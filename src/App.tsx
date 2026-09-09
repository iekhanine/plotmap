import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Map from "ol/Map.js";
import View from "ol/View.js";
import Feature from "ol/Feature.js";

import Point from "ol/geom/Point.js";
import Polygon from "ol/geom/Polygon.js";

import ImageLayer from "ol/layer/Image.js";
import TileLayer from "ol/layer/Tile.js";
import VectorLayer from "ol/layer/Vector.js";

import ImageArcGISRest from "ol/source/ImageArcGISRest.js";
import XYZ from "ol/source/XYZ.js";
import VectorSource from "ol/source/Vector.js";

import {
  fromLonLat,
} from "ol/proj.js";

import {
  Fill,
  RegularShape,
  Stroke,
  Style,
  Text,
} from "ol/style.js";

import {
  Crosshair,
  Database,
  LoaderCircle,
  MapPin,
  Search,
  X,
} from "lucide-react";

import "./App.css";

import {
  plotMapConfig,
  type GeographicBounds,
} from "./config/plotmap";

import {
  getPersonDisplayName,
  getYear,
  loadPlotMapDataset,
} from "./services/plotmap";

import type {
  PlotMapDataset,
  PlotRecord,
  PlotStatus,
  SectionGeometry,
} from "./types/plotmap";


/* ==========================================================
   APP 001
   Map status / visual constants
   ========================================================== */

type ImageryStatus =
  | "loading"
  | "racine"
  | "fallback";

const STATUS_COLORS: Record<
  PlotStatus,
  string
> = {
  available: "#27ae60",
  reserved: "#f5a623",
  occupied: "#d64541",
  unavailable: "#697179",
};

const STATUS_LABELS: Record<
  PlotStatus,
  string
> = {
  available: "Available",
  reserved: "Reserved",
  occupied: "Occupied",
  unavailable: "Unavailable",
};


/* ==========================================================
   APP 002
   Coordinate helpers
   ========================================================== */

function percentToLongitude(
  percent: number,
  bounds: GeographicBounds
) {
  return (
    bounds.west +
    (percent / 100) *
      (bounds.east - bounds.west)
  );
}

function percentToLatitude(
  percent: number,
  bounds: GeographicBounds
) {
  return (
    bounds.north -
    (percent / 100) *
      (bounds.north - bounds.south)
  );
}

function percentToMapCoordinate(
  x: number,
  y: number
) {
  return fromLonLat([
    percentToLongitude(
      x,
      plotMapConfig.demoBounds
    ),

    percentToLatitude(
      y,
      plotMapConfig.demoBounds
    ),
  ]);
}

function sectionPolygonCoordinates(
  geometry: SectionGeometry
) {
  const x =
    geometry.x ?? 0;

  const y =
    geometry.y ?? 0;

  const width =
    geometry.width ?? 0;

  const height =
    geometry.height ?? 0;

  return [
    [
      percentToMapCoordinate(
        x,
        y
      ),

      percentToMapCoordinate(
        x + width,
        y
      ),

      percentToMapCoordinate(
        x + width,
        y + height
      ),

      percentToMapCoordinate(
        x,
        y + height
      ),

      percentToMapCoordinate(
        x,
        y
      ),
    ],
  ];
}

function sectionCenterCoordinate(
  geometry: SectionGeometry
) {
  return percentToMapCoordinate(
    (geometry.x ?? 0) +
      (geometry.width ?? 0) / 2,

    (geometry.y ?? 0) +
      (geometry.height ?? 0) / 2
  );
}

function plotCoordinate(
  plot: PlotRecord
) {
  return percentToMapCoordinate(
    plot.x ?? 0,
    plot.y ?? 0
  );
}


/* ==========================================================
   APP 003
   OpenLayers styles
   ========================================================== */

