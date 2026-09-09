import {
  useEffect,
  useState,
} from "react";

import {
  Save,
} from "lucide-react";

import AdminShell from "../components/AdminShell";
import {
  useAuth,
} from "../context/AuthContext";

import {
  loadAdminSettings,
  saveCemeteryAdminSettings,
} from "../services/admin";

import type {
  AdminSettingsBundle,
} from "../types/admin";


export default function AdminCemeterySettingsPage() {
  const {
    isOwner,
  } = useAuth();

  const [
    bundle,
    setBundle,
  ] = useState<AdminSettingsBundle | null>(null);

  const [
    form,
    setForm,
  ] = useState({
    cemeteryName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    description: "",
    latitude: "",
    longitude: "",
    instanceName: "",
    headerSubtitle: "",
    demoEnabled: false,
  });

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const [
    success,
    setSuccess,
  ] = useState<string | null>(null);

  async function reload() {
    try {
      const next =
        await loadAdminSettings();

      setBundle(next);
      setForm({
        cemeteryName:
          next.cemetery.name,
        addressLine1:
          next.cemetery.address_line_1 || "",
        addressLine2:
          next.cemetery.address_line_2 || "",
        city:
          next.cemetery.city || "",
        state:
          next.cemetery.state || "",
        postalCode:
          next.cemetery.postal_code || "",
        country:
          next.cemetery.country || "US",
        description:
          next.cemetery.description || "",
        latitude:
          next.cemetery.latitude == null
            ? ""
            : String(next.cemetery.latitude),
        longitude:
          next.cemetery.longitude == null
            ? ""
            : String(next.cemetery.longitude),
        instanceName:
          next.instance.instance_name,
        headerSubtitle:
          next.instance.header_subtitle,
        demoEnabled:
          next.instance.demo_enabled,
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load cemetery settings."
      );
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function save() {
    if (!bundle || !isOwner) {
      return;
    }

    if (!form.cemeteryName.trim()) {
      setError("Cemetery name is required.");
      return;
    }

    if (!form.instanceName.trim()) {
      setError("Instance name is required.");
      return;
    }

    try {
      setBusy(true);
      setError(null);
      setSuccess(null);

      await saveCemeteryAdminSettings({
        cemeteryId:
          bundle.cemetery.id,
        instanceId:
          bundle.instance.id,
        ...form,
      });

      setSuccess(
        "Cemetery settings saved. Reload the map/login screen to see branding changes everywhere."
      );

      await reload();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save cemetery settings."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      eyebrow="INSTANCE IDENTITY"
      title="Cemetery Settings"
      description="These settings belong to this specific installed PlotMap instance. No SQL or environment-file editing is required for normal branding changes."
      actions={
        isOwner ? (
          <button
            type="button"
            className="admin-button-primary-v15"
            disabled={busy || !bundle}
            onClick={() => void save()}
          >
            <Save size={13} /> Save Changes
          </button>
        ) : undefined
      }
    >
      {error && (
        <div className="admin-message-v15 error">{error}</div>
      )}

      {success && (
        <div className="admin-message-v15 success">{success}</div>
      )}

      {!isOwner && (
        <div className="admin-lock-v15">
          Cemetery identity and instance branding are Owner-only settings. Managers may view them but cannot change them.
        </div>
      )}

      <section className="admin-card-v15">
        <div className="admin-card-heading-v15">
          <strong>Cemetery Identity</strong>
          <span>Shown throughout PlotMap and public search</span>
        </div>

        <div className="admin-card-pad-v15 admin-form-v15">
          <div className="admin-grid-2-v15">
            <label>
              Cemetery name
              <input
                value={form.cemeteryName}
                disabled={!isOwner}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    cemeteryName: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              PlotMap instance name
              <input
                value={form.instanceName}
                disabled={!isOwner}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    instanceName: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <label>
            Header subtitle
            <input
              value={form.headerSubtitle}
              disabled={!isOwner}
              placeholder="Cemetery Mapping & Records"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  headerSubtitle: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Cemetery description
            <textarea
              rows={3}
              value={form.description}
              disabled={!isOwner}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>
        </div>
      </section>

      <section className="admin-card-v15">
        <div className="admin-card-heading-v15">
          <strong>Location</strong>
          <span>Used for public address display and map centering</span>
        </div>

        <div className="admin-card-pad-v15 admin-form-v15">
          <label>
            Address line 1
            <input
              value={form.addressLine1}
              disabled={!isOwner}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  addressLine1: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Address line 2
            <input
              value={form.addressLine2}
              disabled={!isOwner}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  addressLine2: event.target.value,
                }))
              }
            />
          </label>

          <div className="admin-grid-3-v15">
            <label>
              City
              <input
                value={form.city}
                disabled={!isOwner}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              State / region
              <input
                value={form.state}
                disabled={!isOwner}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    state: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Postal code
              <input
                value={form.postalCode}
                disabled={!isOwner}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    postalCode: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <div className="admin-grid-3-v15">
            <label>
              Country
              <input
                value={form.country}
                disabled={!isOwner}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    country: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Cemetery latitude
              <input
                inputMode="decimal"
                value={form.latitude}
                disabled={!isOwner}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    latitude: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Cemetery longitude
              <input
                inputMode="decimal"
                value={form.longitude}
                disabled={!isOwner}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    longitude: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        </div>
      </section>

      <section className="admin-card-v15 admin-card-pad-v15 admin-form-v15">
        <label className="admin-checkbox-v15">
          <input
            type="checkbox"
            checked={form.demoEnabled}
            disabled={!isOwner}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                demoEnabled: event.target.checked,
              }))
            }
          />
          <span>
            <strong>Enable internal Demo View</strong>
            <small>
              Keeps the v14 read-only staff-interface demo available from the login page. Customer delivery can turn this off while leaving Public Family Search enabled.
            </small>
          </span>
        </label>
      </section>
    </AdminShell>
  );
}
