import {
  supabase,
} from "../lib/supabase";


export type AdminNavKey =
  | "overview"
  | "accounts"
  | "settings"
  | "public"
  | "verifications"
  | "requests"
  | "audit"
  | "export";


export const DEFAULT_ADMIN_NAV_ORDER:
  AdminNavKey[] = [
    "overview",
    "accounts",
    "settings",
    "public",
    "verifications",
    "requests",
    "audit",
    "export",
  ];


function sanitize(
  value: unknown
): AdminNavKey[] {
  if (!Array.isArray(value)) {
    return [
      ...DEFAULT_ADMIN_NAV_ORDER,
    ];
  }

  const allowed =
    new Set<string>(
      DEFAULT_ADMIN_NAV_ORDER
    );

  const seen =
    new Set<string>();

  const ordered:
    AdminNavKey[] = [];

  for (const candidate of value) {
    if (
      typeof candidate === "string" &&
      allowed.has(candidate) &&
      !seen.has(candidate)
    ) {
      ordered.push(
        candidate as AdminNavKey
      );
      seen.add(candidate);
    }
  }

  for (
    const fallback of
      DEFAULT_ADMIN_NAV_ORDER
  ) {
    if (!seen.has(fallback)) {
      ordered.push(fallback);
    }
  }

  return ordered;
}


export async function loadAdminNavOrder():
  Promise<AdminNavKey[]> {
  const response =
    await supabase
      .from(
        "pm_instance_settings"
      )
      .select(
        "admin_nav_order"
      )
      .order(
        "installed_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .single();

  if (response.error) {
    throw response.error;
  }

  return sanitize(
    response.data
      .admin_nav_order
  );
}


export async function saveAdminNavOrder(
  order: AdminNavKey[]
): Promise<void> {
  const instance =
    await supabase
      .from(
        "pm_instance_settings"
      )
      .select("id")
      .order(
        "installed_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .single();

  if (instance.error) {
    throw instance.error;
  }

  const response =
    await supabase
      .from(
        "pm_instance_settings"
      )
      .update({
        admin_nav_order:
          sanitize(order),
      })
      .eq(
        "id",
        instance.data.id
      );

  if (response.error) {
    throw response.error;
  }
}
