import {
  supabase,
} from "../lib/supabase";

import type {
  PublicAvailablePlot,
  PublicMapMarker,
  PublicMemorial,
  PublicPortalConfig,
  PublicSearchResult,
} from "../types/publicPortal";


/* ==========================================================
   PUBLIC SERVICE 001
   Branding / public portal configuration
   ========================================================== */

export async function loadPublicPortalConfig(): Promise<PublicPortalConfig> {
  const response =
    await supabase.rpc(
      "pm_public_portal_config"
    );

  if (response.error) {
    throw response.error;
  }

  if (!response.data) {
    throw new Error(
      "PlotMap public portal is not configured."
    );
  }

  return response.data as PublicPortalConfig;
}


/* ==========================================================
   PUBLIC SERVICE 002
   Loved-one search
   ========================================================== */

export async function searchPublicMemorials(
  query: string
): Promise<PublicSearchResult[]> {
  const response =
    await supabase.rpc(
      "pm_public_search",
      {
        p_query:
          query.trim(),
      }
    );

  if (response.error) {
    throw response.error;
  }

  return (
    response.data || []
  ) as PublicSearchResult[];
}


/* ==========================================================
   PUBLIC SERVICE 003
   Memorial detail
   ========================================================== */

export async function loadPublicMemorial(
  personId: string
): Promise<PublicMemorial | null> {
  const response =
    await supabase.rpc(
      "pm_public_memorial",
      {
        p_person_id:
          personId,
      }
    );

  if (response.error) {
    throw response.error;
  }

  return (
    response.data || null
  ) as PublicMemorial | null;
}




/* ==========================================================
   PUBLIC SERVICE 003A
   Map-first public grave markers
   ========================================================== */

export async function loadPublicMapMarkers(): Promise<PublicMapMarker[]> {
  const response =
    await supabase.rpc(
      "pm_public_map_markers"
    );

  if (response.error) {
    throw response.error;
  }

  return (
    response.data || []
  ) as PublicMapMarker[];
}


/* ==========================================================
   PUBLIC SERVICE 004
   Optional public available-plot view
   ========================================================== */

export async function loadPublicAvailablePlots(): Promise<PublicAvailablePlot[]> {
  const response =
    await supabase.rpc(
      "pm_public_available_plots"
    );

  if (response.error) {
    throw response.error;
  }

  return (
    response.data || []
  ) as PublicAvailablePlot[];
}


/* ==========================================================
   PUBLIC SERVICE 005
   Family correction request
   ========================================================== */

export async function submitPublicCorrection(input: {
  personId: string;
  requesterName: string;
  requesterEmail: string;
  relationship: string;
  message: string;
}): Promise<string> {
  const response =
    await supabase.rpc(
      "pm_submit_public_correction",
      {
        p_person_id:
          input.personId,
        p_requester_name:
          input.requesterName.trim(),
        p_requester_email:
          input.requesterEmail.trim(),
        p_relationship:
          input.relationship.trim() ||
          null,
        p_message:
          input.message.trim(),
      }
    );

  if (response.error) {
    throw response.error;
  }

  return String(
    response.data || ""
  );
}


/* ==========================================================
   PUBLIC SERVICE 006
   Public photo URL
   ========================================================== */

export function publicPhotoUrl(
  bucket: string,
  path: string
) {
  return supabase.storage
    .from(bucket)
    .getPublicUrl(path)
    .data.publicUrl;
}
