/* ==========================================================
   PUBLIC TYPES 001
   Map areas and portal configuration
   ========================================================== */

export type PublicMapArea = {
  id: string;
  label: string;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  } | {
    type: "bbox";
    west: number;
    south: number;
    east: number;
    north: number;
  };
};

export type PublicPortalConfig = {
  instanceName: string;
  headerSubtitle: string;
  publicEnabled: boolean;
  demoEnabled: boolean;
  publicTitle: string;
  publicSubtitle: string;
  contactEmail: string | null;
  contactPhone: string | null;
  allowCorrections: boolean;
  showBirthDate: boolean;
  showDeathDate: boolean;
  showBiography: boolean;
  showObituary: boolean;
  showPlotLocation: boolean;
  kioskEnabled: boolean;
  showAvailablePlots: boolean;
  cemetery: {
    id: string;
    name: string;
    slug: string;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
    description: string | null;
  };
  mapAreas: PublicMapArea[];
};


/* ==========================================================
   PUBLIC TYPES 002
   Search / memorial records
   ========================================================== */

export type PublicSearchResult = {
  personId: string;
  plotId: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  birthDate: string | null;
  deathDate: string | null;
  verificationStatus: string;
  plotNumber: string | null;
  plotName: string | null;
  areaName: string | null;
  latitude: number | null;
  longitude: number | null;
  intermentType: string;
  burialDate: string | null;
};

export type PublicPhoto = {
  id: string;
  title: string | null;
  description: string | null;
  bucket: string;
  path: string;
};

export type PublicMemorial = PublicSearchResult & {
  biography: string | null;
  obituary: string | null;
  allowCorrections: boolean;
  photos: PublicPhoto[];
};


/* ==========================================================
   PUBLIC TYPES 003
   Map-first cemetery browser
   ========================================================== */

export type PublicMapOccupant = {
  personId: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  birthDate: string | null;
  deathDate: string | null;
  verificationStatus: string;
};

export type PublicMapMarker = {
  plotId: string;
  plotNumber: string | null;
  plotName: string | null;
  areaName: string | null;
  latitude: number;
  longitude: number;
  occupants: PublicMapOccupant[];
};

export type PublicAvailablePlot = {
  plotId: string;
  plotNumber: string;
  plotName: string | null;
  plotType: string;
  areaName: string | null;
  latitude: number | null;
  longitude: number | null;
};
