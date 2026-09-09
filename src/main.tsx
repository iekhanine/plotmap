import {
  StrictMode,
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

import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import UserAdminPage from "./pages/UserAdminPage";


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
              <LoginPage />
            }
          />

          <Route
            path="/reset-password"
            element={
              <ResetPasswordPage />
            }
          />

          <Route
            path="/admin/users"
            element={
              <ProtectedRoute
                requireUserAdmin
              >
                <UserAdminPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/"
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
