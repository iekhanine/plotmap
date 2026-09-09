/* ==========================================================
   ADMIN TYPES 001
   Instance and cemetery settings
   ========================================================== */

export type InstanceAdminSettings = {
  id: string;
  organization_id: string;
  cemetery_id: string;
  instance_name: string;
  header_subtitle: string;
  demo_enabled: boolean;
  public_portal_enabled: boolean;
  public_portal_title: string | null;
  public_portal_subtitle: string | null;
  public_contact_email: string | null;
  public_contact_phone: string | null;
  public_allow_corrections: boolean;
  public_show_birth_date: boolean;
  public_show_death_date: boolean;
  public_show_biography: boolean;
  public_show_obituary: boolean;
  public_show_plot_location: boolean;
  public_kiosk_enabled: boolean;
  public_show_available_plots: boolean;
  recovery_owner_user_id: string | null;
  installed_at: string;
  updated_at: string;
};

export type CemeteryAdminRecord = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  active: boolean;
};

export type AdminSettingsBundle = {
  instance: InstanceAdminSettings;
  cemetery: CemeteryAdminRecord;
};


/* ==========================================================
   ADMIN TYPES 002
   Public requests / audit / field verification
   ========================================================== */

export type CorrectionStatus =
  | "pending"
  | "reviewing"
  | "resolved"
  | "rejected";

export type PublicCorrectionRecord = {
  id: string;
  organization_id: string;
  cemetery_id: string;
  person_id: string;
  plot_id: string | null;
  requester_name: string;
  requester_email: string;
  relationship: string | null;
  message: string;
  status: CorrectionStatus;
  resolution_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  personName?: string;
  plotLabel?: string;
};

export type AuditRecord = {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  actorName?: string;
};

export type FieldVerificationRecord = {
  id: string;
  organization_id: string;
  cemetery_id: string;
  plot_id: string;
  person_id: string | null;
  user_id: string | null;
  verification_type: "location" | "record";
  observed_latitude: number | null;
  observed_longitude: number | null;
  accuracy_meters: number | null;
  notes: string | null;
  created_at: string;
};

export type AdminOverviewStats = {
  plots: number;
  occupiedPlots: number;
  people: number;
  pendingCorrections: number;
  fieldVerifications: number;
};


/* ==========================================================
   ADMIN TYPES 003
   Per-person public visibility
   ========================================================== */

export type PersonPublicVisibilityRecord = {
  id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  birth_date: string | null;
  death_date: string | null;
  public_visible: boolean;
  public_visibility_note: string | null;
  public_visibility_updated_at: string | null;
};
