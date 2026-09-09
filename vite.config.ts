import {
  defineConfig,
} from "vite";

import react from "@vitejs/plugin-react";

/* ==========================================================
   VITE CONFIG 001
   PlotMap Vite configuration
   ========================================================== */

export default defineConfig({
  plugins: [
    react(),
  ],

  /* ========================================================
     VITE CONFIG 002
     Racine GIS proxy

     Browser:
       /racine-gis/arcgis/...

     Target:
       https://gis.cityofracine.org/arcgis/...

     This means the user's browser does not need the City GIS
     server to provide CORS headers.
     ======================================================== */

  server: {
    proxy: {
      "/racine-gis": {
        target:
          "https://gis.cityofracine.org",

        changeOrigin: true,
        secure: true,

        rewrite: (path) =>
          path.replace(
            /^\/racine-gis/,
            ""
          ),
      },
    },
  },
});
