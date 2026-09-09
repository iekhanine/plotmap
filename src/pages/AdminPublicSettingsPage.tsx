import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Eye,
  EyeOff,
  ExternalLink,
  Search,
  Save,
  Shield,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import AdminShell from "../components/AdminShell";
import {
  useAuth,
} from "../context/AuthContext";

import {
  loadAdminSettings,
  loadPeoplePublicVisibility,
  savePublicPortalSettings,
  setAllPeoplePublicVisibility,
  setPersonPublicVisibility,
} from "../services/admin";

import type {
  AdminSettingsBundle,
  PersonPublicVisibilityRecord,
} from "../types/admin";


type PublicFormState = {
  enabled: boolean;
  title: string;
  subtitle: string;
  contactEmail: string;
  contactPhone: string;
  allowCorrections: boolean;
  showBirthDate: boolean;
  showDeathDate: boolean;
  showBiography: boolean;
  showObituary: boolean;
  showPlotLocation: boolean;
  kioskEnabled: boolean;
  showAvailablePlots: boolean;
};

type PublicToggleKey =
  | "showBirthDate"
  | "showDeathDate"
  | "showBiography"
  | "showObituary"
  | "showPlotLocation"
  | "allowCorrections"
  | "kioskEnabled"
  | "showAvailablePlots";

const toggleRows: Array<{
  key: PublicToggleKey;
  title: string;
  help: string;
}> = [
  { key: "showBirthDate", title: "Show birth dates", help: "Public search and memorial pages may display birth dates." },
  { key: "showDeathDate", title: "Show death / burial dates", help: "Public search may display death and burial dates." },
  { key: "showBiography", title: "Show biographies", help: "Approved biography text may appear on memorial pages." },
  { key: "showObituary", title: "Show obituaries", help: "Approved obituary text may appear on memorial pages." },
  { key: "showPlotLocation", title: "Show grave location on the public map", help: "Expose mapped grave locations so visitors can browse the cemetery and click tombstones." },
  { key: "allowCorrections", title: "Allow family correction requests", help: "Visitors may suggest corrections or additional information. Staff review every request before any record changes." },
  { key: "kioskEnabled", title: "Allow kiosk mode", help: "The public page can run as a simplified on-site kiosk using /find?kiosk=1." },
  { key: "showAvailablePlots", title: "Show available plots publicly", help: "Adds an optional Available Plots view. Leave off if inventory should stay staff-only." },
];