function createSectionStyle(
  label: string
) {
  return new Style({
    fill: new Fill({
      color:
        "rgba(255,255,255,0.025)",
    }),

    stroke: new Stroke({
      color:
        "rgba(255,255,255,0.72)",

      width: 1.5,
    }),

    text: new Text({
      text: label,

      font:
        "700 12px Inter, sans-serif",

      fill: new Fill({
        color: "#ffffff",
      }),

      stroke: new Stroke({
        color:
          "rgba(0,0,0,0.9)",

        width: 3,
      }),
    }),
  });
}

function createPlotStyle(
  status: PlotStatus,
  visible: boolean,
  selected: boolean
) {
  const color =
    visible
      ? STATUS_COLORS[status]
      : "rgba(255,255,255,0.08)";

  return new Style({
    image:
      new RegularShape({
        points: 4,

        radius:
          selected
            ? 7
            : 4.5,

        angle:
          Math.PI / 4,

        fill: new Fill({
          color,
        }),

        stroke: new Stroke({
          color:
            selected
              ? "#ffffff"
              : visible
                ? "rgba(0,0,0,0.72)"
                : "rgba(0,0,0,0.08)",

          width:
            selected
              ? 2.2
              : 1,
        }),
      }),
  });
}


/* ==========================================================
   APP 004
   Main component
   ========================================================== */

