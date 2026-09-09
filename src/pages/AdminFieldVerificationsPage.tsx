import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Check,
  Image as ImageIcon,
  LocateFixed,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import AdminShell from "../components/AdminShell";

import {
  createFieldSubmissionPhotoUrl,
  loadFieldSubmissions,
  reviewFieldSubmission,
} from "../services/field";

import type {
  FieldSubmissionRecord,
  FieldSubmissionStatus,
} from "../types/field";


function formatDate(
  value: string | null
) {
  if (!value) {
    return "—";
  }

  return new Date(
    value
  ).toLocaleString();
}


function lifeYears(
  birth: string | null,
  death: string | null
) {
  return `${birth?.slice(0, 4) || "—"} — ${death?.slice(0, 4) || "—"}`;
}


export default function AdminFieldVerificationsPage() {
  const [
    rows,
    setRows,
  ] =
    useState<FieldSubmissionRecord[]>(
      []
    );

  const [
    status,
    setStatus,
  ] =
    useState<FieldSubmissionStatus | "all">(
      "pending"
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    selectedId,
    setSelectedId,
  ] =
    useState<string | null>(
      null
    );

  const [
    photoUrl,
    setPhotoUrl,
  ] =
    useState<string | null>(
      null
    );

  const [
    reviewNotes,
    setReviewNotes,
  ] =
    useState("");

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

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
      setLoading(true);
      setError(null);

      const next =
        await loadFieldSubmissions({
          status,
        });

      setRows(
        next
      );

      if (
        selectedId &&
        !next.some(
          (row) =>
            row.id ===
            selectedId
        )
      ) {
        setSelectedId(
          null
        );
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load field verification submissions."
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void reload();
  }, [status]);


  const filtered =
    useMemo(() => {
      const needle =
        search
          .trim()
          .toLowerCase();

      if (!needle) {
        return rows;
      }

      return rows.filter(
        (row) =>
          [
            row.currentPlotNumber,
            row.currentPlotName,
            row.recorded_occupant_name,
            row.observed_occupant_name,
            row.submittedByName,
            row.notes,
            row.status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(
              needle
            )
      );
    }, [
      rows,
      search,
    ]);


  const selected =
    useMemo(
      () =>
        rows.find(
          (row) =>
            row.id ===
            selectedId
        ) ||
        null,
      [
        rows,
        selectedId,
      ]
    );


  useEffect(() => {
    setReviewNotes(
      selected?.review_notes ||
      ""
    );

    setPhotoUrl(
      null
    );

    if (
      selected?.photo_path
    ) {
      void createFieldSubmissionPhotoUrl(
        selected
      )
        .then(
          setPhotoUrl
        )
        .catch(
          (photoError) =>
            setError(
              photoError instanceof Error
                ? photoError.message
                : "Could not load the field photo."
            )
        );
    }
  }, [selected]);


  async function review(
    decision:
      | "approved"
      | "denied"
  ) {
    if (!selected) {
      return;
    }

    const confirmed =
      window.confirm(
        decision === "approved"
          ? "Approve this field observation? This will create a permanent verification record. It will not silently overwrite the person's name or dates."
          : "Deny this field observation?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setBusy(true);
      setError(null);
      setSuccess(null);

      await reviewFieldSubmission({
        id:
          selected.id,
        decision,
        notes:
          reviewNotes,
      });

      setSuccess(
        decision === "approved"
          ? "Field verification approved."
          : "Field verification denied."
      );

      setSelectedId(
        null
      );

      await reload();
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Could not review the field submission."
      );
    } finally {
      setBusy(false);
    }
  }


  return (
    <AdminShell
      eyebrow="FIELD OPERATIONS"
      title="Field Verifications"
      description="Review photos and observations submitted from the mobile field view. Mobile submissions never change official records until they are approved here."
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

      <section className="admin-card-v15">
        <div className="field-admin-toolbar-v17">
          <div className="field-admin-search-v17">
            <Search
              size={14}
            />
            <input
              value={search}
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Plot, occupant, or staff member…"
            />
          </div>

          <select
            value={status}
            onChange={(
              event
            ) =>
              setStatus(
                event.target.value as FieldSubmissionStatus | "all"
              )
            }
          >
            <option value="pending">
              Pending
            </option>
            <option value="approved">
              Approved
            </option>
            <option value="denied">
              Denied
            </option>
            <option value="all">
              All
            </option>
          </select>
        </div>

        <div className="field-admin-layout-v17">
          <div className="field-admin-list-v17">
            {loading && (
              <div className="field-admin-empty-v17">
                Loading…
              </div>
            )}

            {!loading &&
            filtered.length === 0 && (
              <div className="field-admin-empty-v17">
                No field submissions match this view.
              </div>
            )}

            {filtered.map(
              (row) => (
                <button
                  key={row.id}
                  type="button"
                  className={
                    row.id ===
                    selectedId
                      ? "field-admin-row-v17 selected"
                      : "field-admin-row-v17"
                  }
                  onClick={() =>
                    setSelectedId(
                      row.id
                    )
                  }
                >
                  <div>
                    <strong>
                      Plot{" "}
                      {row.currentPlotNumber ||
                        row.recorded_plot_number ||
                        "—"}
                    </strong>

                    <span>
                      {row.currentOccupantName ||
                        row.recorded_occupant_name ||
                        "No occupant recorded"}
                    </span>
                  </div>

                  <div>
                    <span
                      className={`admin-tag-v15 ${row.status}`}
                    >
                      {row.status}
                    </span>

                    <small>
                      {row.submittedByName ||
                        "Staff"}
                    </small>
                  </div>
                </button>
              )
            )}
          </div>

          <div className="field-admin-detail-v17">
            {!selected && (
              <div className="field-admin-empty-v17">
                Select a field submission to inspect the recorded data, observed data, photo, and GPS information.
              </div>
            )}

            {selected && (
              <>
                <div className="field-admin-detail-head-v17">
                  <div>
                    <span className="admin-eyebrow-v15">
                      PLOT
                    </span>
                    <h2>
                      {selected.currentPlotNumber ||
                        selected.recorded_plot_number ||
                        "—"}
                    </h2>
                    <p>
                      Submitted by{" "}
                      {selected.submittedByName ||
                        "Staff"}
                      {" · "}
                      {formatDate(
                        selected.created_at
                      )}
                    </p>
                  </div>

                  <span
                    className={`admin-tag-v15 ${selected.status}`}
                  >
                    {selected.status}
                  </span>
                </div>

                <div className="field-admin-compare-v17">
                  <div>
                    <span className="admin-eyebrow-v15">
                      RECORDED
                    </span>

                    <strong>
                      {selected.recorded_occupant_name ||
                        "No occupant"}
                    </strong>

                    <span>
                      Plot{" "}
                      {selected.recorded_plot_number ||
                        "—"}
                    </span>

                    <span>
                      {lifeYears(
                        selected.recorded_birth_date,
                        selected.recorded_death_date
                      )}
                    </span>
                  </div>

                  <div>
                    <span className="admin-eyebrow-v15">
                      OBSERVED IN FIELD
                    </span>

                    <strong>
                      {selected.observed_occupant_name ||
                        "No name entered"}
                    </strong>

                    <span>
                      Plot{" "}
                      {selected.observed_plot_number ||
                        "—"}
                    </span>

                    <span>
                      {selected.observed_birth_year ||
                        "—"}
                      {" — "}
                      {selected.observed_death_year ||
                        "—"}
                    </span>
                  </div>
                </div>

                <div className="field-admin-match-v17">
                  Occupant match:
                  <strong>
                    {selected.occupant_match ===
                    "match"
                      ? " Matches"
                      : selected.occupant_match ===
                          "mismatch"
                        ? " Mismatch reported"
                        : " Uncertain"}
                  </strong>
                </div>

                {selected.notes && (
                  <div className="admin-note-v15">
                    <strong>
                      Field notes
                    </strong>
                    <br />
                    {selected.notes}
                  </div>
                )}

                <div className="field-admin-media-v17">
                  <div className="field-admin-photo-v17">
                    {photoUrl
                      ? (
                        <img
                          src={photoUrl}
                          alt="Field verification"
                        />
                      )
                      : (
                        <div>
                          <ImageIcon
                            size={24}
                          />
                          <span>
                            No photo available
                          </span>
                        </div>
                      )}
                  </div>

                  <div className="field-admin-gps-v17">
                    <LocateFixed
                      size={18}
                    />

                    <strong>
                      Field GPS
                    </strong>

                    {selected.observed_latitude != null &&
                    selected.observed_longitude != null
                      ? (
                        <>
                          <span>
                            {Number(
                              selected.observed_latitude
                            ).toFixed(6)}
                            ,{" "}
                            {Number(
                              selected.observed_longitude
                            ).toFixed(6)}
                          </span>

                          <span>
                            Accuracy ±
                            {Math.round(
                              Number(
                                selected.accuracy_meters ||
                                0
                              )
                            )}
                            m
                          </span>
                        </>
                      )
                      : (
                        <span>
                          No GPS captured
                        </span>
                      )}
                  </div>
                </div>

                {selected.status ===
                  "pending" && (
                  <div className="field-admin-review-v17">
                    <label>
                      Review notes
                      <textarea
                        rows={4}
                        value={
                          reviewNotes
                        }
                        onChange={(
                          event
                        ) =>
                          setReviewNotes(
                            event.target.value
                          )
                        }
                        placeholder="Why was this approved/denied? Note any follow-up needed."
                      />
                    </label>

                    <div>
                      <button
                        type="button"
                        className="admin-button-danger-v15"
                        disabled={busy}
                        onClick={() =>
                          void review(
                            "denied"
                          )
                        }
                      >
                        <X
                          size={13}
                        />
                        Deny
                      </button>

                      <button
                        type="button"
                        className="admin-button-primary-v15"
                        disabled={busy}
                        onClick={() =>
                          void review(
                            "approved"
                          )
                        }
                      >
                        <Check
                          size={13}
                        />
                        Approve Verification
                      </button>
                    </div>

                    <small>
                      Approval creates the permanent verification record. If the observed name or dates differ, use Plot Details to deliberately edit the official record after review.
                    </small>
                  </div>
                )}

                {selected.status !==
                  "pending" && (
                  <div className="admin-note-v15">
                    Reviewed{" "}
                    {formatDate(
                      selected.reviewed_at
                    )}
                    {selected.review_notes
                      ? ` · ${selected.review_notes}`
                      : ""}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
