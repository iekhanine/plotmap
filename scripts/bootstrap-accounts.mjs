import {
  createClient,
} from "@supabase/supabase-js";


function required(
  name,
) {
  const value =
    process.env[name];

  if (!value) {
    throw new Error(
      `Missing ${name}`
    );
  }

  return value;
}


const supabaseUrl =
  required(
    "SUPABASE_URL"
  );

const serviceRoleKey =
  required(
    "SUPABASE_SERVICE_ROLE_KEY"
  );

const organizationSlug =
  required(
    "PLOTMAP_ORGANIZATION_SLUG"
  );

const cemeterySlug =
  required(
    "PLOTMAP_CEMETERY_SLUG"
  );

const instanceName =
  required(
    "PLOTMAP_INSTANCE_NAME"
  );

const owner = {
  email:
    required(
      "PLOTMAP_OWNER_EMAIL"
    ).toLowerCase(),
  password:
    required(
      "PLOTMAP_OWNER_PASSWORD"
    ),
  displayName:
    required(
      "PLOTMAP_OWNER_NAME"
    ),
};

const recoveryOwner = {
  email:
    required(
      "PLOTMAP_RECOVERY_EMAIL"
    ).toLowerCase(),
  password:
    required(
      "PLOTMAP_RECOVERY_PASSWORD"
    ),
  displayName:
    required(
      "PLOTMAP_RECOVERY_NAME"
    ),
};

if (
  owner.password.length <
    14 ||
  recoveryOwner.password.length <
    14
) {
  throw new Error(
    "Owner and Recovery Owner passwords must be at least 14 characters."
  );
}

if (
  owner.email ===
  recoveryOwner.email
) {
  throw new Error(
    "Owner and Recovery Owner must use different email addresses."
  );
}

const supabase =
  createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );


async function findAuthUser(
  email,
) {
  for (
    let page = 1;
    page <= 20;
    page += 1
  ) {
    const response =
      await supabase.auth.admin.listUsers({
        page,
        perPage: 100,
      });

    if (
      response.error
    ) {
      throw response.error;
    }

    const match =
      response.data.users.find(
        (user) =>
          user.email?.toLowerCase() ===
          email
      );

    if (match) {
      return match;
    }

    if (
      response.data.users.length <
      100
    ) {
      break;
    }
  }

  return null;
}


async function ensureAuthUser(
  account,
) {
  const existing =
    await findAuthUser(
      account.email
    );

  if (existing) {
    const update =
      await supabase.auth.admin.updateUserById(
        existing.id,
        {
          password:
            account.password,
          email_confirm:
            true,
          user_metadata: {
            ...existing.user_metadata,
            display_name:
              account.displayName,
          },
        }
      );

    if (
      update.error
    ) {
      throw update.error;
    }

    return existing.id;
  }

  const create =
    await supabase.auth.admin.createUser({
      email:
        account.email,
      password:
        account.password,
      email_confirm:
        true,
      user_metadata: {
        display_name:
          account.displayName,
      },
    });

  if (
    create.error ||
    !create.data.user
  ) {
    throw create.error ||
      new Error(
        `Could not create ${account.email}`
      );
  }

  return create.data.user.id;
}


async function main() {
  console.log(
    "PlotMap account bootstrap"
  );

  const organizationResponse =
    await supabase
      .from("pm_organizations")
      .select("id, name")
      .eq(
        "slug",
        organizationSlug
      )
      .single();

  if (
    organizationResponse.error
  ) {
    throw organizationResponse.error;
  }

  const organization =
    organizationResponse.data;

  const cemeteryResponse =
    await supabase
      .from("pm_cemeteries")
      .select("id, name")
      .eq(
        "organization_id",
        organization.id
      )
      .eq(
        "slug",
        cemeterySlug
      )
      .single();

  if (
    cemeteryResponse.error
  ) {
    throw cemeteryResponse.error;
  }

  const cemetery =
    cemeteryResponse.data;

  const ownerUserId =
    await ensureAuthUser(
      owner
    );

  const recoveryUserId =
    await ensureAuthUser(
      recoveryOwner
    );

  const membersResponse =
    await supabase
      .from("pm_members")
      .upsert(
        [
          {
            organization_id:
              organization.id,
            user_id:
              ownerUserId,
            role:
              "owner",
            display_name:
              owner.displayName,
            active:
              true,
            permissions: {},
          },
          {
            organization_id:
              organization.id,
            user_id:
              recoveryUserId,
            role:
              "recovery_owner",
            display_name:
              recoveryOwner.displayName,
            active:
              true,
            permissions: {},
          },
        ],
        {
          onConflict:
            "organization_id,user_id",
        }
      );

  if (
    membersResponse.error
  ) {
    throw membersResponse.error;
  }

  const settingsResponse =
    await supabase
      .from("pm_instance_settings")
      .upsert(
        {
          organization_id:
            organization.id,
          cemetery_id:
            cemetery.id,
          instance_name:
            instanceName,
          recovery_owner_user_id:
            recoveryUserId,
        },
        {
          onConflict:
            "organization_id",
        }
      );

  if (
    settingsResponse.error
  ) {
    throw settingsResponse.error;
  }

  console.log("");
  console.log(
    `Instance: ${instanceName}`
  );
  console.log(
    `Cemetery: ${cemetery.name}`
  );
  console.log(
    `Owner: ${owner.email}`
  );
  console.log(
    `Recovery Owner: ${recoveryOwner.email}`
  );
  console.log("");
  console.log(
    "Bootstrap complete."
  );
  console.log(
    "Store Recovery Owner credentials offline and delete .env.bootstrap from the deployment machine."
  );
}


main().catch(
  (error) => {
    console.error(
      error
    );
    process.exit(1);
  }
);
