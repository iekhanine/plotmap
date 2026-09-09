import {
  supabase,
} from "../lib/supabase";

import type {
  BurialRecord,
  CemeteryRecord,
  MapAreaGeometry,
  MapAreaRecord,
  NewPlotPlacement,
  PersonEditInput,
  PersonRecord,
  PlotEditInput,
  PlotMapDataset,
  PlotRecord,
  RowRecord,
  SectionRecord,
} from "../types/plotmap";


/* ==========================================================
   SERVICE 001
   Load cemetery map dataset
   ========================================================== */

export async function loadPlotMapDataset(
  cemeterySlug: string
): Promise<PlotMapDataset> {
  const cemeteryResponse =
    await supabase
      .from("pm_cemeteries")
      .select(
        "id, organization_id, name, slug, address_line_1, city, state, postal_code, description"
      )
      .eq(
        "slug",
        cemeterySlug
      )
      .single();

  if (cemeteryResponse.error) {
    throw cemeteryResponse.error;
  }

  const cemetery =
    cemeteryResponse.data as CemeteryRecord;

  const [
    sectionsResponse,
    rowsResponse,
    plotsResponse,
    burialsResponse,
    mapAreasResponse,
  ] =
    await Promise.all([
      supabase
        .from("pm_sections")
        .select(
          "id, cemetery_id, name, code, sort_order, geometry"
        )
        .eq(
          "cemetery_id",
          cemetery.id
        )
        .order(
          "sort_order"
        ),

      supabase
        .from("pm_rows")
        .select(
          "id, section_id, name, code, sort_order"
        )
        .eq(
          "cemetery_id",
          cemetery.id
        )
        .order(
          "sort_order"
        ),

      supabase
        .from("pm_plots")
        .select(
          "id, organization_id, cemetery_id, plot_area_id, section_id, row_id, plot_number, display_name, status, plot_type, x, y, width, height, rotation, longitude, latitude, geometry, notes"
        )
        .eq(
          "cemetery_id",
          cemetery.id
        ),

      supabase
        .from("pm_burials")
        .select(
          "id, plot_id, person_id, burial_date, interment_type, is_primary, notes"
        )
        .eq(
          "cemetery_id",
          cemetery.id
        ),

      supabase
        .from("pm_map_features")
        .select(
          "id, organization_id, cemetery_id, feature_type, label, geometry, style, metadata, created_at"
        )
        .eq(
          "cemetery_id",
          cemetery.id
        )
        .eq(
          "feature_type",
          "boundary"
        )
        .contains(
          "metadata",
          {
            purpose:
              "plot_area",
          }
        )
        .order(
          "created_at"
        ),
    ]);

  for (
    const response
    of [
      sectionsResponse,
      rowsResponse,
      plotsResponse,
      burialsResponse,
      mapAreasResponse,
    ]
  ) {
    if (response.error) {
      throw response.error;
    }
  }

  const sections =
    (sectionsResponse.data ||
      []) as SectionRecord[];

  const rows =
    (rowsResponse.data ||
      []) as RowRecord[];

  const basePlots =
    (plotsResponse.data ||
      []) as Omit<
        PlotRecord,
        "burials"
      >[];

  const burials =
    (burialsResponse.data ||
      []) as BurialRecord[];

  const mapAreas =
    (mapAreasResponse.data ||
      []) as MapAreaRecord[];

  const personIds =
    Array.from(
      new Set(
        burials.map(
          (burial) =>
            burial.person_id
        )
      )
    );

  let people:
    PersonRecord[] = [];

  if (
    personIds.length > 0
  ) {
    const peopleResponse =
      await supabase
        .from("pm_people")
        .select(
          "id, first_name, middle_name, last_name, suffix, birth_date, death_date, obituary, biography, notes"
        )
        .in(
          "id",
          personIds
        );

    if (
      peopleResponse.error
    ) {
      throw peopleResponse.error;
    }

    people =
      (peopleResponse.data ||
        []) as PersonRecord[];
  }

  const sectionById =
    new Map(
      sections.map(
        (section) => [
          section.id,
          section,
        ]
      )
    );

  const rowById =
    new Map(
      rows.map(
        (row) => [
          row.id,
          row,
        ]
      )
    );

  const personById =
    new Map(
      people.map(
        (person) => [
          person.id,
          person,
        ]
      )
    );

  const burialsByPlot =
    new Map<
      string,
      PlotRecord["burials"]
    >();

  for (
    const burial
    of burials
  ) {
    const person =
      personById.get(
        burial.person_id
      );

    if (!person) {
      continue;
    }

    const existing =
      burialsByPlot.get(
        burial.plot_id
      ) || [];

    existing.push({
      burial,
      person,
    });

    burialsByPlot.set(
      burial.plot_id,
      existing
    );
  }

  for (
    const entries
    of burialsByPlot.values()
  ) {
    entries.sort(
      (a, b) =>
        Number(
          b.burial.is_primary
        ) -
        Number(
          a.burial.is_primary
        )
    );
  }

  const plots:
    PlotRecord[] =
    basePlots.map(
      (plot) => ({
        ...plot,

        section:
          sectionById.get(
            plot.section_id
          ),

        row:
          plot.row_id
            ? rowById.get(
                plot.row_id
              )
            : undefined,

        burials:
          burialsByPlot.get(
            plot.id
          ) || [],
      })
    );

  return {
    cemetery,
    sections,
    rows,
    plots,
    mapAreas,
  };
}


