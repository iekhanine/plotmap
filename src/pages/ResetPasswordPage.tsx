import {
  useState,
} from "react";

import {
  KeyRound,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext";

import "../css/Auth.css";


export default function ResetPasswordPage() {
  const navigate =
    useNavigate();

  const {
    updatePassword,
  } = useAuth();

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirm,
    setConfirm,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const [
    busy,
    setBusy,
  ] = useState(false);


  async function handleSubmit(
    event: any
  ) {
    event.preventDefault();

    if (
      password.length < 10
    ) {
      setError(
        "Use at least 10 characters."
      );
      return;
    }

    if (
      password !==
      confirm
    ) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    try {
      setBusy(
        true
      );
      setError(
        null
      );

      await updatePassword(
        password
      );

      navigate(
        "/",
        {
          replace: true,
        }
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not update password."
      );
    } finally {
      setBusy(
        false
      );
    }
  }


  return (
    <div className="auth-screen">
      <form
        className="auth-card"
        onSubmit={
          handleSubmit
        }
      >
        <div className="auth-heading">
          <KeyRound
            size={18}
          />

          <div>
            <h1>
              Set new password
            </h1>

            <p>
              PlotMap account recovery
            </p>
          </div>
        </div>

        <label>
          New password
        </label>

        <input
          type="password"
          autoComplete="new-password"
          value={
            password
          }
          onChange={
            (event) =>
              setPassword(
                event.target.value
              )
          }
          required
        />

        <label>
          Confirm password
        </label>

        <input
          type="password"
          autoComplete="new-password"
          value={
            confirm
          }
          onChange={
            (event) =>
              setConfirm(
                event.target.value
              )
          }
          required
        />

        {error && (
          <div className="auth-message error">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="auth-primary"
          disabled={
            busy
          }
        >
          {busy
            ? "Saving…"
            : "Update Password"}
        </button>
      </form>
    </div>
  );
}
