import {
  supabase,
} from "../lib/supabase";

import type {
  AdminOverviewStats,
  AdminSettingsBundle,
  AuditRecord,
  CemeteryAdminRecord,
  CorrectionStatus,
  FieldVerificationRecord,
  InstanceAdminSettings,
  PublicCorrectionRecord,
  PersonPublicVisibilityRecord,
} from "../types/admin";


/* ==========================================================
   ADMIN SERVICE 001
   Load settings
   ========================================================== */

export async function loadAdminSettings(): Promise<AdminSettingsBundle> {
  const instanceResponse =
    await supabase
      .from(
        "pm_instance_settings"
      )
      .select(
        "id, organization_id, cemetery_id, instance_name, header_subtitle, demo_enabled, public_portal_enabled, public_portal_title, public_portal_subtitle, public_contact_email, public_contact_phone, public_allow_corrections, public_show_birth_date, public_show_death_date, public_show_biography, public_show_obituary, public_show_plot_location, public_kiosk_enabled, public_show_available_plots, recovery_owner_user_id, installed_at, updated_at"
      )
      .order(
        "installed_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .single();

  if (instanceResponse.error) {
    throw instanceResponse.error;
  }

  const instance =
    instanceResponse.data as InstanceAdminSettings;

  const cemeteryResponse =
    await supabase
      .from(
        "pm_cemeteries"
      )
      .select(
        "id, organization_id, name, slug, address_line_1, address_line_2, city, state, postal_code, country, latitude, longitude, description, active"
      )
      .eq(
        "id",
        instance.cemetery_id
      )
      .single();

  if (cemeteryResponse.error) {
    throw cemeteryResponse.error;
  }

  return {
    instance,
    cemetery:
      cemeteryResponse.data as CemeteryAdminRecord,
  };
}


/* ==========================================================
   ADMIN SERVICE 002
   Save cemetery identity / instance branding
   ========================================================== */

export async function saveCemeteryAdminSettings(input: {
  cemeteryId: string;
  instanceId: string;
  cemeteryName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  description: string;
  latitude: string;
  longitude: string;
  instanceName: string;
  headerSubtitle: string;
  demoEnabled: boolean;
}): Promise<void> {
  const latitude =
    input.latitude.trim()
      ? Number(input.latitude)
      : null;

  const longitude =
    input.longitude.trim()
      ? Number(input.longitude)
      : null;

  if (latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
    throw new Error("Latitude must be a number between -90 and 90.");
  }

  if (longitude != null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
    throw new Error("Longitude must be a number between -180 and 180.");
  }

  const cemeteryResponse =
    await supabase
      .from(
        "pm_cemeteries"
      )
      .update({
        name:
          input.cemeteryName.trim(),
        address_line_1:
          input.addressLine1.trim() ||
          null,
        address_line_2:
          input.addressLine2.trim() ||
          null,
        city:
          input.city.trim() ||
          null,
        state:
          input.state.trim() ||
          null,
        postal_code:
          input.postalCode.trim() ||
          null,
        country:
          input.country.trim() ||
          "US",
        description:
          input.description.trim() ||
          null,
        latitude,
        longitude,
      })
      .eq(
        "id",
        input.cemeteryId
      );

  if (cemeteryResponse.error) {
    throw cemeteryResponse.error;
  }

  const instanceResponse =
    await supabase
      .from(
        "pm_instance_settings"
      )
      .update({
        instance_name:
          input.instanceName.trim(),
        header_subtitle:
          input.headerSubtitle.trim() ||
          "Cemetery Mapping & Records",
        demo_enabled:
          input.demoEnabled,
      })
      .eq(
        "id",
        input.instanceId
      );

  if (instanceResponse.error) {
    throw instanceResponse.error;
  }
}


/* ==========================================================
   ADMIN SERVICE 003
   Save public portal settings
   ========================================================== */

export async function savePublicPortalSettings(input: {
  instanceId: string;
  enabled: boolean;
  title: string;
  subtitle: string;
  contactEmail: string;
  contactPhone: string;
  allowCorrections: boolean;
  showBirthDate: boolean;
  showDeathDate: boolean;
  showBiography: boolean;
  showObituary: boolean;
  showPlotLocation: boolean;
  kioskEnabled: boolean;
  showAvailablePlots: boolean;
}): Promise<void> {
  const response =
    await supabase
      .from(
        "pm_instance_settings"
      )
      .update({
        public_portal_enabled:
          input.enabled,
        public_portal_title:
          input.title.trim() ||
          null,
        public_portal_subtitle:
          input.subtitle.trim() ||
          null,
        public_contact_email:
          input.contactEmail.trim() ||
          null,
        public_contact_phone:
          input.contactPhone.trim() ||
          null,
        public_allow_corrections:
          input.allowCorrections,
        public_show_birth_date:
          input.showBirthDate,
        public_show_death_date:
          input.showDeathDate,
        public_show_biography:
          input.showBiography,
        public_show_obituary:
          input.showObituary,
        public_show_plot_location:
          input.showPlotLocation,
        public_kiosk_enabled:
          input.kioskEnabled,
        public_show_available_plots:
          input.showAvailablePlots,
      })
      .eq(
        "id",
        input.instanceId
      );

  if (response.error) {
    throw response.error;
  }
}


/* ==========================================================
   ADMIN SERVICE 004
   Overview counts
   ========================================================== */

export async function loadAdminOverview(): Promise<AdminOverviewStats> {
  const [
    plots,
    occupied,
    people,
    corrections,
    verifications,
  ] =
    await Promise.all([
      supabase
        .from("pm_plots")
        .select("id", {
          count: "exact",
          head: true,
        }),
      supabase
        .from("pm_plots")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "status",
          "occupied"
        ),
      supabase
        .from("pm_people")
        .select("id", {
          count: "exact",
          head: true,
        }),
      supabase
        .from(
          "pm_public_corrections"
        )
        .select("id", {
          count: "exact",
          head: true,
        })
        .in(
          "status",
          [
            "pending",
            "reviewing",
          ]
        ),
      supabase
        .from(
          "pm_field_verifications"
        )
        .select("id", {
          count: "exact",
          head: true,
        }),
    ]);

  for (
    const response of [
      plots,
      occupied,
      people,
      corrections,
      verifications,
    ]
  ) {
    if (response.error) {
      throw response.error;
    }
  }

  return {
    plots:
      plots.count || 0,
    occupiedPlots:
      occupied.count || 0,
    people:
      people.count || 0,
    pendingCorrections:
      corrections.count || 0,
    fieldVerifications:
      verifications.count || 0,
  };
}


