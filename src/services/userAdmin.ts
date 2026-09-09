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
  let sessionResponse =
    await supabase.auth.getSession();

  if (sessionResponse.error) {
    throw sessionResponse.error;
  }

  let session =
    sessionResponse.data.session;

  if (!session) {
    throw new Error(
      "Your PlotMap session has expired. Sign in again."
    );
  }

  const expiresAt =
    session.expires_at
      ? session.expires_at * 1000
      : null;

  if (
    expiresAt &&
    expiresAt <
      Date.now() + 60_000
  ) {
    const refreshResponse =
      await supabase.auth.refreshSession();

    if (refreshResponse.error) {
      throw refreshResponse.error;
    }

    session =
      refreshResponse.data.session;

    if (!session) {
      throw new Error(
        "Your PlotMap session could not be refreshed. Sign in again."
      );
    }
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
        // Use the original Functions error below.
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
