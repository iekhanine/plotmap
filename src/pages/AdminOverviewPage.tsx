import {
  useEffect,
  useState,
} from "react";

import {
  ClipboardList,
  Database,
  MapPin,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";

import AdminShell from "../components/AdminShell";

import {
  loadAdminOverview,
  loadAdminSettings,
} from "../services/admin";

import type {
  AdminOverviewStats,
  AdminSettingsBundle,
} from "../types/admin";


export default function AdminOverviewPage() {
  const [
    stats,
    setStats,
  ] = useState<AdminOverviewStats | null>(null);

  const [
    settings,
    setSettings,
  ] = useState<AdminSettingsBundle | null>(null);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      loadAdminOverview(),
      loadAdminSettings(),
    ])
      .then(
        ([nextStats, nextSettings]) => {
          setStats(nextStats);
          setSettings(nextSettings);
        }
      )
      .catch(
        (loadError) =>
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load administration overview."
          )
      );
  }, []);

  return (
    <AdminShell
      eyebrow="INSTANCE CONTROL"
      title="Administration"
      description="One place for cemetery identity, staff access, public family search, requests, audit history, and customer-owned exports."
    >
      {error && (
        <div className="admin-message-v15 error">
          {error}
        </div>
      )}

      <section className="admin-stat-grid-v15">
        <div className="admin-stat-v15">
          <span>Plots</span>
          <strong>{stats?.plots ?? "—"}</strong>
        </div>

        <div className="admin-stat-v15">
          <span>Occupied</span>
          <strong>{stats?.occupiedPlots ?? "—"}</strong>
        </div>

        <div className="admin-stat-v15">
          <span>People</span>
          <strong>{stats?.people ?? "—"}</strong>
        </div>

        <div className="admin-stat-v15">
          <span>Family requests</span>
          <strong>{stats?.pendingCorrections ?? "—"}</strong>
        </div>

        <div className="admin-stat-v15">
          <span>Field checks</span>
          <strong>{stats?.fieldVerifications ?? "—"}</strong>
        </div>
      </section>

      <section className="admin-card-v15 admin-card-pad-v15">
        <div className="admin-grid-3-v15">
          <Link className="admin-export-card-v15" to="/admin/settings">
            <MapPin size={18} />
            <strong>Cemetery Settings</strong>
            <span>
              Rename the cemetery, change the address, description, instance title, and demo behavior.
            </span>
          </Link>

          <Link className="admin-export-card-v15" to="/admin/public">
            <UserRound size={18} />
            <strong>Public Family Search</strong>
            <span>
              Control exactly what families can search, see, and submit without a login.
            </span>
          </Link>

          <Link className="admin-export-card-v15" to="/admin/requests">
            <ClipboardList size={18} />
            <strong>Family Requests</strong>
            <span>
              Review suggested corrections and follow up with family members from one queue.
            </span>
          </Link>

          <Link className="admin-export-card-v15" to="/admin/users">
            <ShieldCheck size={18} />
            <strong>Accounts & Permissions</strong>
            <span>
              Create Managers and Users and keep the Recovery Owner protected.
            </span>
          </Link>

          <Link className="admin-export-card-v15" to="/admin/audit">
            <Database size={18} />
            <strong>Audit History</strong>
            <span>
              See sign-ins and important record changes with before/after data.
            </span>
          </Link>

          <Link className="admin-export-card-v15" to="/admin/export">
            <Database size={18} />
            <strong>Backup & Export</strong>
            <span>
              Download a customer-owned JSON backup, burial CSV, or GeoJSON map export.
            </span>
          </Link>
        </div>
      </section>

      {settings && (
        <section className="admin-card-v15 admin-card-pad-v15">
          <div className="admin-grid-2-v15">
            <div>
              <span className="admin-eyebrow-v15">CURRENT INSTANCE</span>
              <h3>{settings.instance.instance_name}</h3>
              <p className="admin-note-v15">
                {settings.cemetery.name} · {settings.cemetery.city || "No city"}, {settings.cemetery.state || "No state"}
              </p>
            </div>

            <div>
              <span className="admin-eyebrow-v15">PUBLIC SEARCH</span>
              <h3>
                {settings.instance.public_portal_enabled
                  ? "Enabled"
                  : "Disabled"}
              </h3>
              <p className="admin-note-v15">
                Demo view: {settings.instance.demo_enabled ? "enabled" : "disabled"} · Corrections: {settings.instance.public_allow_corrections ? "enabled" : "disabled"}
              </p>
            </div>
          </div>
        </section>
      )}
    </AdminShell>
  );
}