/* ==========================================================
   ADMIN SERVICE 005
   Public correction queue
   ========================================================== */

export async function loadPublicCorrections(): Promise<PublicCorrectionRecord[]> {
  const response =
    await supabase
      .from(
        "pm_public_corrections"
      )
      .select(
        "id, organization_id, cemetery_id, person_id, plot_id, requester_name, requester_email, relationship, message, status, resolution_notes, reviewed_by, reviewed_at, created_at, updated_at"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(500);

  if (response.error) {
    throw response.error;
  }

  const rows =
    (response.data || []) as PublicCorrectionRecord[];

  const personIds =
    Array.from(
      new Set(
        rows.map(
          (row) =>
            row.person_id
        )
      )
    );

  const plotIds =
    Array.from(
      new Set(
        rows
          .map(
            (row) =>
              row.plot_id
          )
          .filter(Boolean) as string[]
      )
    );

  const [
    peopleResponse,
    plotsResponse,
  ] =
    await Promise.all([
      personIds.length
        ? supabase
            .from("pm_people")
            .select(
              "id, first_name, middle_name, last_name, suffix"
            )
            .in(
              "id",
              personIds
            )
        : Promise.resolve({
            data: [],
            error: null,
          }),
      plotIds.length
        ? supabase
            .from("pm_plots")
            .select(
              "id, plot_number, display_name"
            )
            .in(
              "id",
              plotIds
            )
        : Promise.resolve({
            data: [],
            error: null,
          }),
    ]);

  if (peopleResponse.error) {
    throw peopleResponse.error;
  }

  if (plotsResponse.error) {
    throw plotsResponse.error;
  }

  const people =
    new Map(
      (peopleResponse.data || [])
        .map(
          (person: any) => [
            person.id,
            [
              person.first_name,
              person.middle_name,
              person.last_name,
              person.suffix,
            ]
              .filter(Boolean)
              .join(" "),
          ]
        )
    );

  const plots =
    new Map(
      (plotsResponse.data || [])
        .map(
          (plot: any) => [
            plot.id,
            plot.display_name ||
              `Plot ${plot.plot_number}`,
          ]
        )
    );

  return rows.map(
    (row) => ({
      ...row,
      personName:
        people.get(
          row.person_id
        ) || "Unknown record",
      plotLabel:
        row.plot_id
          ? plots.get(
              row.plot_id
            ) || "Unknown plot"
          : "—",
    })
  );
}


export async function updatePublicCorrection(input: {
  id: string;
  status: CorrectionStatus;
  resolutionNotes: string;
  userId: string | null;
}): Promise<void> {
  const response =
    await supabase
      .from(
        "pm_public_corrections"
      )
      .update({
        status:
          input.status,
        resolution_notes:
          input.resolutionNotes.trim() ||
          null,
        reviewed_by:
          input.userId,
        reviewed_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        input.id
      );

  if (response.error) {
    throw response.error;
  }
}


/* ==========================================================
   ADMIN SERVICE 006
   Audit history
   ========================================================== */

export async function loadAuditLog(): Promise<AuditRecord[]> {
  const [
    auditResponse,
    memberResponse,
  ] =
    await Promise.all([
      supabase
        .from(
          "pm_audit_log"
        )
        .select(
          "id, organization_id, user_id, action, entity_type, entity_id, details, created_at"
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(500),
      supabase
        .from(
          "pm_members"
        )
        .select(
          "user_id, display_name, role"
        ),
    ]);

  if (auditResponse.error) {
    throw auditResponse.error;
  }

  if (memberResponse.error) {
    throw memberResponse.error;
  }

  const actorById =
    new Map(
      (memberResponse.data || [])
        .map(
          (member: any) => [
            member.user_id,
            member.display_name ||
              member.role,
          ]
        )
    );

  return (
    auditResponse.data || []
  ).map(
    (row: any) => ({
      ...row,
      actorName:
        row.user_id
          ? actorById.get(
              row.user_id
            ) || "Staff account"
          : "Public / system",
    })
  ) as AuditRecord[];
}


/* ==========================================================
   ADMIN SERVICE 007
   Field verification
   ========================================================== */

export async function getLatestFieldVerification(
  plotId: string
): Promise<FieldVerificationRecord | null> {
  const response =
    await supabase
      .from(
        "pm_field_verifications"
      )
      .select(
        "id, organization_id, cemetery_id, plot_id, person_id, user_id, verification_type, observed_latitude, observed_longitude, accuracy_meters, notes, created_at"
      )
      .eq(
        "plot_id",
        plotId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

  if (response.error) {
    throw response.error;
  }

  return (
    response.data || null
  ) as FieldVerificationRecord | null;
}


export async function captureFieldVerification(input: {
  organizationId: string;
  cemeteryId: string;
  plotId: string;
  personId: string | null;
  userId: string | null;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  notes?: string;
}): Promise<FieldVerificationRecord> {
  const response =
    await supabase
      .from(
        "pm_field_verifications"
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
        user_id:
          input.userId,
        verification_type:
          "location",
        observed_latitude:
          input.latitude,
        observed_longitude:
          input.longitude,
        accuracy_meters:
          input.accuracyMeters,
        notes:
          input.notes?.trim() ||
          null,
      })
      .select(
        "id, organization_id, cemetery_id, plot_id, person_id, user_id, verification_type, observed_latitude, observed_longitude, accuracy_meters, notes, created_at"
      )
      .single();

  if (response.error) {
    throw response.error;
  }

  return response.data as FieldVerificationRecord;
}


export async function updatePersonVerification(input: {
  personId: string;
  status: string;
  notes: string;
  userId: string | null;
}): Promise<void> {
  const response =
    await supabase
      .from(
        "pm_people"
      )
      .update({
        verification_status:
          input.status,
        verification_notes:
          input.notes.trim() ||
          null,
        verified_at:
          input.status === "verified"
            ? new Date().toISOString()
            : null,
        verified_by:
          input.status === "verified"
            ? input.userId
            : null,
      })
      .eq(
        "id",
        input.personId
      );

  if (response.error) {
    throw response.error;
  }
}


/* ==========================================================
   ADMIN SERVICE 008
   Backup / export
   ========================================================== */

function downloadBlob(
  filename: string,
  contents: string,
  mimeType: string
) {
  const blob =
    new Blob(
      [contents],
      {
        type:
          mimeType,
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const anchor =
    document.createElement(
      "a"
    );

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(
    url
  );
}


async function readAll(
  table: string
) {
  const response =
    await supabase
      .from(table)
      .select("*");

  if (response.error) {
    throw response.error;
  }

  return response.data || [];
}


export async function downloadFullBackup(): Promise<void> {
  const tableNames = [
    "pm_organizations",
    "pm_members",
    "pm_instance_settings",
    "pm_cemeteries",
    "pm_sections",
    "pm_rows",
    "pm_plots",
    "pm_people",
    "pm_burials",
    "pm_plot_owners",
    "pm_map_layers",
    "pm_map_features",
    "pm_photos",
    "pm_documents",
    "pm_public_corrections",
    "pm_field_verifications",
    "pm_audit_log",
  ];

  const results =
    await Promise.all(
      tableNames.map(
        async (table) => [
          table,
          await readAll(
            table
          ),
        ] as const
      )
    );

  const backup = {
    format:
      "plotmap-backup",
    version:
      "0.16.0",
    exportedAt:
      new Date().toISOString(),
    tables:
      Object.fromEntries(
        results
      ),
  };

  downloadBlob(
    `plotmap-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`,
    JSON.stringify(
      backup,
      null,
      2
    ),
    "application/json"
  );
}


function csvCell(
  value: unknown
) {
  const text =
    value == null
      ? ""
      : String(value);

  return `"${text.replaceAll(
    '"',
    '""'
  )}"`;
}


export async function downloadBurialCsv(): Promise<void> {
  const [
    people,
    burials,
    plots,
  ] =
    await Promise.all([
      readAll(
        "pm_people"
      ),
      readAll(
        "pm_burials"
      ),
      readAll(
        "pm_plots"
      ),
    ]);

  const personById =
    new Map(
      people.map(
        (person: any) => [
          person.id,
          person,
        ]
      )
    );

  const plotById =
    new Map(
      plots.map(
        (plot: any) => [
          plot.id,
          plot,
        ]
      )
    );

  const header = [
    "Last Name",
    "First Name",
    "Middle Name",
    "Suffix",
    "Birth Date",
    "Death Date",
    "Burial Date",
    "Interment Type",
    "Plot Number",
    "Plot Name",
    "Record Confidence",
  ];

  const rows =
    burials.map(
      (burial: any) => {
        const person =
          personById.get(
            burial.person_id
          ) || {};

        const plot =
          plotById.get(
            burial.plot_id
          ) || {};

        return [
          person.last_name,
          person.first_name,
          person.middle_name,
          person.suffix,
          person.birth_date,
          person.death_date,
          burial.burial_date,
          burial.interment_type,
          plot.plot_number,
          plot.display_name,
          person.verification_status,
        ];
      }
    );

  const csv =
    [
      header,
      ...rows,
    ]
      .map(
        (row) =>
          row
            .map(csvCell)
            .join(",")
      )
      .join("\r\n");

  downloadBlob(
    `plotmap-burial-register-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`,
    csv,
    "text/csv;charset=utf-8"
  );
}


export async function downloadMapGeoJson(): Promise<void> {
  const [
    plots,
    areas,
  ] =
    await Promise.all([
      readAll(
        "pm_plots"
      ),
      readAll(
        "pm_map_features"
      ),
    ]);

  const features: any[] = [];

  for (
    const plot of plots as any[]
  ) {
    if (
      plot.longitude == null ||
      plot.latitude == null
    ) {
      continue;
    }

    features.push({
      type:
        "Feature",
      geometry: {
        type:
          "Point",
        coordinates: [
          Number(
            plot.longitude
          ),
          Number(
            plot.latitude
          ),
        ],
      },
      properties: {
        kind:
          "plot",
        id:
          plot.id,
        plotNumber:
          plot.plot_number,
        displayName:
          plot.display_name,
        status:
          plot.status,
        plotType:
          plot.plot_type,
        plotAreaId:
          plot.plot_area_id,
      },
    });
  }

  for (
    const area of areas as any[]
  ) {
    if (
      area.feature_type !==
        "boundary" ||
      area.metadata?.purpose !==
        "plot_area" ||
      !area.geometry
    ) {
      continue;
    }

    if (
      area.geometry.type ===
      "Polygon"
    ) {
      features.push({
        type:
          "Feature",
        geometry:
          area.geometry,
        properties: {
          kind:
            "plot_area",
          id:
            area.id,
          label:
            area.label,
        },
      });
    }
  }

  downloadBlob(
    `plotmap-map-${new Date()
      .toISOString()
      .slice(0, 10)}.geojson`,
    JSON.stringify(
      {
        type:
          "FeatureCollection",
        features,
      },
      null,
      2
    ),
    "application/geo+json"
  );
}

/* ==========================================================
   ADMIN SERVICE 010
   Person-level public visibility directory
   ========================================================== */

export async function loadPeoplePublicVisibility(): Promise<PersonPublicVisibilityRecord[]> {
  const pageSize = 1000;
  const rows: PersonPublicVisibilityRecord[] = [];

  for (let from = 0; ; from += pageSize) {
    const response =
      await supabase
        .from("pm_people")
        .select(
          "id, first_name, middle_name, last_name, suffix, birth_date, death_date, public_visible, public_visibility_note, public_visibility_updated_at"
        )
        .order("last_name")
        .order("first_name")
        .range(
          from,
          from + pageSize - 1
        );

    if (response.error) {
      throw response.error;
    }

    const page =
      (response.data || []) as PersonPublicVisibilityRecord[];

    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return rows;
}


export async function setPersonPublicVisibility(input: {
  personId: string;
  visible: boolean;
  note?: string | null;
}): Promise<void> {
  const response =
    await supabase.rpc(
      "pm_set_person_public_visibility",
      {
        p_person_id: input.personId,
        p_visible: input.visible,
        p_note: input.note?.trim() || null,
      }
    );

  if (response.error) {
    throw response.error;
  }
}


export async function setAllPeoplePublicVisibility(input: {
  visible: boolean;
  note?: string | null;
}): Promise<number> {
  const response =
    await supabase.rpc(
      "pm_set_all_person_public_visibility",
      {
        p_visible: input.visible,
        p_note: input.note?.trim() || null,
      }
    );

  if (response.error) {
    throw response.error;
  }

  return Number(response.data || 0);
}