function personName(
  record: PersonPublicVisibilityRecord
) {
  return [
    record.first_name,
    record.middle_name,
    record.last_name,
    record.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}


function lifeYears(
  record: PersonPublicVisibilityRecord
) {
  const born = record.birth_date?.slice(0, 4) || "—";
  const died = record.death_date?.slice(0, 4) || "—";
  return `${born} — ${died}`;
}


export default function AdminPublicSettingsPage() {
  const navigate = useNavigate();
  const { isOwner } = useAuth();

  const [bundle, setBundle] = useState<AdminSettingsBundle | null>(null);
  const [people, setPeople] = useState<PersonPublicVisibilityRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [directoryBusy, setDirectoryBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [privacySearch, setPrivacySearch] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [privacyVisible, setPrivacyVisible] = useState(true);
  const [privacyNote, setPrivacyNote] = useState("");

  const [form, setForm] = useState<PublicFormState>({
    enabled: true,
    title: "",
    subtitle: "",
    contactEmail: "",
    contactPhone: "",
    allowCorrections: true,
    showBirthDate: true,
    showDeathDate: true,
    showBiography: true,
    showObituary: true,
    showPlotLocation: true,
    kioskEnabled: true,
    showAvailablePlots: false,
  });

  async function reload() {
    try {
      setError(null);
      const [next, nextPeople] = await Promise.all([
        loadAdminSettings(),
        loadPeoplePublicVisibility(),
      ]);

      setBundle(next);
      setPeople(nextPeople);
      setForm({
        enabled: next.instance.public_portal_enabled,
        title: next.instance.public_portal_title || next.cemetery.name,
        subtitle: next.instance.public_portal_subtitle || "Search burial records, browse the cemetery map, and locate loved ones.",
        contactEmail: next.instance.public_contact_email || "",
        contactPhone: next.instance.public_contact_phone || "",
        allowCorrections: next.instance.public_allow_corrections,
        showBirthDate: next.instance.public_show_birth_date,
        showDeathDate: next.instance.public_show_death_date,
        showBiography: next.instance.public_show_biography,
        showObituary: next.instance.public_show_obituary,
        showPlotLocation: next.instance.public_show_plot_location,
        kioskEnabled: next.instance.public_kiosk_enabled,
        showAvailablePlots: next.instance.public_show_available_plots,
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load public search settings."
      );
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const selectedPerson = useMemo(
    () =>
      people.find(
        (person) => person.id === selectedPersonId
      ) || null,
    [people, selectedPersonId]
  );

  useEffect(() => {
    if (!selectedPerson) {
      return;
    }

    setPrivacyVisible(selectedPerson.public_visible);
    setPrivacyNote(selectedPerson.public_visibility_note || "");
  }, [selectedPerson]);

  const filteredPeople = useMemo(() => {
    const needle = privacySearch.trim().toLowerCase();

    if (!needle) {
      return people;
    }

    return people.filter((person) => {
      const haystack = [
        personName(person),
        person.birth_date,
        person.death_date,
        person.public_visible ? "public visible" : "hidden private",
        person.public_visibility_note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [people, privacySearch]);

  const publicCount = useMemo(
    () => people.filter((person) => person.public_visible).length,
    [people]
  );

  const hiddenCount = people.length - publicCount;

  async function save() {
    if (!bundle || !isOwner) {
      return;
    }

    try {
      setBusy(true);
      setError(null);
      setSuccess(null);

      await savePublicPortalSettings({
        instanceId: bundle.instance.id,
        ...form,
      });

      setSuccess("Public cemetery settings saved.");
      await reload();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save public search settings."
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveSelectedPrivacy() {
    if (!selectedPerson || !isOwner) {
      return;
    }

    try {
      setDirectoryBusy(true);
      setError(null);
      setSuccess(null);

      await setPersonPublicVisibility({
        personId: selectedPerson.id,
        visible: privacyVisible,
        note: privacyNote,
      });

      setSuccess(
        `${personName(selectedPerson)} is now ${privacyVisible ? "public" : "hidden from public access"}.`
      );
      await reload();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not update public visibility."
      );
    } finally {
      setDirectoryBusy(false);
    }
  }

  async function bulkVisibility(visible: boolean) {
    if (!isOwner) {
      return;
    }

    const confirmed = window.confirm(
      visible
        ? "Make every cemetery person record public? Individual records can still be hidden afterward."
        : "Hide every cemetery person record from public search and the public map? Staff records will not be deleted."
    );

    if (!confirmed) {
      return;
    }

    try {
      setDirectoryBusy(true);
      setError(null);
      setSuccess(null);

      const changed = await setAllPeoplePublicVisibility({
        visible,
        note: visible
          ? "Bulk public visibility enabled by Owner."
          : "Bulk public visibility disabled by Owner.",
      });

      setSuccess(
        `${changed} record${changed === 1 ? "" : "s"} updated.`
      );
      await reload();
    } catch (bulkError) {
      setError(
        bulkError instanceof Error
          ? bulkError.message
          : "Could not update records."
      );
    } finally {
      setDirectoryBusy(false);
    }
  }

  return (
    <AdminShell
      eyebrow="PUBLIC EXPERIENCE"
      title="Public Cemetery Access"
      description="Control the public cemetery map, loved-one search, visitor-facing fields, and family privacy requests without changing internal staff records."
      actions={
        <>
          <button
            type="button"
            className="admin-button-secondary-v15"
            onClick={() => navigate("/find")}
          >
            <ExternalLink size={13} /> Preview Public Map
          </button>

          {isOwner && (
            <button
              type="button"
              className="admin-button-primary-v15"
              disabled={busy || !bundle}
              onClick={() => void save()}
            >
              <Save size={13} /> Save Settings
            </button>
          )}
        </>
      }
    >
      {error && <div className="admin-message-v15 error">{error}</div>}
      {success && <div className="admin-message-v15 success">{success}</div>}

      {!isOwner && (
        <div className="admin-lock-v15">
          Public-facing visibility is Owner-controlled. Managers may preview the portal and review family requests, but only an Owner or Recovery Owner can publish or hide cemetery records.
        </div>
      )}

      <section className="admin-card-v15 admin-card-pad-v15 admin-form-v15">
        <label className="admin-checkbox-v15">
          <input
            type="checkbox"
            checked={form.enabled}
            disabled={!isOwner}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                enabled: event.target.checked,
              }))
            }
          />
          <span>
            <strong>Enable public cemetery access</strong>
            <small>
              Visitors can browse the public map and search approved burial records without an account. Turning this off disables the entire public cemetery portal while leaving staff access untouched.
            </small>
          </span>
        </label>
      </section>

      <section className="admin-card-v15">
        <div className="admin-card-heading-v15">
          <strong>Public Branding</strong>
          <span>Visitor-facing identity at /find</span>
        </div>
        <div className="admin-card-pad-v15 admin-form-v15">
          <label>
            Public page title
            <input
              value={form.title}
              disabled={!isOwner}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Public page subtitle
            <textarea
              rows={2}
              value={form.subtitle}
              disabled={!isOwner}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  subtitle: event.target.value,
                }))
              }
            />
          </label>

          <div className="admin-grid-2-v15">
            <label>
              Public contact email
              <input
                type="email"
                value={form.contactEmail}
                disabled={!isOwner}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    contactEmail: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Public contact phone
              <input
                value={form.contactPhone}
                disabled={!isOwner}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    contactPhone: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        </div>
      </section>

      <section className="admin-card-v15">
        <div className="admin-card-heading-v15">
          <strong>Public Data Controls</strong>
          <span>Choose which categories may be exposed</span>
        </div>
        <div className="admin-card-pad-v15 admin-form-v15">
          {toggleRows.map((row) => (
            <label className="admin-checkbox-v15" key={row.key}>
              <input
                type="checkbox"
                checked={form[row.key]}
                disabled={!isOwner}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [row.key]: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>{row.title}</strong>
                <small>{row.help}</small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="admin-card-v15 public-privacy-card-v16">
        <div className="admin-card-heading-v15">
          <strong>Family Privacy & Record Visibility</strong>
          <span>{publicCount} public · {hiddenCount} hidden · {people.length} total</span>
        </div>

        <div className="public-privacy-toolbar-v16">
          <div className="public-privacy-search-v16">
            <Search size={13} />
            <input
              value={privacySearch}
              placeholder="Find a person by name, date, or privacy note…"
              onChange={(event) => setPrivacySearch(event.target.value)}
            />
          </div>

          {isOwner && (
            <div className="public-privacy-bulk-v16">
              <button
                type="button"
                className="admin-button-secondary-v15"
                disabled={directoryBusy}
                onClick={() => void bulkVisibility(true)}
              >
                <Eye size={13} /> Publish All
              </button>
              <button
                type="button"
                className="admin-button-danger-v15"
                disabled={directoryBusy}
                onClick={() => void bulkVisibility(false)}
              >
                <EyeOff size={13} /> Hide All
              </button>
            </div>
          )}
        </div>

        {selectedPerson && (
          <div className="public-privacy-editor-v16">
            <div className="public-privacy-editor-heading-v16">
              <Shield size={15} />
              <div>
                <strong>{personName(selectedPerson)}</strong>
                <span>{lifeYears(selectedPerson)}</span>
              </div>
            </div>

            <label className="admin-checkbox-v15 public-privacy-toggle-v16">
              <input
                type="checkbox"
                checked={privacyVisible}
                disabled={!isOwner}
                onChange={(event) => setPrivacyVisible(event.target.checked)}
              />
              <span>
                <strong>Visible in public cemetery access</strong>
                <small>
                  When disabled, this person disappears from public search, memorial links, and clickable cemetery-map tombstones. Internal staff records are unchanged.
                </small>
              </span>
            </label>

            <label className="public-privacy-note-v16">
              Internal privacy note
              <textarea
                rows={2}
                value={privacyNote}
                disabled={!isOwner}
                placeholder="Example: Family requested that this memorial remain private."
                onChange={(event) => setPrivacyNote(event.target.value)}
              />
            </label>

            {isOwner && (
              <div className="admin-actions-row-v15">
                <button
                  type="button"
                  className="admin-button-primary-v15"
                  disabled={directoryBusy}
                  onClick={() => void saveSelectedPrivacy()}
                >
                  <Save size={13} /> Save Record Privacy
                </button>
              </div>
            )}
          </div>
        )}

        <div className="public-privacy-table-wrap-v16">
          <table className="admin-table-v15 public-privacy-table-v16">
            <thead>
              <tr>
                <th>Person</th>
                <th>Life Dates</th>
                <th>Public Status</th>
                <th>Privacy Note</th>
              </tr>
            </thead>
            <tbody>
              {filteredPeople.slice(0, 250).map((person) => (
                <tr
                  key={person.id}
                  className={selectedPersonId === person.id ? "selected" : ""}
                  onClick={() => setSelectedPersonId(person.id)}
                >
                  <td><strong>{personName(person)}</strong></td>
                  <td>{lifeYears(person)}</td>
                  <td>
                    <span className={person.public_visible ? "admin-tag-v15 public" : "admin-tag-v15 private"}>
                      {person.public_visible ? "Public" : "Hidden"}
                    </span>
                  </td>
                  <td>{person.public_visibility_note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPeople.length > 250 && (
          <div className="public-privacy-limit-v16">
            Showing the first 250 matches. Use search to narrow the directory.
          </div>
        )}
      </section>
    </AdminShell>
  );
}