/* ==========================================================
   SERVICE 002
   Save one plot position
   ========================================================== */

export async function updatePlotPlacement(
  plotId: string,
  longitude: number,
  latitude: number
): Promise<void> {
  const response =
    await supabase
      .from("pm_plots")
      .update({
        longitude,
        latitude,
      })
      .eq(
        "id",
        plotId
      );

  if (response.error) {
    throw response.error;
  }
}


/* ==========================================================
   SERVICE 003
   Batch-create new plots inside one Plot Area
   ========================================================== */

export async function createPlotsBatch(
  cemeteryId: string,
  plotAreaId: string,
  placements: NewPlotPlacement[]
): Promise<PlotRecord[]> {
  if (
    placements.length === 0
  ) {
    return [];
  }

  const response =
    await supabase.rpc(
      "pm_batch_create_demo_plots_v2",
      {
        p_cemetery_id:
          cemeteryId,

        p_plot_area_id:
          plotAreaId,

        p_plots:
          placements.map(
            (placement) => ({
              temp_id:
                placement.tempId,

              plot_number:
                placement.plotNumber,

              display_name:
                placement.displayName,

              longitude:
                placement.longitude,

              latitude:
                placement.latitude,
            })
          ),
      }
    );

  if (response.error) {
    throw response.error;
  }

  return (
    response.data || []
  ) as PlotRecord[];
}


/* ==========================================================
   SERVICE 004
   Create another Plot Area
   ========================================================== */

export async function createMapArea(
  cemeteryId: string,
  label: string,
  geometry: MapAreaGeometry
): Promise<MapAreaRecord> {
  const response =
    await supabase.rpc(
      "pm_create_demo_plot_area",
      {
        p_cemetery_id:
          cemeteryId,

        p_label:
          label,

        p_geometry:
          geometry,
      }
    );

  if (response.error) {
    throw response.error;
  }

  const rows =
    (response.data ||
      []) as MapAreaRecord[];

  const created =
    rows[0];

  if (!created) {
    throw new Error(
      "Plot Area was created but no record was returned."
    );
  }

  return created;
}


/* ==========================================================
   SERVICE 005
   Rename an existing Plot Area
   ========================================================== */

export async function updateMapAreaLabel(
  areaId: string,
  label: string
): Promise<void> {
  const response =
    await supabase
      .from("pm_map_features")
      .update({
        label,
      })
      .eq(
        "id",
        areaId
      );

  if (response.error) {
    throw response.error;
  }
}


/* ==========================================================
   SERVICE 006
   Save arbitrary polygon geometry
   ========================================================== */

export async function updateMapAreaGeometry(
  areaId: string,
  geometry: MapAreaGeometry
): Promise<void> {
  const response =
    await supabase
      .from("pm_map_features")
      .update({
        geometry,
      })
      .eq(
        "id",
        areaId
      );

  if (response.error) {
    throw response.error;
  }
}


/* ==========================================================
   SERVICE 007
   Edit one plot record
   ========================================================== */

export async function updatePlotDetails(
  plotId: string,
  input: PlotEditInput
): Promise<void> {
  const response =
    await supabase
      .from("pm_plots")
      .update({
        plot_area_id:
          input.plotAreaId,

        plot_number:
          input.plotNumber,

        display_name:
          input.displayName,

        status:
          input.status,

        plot_type:
          input.plotType,

        notes:
          input.notes,
      })
      .eq(
        "id",
        plotId
      )
      .select(
        "id"
      )
      .single();

  if (
    response.error
  ) {
    throw response.error;
  }

  if (
    response.data?.id !==
    plotId
  ) {
    throw new Error(
      "Plot update could not be verified."
    );
  }
}



