import {
  StrictMode,
} from "react";

import {
  createRoot,
} from "react-dom/client";

import "ol/ol.css";

import "./index.css";
import App from "./App.tsx";

/* ==========================================================
   MAIN 001
   PlotMap application entry
   ========================================================== */

createRoot(
  document.getElementById("root")!
).render(
  <StrictMode>
    <App />
  </StrictMode>
);
