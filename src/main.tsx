import {
  StrictMode,
  type ReactNode,
} from "react";

import {
  createRoot,
} from "react-dom/client";

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import "ol/ol.css";
import "./index.css";

import App from "./App.tsx";

import ProtectedRoute from "./components/ProtectedRoute";

import {
  AuthProvider,
} from "./context/AuthContext";

import AdminAuditPage from "./pages/AdminAuditPage";
import AdminCemeterySettingsPage from "./pages/AdminCemeterySettingsPage";
import AdminExportPage from "./pages/AdminExportPage";
import AdminOverviewPage from "./pages/AdminOverviewPage";
import AdminPublicSettingsPage from "./pages/AdminPublicSettingsPage";
import AdminRequestsPage from "./pages/AdminRequestsPage";
import LoginPage from "./pages/LoginPage";
import PublicSearchPage from "./pages/PublicSearchPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import UserAdminPage from "./pages/UserAdminPage";


function AdminRoute({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ProtectedRoute
      requireUserAdmin
    >
      {children}
    </ProtectedRoute>
  );
}


createRoot(
  document.getElementById(
    "root"
  )!
).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <Navigate
                to="/#staff-access"
                replace
              />
            }
          />

          <Route
            path="/reset-password"
            element={
              <ResetPasswordPage />
            }
          />

          <Route
            path="/find"
            element={
              <PublicSearchPage />
            }
          />

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminOverviewPage />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UserAdminPage />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/settings"
            element={
              <AdminRoute>
                <AdminCemeterySettingsPage />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/public"
            element={
              <AdminRoute>
                <AdminPublicSettingsPage />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/requests"
            element={
              <AdminRoute>
                <AdminRequestsPage />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/audit"
            element={
              <AdminRoute>
                <AdminAuditPage />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/export"
            element={
              <AdminRoute>
                <AdminExportPage />
              </AdminRoute>
            }
          />

          <Route
            path="/"
            element={
              <LoginPage />
            }
          />

          <Route
            path="/staff"
            element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            }
          />

          <Route
            path="*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
