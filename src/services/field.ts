import {
  supabase,
} from "../lib/supabase";

import type {
  FieldOccupantMatch,
  FieldSubmissionRecord,
  FieldSubmissionStatus,
} from "../types/field";


export async function submitFieldVerification(input: {
  organizationId: string;
  cemeteryId: string;
  plotId: string;
  personId: string | null;
  userId: string;

  recordedPlotNumber: string;
  recordedOccupantName: string;
  recordedBirthDate: string | null;
  recordedDeathDate: string | null;

  observedPlotNumber: string;
  observedOccupantName: string;
  observedBirthYear: string;
  observedDeathYear: string;
  occupantMatch: FieldOccupantMatch;

  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;

  notes: string;
  photo: File | null;
}): Promise<string> {
  let storagePath: string | null =
    null;

  if (input.photo) {
    const extension =
      (
        input.photo.name
          .split(".")
          .pop() ||
        "jpg"
      )
        .toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          ""
        ) || "jpg";

    const token =
      crypto.randomUUID();

    storagePath =
      `${input.organizationId}/cemeteries/${input.cemeteryId}/field-submissions/${token}.${extension}`;

    const upload =
      await supabase.storage
        .from("plotmap-private")
        .upload(
          storagePath,
          input.photo,
          {
            cacheControl: "3600",
            upsert: false,
            contentType:
              input.photo.type ||
              undefined,
          }
        );

    if (upload.error) {
      throw upload.error;
    }
  }

  const birthYear =
    input.observedBirthYear.trim()
      ? Number(
          input.observedBirthYear
        )
      : null;

  const deathYear =
    input.observedDeathYear.trim()
      ? Number(
          input.observedDeathYear
        )
      : null;

  try {
    const response =
      await supabase
        .from(
          "pm_field_submissions"
        )
        .insert({
          organization_id:
            input.organizationId,
          cemetery_id:
            input.cemeteryId,
          plot_id:
            input.plotId,
          person_id:
            input.personId,
          submitted_by:
            input.userId,

          recorded_plot_number:
            input.recordedPlotNumber ||
            null,
          recorded_occupant_name:
            input.recordedOccupantName ||
            null,
          recorded_birth_date:
            input.recordedBirthDate,
          recorded_death_date:
            input.recordedDeathDate,

          observed_plot_number:
            input.observedPlotNumber.trim() ||
            null,
          observed_occupant_name:
            input.observedOccupantName.trim() ||
            null,
          observed_birth_year:
            Number.isFinite(
              birthYear
            )
              ? birthYear
              : null,
          observed_death_year:
            Number.isFinite(
              deathYear
            )
              ? deathYear
              : null,

          occupant_match:
            input.occupantMatch,

          observed_latitude:
            input.latitude,
          observed_longitude:
            input.longitude,
          accuracy_meters:
            input.accuracyMeters,

          photo_bucket:
            input.photo
              ? "plotmap-private"
              : null,
          photo_path:
            storagePath,
          photo_original_name:
            input.photo?.name ||
            null,

          notes:
            input.notes.trim() ||
            null,

          status:
            "pending",
        })
        .select("id")
        .single();

    if (response.error) {
      throw response.error;
    }

    return response.data.id;
  } catch (error) {
    if (storagePath) {
      await supabase.storage
        .from("plotmap-private")
        .remove([
          storagePath,
        ]);
    }

    throw error;
  }
}


export async function loadFieldSubmissions(input?: {
  status?: FieldSubmissionStatus | "all";
}): Promise<FieldSubmissionRecord[]> {
  /*
   * Field submissions are reviewed through one server-side RPC.
   *
   * The original v17 implementation loaded the submission table,
   * then performed three additional browser-side enrichment queries
   * for plots, people, and members. If any one of those optional
   * lookups failed, the entire review queue appeared empty.
   *
   * The RPC returns the review row and its display metadata together
   * while still enforcing the caller's PlotMap organization role.
   */
  const response =
    await supabase.rpc(
      "pm_list_field_submissions",
      {
        p_status:
          input?.status ||
          "pending",
      }
    );

  if (response.error) {
    throw response.error;
  }

  return (
    response.data ||
    []
  ).map(
    (row: any) => ({
      id: row.id,
      organization_id:
        row.organization_id,
      cemetery_id:
        row.cemetery_id,
      plot_id:
        row.plot_id,
      person_id:
        row.person_id,
      submitted_by:
        row.submitted_by,

      recorded_plot_number:
        row.recorded_plot_number,
      recorded_occupant_name:
        row.recorded_occupant_name,
      recorded_birth_date:
        row.recorded_birth_date,
      recorded_death_date:
        row.recorded_death_date,

      observed_plot_number:
        row.observed_plot_number,
      observed_occupant_name:
        row.observed_occupant_name,
      observed_birth_year:
        row.observed_birth_year,
      observed_death_year:
        row.observed_death_year,

      occupant_match:
        row.occupant_match,

      observed_latitude:
        row.observed_latitude == null
          ? null
          : Number(
              row.observed_latitude
            ),
      observed_longitude:
        row.observed_longitude == null
          ? null
          : Number(
              row.observed_longitude
            ),
      accuracy_meters:
        row.accuracy_meters == null
          ? null
          : Number(
              row.accuracy_meters
            ),

      photo_bucket:
        row.photo_bucket,
      photo_path:
        row.photo_path,
      photo_original_name:
        row.photo_original_name,

      notes:
        row.notes,

      status:
        row.status,
      review_notes:
        row.review_notes,
      reviewed_by:
        row.reviewed_by,
      reviewed_at:
        row.reviewed_at,

      created_at:
        row.created_at,
      updated_at:
        row.updated_at,

      submittedByName:
        row.submitted_by_name ||
        "Staff account",
      currentPlotNumber:
        row.current_plot_number ||
        row.recorded_plot_number ||
        null,
      currentPlotName:
        row.current_plot_name ||
        null,
      currentOccupantName:
        row.current_occupant_name ||
        row.recorded_occupant_name ||
        null,
    })
  ) as FieldSubmissionRecord[];
}

export async function createFieldSubmissionPhotoUrl(
  submission: FieldSubmissionRecord
): Promise<string | null> {
  if (
    !submission.photo_bucket ||
    !submission.photo_path
  ) {
    return null;
  }

  const response =
    await supabase.storage
      .from(
        submission.photo_bucket
      )
      .createSignedUrl(
        submission.photo_path,
        60 * 60
      );

  if (response.error) {
    throw response.error;
  }

  return response.data.signedUrl;
}


export async function reviewFieldSubmission(input: {
  id: string;
  decision: "approved" | "denied";
  notes: string;
}): Promise<void> {
  const response =
    await supabase.rpc(
      "pm_review_field_submission",
      {
        p_submission_id:
          input.id,
        p_decision:
          input.decision,
        p_review_notes:
          input.notes.trim() ||
          null,
      }
    );

  if (response.error) {
    throw response.error;
  }
}
