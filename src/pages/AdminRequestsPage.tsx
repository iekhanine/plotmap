import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AtSign,
  Clock3,
  Mail,
  RefreshCw,
  Save,
  UserRound,
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


function receivedLabel(
  value: string
) {
  const date =
    new Date(
      value
    );

  const today =
    new Date();

  if (
    date.toDateString() ===
    today.toDateString()
  ) {
    return date.toLocaleTimeString(
      [],
      {
        hour:
          "numeric",
        minute:
          "2-digit",
      }
    );
  }

  return date.toLocaleDateString(
    [],
    {
      month:
        "short",
      day:
        "numeric",
    }
  );
}


export default function AdminRequestsPage() {
  const {
    user,
  } = useAuth();

  const [
    rows,
    setRows,
  ] =
    useState<PublicCorrectionRecord[]>(
      []
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    status,
    setStatus,
  ] =
    useState<
      CorrectionStatus |
      "all"
    >(
      "all"
    );

  const [
    selectedId,
    setSelectedId,
  ] =
    useState<string | null>(
      null
    );

  const [
    editStatus,
    setEditStatus,
  ] =
    useState<CorrectionStatus>(
      "pending"
    );

  const [
    resolutionNotes,
    setResolutionNotes,
  ] =
    useState("");

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    success,
    setSuccess,
  ] =
    useState<string | null>(
      null
    );


  async function reload() {
    try {
      setError(
        null
      );

      const next =
        await loadPublicCorrections();

      setRows(
        next
      );

      if (
        next.length &&
        !selectedId
      ) {
        open(
          next[0]
        );
      }
    } catch (
      loadError
    ) {
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


  const filtered =
    useMemo(() => {
      const needle =
        search
          .trim()
          .toLowerCase();

      return rows.filter(
        (row) => {
          if (
            status !== "all" &&
            row.status !==
              status
          ) {
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
            .includes(
              needle
            );
        }
      );
    }, [
      rows,
      search,
      status,
    ]);


  const selected =
    rows.find(
      (row) =>
        row.id ===
        selectedId
    ) ||
    null;


  function open(
    row: PublicCorrectionRecord
  ) {
    setSelectedId(
      row.id
    );

    setEditStatus(
      row.status
    );

    setResolutionNotes(
      row.resolution_notes ||
      ""
    );

    setSuccess(
      null
    );

    setError(
      null
    );
  }


  async function save() {
    if (!selected) {
      return;
    }

    try {
      setBusy(
        true
      );

      setError(
        null
      );

      setSuccess(
        null
      );

      await updatePublicCorrection({
        id:
          selected.id,
        status:
          editStatus,
        resolutionNotes,
        userId:
          user?.id ||
          null,
      });

      setSuccess(
        "Family request updated."
      );

      await reload();
    } catch (
      saveError
    ) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not update request."
      );
    } finally {
      setBusy(
        false
      );
    }
  }


  return (
    <AdminShell
      eyebrow="PUBLIC INTAKE"
      title="Family Requests"
      description="Review visitor-submitted corrections like an inbox. Requests never modify the official record automatically."
      actions={
        <button
          type="button"
          className="admin-button-secondary-v15"
          onClick={() =>
            void reload()
          }
        >
          <RefreshCw
            size={13}
          />
          Refresh
        </button>
      }
    >
      {error && (
        <div className="admin-message-v15 error">
          {error}
        </div>
      )}

      {success && (
        <div className="admin-message-v15 success">
          {success}
        </div>
      )}

      <section className="family-inbox-v18">
        <div className="family-inbox-toolbar-v18">
          <div className="family-inbox-search-v18">
            <Mail
              size={14}
            />

            <input
              type="search"
              placeholder="Search person, requester, plot…"
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
            />
          </div>

          <select
            value={
              status
            }
            onChange={(
              event
            ) =>
              setStatus(
                event.target.value as
                  CorrectionStatus |
                  "all"
              )
            }
          >
            <option value="all">
              All statuses
            </option>
            <option value="pending">
              Pending
            </option>
            <option value="reviewing">
              Reviewing
            </option>
            <option value="resolved">
              Resolved
            </option>
            <option value="rejected">
              Rejected
            </option>
          </select>
        </div>

        <div className="family-inbox-layout-v18">
          <aside className="family-inbox-list-v18">
            <div className="family-inbox-list-heading-v18">
              <strong>
                Requests
              </strong>
              <span>
                {filtered.length}
              </span>
            </div>

            {filtered.map(
              (row) => (
                <button
                  key={
                    row.id
                  }
                  type="button"
                  className={
                    row.id ===
                    selectedId
                      ? "family-mail-row-v18 selected"
                      : "family-mail-row-v18"
                  }
                  onClick={() =>
                    open(
                      row
                    )
                  }
                >
                  <div className="family-mail-row-top-v18">
                    <strong>
                      {row.personName ||
                        "Unknown record"}
                    </strong>

                    <time>
                      {receivedLabel(
                        row.created_at
                      )}
                    </time>
                  </div>

                  <div className="family-mail-row-meta-v18">
                    <span>
                      {row.requester_name}
                    </span>

                    <span
                      className={`admin-tag-v15 ${row.status}`}
                    >
                      {row.status}
                    </span>
                  </div>

                  <p>
                    {row.message}
                  </p>

                  <small>
                    {row.plotLabel}
                  </small>
                </button>
              )
            )}

            {filtered.length ===
              0 && (
              <div className="family-inbox-empty-v18">
                No requests match this filter.
              </div>
            )}
          </aside>

          <article className="family-inbox-reader-v18">
            {!selected && (
              <div className="family-inbox-reader-empty-v18">
                <Mail
                  size={28}
                />
                <strong>
                  Select a request
                </strong>
                <span>
                  The request details will appear here.
                </span>
              </div>
            )}

            {selected && (
              <>
                <header className="family-reader-header-v18">
                  <div>
                    <span className="admin-eyebrow-v15">
                      REQUESTED RECORD
                    </span>

                    <h2>
                      {selected.personName}
                    </h2>

                    <p>
                      {selected.plotLabel}
                    </p>
                  </div>

                  <span
                    className={`admin-tag-v15 ${selected.status}`}
                  >
                    {selected.status}
                  </span>
                </header>

                <div className="family-reader-sender-v18">
                  <div className="family-reader-avatar-v18">
                    <UserRound
                      size={17}
                    />
                  </div>

                  <div>
                    <strong>
                      {selected.requester_name}
                    </strong>

                    <span>
                      <AtSign
                        size={11}
                      />
                      {selected.requester_email}
                    </span>
                  </div>

                  <div className="family-reader-time-v18">
                    <Clock3
                      size={11}
                    />
                    {new Date(
                      selected.created_at
                    ).toLocaleString()}
                  </div>
                </div>

                <div className="family-reader-metadata-v18">
                  <div>
                    <span>
                      Relationship
                    </span>
                    <strong>
                      {selected.relationship ||
                        "Not provided"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Plot
                    </span>
                    <strong>
                      {selected.plotLabel}
                    </strong>
                  </div>
                </div>

                <div className="family-reader-message-v18">
                  <span className="admin-eyebrow-v15">
                    MESSAGE
                  </span>

                  <p>
                    {selected.message}
                  </p>
                </div>

                <div className="family-reader-review-v18">
                  <label>
                    Status
                    <select
                      value={
                        editStatus
                      }
                      onChange={(
                        event
                      ) =>
                        setEditStatus(
                          event.target.value as CorrectionStatus
                        )
                      }
                    >
                      <option value="pending">
                        Pending
                      </option>
                      <option value="reviewing">
                        Reviewing
                      </option>
                      <option value="resolved">
                        Resolved
                      </option>
                      <option value="rejected">
                        Rejected
                      </option>
                    </select>
                  </label>

                  <label>
                    Staff resolution notes
                    <textarea
                      rows={5}
                      value={
                        resolutionNotes
                      }
                      onChange={(
                        event
                      ) =>
                        setResolutionNotes(
                          event.target.value
                        )
                      }
                      placeholder="What was verified, corrected, or why was the request rejected?"
                    />
                  </label>

                  <div className="family-reader-actions-v18">
                    <button
                      type="button"
                      className="admin-button-primary-v15"
                      disabled={
                        busy
                      }
                      onClick={() =>
                        void save()
                      }
                    >
                      <Save
                        size={13}
                      />
                      {busy
                        ? "Saving…"
                        : "Save Request"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </article>
        </div>
      </section>
    </AdminShell>
  );
}
