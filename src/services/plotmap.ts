import { supabase } from "../lib/supabase";

import type {
  BurialRecord,
  CemeteryRecord,
  PersonRecord,
  PlotMapDataset,
  PlotRecord,
  RowRecord,
  SectionRecord,
} from "../types/plotmap";

/* ==========================================================
   SERVICE 001
   Load one cemetery and all public demo map data
   ========================================================== */

export async function loadPlotMapDataset(
  cemeterySlug: string
): Promise<PlotMapDataset> {
  const cemeteryResponse = await supabase
    .from("pm_cemeteries")
    .select(
      "id, organization_id, name, slug, address_line_1, city, state, postal_code, description"
    )
    .eq("slug", cemeterySlug)
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
  ] = await Promise.all([
    supabase
      .from("pm_sections")
      .select(
        "id, cemetery_id, name, code, sort_order, geometry"
      )
      .eq("cemetery_id", cemetery.id)
      .order("sort_order"),

    supabase
      .from("pm_rows")
      .select(
        "id, section_id, name, code, sort_order"
      )
      .eq("cemetery_id", cemetery.id)
      .order("sort_order"),

    supabase
      .from("pm_plots")
      .select(
        "id, cemetery_id, section_id, row_id, plot_number, display_name, status, plot_type, x, y, width, height, rotation, notes"
      )
      .eq("cemetery_id", cemetery.id),

    supabase
      .from("pm_burials")
      .select(
        "id, plot_id, person_id, burial_date, interment_type"
      )
      .eq("cemetery_id", cemetery.id),
  ]);

  for (const response of [
    sectionsResponse,
    rowsResponse,
    plotsResponse,
    burialsResponse,
  ]) {
    if (response.error) {
      throw response.error;
    }
  }

  const sections =
    (sectionsResponse.data || []) as SectionRecord[];

  const rows =
    (rowsResponse.data || []) as RowRecord[];

  const basePlots =
    (plotsResponse.data || []) as Omit<
      PlotRecord,
      "burials"
    >[];

  const burials =
    (burialsResponse.data || []) as BurialRecord[];

  const personIds = Array.from(
    new Set(burials.map((burial) => burial.person_id))
  );

  let people: PersonRecord[] = [];

  if (personIds.length > 0) {
    const peopleResponse = await supabase
      .from("pm_people")
      .select(
        "id, first_name, middle_name, last_name, suffix, birth_date, death_date"
      )
      .in("id", personIds);

    if (peopleResponse.error) {
      throw peopleResponse.error;
    }

    people =
      (peopleResponse.data || []) as PersonRecord[];
  }

  const sectionById = new Map(
    sections.map((section) => [section.id, section])
  );

  const rowById = new Map(
    rows.map((row) => [row.id, row])
  );

  const personById = new Map(
    people.map((person) => [person.id, person])
  );

  const burialsByPlot = new Map<
    string,
    PlotRecord["burials"]
  >();

  for (const burial of burials) {
    const person = personById.get(burial.person_id);

    if (!person) {
      continue;
    }

    const existing =
      burialsByPlot.get(burial.plot_id) || [];

    existing.push({
      burial,
      person,
    });

    burialsByPlot.set(
      burial.plot_id,
      existing
    );
  }

  const plots: PlotRecord[] = basePlots.map(
    (plot) => ({
      ...plot,
      section: sectionById.get(plot.section_id),
      row: plot.row_id
        ? rowById.get(plot.row_id)
        : undefined,
      burials: burialsByPlot.get(plot.id) || [],
    })
  );

  return {
    cemetery,
    sections,
    rows,
    plots,
  };
}

/* ==========================================================
   SERVICE 002
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

  return dateValue.slice(0, 4);
}