/* ==========================================================
   SERVICE 008
   Assign many plots to one Plot Area
   ========================================================== */

export type BulkAreaAssignmentResult = {
  requestedCount: number;
  updatedCount: number;
  plotAreaId: string | null;
};

export async function assignPlotsToArea(
  plotIds: string[],
  plotAreaId: string | null
): Promise<BulkAreaAssignmentResult> {
  if (
    plotIds.length === 0
  ) {
    return {
      requestedCount: 0,
      updatedCount: 0,
      plotAreaId,
    };
  }

  /*
   * SERVICE 008A
   * Direct verified Supabase updates.
   *
   * Chunking avoids giant `in(...)` URLs when hundreds of
   * plots are selected.
   */
  const chunkSize =
    120;

  const returnedIds =
    new Set<string>();

  for (
    let offset = 0;
    offset <
      plotIds.length;
    offset +=
      chunkSize
  ) {
    const chunk =
      plotIds.slice(
        offset,
        offset +
          chunkSize
      );

    const response =
      await supabase
        .from("pm_plots")
        .update({
          plot_area_id:
            plotAreaId,
        })
        .in(
          "id",
          chunk
        )
        .select(
          "id, plot_area_id"
        );

    if (
      response.error
    ) {
      throw response.error;
    }

    for (
      const row
      of response.data ||
        []
    ) {
      if (
        row.plot_area_id !==
        plotAreaId
      ) {
        throw new Error(
          `Plot ${row.id} returned an unexpected Plot Area after update.`
        );
      }

      returnedIds.add(
        row.id
      );
    }
  }

  if (
    returnedIds.size !==
    plotIds.length
  ) {
    throw new Error(
      `Supabase returned ${returnedIds.size} updated plots for ${plotIds.length} requested plots.`
    );
  }

  return {
    requestedCount:
      plotIds.length,

    updatedCount:
      returnedIds.size,

    plotAreaId,
  };
}



/* ==========================================================
   SERVICE 009
   Delete many plots in one transaction
   ========================================================== */

export async function deletePlotsBatch(
  plotIds: string[]
): Promise<number> {
  if (
    plotIds.length === 0
  ) {
    return 0;
  }

  const response =
    await supabase.rpc(
      "pm_delete_demo_plots",
      {
        p_plot_ids:
          plotIds,
      }
    );

  if (response.error) {
    throw response.error;
  }

  return Number(
    response.data || 0
  );
}


/* ==========================================================
   SERVICE 010
   Create or update primary person information for one plot
   ========================================================== */

export async function savePlotPersonInfo(
  plotId: string,
  input: PersonEditInput
): Promise<string> {
  const response =
    await supabase.rpc(
      "pm_upsert_demo_plot_person",
      {
        p_plot_id:
          plotId,

        p_person_id:
          input.personId,

        p_first_name:
          input.firstName.trim() ||
          null,

        p_middle_name:
          input.middleName.trim() ||
          null,

        p_last_name:
          input.lastName.trim(),

        p_suffix:
          input.suffix.trim() ||
          null,

        p_birth_date:
          input.birthDate ||
          null,

        p_death_date:
          input.deathDate ||
          null,

        p_obituary:
          input.obituary.trim() ||
          null,

        p_biography:
          input.biography.trim() ||
          null,

        p_person_notes:
          input.personNotes.trim() ||
          null,

        p_burial_date:
          input.burialDate ||
          null,

        p_interment_type:
          input.intermentType,

        p_burial_notes:
          input.burialNotes.trim() ||
          null,
      }
    );

  if (
    response.error
  ) {
    throw response.error;
  }

  const personId =
    String(
      response.data ||
      ""
    );

  if (!personId) {
    throw new Error(
      "Person record was not returned after save."
    );
  }

  return personId;
}


/* ==========================================================
   SERVICE 011
   Presentation helpers
   ========================================================== */

export function getPersonDisplayName(
  person: PersonRecord
): string {
  return [
    person.first_name,
    person.middle_name,
    person.last_name,
    person.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}

export function getYear(
  dateValue: string | null
): string {
  if (!dateValue) {
    return "—";
  }

  return dateValue.slice(
    0,
    4
  );
}
