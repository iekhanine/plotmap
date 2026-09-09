import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  RefreshCw,
} from "lucide-react";

import AdminShell from "../components/AdminShell";
import {
  useAuth,
} from "../context/AuthContext";

import {
  loadPublicCorrections,
  updatePublicCorrection,
} from "../services/admin";

import type {
  CorrectionStatus,
  PublicCorrectionRecord,
} from "../types/admin";


export default function AdminRequestsPage() {
  const { user } = useAuth();

  const [rows, setRows] = useState<PublicCorrectionRecord[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CorrectionStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<CorrectionStatus>("pending");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function reload() {
    try {
      setError(null);
      setRows(await loadPublicCorrections());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load family requests."
      );
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (status !== "all" && row.status !== status) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [
        row.personName,
        row.plotLabel,
        row.requester_name,
        row.requester_email,
        row.relationship,
        row.message,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, search, status]);

  const selected = rows.find((row) => row.id === selectedId) || null;

  function open(row: PublicCorrectionRecord) {
    setSelectedId(row.id);
    setEditStatus(row.status);
    setResolutionNotes(row.resolution_notes || "");
    setSuccess(null);
    setError(null);
  }

  async function save() {
    if (!selected) {
      return;
    }

    try {
      setBusy(true);
      setError(null);
      setSuccess(null);

      await updatePublicCorrection({
        id: selected.id,
        status: editStatus,
        resolutionNotes,
        userId: user?.id || null,
      });

      setSuccess("Family request updated.");
      await reload();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not update request."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      eyebrow="PUBLIC INTAKE"
      title="Family Requests"
      description="Visitors may suggest a correction; nothing is changed automatically. Staff review, contact the family if needed, then update the official record separately."
      actions={
        <button
          type="button"
          className="admin-button-secondary-v15"
          onClick={() => void reload()}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      }
    >
      {error && <div className="admin-message-v15 error">{error}</div>}
      {success && <div className="admin-message-v15 success">{success}</div>}

      <div className="admin-grid-2-v15" style={{ alignItems: "start" }}>
        <section className="admin-card-v15 admin-card-pad-v15">
          <div className="admin-filter-row-v15">
            <input
              type="search"
              placeholder="Search person, requester, plot…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ flex: 1 }}
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as any)}
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="reviewing">Reviewing</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <table className="admin-table-v15">
            <thead>
              <tr>
                <th>Record</th>
                <th>Requester</th>
                <th>Status</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => open(row)}
                  style={{ cursor: "pointer", background: selectedId === row.id ? "#f2f8fb" : undefined }}
                >
                  <td>
                    <strong>{row.personName}</strong><br />
                    <small>{row.plotLabel}</small>
                  </td>
                  <td>
                    {row.requester_name}<br />
                    <small>{row.requester_email}</small>
                  </td>
                  <td>
                    <span className={`admin-tag-v15 ${row.status}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>{new Date(row.created_at).toLocaleDateString()}</td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4}>No requests match this filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="admin-card-v15 admin-card-pad-v15">
          {selected ? (
            <div className="admin-form-v15">
              <div>
                <span className="admin-eyebrow-v15">RECORD</span>
                <h3>{selected.personName}</h3>
                <p className="admin-note-v15">{selected.plotLabel}</p>
              </div>

              <div className="admin-grid-2-v15">
                <div>
                  <span className="admin-eyebrow-v15">REQUESTER</span>
                  <p>{selected.requester_name}<br />{selected.requester_email}</p>
                </div>
                <div>
                  <span className="admin-eyebrow-v15">RELATIONSHIP</span>
                  <p>{selected.relationship || "Not provided"}</p>
                </div>
              </div>

              <div>
                <span className="admin-eyebrow-v15">MESSAGE</span>
                <p className="admin-note-v15">{selected.message}</p>
              </div>

              <label>
                Status
                <select
                  value={editStatus}
                  onChange={(event) => setEditStatus(event.target.value as CorrectionStatus)}
                >
                  <option value="pending">Pending</option>
                  <option value="reviewing">Reviewing</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>

              <label>
                Staff resolution notes
                <textarea
                  rows={5}
                  value={resolutionNotes}
                  onChange={(event) => setResolutionNotes(event.target.value)}
                  placeholder="What was verified, corrected, or why was the request rejected?"
                />
              </label>

              <div className="admin-actions-row-v15">
                <button
                  type="button"
                  className="admin-button-primary-v15"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  {busy ? "Saving…" : "Save Request"}
                </button>
              </div>
            </div>
          ) : (
            <div className="admin-note-v15">
              Select a family request on the left to review the submitted information.
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