export default function App() {
  const mapContainerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const mapRef =
    useRef<Map | null>(
      null
    );

  const sectionsSourceRef =
    useRef<VectorSource | null>(
      null
    );

  const plotsSourceRef =
    useRef<VectorSource | null>(
      null
    );

  const [
    dataset,
    setDataset,
  ] =
    useState<PlotMapDataset | null>(
      null
    );

  const [
    selectedPlotId,
    setSelectedPlotId,
  ] =
    useState<string | null>(
      null
    );

  const [
    searchTerm,
    setSearchTerm,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<PlotStatus | "all">(
      "all"
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    mapReady,
    setMapReady,
  ] =
    useState(false);

  const [
    imageryStatus,
    setImageryStatus,
  ] =
    useState<ImageryStatus>(
      "loading"
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );


  /* ========================================================
     APP 005
     Load cemetery records from Supabase
     ======================================================== */

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);

        const nextDataset =
          await loadPlotMapDataset(
            plotMapConfig.cemeterySlug
          );

        if (active) {
          setDataset(
            nextDataset
          );
        }
      } catch (loadError) {
        console.error(
          "PlotMap database error:",
          loadError
        );

        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load PlotMap data."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);


  /* ========================================================
     APP 006
     Create OpenLayers map

     We always load the fallback aerial first.

     The Racine ArcGIS MapServer is then drawn over it through
     ImageArcGISRest. If that layer fails, the fallback remains
     visible and PlotMap itself still works.
     ======================================================== */

  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    const fallbackLayer =
      new TileLayer({
        source: new XYZ({
          url:
            plotMapConfig
              .fallbackTileUrl,

          crossOrigin:
            "anonymous",

          attributions:
            "Tiles © Esri",
        }),

        zIndex: 0,
      });

    const racineSource =
      new ImageArcGISRest({
        url:
          plotMapConfig
            .racineAerialServiceUrl,

        ratio: 1,

        params: {
          FORMAT: "JPG",
          TRANSPARENT: false,
        },

        crossOrigin:
          "anonymous",
      });

    const racineLayer =
      new ImageLayer({
        source:
          racineSource,

        opacity: 1,
        zIndex: 1,
      });

    const sectionsSource =
      new VectorSource();

    const plotsSource =
      new VectorSource();

    sectionsSourceRef.current =
      sectionsSource;

    plotsSourceRef.current =
      plotsSource;

    const sectionsLayer =
      new VectorLayer({
        source:
          sectionsSource,

        zIndex: 10,
      });

    const plotsLayer =
      new VectorLayer({
        source:
          plotsSource,

        zIndex: 20,
      });

    const view =
      new View({
        center:
          fromLonLat([
            plotMapConfig
              .initialView
              .longitude,

            plotMapConfig
              .initialView
              .latitude,
          ]),

        zoom:
          plotMapConfig
            .initialView
            .zoom,

        minZoom: 13,
        maxZoom: 22,
      });

    const map =
      new Map({
        target:
          mapContainerRef.current,

        layers: [
          fallbackLayer,
          racineLayer,
          sectionsLayer,
          plotsLayer,
        ],

        view,
      });

    mapRef.current =
      map;

    /*
     * OpenLayers map creation is synchronous.
     * We no longer wait indefinitely for an SDK MapView.
     */
    setMapReady(true);

    let racineFailed =
      false;

    const handleRacineStart =
      () => {
        if (!racineFailed) {
          setImageryStatus(
            "loading"
          );
        }
      };

    const handleRacineLoaded =
      () => {
        if (!racineFailed) {
          setImageryStatus(
            "racine"
          );
        }
      };

    const handleRacineError =
      () => {
        racineFailed =
          true;

        console.warn(
          "PlotMap: Racine GIS aerial could not load. Using fallback aerial."
        );

        racineLayer.setVisible(
          false
        );

        setImageryStatus(
          "fallback"
        );
      };

    racineSource.on(
      "imageloadstart",
      handleRacineStart
    );

    racineSource.on(
      "imageloadend",
      handleRacineLoaded
    );

    racineSource.on(
      "imageloaderror",
      handleRacineError
    );

    /*
     * Plot click handling.
     */
    const handleClick =
      (event: any) => {
        const feature =
          map.forEachFeatureAtPixel(
            event.pixel,
            (candidate) => {
              if (
                candidate.get(
                  "kind"
                ) === "plot"
              ) {
                return candidate;
              }

              return undefined;
            }
          );

        const plotId =
          feature?.get(
            "plotId"
          );

        if (plotId) {
          setSelectedPlotId(
            plotId
          );
        }
      };

    map.on(
      "singleclick",
      handleClick
    );

    /*
     * Safety fallback:
     * If the municipal image layer never emits success or
     * failure, don't leave the UI saying "loading" forever.
     */
    const imageryTimer =
      window.setTimeout(
        () => {
          setImageryStatus(
            (current) =>
              current ===
              "loading"
                ? "fallback"
                : current
          );
        },
        6000
      );

    return () => {
      window.clearTimeout(
        imageryTimer
      );

      racineSource.un(
        "imageloadstart",
        handleRacineStart
      );

      racineSource.un(
        "imageloadend",
        handleRacineLoaded
      );

      racineSource.un(
        "imageloaderror",
        handleRacineError
      );

      map.un(
        "singleclick",
        handleClick
      );

      map.setTarget(
        undefined
      );

      mapRef.current =
        null;

      sectionsSourceRef.current =
        null;

      plotsSourceRef.current =
        null;
    };
  }, []);


  /* ========================================================
     APP 007
     Search / filtering
     ======================================================== */

  const filteredPlots =
    useMemo(() => {
      if (!dataset) {
        return [];
      }

      const normalized =
        searchTerm
          .trim()
          .toLowerCase();

      return dataset.plots.filter(
        (plot) => {
          if (
            statusFilter !== "all" &&
            plot.status !==
              statusFilter
          ) {
            return false;
          }

          if (!normalized) {
            return true;
          }

          const names =
            plot.burials
              .map(
                ({ person }) =>
                  getPersonDisplayName(
                    person
                  )
              )
              .join(" ");

          const haystack = [
            plot.display_name,
            plot.plot_number,
            plot.section?.name,
            plot.row?.name,
            names,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(
            normalized
          );
        }
      );
    }, [
      dataset,
      searchTerm,
      statusFilter,
    ]);

  const visiblePlotIds =
    useMemo(
      () =>
        new Set(
          filteredPlots.map(
            (plot) =>
              plot.id
          )
        ),
      [filteredPlots]
    );


  /* ========================================================
     APP 008
     Draw cemetery sections
     ======================================================== */

  useEffect(() => {
    const source =
      sectionsSourceRef.current;

    if (
      !source ||
      !dataset ||
      !mapReady
    ) {
      return;
    }

    source.clear();

    for (
      const section
      of dataset.sections
    ) {
      const geometry =
        section.geometry;

      if (
        !geometry ||
        geometry.x == null ||
        geometry.y == null ||
        geometry.width == null ||
        geometry.height == null
      ) {
        continue;
      }

      const feature =
        new Feature({
          geometry:
            new Polygon(
              sectionPolygonCoordinates(
                geometry
              )
            ),

          kind:
            "section",

          sectionId:
            section.id,
        });

      /*
       * OpenLayers text is anchored to the polygon interior,
       * so we don't need a second label feature.
       */
      feature.setStyle(
        createSectionStyle(
          section.name
        )
      );

      source.addFeature(
        feature
      );
    }
  }, [
    dataset,
    mapReady,
  ]);


  /* ========================================================
     APP 009
     Draw individual plot markers
     ======================================================== */

  useEffect(() => {
    const source =
      plotsSourceRef.current;

    if (
      !source ||
      !dataset ||
      !mapReady
    ) {
      return;
    }

    source.clear();

    for (
      const plot
      of dataset.plots
    ) {
      if (
        plot.x == null ||
        plot.y == null
      ) {
        continue;
      }

      const visible =
        visiblePlotIds.has(
          plot.id
        );

      const selected =
        selectedPlotId ===
        plot.id;

      const feature =
        new Feature({
          geometry:
            new Point(
              plotCoordinate(
                plot
              )
            ),

          kind:
            "plot",

          plotId:
            plot.id,

          status:
            plot.status,
        });

      feature.setStyle(
        createPlotStyle(
          plot.status,
          visible,
          selected
        )
      );

      source.addFeature(
        feature
      );
    }
  }, [
    dataset,
    mapReady,
    selectedPlotId,
    visiblePlotIds,
  ]);


  /* ========================================================
     APP 010
     Selected plot / navigation
     ======================================================== */

  const selectedPlot =
    dataset?.plots.find(
      (plot) =>
        plot.id ===
        selectedPlotId
    ) || null;

  function focusPlot(
    plot: PlotRecord
  ) {
    setSelectedPlotId(
      plot.id
    );

    const map =
      mapRef.current;

    if (!map) {
      return;
    }

    map.getView().animate({
      center:
        plotCoordinate(
          plot
        ),

      zoom: 20.25,

      duration: 650,
    });
  }

  function resetMap() {
    const map =
      mapRef.current;

    if (!map) {
      return;
    }

    map.getView().animate({
      center:
        fromLonLat([
          plotMapConfig
            .initialView
            .longitude,

          plotMapConfig
            .initialView
            .latitude,
        ]),

      zoom:
        plotMapConfig
          .initialView
          .zoom,

      duration: 500,
    });

    setSelectedPlotId(
      null
    );
  }


  /* ========================================================
     APP 011
     Statistics
     ======================================================== */

  const stats =
    useMemo(() => {
      const plots =
        dataset?.plots || [];

      return {
        total:
          plots.length,

        occupied:
          plots.filter(
            (plot) =>
              plot.status ===
              "occupied"
          ).length,

        available:
          plots.filter(
            (plot) =>
              plot.status ===
              "available"
          ).length,

        reserved:
          plots.filter(
            (plot) =>
              plot.status ===
              "reserved"
          ).length,
      };
    }, [dataset]);


  /* ========================================================
     APP 012
     Render
     ======================================================== */

  return (
    <div className="plotmap-shell">
      <header className="plotmap-header">
        <div className="plotmap-brand">
          <div className="plotmap-brand-icon">
            <MapPin
              size={19}
            />
          </div>

          <div>
            <strong>
              PlotMap
            </strong>

            <span>
              Cemetery Mapping Prototype
            </span>
          </div>
        </div>

        <div className="plotmap-header-status">
          <span
            className={
              mapReady
                ? "status-dot ready"
                : "status-dot"
            }
          />

          {!mapReady &&
            "Loading map"}

          {mapReady &&
            imageryStatus ===
              "loading" &&
            "Loading Racine aerial"}

          {mapReady &&
            imageryStatus ===
              "racine" &&
            "Racine 2025 aerial"}

          {mapReady &&
            imageryStatus ===
              "fallback" &&
            "Fallback aerial"}
        </div>
      </header>

      <main className="plotmap-workspace">
        <aside className="plotmap-sidebar">
          <section className="cemetery-summary">
            <span className="eyebrow">
              DEMO CEMETERY
            </span>

            <h1>
              {dataset?.cemetery
                .name ||
                "Loading cemetery…"}
            </h1>

            <p>
              {dataset?.cemetery
                .address_line_1}

              {dataset?.cemetery
                .city
                ? ` · ${dataset.cemetery.city}, ${dataset.cemetery.state}`
                : ""}
            </p>
          </section>

          <section className="search-section">
            <div className="search-box">
              <Search
                size={16}
              />

              <input
                value={
                  searchTerm
                }
                onChange={
                  (event) =>
                    setSearchTerm(
                      event.target
                        .value
                    )
                }
                placeholder="Search person or plot…"
              />

              {searchTerm && (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() =>
                    setSearchTerm(
                      ""
                    )
                  }
                  aria-label="Clear search"
                >
                  <X
                    size={15}
                  />
                </button>
              )}
            </div>

            <div className="filter-row">
              {(
                [
                  "all",
                  "available",
                  "occupied",
                  "reserved",
                ] as const
              ).map(
                (filter) => (
                  <button
                    key={
                      filter
                    }
                    type="button"
                    className={
                      statusFilter ===
                      filter
                        ? "filter-chip active"
                        : "filter-chip"
                    }
                    onClick={() =>
                      setStatusFilter(
                        filter
                      )
                    }
                  >
                    {filter ===
                    "all"
                      ? "All"
                      : STATUS_LABELS[
                          filter
                        ]}
                  </button>
                )
              )}
            </div>
          </section>

          <section className="stats-grid">
            <div>
              <strong>
                {
                  stats.total
                }
              </strong>
              <span>
                Total plots
              </span>
            </div>

            <div>
              <strong>
                {
                  stats.occupied
                }
              </strong>
              <span>
                Occupied
              </span>
            </div>

            <div>
              <strong>
                {
                  stats.available
                }
              </strong>
              <span>
                Available
              </span>
            </div>

            <div>
              <strong>
                {
                  stats.reserved
                }
              </strong>
              <span>
                Reserved
              </span>
            </div>
          </section>

          <section className="results-section">
            <div className="section-heading">
              <span>
                {searchTerm ||
                statusFilter !==
                  "all"
                  ? "Results"
                  : "Plots"}
              </span>

              <small>
                {
                  filteredPlots.length
                }
              </small>
            </div>

            <div className="results-list">
              {filteredPlots
                .slice(
                  0,
                  80
                )
                .map(
                  (plot) => {
                    const firstBurial =
                      plot
                        .burials[0];

                    return (
                      <button
                        type="button"
                        key={
                          plot.id
                        }
                        className={
                          selectedPlotId ===
                          plot.id
                            ? "result-card selected"
                            : "result-card"
                        }
                        onClick={() =>
                          focusPlot(
                            plot
                          )
                        }
                      >
                        <span
                          className={`plot-status ${plot.status}`}
                        />

                        <span className="result-copy">
                          <strong>
                            {firstBurial
                              ? getPersonDisplayName(
                                  firstBurial.person
                                )
                              : plot.display_name ||
                                `Plot ${plot.plot_number}`}
                          </strong>

                          <small>
                            {
                              plot
                                .section
                                ?.name
                            }
                            {" · "}
                            {
                              plot
                                .row
                                ?.name
                            }
                            {" · "}
                            Plot{" "}
                            {
                              plot.plot_number
                            }
                          </small>
                        </span>
                      </button>
                    );
                  }
                )}
            </div>
          </section>
        </aside>

        <section className="plotmap-map-panel">
          <div
            ref={
              mapContainerRef
            }
            className="plotmap-map"
          />

          <div className="map-toolbar">
            <button
              type="button"
              onClick={
                resetMap
              }
            >
              <Crosshair
                size={15}
              />
              Cemetery
            </button>
          </div>

          <div className="map-legend">
            <span>
              <i className="legend available" />
              Available
            </span>

            <span>
              <i className="legend occupied" />
              Occupied
            </span>

            <span>
              <i className="legend reserved" />
              Reserved
            </span>
          </div>

          <div className="prototype-notice">
            <Database
              size={14}
            />

            {imageryStatus ===
              "racine" &&
              "Racine 2025 aerial · live Supabase records"}

            {imageryStatus ===
              "fallback" &&
              "Fallback aerial · live Supabase records"}

            {imageryStatus ===
              "loading" &&
              "Connecting to Racine aerial…"}
          </div>

          {loading &&
            !error && (
              <div className="map-loading">
                <LoaderCircle
                  size={30}
                  className="spin"
                />

                <strong>
                  Loading PlotMap…
                </strong>

                <span>
                  Loading cemetery records.
                </span>
              </div>
            )}

          {error && (
            <div className="map-error">
              <strong>
                PlotMap could not start
              </strong>

              <span>
                {error}
              </span>
            </div>
          )}

          {selectedPlot && (
            <article className="plot-detail-card">
              <button
                type="button"
                className="detail-close"
                onClick={() =>
                  setSelectedPlotId(
                    null
                  )
                }
                aria-label="Close plot details"
              >
                <X
                  size={17}
                />
              </button>

              <span
                className={`detail-status ${selectedPlot.status}`}
              >
                {
                  STATUS_LABELS[
                    selectedPlot
                      .status
                  ]
                }
              </span>

              <h2>
                {selectedPlot
                  .burials[0]
                  ? getPersonDisplayName(
                      selectedPlot
                        .burials[0]
                        .person
                    )
                  : selectedPlot
                      .display_name ||
                    `Plot ${selectedPlot.plot_number}`}
              </h2>

              {selectedPlot
                .burials[0] && (
                <p className="life-dates">
                  {getYear(
                    selectedPlot
                      .burials[0]
                      .person
                      .birth_date
                  )}
                  {" — "}
                  {getYear(
                    selectedPlot
                      .burials[0]
                      .person
                      .death_date
                  )}
                </p>
              )}

              <dl>
                <div>
                  <dt>
                    Section
                  </dt>

                  <dd>
                    {selectedPlot
                      .section
                      ?.name ||
                      "—"}
                  </dd>
                </div>

                <div>
                  <dt>
                    Row
                  </dt>

                  <dd>
                    {selectedPlot
                      .row
                      ?.name ||
                      "—"}
                  </dd>
                </div>

                <div>
                  <dt>
                    Plot
                  </dt>

                  <dd>
                    {
                      selectedPlot
                        .plot_number
                    }
                  </dd>
                </div>

                <div>
                  <dt>
                    Type
                  </dt>

                  <dd>
                    {
                      selectedPlot
                        .plot_type
                    }
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                className="primary-action"
                onClick={() =>
                  focusPlot(
                    selectedPlot
                  )
                }
              >
                <MapPin
                  size={16}
                />
                Center on plot
              </button>
            </article>
          )}
        </section>
      </main>
    </div>
  );
}
