import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  Building2,
  Eye,
  LockKeyhole,
  MapPin,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext";

import {
  loadPublicPortalConfig,
} from "../services/publicPortal";

import type {
  PublicPortalConfig,
} from "../types/publicPortal";

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

  const [portalConfig, setPortalConfig] =
    useState<PublicPortalConfig | null>(
      null
    );

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(
      null
    );

  const [error, setError] =
    useState<string | null>(
      null
    );

  const fallbackInstanceName =
    import.meta.env
      .VITE_INSTANCE_NAME ||
    "PlotMap";

  const instanceName =
    portalConfig?.instanceName ||
    fallbackInstanceName;

  const cemeteryName =
    portalConfig?.cemetery.name ||
    instanceName;

  const demoEnabled =
    portalConfig
      ? portalConfig.demoEnabled
      : import.meta.env
          .VITE_DEMO_ENABLED !==
        "false";

  const publicEnabled =
    portalConfig?.publicEnabled ??
    false;

  const cemeteryDescription =
    portalConfig?.cemetery.description ||
    "Memorial records, mapping, and visitor information.";

  const address =
    useMemo(() => {
      if (!portalConfig) {
        return "";
      }

      return [
        portalConfig.cemetery.addressLine1,
        portalConfig.cemetery.city,
        portalConfig.cemetery.state,
        portalConfig.cemetery.postalCode,
      ]
        .filter(Boolean)
        .join(", ");
    }, [portalConfig]);

  useEffect(() => {
    if (
      session &&
      profile
    ) {
      navigate(
        "/staff",
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

  useEffect(() => {
    let active = true;

    void loadPublicPortalConfig()
      .then(
        (config) => {
          if (active) {
            setPortalConfig(
              config
            );
          }
        }
      )
      .catch(() => {
        // Staff sign-in remains available if public branding cannot load.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      window.location.hash ===
      "#staff-access"
    ) {
      window.setTimeout(
        () => {
          document
            .getElementById(
              "staff-access"
            )
            ?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
        },
        0
      );
    }
  }, []);

  async function handleSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    try {
      setBusy(true);
      setError(null);
      setMessage(null);

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
      setBusy(false);
    }
  }

  function handleDemo() {
    setError(null);
    setMessage(null);

    enterDemo();

    navigate(
      "/staff",
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
      setBusy(true);
      setError(null);

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
      setBusy(false);
    }
  }

  return (
    <div className="client-site-shell">
      <header className="client-site-header">
        <div className="client-site-brand">
          <div className="client-site-brand-mark">
            <MapPin size={18} />
          </div>
          <div>
            <strong>{cemeteryName}</strong>
            <span>{portalConfig?.headerSubtitle || "Memorial Records & Mapping"}</span>
          </div>
        </div>

        <nav className="client-site-nav">
          {publicEnabled && (
            <button
              type="button"
              onClick={() => navigate("/find")}
            >
              <Search size={13} /> Find a Loved One
            </button>
          )}

          <button
            type="button"
            className="primary"
            onClick={() =>
              document
                .getElementById("staff-access")
                ?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                })
            }
          >
            <LockKeyhole size={13} /> Staff Access
          </button>
        </nav>
      </header>

      <main className="client-site-main">
        <section className="client-site-hero">
          <div className="client-site-hero-copy">
            <span className="client-site-eyebrow">MEMORIAL INFORMATION & RECORDS</span>
            <h1>{cemeteryName}</h1>
            <p>{cemeteryDescription}</p>

            <div className="client-site-hero-actions">
              {publicEnabled && (
                <button
                  type="button"
                  className="client-site-primary-action"
                  onClick={() => navigate("/find")}
                >
                  <Search size={15} /> Search Memorial Records
                </button>
              )}

              <button
                type="button"
                className="client-site-secondary-action"
                onClick={() =>
                  document
                    .getElementById("staff-access")
                    ?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    })
                }
              >
                <LockKeyhole size={15} /> Employee Sign In
              </button>
            </div>

            {(address || portalConfig?.contactEmail || portalConfig?.contactPhone) && (
              <div className="client-site-contact-strip">
                {address && <span><MapPin size={12} /> {address}</span>}
                {portalConfig?.contactEmail && <a href={`mailto:${portalConfig.contactEmail}`}>{portalConfig.contactEmail}</a>}
                {portalConfig?.contactPhone && <a href={`tel:${portalConfig.contactPhone}`}>{portalConfig.contactPhone}</a>}
              </div>
            )}
          </div>

          <div className="client-site-hero-panel">
            <div className="client-site-map-art">
              <div className="client-site-map-grid" />
              <MapPin size={34} />
              <strong>Interactive Memorial Map</strong>
              <span>Mapped burial records, searchable memorials, and staff-managed grounds data.</span>
            </div>
          </div>
        </section>

        <section className="client-site-feature-grid">
          {publicEnabled && (
            <button
              type="button"
              className="client-site-feature-card interactive"
              onClick={() => navigate("/find")}
            >
              <Search size={20} />
              <strong>Find a Loved One</strong>
              <span>Search public burial records or browse the cemetery map and click a grave to view available memorial information.</span>
            </button>
          )}

          <div className="client-site-feature-card">
            <Building2 size={20} />
            <strong>Site Information</strong>
            <span>{address || "Location and visitor information are managed directly by staff."}</span>
          </div>

          <div className="client-site-feature-card">
            <ShieldCheck size={20} />
            <strong>Privacy Controlled by the Organization</strong>
            <span>Public records can be enabled or hidden by the organization, including individual memorial privacy requests from families.</span>
          </div>
        </section>

        <section className="client-site-staff-section" id="staff-access">
          <div className="client-site-staff-copy">
            <span className="client-site-eyebrow">STAFF PORTAL</span>
            <h2>Management Access</h2>
            <p>
              PlotMap staff access is reserved for authorized owners, managers, and employees. Sign in to manage records, mapping, accounts, and administrative settings.
            </p>

            <div className="client-site-role-list">
              <span><Users size={13} /> Owner / Manager / Staff accounts</span>
              <span><ShieldCheck size={13} /> Role-based permissions</span>
              <span><MapPin size={13} /> Memorial mapping and record management</span>
            </div>

            {demoEnabled && (
              <button
                type="button"
                className="client-site-demo-action"
                onClick={handleDemo}
              >
                <Eye size={14} /> Open Read-Only Demo View
              </button>
            )}
          </div>

          <form
            className="auth-card client-site-login-card"
            onSubmit={handleSubmit}
          >
            <div className="auth-brand-row">
              <div className="auth-brand-icon">
                <LockKeyhole size={18} />
              </div>
              <div>
                <strong>Staff Sign In</strong>
                <span>{instanceName}</span>
              </div>
            </div>

            <label>Email</label>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <label>Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            {error && (
              <div className="auth-message error">{error}</div>
            )}

            {message && (
              <div className="auth-message success">{message}</div>
            )}

            <button
              type="submit"
              className="auth-primary"
              disabled={busy}
            >
              {busy ? "Signing In…" : "Sign In"}
            </button>

            <button
              type="button"
              className="auth-link-button"
              disabled={busy}
              onClick={() => void handleReset()}
            >
              Forgot password?
            </button>

            <div className="auth-footer-note">
              Authorized personnel only. Public visitors do not need an account to use enabled memorial-search features.
            </div>
          </form>
        </section>
      </main>

      <footer className="client-site-footer">
        <div>
          <strong>{cemeteryName}</strong>
          <span>{address || "Memorial records and visitor information"}</span>
        </div>
        <div>
          <span>Powered by PlotMap</span>
        </div>
      </footer>
    </div>
  );
}
