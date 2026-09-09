/* ==========================================================
   TYPES 001
   PlotMap core data types
   ========================================================== */

export type PlotStatus =
  | "available"
  | "reserved"
  | "occupied"
  | "unavailable";

export type CemeteryRecord = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  description: string | null;
};

export type SectionGeometry = {
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type SectionRecord = {
  id: string;
  cemetery_id: string;
  name: string;
  code: string | null;
  sort_order: number;
  geometry: SectionGeometry | null;
};

export type RowRecord = {
  id: string;
  section_id: string;
  name: string;
  code: string | null;
  sort_order: number;
};

export type PersonRecord = {
  id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  birth_date: string | null;
  death_date: string | null;
  obituary: string | null;
  biography: string | null;
  notes: string | null;
  verification_status: "unverified" | "verified" | "needs_review" | "conflict" | "approximate";
  verification_notes: string | null;
  verified_at: string | null;
  verified_by: string | null;
  public_visible: boolean;
  public_visibility_note: string | null;
  public_visibility_updated_at: string | null;
};

export type BurialRecord = {
  id: string;
  plot_id: string;
  person_id: string;
  burial_date: string | null;
  interment_type: string;
  is_primary: boolean;
  notes: string | null;
};


/* ==========================================================
   TYPES 002
   Plot Area geometry

   Polygon is the new format.

   BBox remains readable only so an existing v5 area can load
   before migration 007 converts it to a polygon.
   ========================================================== */

export type MapAreaPolygonGeometry = {
  type: "Polygon";
  coordinates: number[][][];
};

export type LegacyMapAreaBBoxGeometry = {
  type: "bbox";
  west: number;
  south: number;
  east: number;
  north: number;
};

export type MapAreaGeometry =
  | MapAreaPolygonGeometry
  | LegacyMapAreaBBoxGeometry;

export type MapAreaRecord = {
  id: string;
  organization_id: string;
  cemetery_id: string;
  feature_type: "boundary";
  label: string;
  geometry: MapAreaGeometry;
  style: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};


/* ==========================================================
   TYPES 003
   Plot placement
   ========================================================== */

export type PlotPlacementUpdate = {
  plotId: string;
  longitude: number;
  latitude: number;
};

export type NewPlotPlacement = {
  tempId: string;
  plotNumber: string;
  displayName: string;
  longitude: number;
  latitude: number;
};


export type PlotEditInput = {
  plotAreaId: string | null;
  plotNumber: string;
  displayName: string | null;
  status: PlotStatus;
  plotType: string;
  notes: string | null;
};


export type PersonEditInput = {
  personId: string | null;

  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;

  birthDate: string;
  deathDate: string;

  obituary: string;
  biography: string;
  personNotes: string;

  verificationStatus: "unverified" | "verified" | "needs_review" | "conflict" | "approximate";
  verificationNotes: string;

  publicVisible: boolean;
  publicVisibilityNote: string;

  burialDate: string;
  intermentType: string;
  burialNotes: string;
};

export type PlotRecord = {
  id: string;
  organization_id?: string;
  cemetery_id: string;

  /*
   * A real plot now belongs to one geographic Plot Area.
   */
  plot_area_id: string | null;

  /*
   * Sections/rows remain optional organizational metadata.
   */
  section_id: string;
  row_id: string | null;

  plot_number: string;
  display_name: string | null;

  status: PlotStatus;
  plot_type: string;

  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  rotation: number;

  longitude: number | null;
  latitude: number | null;

  geometry?: Record<string, unknown> | null;
  notes: string | null;

  section?: SectionRecord;
  row?: RowRecord;

  burials: Array<{
    burial: BurialRecord;
    person: PersonRecord;
  }>;
};


/* ==========================================================
   TYPES 004
   Complete map dataset
   ========================================================== */

export type PlotMapDataset = {
  cemetery: CemeteryRecord;

  sections: SectionRecord[];
  rows: RowRecord[];
  plots: PlotRecord[];

  /*
   * Multiple independent geographic Plot Areas.
   */
  mapAreas: MapAreaRecord[];
};
