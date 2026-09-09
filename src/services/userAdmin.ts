import {
  supabase,
} from "../lib/supabase";

import type {
  PlotMapRole,
} from "../context/AuthContext";


export type ManagedUser = {
  memberId: string;
  userId: string;
  email: string;
  displayName: string | null;
  role: PlotMapRole;
  active: boolean;
  canEditPlotNames: boolean;
  createdAt: string;
};


type InvokeResult<T> = {
  data?: T;
  error?: string;
};


async function getAccessToken() {
  const response =
    await supabase.auth
      .getSession();

  if (response.error) {
    throw response.error;
  }

  const session =
    response.data.session;

  if (!session) {
    throw new Error(
      "Your PlotMap session is not available. Sign out and sign in again."
    );
  }

  return session.access_token;
}


async function edgeFunctionErrorMessage(
  error: unknown
) {
  const fallback =
    error instanceof Error
      ? error.message
      : "PlotMap account administration failed.";

  const context =
    (
      error as {
        context?: unknown;
      } | null
    )?.context;

  if (
    typeof Response !==
      "undefined" &&
    context instanceof Response
  ) {
    try {
      const body =
        await context
          .clone()
          .json();

      if (
        body &&
        typeof body ===
          "object" &&
        "error" in body &&
        typeof (
          body as {
            error?: unknown;
          }
        ).error ===
          "string"
      ) {
        return (
          body as {
            error: string;
          }
        ).error;
      }
    } catch {
      try {
        const text =
          await context
            .clone()
            .text();

        if (text.trim()) {
          return text.trim();
        }
      } catch {
        // Use fallback.
      }
    }
  }

  return fallback;
}


async function invoke<T>(
  body: Record<string, unknown>
): Promise<T> {
  const accessToken =
    await getAccessToken();

  const response =
    await supabase.functions.invoke(
      "pm-user-admin",
      {
        body,
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      }
    );

  if (response.error) {
    throw new Error(
      await edgeFunctionErrorMessage(
        response.error
      )
    );
  }

  const result =
    response.data as
      InvokeResult<T>;

  if (result?.error) {
    throw new Error(
      result.error
    );
  }

  if (
    result?.data ===
    undefined
  ) {
    throw new Error(
      "PlotMap user administration returned no data."
    );
  }

  return result.data;
}


export async function listManagedUsers() {
  return invoke<ManagedUser[]>({
    action:
      "list",
  });
}


export async function createManagedUser(input: {
  email: string;
  password: string;
  displayName: string;
  role:
    | "recovery_owner"
    | "manager"
    | "user";
  canEditPlotNames: boolean;
}) {
  return invoke<ManagedUser>({
    action:
      "create",
    ...input,
  });
}


export async function updateManagedUser(input: {
  memberId: string;
  role: "manager" | "user";
  active: boolean;
  canEditPlotNames: boolean;
}) {
  return invoke<ManagedUser>({
    action:
      "update",
    ...input,
  });
}


export async function updateManagedIdentity(input: {
  memberId: string;
  displayName: string;
  email?: string;
  password?: string;
}) {
  return invoke<ManagedUser>({
    action:
      "update_identity",
    ...input,
  });
}


export async function deleteManagedUser(
  memberId: string,
) {
  return invoke<{
    deleted: boolean;
  }>({
    action:
      "delete",
    memberId,
  });
}
