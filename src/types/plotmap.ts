/* ==========================================================
   TYPES 001
   PlotMap database / UI types
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
};

export type BurialRecord = {
  id: string;
  plot_id: string;
  person_id: string;
  burial_date: string | null;
  interment_type: string;
};

export type PlotRecord = {
  id: string;
  cemetery_id: string;
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
  notes: string | null;

  section?: SectionRecord;
  row?: RowRecord;
  burials: Array<{
    burial: BurialRecord;
    person: PersonRecord;
  }>;
};

export type PlotMapDataset = {
  cemetery: CemeteryRecord;
  sections: SectionRecord[];
  rows: RowRecord[];
  plots: PlotRecord[];
};
