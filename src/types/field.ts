export type FieldSubmissionStatus =
  | "pending"
  | "approved"
  | "denied";

export type FieldOccupantMatch =
  | "match"
  | "mismatch"
  | "uncertain";

export type FieldSubmissionRecord = {
  id: string;
  organization_id: string;
  cemetery_id: string;
  plot_id: string;
  person_id: string | null;
  submitted_by: string | null;

  recorded_plot_number: string | null;
  recorded_occupant_name: string | null;
  recorded_birth_date: string | null;
  recorded_death_date: string | null;

  observed_plot_number: string | null;
  observed_occupant_name: string | null;
  observed_birth_year: number | null;
  observed_death_year: number | null;

  occupant_match: FieldOccupantMatch;

  observed_latitude: number | null;
  observed_longitude: number | null;
  accuracy_meters: number | null;

  photo_bucket: string | null;
  photo_path: string | null;
  photo_original_name: string | null;

  notes: string | null;

  status: FieldSubmissionStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;

  created_at: string;
  updated_at: string;

  submittedByName?: string;
  currentPlotNumber?: string | null;
  currentPlotName?: string | null;
  currentOccupantName?: string | null;
};
