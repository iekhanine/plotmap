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


async function invoke<T>(
  body: Record<string, unknown>
): Promise<T> {
  const response =
    await supabase.functions.invoke(
      "pm-user-admin",
      {
        body,
      }
    );

  if (
    response.error
  ) {
    throw response.error;
  }

  const result =
    response.data as InvokeResult<T>;

  if (
    result?.error
  ) {
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
  role: "manager" | "user";
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


export async function deleteManagedUser(
  memberId: string,
) {
  return invoke<{ deleted: boolean }>({
    action:
      "delete",
    memberId,
  });
}
