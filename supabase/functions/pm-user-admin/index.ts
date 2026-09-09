import {
  createClient,
} from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};


type Role =
  | "owner"
  | "recovery_owner"
  | "manager"
  | "user";


type Requester = {
  userId: string;
  memberId: string;
  organizationId: string;
  role: Role;
};


function json(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(
      body
    ),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    }
  );
}


Deno.serve(
  async (request) => {
    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        }
      );
    }

    if (
      request.method !==
      "POST"
    ) {
      return json(
        {
          error:
            "Method not allowed",
        },
        405
      );
    }

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL"
      );


    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return json(
        {
          error:
            "PlotMap server configuration is incomplete.",
        },
        500
      );
    }

    const authorization =
      request.headers.get(
        "Authorization"
      );

    if (!authorization) {
      return json(
        {
          error:
            "Authentication required.",
        },
        401
      );
    }


    const service =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession:
              false,
            autoRefreshToken:
              false,
          },
        }
      );

    try {
      const accessToken =
        authorization.replace(
          /^Bearer\s+/i,
          ""
        );

      if (!accessToken) {
        return json(
          {
            error:
              "Authentication token is missing.",
          },
          401
        );
      }

      const userResponse =
        await service.auth.getUser(
          accessToken
        );

      if (
        userResponse.error ||
        !userResponse.data.user
      ) {
        return json(
          {
            error:
              userResponse.error?.message ||
              "Invalid or expired PlotMap session.",
          },
          401
        );
      }

      const requesterUser =
        userResponse.data.user;

      const memberResponse =
        await service
          .from("pm_members")
          .select(
            "id, organization_id, role, active"
          )
          .eq(
            "user_id",
            requesterUser.id
          )
          .eq(
            "active",
            true
          )
          .limit(1)
          .maybeSingle();

      if (
        memberResponse.error ||
        !memberResponse.data
      ) {
        return json(
          {
            error:
              "Account is not assigned to this PlotMap installation.",
          },
          403
        );
      }

      const requester:
        Requester = {
          userId:
            requesterUser.id,
          memberId:
            memberResponse.data.id,
          organizationId:
            memberResponse.data.organization_id,
          role:
            memberResponse.data.role as Role,
        };

      if (
        ![
          "owner",
          "recovery_owner",
          "manager",
        ].includes(
          requester.role
        )
      ) {
        return json(
          {
            error:
              "Account administration is not permitted for this role.",
          },
          403
        );
      }

      const body =
        await request.json();

      const action =
        String(
          body.action ||
          ""
        );

      const isOwner =
        requester.role ===
          "owner" ||
        requester.role ===
          "recovery_owner";

      async function audit(
        actionName: string,
        entityId: string | null,
        details: Record<string, unknown>,
      ) {
        await service
          .from("pm_audit_log")
          .insert({
            organization_id:
              requester.organizationId,
            user_id:
              requester.userId,
            action:
              actionName,
            entity_type:
              "member",
            entity_id:
              entityId,
            details,
          });
      }

      if (
        action === "list"
      ) {
        let query =
          service
            .from("pm_members")
            .select(
              "id, user_id, display_name, role, active, permissions, created_at"
            )
            .eq(
              "organization_id",
              requester.organizationId
            )
            .order(
              "created_at"
            );

        if (!isOwner) {
          query =
            query.eq(
              "role",
              "user"
            );
        }

        const membersResponse =
          await query;

        if (
          membersResponse.error
        ) {
          throw membersResponse.error;
        }

        const authListResponse =
          await service.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          });

        if (
          authListResponse.error
        ) {
          throw authListResponse.error;
        }

        const emailByUserId =
          new Map(
            authListResponse.data.users.map(
              (user) => [
                user.id,
                user.email || "",
              ]
            )
          );

        const result =
          (
            membersResponse.data ||
            []
          ).map(
            (member) => ({
              memberId:
                member.id,
              userId:
                member.user_id,
              email:
                emailByUserId.get(
                  member.user_id
                ) ||
                "",
              displayName:
                member.display_name,
              role:
                member.role,
              active:
                member.active,
              canEditPlotNames:
                Boolean(
                  member.permissions
                    ?.can_edit_plot_names
                ),
              createdAt:
                member.created_at,
            })
          );

        return json({
          data:
            result,
        });
      }

      if (
        action === "create"
      ) {
        const email =
          String(
            body.email ||
            ""
          )
            .trim()
            .toLowerCase();

        const password =
          String(
            body.password ||
            ""
          );

        const displayName =
          String(
            body.displayName ||
            ""
          ).trim();

        const requestedRole =
          String(
            body.role ||
            "user"
          ) as Role;

        const role:
          "manager" | "user" =
          isOwner &&
          requestedRole ===
            "manager"
            ? "manager"
            : "user";

        if (
          !email ||
          !displayName
        ) {
          return json(
            {
              error:
                "Display name and email are required.",
            },
            400
          );
        }

        if (
          password.length <
          10
        ) {
          return json(
            {
              error:
                "Temporary password must be at least 10 characters.",
            },
            400
          );
        }

        const authCreate =
          await service.auth.admin.createUser({
            email,
            password,
            email_confirm:
              true,
            user_metadata: {
              display_name:
                displayName,
            },
          });

        if (
          authCreate.error ||
          !authCreate.data.user
        ) {
          throw authCreate.error ||
            new Error(
              "Could not create authentication account."
            );
        }

        const createdUser =
          authCreate.data.user;

        const memberInsert =
          await service
            .from("pm_members")
            .insert({
              organization_id:
                requester.organizationId,
              user_id:
                createdUser.id,
              role,
              display_name:
                displayName,
              active:
                true,
              created_by:
                requester.userId,
              permissions: {
                can_edit_plot_names:
                  role === "user" &&
                  Boolean(
                    body.canEditPlotNames
                  ),
              },
            })
            .select(
              "id, user_id, display_name, role, active, permissions, created_at"
            )
            .single();

        if (
          memberInsert.error
        ) {
          await service.auth.admin.deleteUser(
            createdUser.id
          );

          throw memberInsert.error;
        }

        await audit(
          "user.create",
          memberInsert.data.id,
          {
            email,
            role,
          }
        );

        return json({
          data: {
            memberId:
              memberInsert.data.id,
            userId:
              createdUser.id,
            email,
            displayName:
              memberInsert.data.display_name,
            role:
              memberInsert.data.role,
            active:
              memberInsert.data.active,
            canEditPlotNames:
              Boolean(
                memberInsert.data.permissions
                  ?.can_edit_plot_names
              ),
            createdAt:
              memberInsert.data.created_at,
          },
        });
      }

      if (
        action === "update" ||
        action === "delete"
      ) {
        const memberId =
          String(
            body.memberId ||
            ""
          );

        const targetResponse =
          await service
            .from("pm_members")
            .select(
              "id, user_id, role, active, permissions"
            )
            .eq(
              "id",
              memberId
            )
            .eq(
              "organization_id",
              requester.organizationId
            )
            .maybeSingle();

        if (
          targetResponse.error ||
          !targetResponse.data
        ) {
          return json(
            {
              error:
                "Target account was not found.",
            },
            404
          );
        }

        const target =
          targetResponse.data;

        const targetRole =
          target.role as Role;

        if (
          targetRole ===
            "owner" ||
          targetRole ===
            "recovery_owner" ||
          target.user_id ===
            requester.userId
        ) {
          return json(
            {
              error:
                "Owner and Recovery Owner accounts cannot be modified here.",
            },
            403
          );
        }

        if (
          requester.role ===
            "manager" &&
          targetRole !==
            "user"
        ) {
          return json(
            {
              error:
                "Managers may only administer User accounts.",
            },
            403
          );
        }

        if (
          action ===
          "delete"
        ) {
          await audit(
            "user.delete",
            target.id,
            {
              target_user_id:
                target.user_id,
              target_role:
                targetRole,
            }
          );

          const deleteResponse =
            await service.auth.admin.deleteUser(
              target.user_id
            );

          if (
            deleteResponse.error
          ) {
            throw deleteResponse.error;
          }

          return json({
            data: {
              deleted: true,
            },
          });
        }

        const requestedRole =
          String(
            body.role ||
            targetRole
          );

        const nextRole:
          "manager" | "user" =
          isOwner &&
          requestedRole ===
            "manager"
            ? "manager"
            : "user";

        const nextActive =
          typeof body.active ===
          "boolean"
            ? body.active
            : target.active;

        const nextPermissions = {
          can_edit_plot_names:
            nextRole === "user" &&
            Boolean(
              body.canEditPlotNames
            ),
        };

        const updateResponse =
          await service
            .from("pm_members")
            .update({
              role:
                nextRole,
              active:
                nextActive,
              permissions:
                nextPermissions,
            })
            .eq(
              "id",
              target.id
            )
            .select(
              "id, user_id, display_name, role, active, permissions, created_at"
            )
            .single();

        if (
          updateResponse.error
        ) {
          throw updateResponse.error;
        }

        const authResponse =
          await service.auth.admin.getUserById(
            target.user_id
          );

        await audit(
          "user.update",
          target.id,
          {
            role:
              nextRole,
            active:
              nextActive,
            can_edit_plot_names:
              nextPermissions.can_edit_plot_names,
          }
        );

        return json({
          data: {
            memberId:
              updateResponse.data.id,
            userId:
              updateResponse.data.user_id,
            email:
              authResponse.data.user?.email ||
              "",
            displayName:
              updateResponse.data.display_name,
            role:
              updateResponse.data.role,
            active:
              updateResponse.data.active,
            canEditPlotNames:
              Boolean(
                updateResponse.data.permissions
                  ?.can_edit_plot_names
              ),
            createdAt:
              updateResponse.data.created_at,
          },
        });
      }

      return json(
        {
          error:
            "Unknown action.",
        },
        400
      );
    } catch (error) {
      console.error(
        "pm-user-admin:",
        error
      );

      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "PlotMap account administration failed.",
        },
        500
      );
    }
  }
);
