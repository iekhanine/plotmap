import type {
  ReactNode,
} from "react";

import {
  Navigate,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext";

import "../css/Auth.css";


export default function ProtectedRoute({
  children,
  requireUserAdmin = false,
}: {
  children: ReactNode;
  requireUserAdmin?: boolean;
}) {
  const {
    session,
    profile,
    loading,
    profileError,
    demoMode,
    canManageUsers,
    signOut,
  } = useAuth();

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-card compact">
          <div className="auth-brand-mark">
            P
          </div>

          <strong>
            Loading PlotMap…
          </strong>
        </div>
      </div>
    );
  }

  if (
    demoMode &&
    !requireUserAdmin
  ) {
    return children;
  }

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (!profile) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-brand-mark">
            P
          </div>

          <h1>
            Account unavailable
          </h1>

          <p>
            {profileError ||
              "This account is not assigned to this PlotMap installation."}
          </p>

          <button
            type="button"
            className="auth-primary"
            onClick={() =>
              void signOut()
            }
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (
    requireUserAdmin &&
    !canManageUsers
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}
