import {
  useEffect,
  useState,
} from "react";

import {
  Eye,
  LockKeyhole,
  MapPin,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext";

import "../css/Auth.css";


export default function LoginPage() {
  const navigate =
    useNavigate();

  const {
    session,
    profile,
    signIn,
    enterDemo,
    sendPasswordReset,
  } = useAuth();

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState<string | null>(
    null
  );

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const instanceName =
    import.meta.env
      .VITE_INSTANCE_NAME ||
    "PlotMap";

  const demoEnabled =
    import.meta.env
      .VITE_DEMO_ENABLED !==
    "false";


  useEffect(() => {
    if (
      session &&
      profile
    ) {
      navigate(
        "/",
        {
          replace: true,
        }
      );
    }
  }, [
    session,
    profile,
    navigate,
  ]);


  async function handleSubmit(
    event: any
  ) {
    event.preventDefault();

    try {
      setBusy(
        true
      );
      setError(
        null
      );
      setMessage(
        null
      );

      await signIn(
        email,
        password
      );
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Sign in failed."
      );
    } finally {
      setBusy(
        false
      );
    }
  }


  function handleDemo() {
    setError(
      null
    );
    setMessage(
      null
    );

    enterDemo();

    navigate(
      "/",
      {
        replace: true,
      }
    );
  }


  async function handleReset() {
    if (!email.trim()) {
      setError(
        "Enter your email address first."
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

      await sendPasswordReset(
        email
      );

      setMessage(
        "Password reset instructions were sent if that account exists."
      );
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Could not send password reset."
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
        <div className="auth-brand-row">
          <div className="auth-brand-icon">
            <MapPin
              size={19}
            />
          </div>

          <div>
            <strong>
              PlotMap
            </strong>

            <span>
              {instanceName}
            </span>
          </div>
        </div>

        <div className="auth-heading">
          <LockKeyhole
            size={17}
          />

          <div>
            <h1>
              Sign in
            </h1>

            <p>
              Local PlotMap account
            </p>
          </div>
        </div>

        <label>
          Email
        </label>

        <input
          type="email"
          autoComplete="username"
          value={
            email
          }
          onChange={
            (event) =>
              setEmail(
                event.target.value
              )
          }
          required
        />

        <label>
          Password
        </label>

        <input
          type="password"
          autoComplete="current-password"
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

        {error && (
          <div className="auth-message error">
            {error}
          </div>
        )}

        {message && (
          <div className="auth-message success">
            {message}
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
            ? "Signing in…"
            : "Sign In"}
        </button>

        <button
          type="button"
          className="auth-link-button"
          disabled={
            busy
          }
          onClick={
            handleReset
          }
        >
          Forgot password?
        </button>

        {demoEnabled && (
          <div className="auth-demo-section">
            <div className="auth-demo-divider">
              <span>
                DEMO
              </span>
            </div>

            <div className="auth-demo-copy">
              <Eye
                size={15}
              />

              <div>
                <strong>
                  Explore the live prototype
                </strong>

                <span>
                  Search the cemetery, inspect plots, and view person records without making changes.
                </span>
              </div>
            </div>

            <button
              type="button"
              className="auth-demo-button"
              disabled={
                busy
              }
              onClick={
                handleDemo
              }
            >
              <Eye
                size={13}
              />
              Open Demo View
            </button>
          </div>
        )}

        <div className="auth-footer-note">
          Accounts are created by this cemetery's PlotMap administrator. Public registration is disabled.
        </div>
      </form>
    </div>
  );
}
