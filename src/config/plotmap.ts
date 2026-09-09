/* ==========================================================
   PLOTMAP CONFIG 001
   Client / map configuration
   ========================================================== */

export type GeographicBounds = {
  west: number;
  east: number;
  north: number;
  south: number;
};

export const plotMapConfig = {
  productName: "PlotMap",

  cemeterySlug:
    import.meta.env.VITE_CEMETERY_SLUG ||
    "old-holy-cross-demo",

  /*
   * CONFIG 002
   * Preferred imagery.
   *
   * PlotMap requests the City of Racine ArcGIS REST service
   * through our own same-origin proxy.
   */
  racineAerialServiceUrl:
    import.meta.env.VITE_ARCGIS_MAP_SERVICE_URL ||
    "/racine-gis/arcgis/rest/services/Aerial/Aerial_2025/MapServer",

  /*
   * CONFIG 003
   * Fallback aerial imagery.
   *
   * This is a tiled ArcGIS World Imagery service. It loads
   * underneath the municipal aerial, so the map is still
   * usable if the Racine service is unavailable.
   */
  fallbackTileUrl:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",

  initialView: {
    longitude: -87.8164,
    latitude: 42.7242,
    zoom: 17.2,
  },

  /*
   * CONFIG 004
   * Temporary prototype bounds.
   *
   * The seed SQL used normalized X/Y percentages rather than
   * surveyed coordinates. These bounds place those synthetic
   * demo coordinates roughly over the test cemetery.
   *
   * The future Map Editor will replace this with true GIS
   * coordinates for every section, row and plot.
   */
  demoBounds: {
    west: -87.8194,
    east: -87.8134,
    north: 42.7276,
    south: 42.7204,
  } satisfies GeographicBounds,
};
