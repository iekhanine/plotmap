import {
  useState,
} from "react";

import {
  FileJson,
  FileSpreadsheet,
  Map,
} from "lucide-react";

import AdminShell from "../components/AdminShell";
import {
  useAuth,
} from "../context/AuthContext";

import {
  downloadBurialCsv,
  downloadFullBackup,
  downloadMapGeoJson,
} from "../services/admin";


export default function AdminExportPage() {
  const { isOwner } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<void>) {
    try {
      setBusy(key);
      setError(null);
      await action();
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Export failed."
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell
      eyebrow="CUSTOMER OWNERSHIP"
      title="Backup & Export"
      description="PlotMap is designed around customer-owned data. Owners can download portable records without asking OneTime Labs for permission."
    >
      {error && <div className="admin-message-v15 error">{error}</div>}

      {!isOwner && (
        <div className="admin-lock-v15">
          Full data exports are Owner-only because they may contain private person records, ownership information and internal notes.
        </div>
      )}

      <div className="admin-export-grid-v15">
        <div className="admin-export-card-v15">
          <FileJson size={20} />
          <strong>Full PlotMap Backup</strong>
          <span>
            JSON snapshot of the instance settings, cemetery, plots, people, burials, maps, documents metadata, family requests and field checks.
          </span>
          <button
            type="button"
            className="admin-button-primary-v15"
            disabled={!isOwner || busy !== null}
            onClick={() => void run("backup", downloadFullBackup)}
          >
            {busy === "backup" ? "Preparing…" : "Download JSON Backup"}
          </button>
        </div>

        <div className="admin-export-card-v15">
          <FileSpreadsheet size={20} />
          <strong>Burial Register</strong>
          <span>
            Human-readable CSV suitable for Excel, LibreOffice, records review, migration or archival storage.
          </span>
          <button
            type="button"
            className="admin-button-primary-v15"
            disabled={!isOwner || busy !== null}
            onClick={() => void run("csv", downloadBurialCsv)}
          >
            {busy === "csv" ? "Preparing…" : "Download Burial CSV"}
          </button>
        </div>

        <div className="admin-export-card-v15">
          <Map size={20} />
          <strong>Map GeoJSON</strong>
          <span>
            Plot point coordinates and Plot Area polygons for GIS tools, archives, migrations, QGIS or ArcGIS workflows.
          </span>
          <button
            type="button"
            className="admin-button-primary-v15"
            disabled={!isOwner || busy !== null}
            onClick={() => void run("geojson", downloadMapGeoJson)}
          >
            {busy === "geojson" ? "Preparing…" : "Download GeoJSON"}
          </button>
        </div>
      </div>

      <div className="admin-note-v15" style={{ marginTop: 12 }}>
        File metadata is exported here. Binary photo/document files are still stored in Supabase Storage and are not bundled into the browser-generated JSON archive in this release.
      </div>
    </AdminShell>
  );
}
