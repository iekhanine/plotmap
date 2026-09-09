import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  Session,
  User,
} from "@supabase/supabase-js";

import {
  supabase,
} from "../lib/supabase";


/* ==========================================================
   AUTH 001
   Roles and profile
   ========================================================== */

export type PlotMapRole =
  | "owner"
  | "recovery_owner"
  | "manager"
  | "user";

export type PlotMapPermissions = {
  can_edit_plot_names?: boolean;
};

export type PlotMapProfile = {
  memberId: string;
  organizationId: string;
  userId: string;
  email: string;
  displayName: string | null;
  role: PlotMapRole;
  permissions: PlotMapPermissions;
  active: boolean;
};


type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: PlotMapProfile | null;
  loading: boolean;
  profileError: string | null;
  demoMode: boolean;

  isOwner: boolean;
  canManageUsers: boolean;
  canEditCore: boolean;
  canEditPlotNames: boolean;

  signIn: (
    email: string,
    password: string,
  ) => Promise<void>;

  signOut: () => Promise<void>;

  enterDemo: () => void;
  exitDemo: () => void;

  sendPasswordReset: (
    email: string,
  ) => Promise<void>;

  updatePassword: (
    password: string,
  ) => Promise<void>;

  refreshProfile: () => Promise<void>;
};

const AuthContext =
  createContext<AuthContextValue | null>(
    null
  );

const DEMO_SESSION_KEY =
  "plotmap_demo_mode";


/* ==========================================================
   AUTH 002
   Provider
   ========================================================== */

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [
    session,
    setSession,
  ] = useState<Session | null>(
    null
  );

  const [
    profile,
    setProfile,
  ] = useState<PlotMapProfile | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    profileError,
    setProfileError,
  ] = useState<string | null>(
    null
  );

  const [
    demoMode,
    setDemoMode,
  ] = useState(
    () =>
      window.sessionStorage.getItem(
        DEMO_SESSION_KEY
      ) === "1"
  );

  const lastLoginAuditRef =
    useRef<string | null>(
      null
    );


  function setDemo(
    enabled: boolean,
  ) {
    setDemoMode(
      enabled
    );

    if (enabled) {
      window.sessionStorage.setItem(
        DEMO_SESSION_KEY,
        "1"
      );
    } else {
      window.sessionStorage.removeItem(
        DEMO_SESSION_KEY
      );
    }
  }


  async function hydrateProfile(
    nextSession: Session | null,
  ) {
    setSession(
      nextSession
    );

    if (!nextSession) {
      setProfile(
        null
      );

      setProfileError(
        null
      );

      setLoading(
        false
      );

      return;
    }

    setDemo(
      false
    );

    setLoading(
      true
    );

    const memberResponse =
      await supabase
        .from("pm_members")
        .select(
          "id, organization_id, user_id, role, display_name, permissions, active"
        )
        .eq(
          "user_id",
          nextSession.user.id
        )
        .eq(
          "active",
          true
        )
        .limit(1)
        .maybeSingle();

    if (
      memberResponse.error
    ) {
      setProfile(
        null
      );

      setProfileError(
        memberResponse.error.message
      );

      setLoading(
        false
      );

      return;
    }

    if (
      !memberResponse.data
    ) {
      setProfile(
        null
      );

      setProfileError(
        "This account is not assigned to this PlotMap installation."
      );

      setLoading(
        false
      );

      return;
    }

    const role =
      memberResponse.data.role as PlotMapRole;

    setProfile({
      memberId:
        memberResponse.data.id,

      organizationId:
        memberResponse.data.organization_id,

      userId:
        memberResponse.data.user_id,

      email:
        nextSession.user.email ||
        "",

      displayName:
        memberResponse.data.display_name,

      role,

      permissions:
        (
          memberResponse.data.permissions ||
          {}
        ) as PlotMapPermissions,

      active:
        memberResponse.data.active,
    });

    setProfileError(
      null
    );

    setLoading(
      false
    );
  }


  async function refreshProfile() {
    const response =
      await supabase.auth.getSession();

    await hydrateProfile(
      response.data.session
    );
  }


  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(
        async ({
          data,
        }) => {
          if (!mounted) {
            return;
          }

          await hydrateProfile(
            data.session
          );
        }
      );

    const {
      data: {
        subscription,
      },
    } = supabase.auth.onAuthStateChange(
      (
        event,
        nextSession,
      ) => {
        if (!mounted) {
          return;
        }

        void hydrateProfile(
          nextSession
        );

        if (
          event === "SIGNED_IN" &&
          nextSession?.user.id &&
          lastLoginAuditRef.current !==
            nextSession.user.id
        ) {
          lastLoginAuditRef.current =
            nextSession.user.id;

          window.setTimeout(
            () => {
              void supabase.rpc(
                "pm_log_login"
              );
            },
            0
          );
        }

        if (
          event === "SIGNED_OUT"
        ) {
          lastLoginAuditRef.current =
            null;
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);


  async function signIn(
    email: string,
    password: string,
  ) {
    setDemo(
      false
    );

    const response =
      await supabase.auth.signInWithPassword({
        email:
          email.trim(),
        password,
      });

    if (
      response.error
    ) {
      throw response.error;
    }
  }


  async function signOut() {
    setDemo(
      false
    );

    if (!session) {
      return;
    }

    const response =
      await supabase.auth.signOut();

    if (
      response.error
    ) {
      throw response.error;
    }
  }


  function enterDemo() {
    setDemo(
      true
    );
  }


  function exitDemo() {
    setDemo(
      false
    );
  }


  async function sendPasswordReset(
    email: string,
  ) {
    const response =
      await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo:
            `${window.location.origin}/reset-password`,
        }
      );

    if (
      response.error
    ) {
      throw response.error;
    }
  }


  async function updatePassword(
    password: string,
  ) {
    const response =
      await supabase.auth.updateUser({
        password,
      });

    if (
      response.error
    ) {
      throw response.error;
    }
  }


  const capabilities =
    useMemo(() => {
      if (demoMode) {
        return {
          isOwner: false,
          canEditCore: false,
          canManageUsers: false,
          canEditPlotNames: false,
        };
      }

      const role =
        profile?.role;

      const isOwner =
        role === "owner" ||
        role ===
          "recovery_owner";

      const canEditCore =
        isOwner ||
        role === "manager";

      const canManageUsers =
        canEditCore;

      const canEditPlotNames =
        canEditCore ||
        Boolean(
          profile?.permissions
            ?.can_edit_plot_names
        );

      return {
        isOwner,
        canEditCore,
        canManageUsers,
        canEditPlotNames,
      };
    }, [
      profile,
      demoMode,
    ]);


  return (
    <AuthContext.Provider
      value={{
        session,
        user:
          session?.user ||
          null,
        profile,
        loading,
        profileError,
        demoMode,

        ...capabilities,

        signIn,
        signOut,
        enterDemo,
        exitDemo,
        sendPasswordReset,
        updatePassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


/* ==========================================================
   AUTH 003
   Hook
   ========================================================== */

export function useAuth() {
  const value =
    useContext(
      AuthContext
    );

  if (!value) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return value;
}
