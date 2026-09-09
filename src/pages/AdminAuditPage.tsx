import {
  Fragment,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Download,
  RefreshCw,
} from "lucide-react";

import AdminShell from "../components/AdminShell";

import {
  downloadFullAuditLogCsv,
  loadAuditLog,
} from "../services/admin";

import type {
  AuditRecord,
} from "../types/admin";


export default function AdminAuditPage() {
  const [
    rows,
    setRows,
  ] =
    useState<AuditRecord[]>(
      []
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    entity,
    setEntity,
  ] =
    useState("all");

  const [
    expanded,
    setExpanded,
  ] =
    useState<string | null>(
      null
    );

  const [
    exporting,
    setExporting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );


  async function reload() {
    try {
      setError(
        null
      );

      setRows(
        await loadAuditLog()
      );
    } catch (
      loadError
    ) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load audit history."
      );
    }
  }


  async function exportAll() {
    try {
      setExporting(
        true
      );

      setError(
        null
      );

      await downloadFullAuditLogCsv();
    } catch (
      exportError
    ) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Could not export the full audit log."
      );
    } finally {
      setExporting(
        false
      );
    }
  }


  useEffect(() => {
    void reload();
  }, []);


  const entities =
    useMemo(
      () =>
        Array.from(
          new Set(
            rows.map(
              (row) =>
                row.entity_type
            )
          )
        ).sort(),
      [rows]
    );


  const filtered =
    useMemo(() => {
      const needle =
        search
          .trim()
          .toLowerCase();

      return rows.filter(
        (row) => {
          if (
            entity !== "all" &&
            row.entity_type !==
              entity
          ) {
            return false;
          }

          if (!needle) {
            return true;
          }

          return [
            row.actorName,
            row.action,
            row.entity_type,
            row.entity_id,
            JSON.stringify(
              row.details ||
              {}
            ),
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
      entity,
    ]);


  return (
    <AdminShell
      eyebrow="ACCOUNTABILITY"
      title="Audit Log"
      description="The page shows the latest 500 records for fast review. Full export downloads the complete audit history."
      actions={
        <>
          <button
            type="button"
            className="admin-button-secondary-v15"
            disabled={
              exporting
            }
            onClick={() =>
              void exportAll()
            }
          >
            <Download
              size={13}
            />
            {exporting
              ? "Exporting…"
              : "Export Full Audit Log"}
          </button>

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
        </>
      }
    >
      {error && (
        <div className="admin-message-v15 error">
          {error}
        </div>
      )}

      <section className="admin-card-v15 admin-card-pad-v15">
        <div className="admin-filter-row-v15">
          <input
            type="search"
            placeholder="Search action, account, record…"
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
            style={{
              flex: 1,
            }}
          />

          <select
            value={
              entity
            }
            onChange={(
              event
            ) =>
              setEntity(
                event.target.value
              )
            }
          >
            <option value="all">
              All record types
            </option>

            {entities.map(
              (value) => (
                <option
                  key={
                    value
                  }
                  value={
                    value
                  }
                >
                  {value}
                </option>
              )
            )}
          </select>
        </div>

        <table className="admin-table-v15">
          <thead>
            <tr>
              <th>When</th>
              <th>Account</th>
              <th>Action</th>
              <th>Record</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {filtered.map(
              (row) => (
                <Fragment
                  key={
                    row.id
                  }
                >
                  <tr>
                    <td>
                      {new Date(
                        row.created_at
                      ).toLocaleString()}
                    </td>

                    <td>
                      {row.actorName ||
                        "—"}
                    </td>

                    <td>
                      <span className="admin-tag-v15">
                        {row.action}
                      </span>
                    </td>

                    <td>
                      {row.entity_type}
                      <br />
                      <small>
                        {row.entity_id ||
                          "—"}
                      </small>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="admin-button-secondary-v15"
                        onClick={() =>
                          setExpanded(
                            expanded ===
                              row.id
                              ? null
                              : row.id
                          )
                        }
                      >
                        {expanded ===
                          row.id
                          ? "Hide"
                          : "Details"}
                      </button>
                    </td>
                  </tr>

                  {expanded ===
                    row.id && (
                    <tr>
                      <td
                        colSpan={
                          5
                        }
                      >
                        <pre className="admin-audit-json-v18">
                          {JSON.stringify(
                            row.details ||
                            {},
                            null,
                            2
                          )}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            )}

            {filtered.length ===
              0 && (
              <tr>
                <td
                  colSpan={
                    5
                  }
                >
                  No audit records match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
