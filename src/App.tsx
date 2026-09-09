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

import ExtentInteraction from "ol/interaction/Extent.js";

import ImageLayer from "ol/layer/Image.js";
import TileLayer from "ol/layer/Tile.js";
import VectorLayer from "ol/layer/Vector.js";

import ImageArcGISRest from "ol/source/ImageArcGISRest.js";
import XYZ from "ol/source/XYZ.js";
import VectorSource from "ol/source/Vector.js";

import {
  never,
} from "ol/events/condition.js";

import {
  fromLonLat,
  toLonLat,
  transformExtent,
} from "ol/proj.js";

import {
  Fill,
  RegularShape,
  Stroke,
  Style,
  Text,
} from "ol/style.js";

import {
  BoxSelect,
  Crosshair,
  Database,
  LoaderCircle,
  MapPin,
  MousePointerClick,
  Pencil,
  Save,
  Search,
  Undo2,
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
  createPlotsBatch,
  updateMapAreaGeometry,
  updateMapAreaLabel,
  updatePlotPlacement,
  updatePlotPlacementsBatch,
} from "./services/plotmap";

import type {
  MapAreaGeometry,
  NewPlotPlacement,
  PlotMapDataset,
  PlotPlacementUpdate,
  PlotRecord,
  PlotStatus,
} from "./types/plotmap";


/* ==========================================================
   APP 001
   Editor state types
   ========================================================== */

type ImageryStatus =
  | "loading"
  | "racine"
  | "fallback";

type EditorMode =
  | "browse"
  | "place"
  | "batch-place"
  | "resize-area";

type PendingPlacement = PlotPlacementUpdate;


/* ==========================================================
   APP 002
   Status constants
   ========================================================== */

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
   APP 003
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

function plotHasRealPlacement(
  plot: PlotRecord
) {
  return (
    plot.longitude != null &&
    plot.latitude != null
  );
}

function plotCoordinate(
  plot: PlotRecord,
  override?: PendingPlacement | null
) {
  if (
    override &&
    override.plotId === plot.id
  ) {
    return fromLonLat([
      override.longitude,
      override.latitude,
    ]);
  }

  if (plotHasRealPlacement(plot)) {
    return fromLonLat([
      plot.longitude as number,
      plot.latitude as number,
    ]);
  }

  return percentToMapCoordinate(
    plot.x ?? 0,
    plot.y ?? 0
  );
}

function areaGeometryToViewExtent(
  geometry: MapAreaGeometry
) {
  return transformExtent(
    [
      geometry.west,
      geometry.south,
      geometry.east,
      geometry.north,
    ],
    "EPSG:4326",
    "EPSG:3857"
  );
}

function viewExtentToAreaGeometry(
  extent: number[]
): MapAreaGeometry {
  const [
    west,
    south,
    east,
    north,
  ] =
    transformExtent(
      extent,
      "EPSG:3857",
      "EPSG:4326"
    );

  return {
    type: "bbox",
    west,
    south,
    east,
    north,
  };
}

function areaPolygonCoordinates(
  geometry: MapAreaGeometry
) {
  return [
    [
      fromLonLat([
        geometry.west,
        geometry.north,
      ]),
      fromLonLat([
        geometry.east,
        geometry.north,
      ]),
      fromLonLat([
        geometry.east,
        geometry.south,
      ]),
      fromLonLat([
        geometry.west,
        geometry.south,
      ]),
      fromLonLat([
        geometry.west,
        geometry.north,
      ]),
    ],
  ];
}

function comparePlotsForBatch(
  a: PlotRecord,
  b: PlotRecord
) {
  const sectionCompare =
    (a.section?.sort_order ?? 0) -
    (b.section?.sort_order ?? 0);

  if (sectionCompare !== 0) {
    return sectionCompare;
  }

  const rowCompare =
    (a.row?.sort_order ?? 0) -
    (b.row?.sort_order ?? 0);

  if (rowCompare !== 0) {
    return rowCompare;
  }

  return a.plot_number.localeCompare(
    b.plot_number,
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    }
  );
}

function getPlotShortLabel(
  plot: PlotRecord
) {
  return [
    plot.section?.name,
    plot.row?.name,
    `Plot ${plot.plot_number}`,
  ]
    .filter(Boolean)
    .join(" · ");
}


/* ==========================================================
   APP 004
   OpenLayers styles
   ========================================================== */

function createAreaStyle(
  label: string
) {
  return new Style({
    fill: new Fill({
      color:
        "rgba(70,190,255,0.07)",
    }),

    stroke: new Stroke({
      color:
        "rgba(70,190,255,0.95)",
      width: 2,
    }),

    text: new Text({
      text:
        label ||
        "Map Area",

      font:
        "700 12px Inter, sans-serif",

      fill: new Fill({
        color: "#dff6ff",
      }),

      stroke: new Stroke({
        color:
          "rgba(0,0,0,0.95)",
        width: 3,
      }),
    }),
  });
}

function createPlotStyle(
  status: PlotStatus,
  visible: boolean,
  selected: boolean,
  mapped: boolean,
  pending: boolean
) {
  const color =
    visible
      ? STATUS_COLORS[status]
      : "rgba(255,255,255,0.08)";

  let outlineColor =
    visible
      ? "rgba(0,0,0,0.72)"
      : "rgba(0,0,0,0.08)";

  let outlineWidth = 1;

  if (mapped) {
    outlineColor =
      "rgba(70,190,255,0.95)";
    outlineWidth = 1.6;
  }

  if (selected) {
    outlineColor = "#ffffff";
    outlineWidth = 2.2;
  }

  if (pending) {
    outlineColor = "#65d7ff";
    outlineWidth = 3;
  }

  return new Style({
    image:
      new RegularShape({
        points: 4,
        radius:
          pending
            ? 8
            : selected
              ? 7
              : 4.5,
        angle:
          Math.PI / 4,
        fill:
          new Fill({
            color,
          }),
        stroke:
          new Stroke({
            color:
              outlineColor,
            width:
              outlineWidth,
          }),
      }),
  });
}


/* ==========================================================
   APP 005
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

  const areaSourceRef =
    useRef<VectorSource | null>(
      null
    );

  const plotsSourceRef =
    useRef<VectorSource | null>(
      null
    );

  const extentInteractionRef =
    useRef<ExtentInteraction | null>(
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

  const [
    editorOpen,
    setEditorOpen,
  ] =
    useState(false);

  const [
    editorMode,
    setEditorMode,
  ] =
    useState<EditorMode>(
      "browse"
    );

  const [
    pendingPlacement,
    setPendingPlacement,
  ] =
    useState<PendingPlacement | null>(
      null
    );

  const [
    batchPlacements,
    setBatchPlacements,
  ] =
    useState<PendingPlacement[]>(
      []
    );

  /*
   * APP 005A
   * Freeform batch placement.
   *
   * These are NEW plot records that do not exist in Supabase
   * yet. Each map click stages one new plot.
   */
  const [
    newBatchPlots,
    setNewBatchPlots,
  ] =
    useState<NewPlotPlacement[]>(
      []
    );

  const [
    nextPlotNumber,
    setNextPlotNumber,
  ] =
    useState(1);

  const [
    batchStartIndex,
    setBatchStartIndex,
  ] =
    useState(0);

  const [
    pendingAreaGeometry,
    setPendingAreaGeometry,
  ] =
    useState<MapAreaGeometry | null>(
      null
    );

  const [
    savingPlacement,
    setSavingPlacement,
  ] =
    useState(false);

  const [
    savingBatch,
    setSavingBatch,
  ] =
    useState(false);

  const [
    savingArea,
    setSavingArea,
  ] =
    useState(false);

  const [
    editorMessage,
    setEditorMessage,
  ] =
    useState<string | null>(
      null
    );

  const [
    areaName,
    setAreaName,
  ] =
    useState("");

  const [
    savingAreaName,
    setSavingAreaName,
  ] =
    useState(false);


  /* ========================================================
     APP 006
     Load cemetery data
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

          setAreaName(
            nextDataset.mapArea?.label ||
            ""
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
     APP 007
     Search / batch candidate ordering
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

  const nextSuggestedPlotNumber =
    useMemo(() => {
      if (!dataset) {
        return 1;
      }

      let highest = 0;

      for (
        const plot
        of dataset.plots
      ) {
        const match =
          plot.plot_number.match(
            /(\d+)$/
          );

        if (!match) {
          continue;
        }

        const value =
          Number(
            match[1]
          );

        if (
          Number.isFinite(value) &&
          value > highest
        ) {
          highest = value;
        }
      }

      return highest + 1;
    }, [dataset]);

  const batchPlacementByPlotId =
    useMemo(
      () =>
        new Map(
          batchPlacements.map(
            (placement) => [
              placement.plotId,
              placement,
            ]
          )
        ),
      [batchPlacements]
    );



  /* ========================================================
     APP 008
     Create OpenLayers map
     ======================================================== */

  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    const fallbackLayer =
      new TileLayer({
        source:
          new XYZ({
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

    const areaSource =
      new VectorSource();

    const plotsSource =
      new VectorSource();

    areaSourceRef.current =
      areaSource;

    plotsSourceRef.current =
      plotsSource;

    const areaLayer =
      new VectorLayer({
        source:
          areaSource,
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

    const extentInteraction =
      new ExtentInteraction({
        condition:
          never,

        pixelTolerance: 14,

        boxStyle: {
          "fill-color":
            "rgba(70,190,255,0.13)",

          "stroke-color":
            "#46beff",

          "stroke-width":
            2.5,
        },
      });

    extentInteraction.setActive(
      false
    );

    const map =
      new Map({
        target:
          mapContainerRef.current,

        layers: [
          fallbackLayer,
          racineLayer,
          areaLayer,
          plotsLayer,
        ],

        view,
      });

    map.addInteraction(
      extentInteraction
    );

    mapRef.current =
      map;

    extentInteractionRef.current =
      extentInteraction;

    setMapReady(
      true
    );

    let racineFailed =
      false;

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

        racineLayer.setVisible(
          false
        );

        setImageryStatus(
          "fallback"
        );
      };

    racineSource.on(
      "imageloadend",
      handleRacineLoaded
    );

    racineSource.on(
      "imageloaderror",
      handleRacineError
    );

    const handleExtentChanged =
      (event: any) => {
        const extent =
          event.extent as
            | number[]
            | null
            | undefined;

        if (
          !extent ||
          extent.length !== 4
        ) {
          return;
        }

        setPendingAreaGeometry(
          viewExtentToAreaGeometry(
            extent
          )
        );

        setEditorMessage(
          "Area preview changed. Save when it looks right."
        );
      };

    extentInteraction.on(
      "extentchanged",
      handleExtentChanged
    );

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
        "imageloadend",
        handleRacineLoaded
      );

      racineSource.un(
        "imageloaderror",
        handleRacineError
      );

      extentInteraction.un(
        "extentchanged",
        handleExtentChanged
      );

      map.removeInteraction(
        extentInteraction
      );

      map.setTarget(
        undefined
      );

      mapRef.current =
        null;

      areaSourceRef.current =
        null;

      plotsSourceRef.current =
        null;

      extentInteractionRef.current =
        null;
    };
  }, []);


  /* ========================================================
     APP 009
     Map click behavior
     ======================================================== */

  useEffect(() => {
    const map =
      mapRef.current;

    if (
      !map ||
      !mapReady
    ) {
      return;
    }

    const handleClick =
      (event: any) => {
        if (
          editorMode ===
          "resize-area"
        ) {
          return;
        }

        if (
          editorOpen &&
          editorMode ===
            "batch-place"
        ) {
          const [
            longitude,
            latitude,
          ] =
            toLonLat(
              event.coordinate
            );

          const plotNumber =
            String(
              nextPlotNumber +
              newBatchPlots.length
            );

          const nextPlot: NewPlotPlacement = {
            tempId:
              crypto.randomUUID(),

            plotNumber,

            displayName:
              `Plot ${plotNumber}`,

            longitude,
            latitude,
          };

          setNewBatchPlots(
            (current) => [
              ...current,
              nextPlot,
            ]
          );

          setEditorMessage(
            `Staged ${nextPlot.displayName}. Keep clicking; save the whole batch when you're done.`
          );

          return;
        }

        if (
          editorOpen &&
          editorMode === "place" &&
          selectedPlotId
        ) {
          const [
            longitude,
            latitude,
          ] =
            toLonLat(
              event.coordinate
            );

          setPendingPlacement({
            plotId:
              selectedPlotId,
            longitude,
            latitude,
          });

          setEditorMessage(
            "Placement preview updated. Save when the marker is centered on the headstone."
          );

          return;
        }

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
          ) as Feature | undefined;

        const plotId =
          feature?.get(
            "plotId"
          );

        if (plotId) {
          setSelectedPlotId(
            plotId
          );

          setEditorMessage(
            null
          );
        }
      };

    map.on(
      "singleclick",
      handleClick
    );

    return () => {
      map.un(
        "singleclick",
        handleClick
      );
    };
  }, [
    mapReady,
    editorOpen,
    editorMode,
    selectedPlotId,
    nextPlotNumber,
    newBatchPlots.length,
  ]);


  /* ========================================================
     APP 010
     Draw the ONE Plot Area
     ======================================================== */

  useEffect(() => {
    const source =
      areaSourceRef.current;

    if (
      !source ||
      !dataset ||
      !mapReady
    ) {
      return;
    }

    source.clear();

    if (
      editorMode ===
      "resize-area"
    ) {
      return;
    }

    const geometry =
      dataset.mapArea?.geometry;

    if (!geometry) {
      return;
    }

    const feature =
      new Feature({
        geometry:
          new Polygon(
            areaPolygonCoordinates(
              geometry
            )
          ),

        kind:
          "plot-area",

        areaId:
          dataset.mapArea.id,
      });

    feature.setStyle(
      createAreaStyle(
        dataset.mapArea.label ||
        "Map Area"
      )
    );

    source.addFeature(
      feature
    );
  }, [
    dataset,
    mapReady,
    editorMode,
  ]);


  /* ========================================================
     APP 011
     Draw individual plots / staged batch dots
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
        plot.x == null &&
        !plotHasRealPlacement(
          plot
        )
      ) {
        continue;
      }

      const batchOverride =
        batchPlacementByPlotId.get(
          plot.id
        ) || null;

      const singleOverride =
        pendingPlacement?.plotId ===
        plot.id
          ? pendingPlacement
          : null;

      const activeOverride =
        batchOverride ||
        singleOverride;

      const visible =
        visiblePlotIds.has(
          plot.id
        );

      const selected =
        selectedPlotId ===
        plot.id;

      const pending =
        activeOverride != null;

      const feature =
        new Feature({
          geometry:
            new Point(
              plotCoordinate(
                plot,
                activeOverride
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
          selected,
          plotHasRealPlacement(
            plot
          ),
          pending
        )
      );

      source.addFeature(
        feature
      );
    }

    /*
     * Draw newly staged plots that do not exist in the
     * database yet.
     */
    for (
      const staged
      of newBatchPlots
    ) {
      const stagedFeature =
        new Feature({
          geometry:
            new Point(
              fromLonLat([
                staged.longitude,
                staged.latitude,
              ])
            ),

          kind:
            "staged-new-plot",

          tempId:
            staged.tempId,
        });

      stagedFeature.setStyle(
        new Style({
          image:
            new RegularShape({
              points: 4,
              radius: 7,
              angle:
                Math.PI / 4,
              fill:
                new Fill({
                  color:
                    "rgba(101,215,255,0.88)",
                }),
              stroke:
                new Stroke({
                  color:
                    "#ffffff",
                  width: 1.5,
                }),
            }),

          text:
            new Text({
              text:
                staged.plotNumber,
              offsetY: -14,
              font:
                "700 10px Inter, sans-serif",
              fill:
                new Fill({
                  color:
                    "#ffffff",
                }),
              stroke:
                new Stroke({
                  color:
                    "rgba(0,0,0,0.95)",
                  width: 3,
                }),
            }),
        })
      );

      source.addFeature(
        stagedFeature
      );
    }
  }, [
    dataset,
    mapReady,
    selectedPlotId,
    visiblePlotIds,
    pendingPlacement,
    batchPlacementByPlotId,
    newBatchPlots,
  ]);


  /* ========================================================
     APP 012
     Navigation helpers
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
          plot,
          pendingPlacement
        ),

      zoom: 20.25,
      duration: 650,
    });
  }

  function fitPlotArea() {
    const map =
      mapRef.current;

    const geometry =
      dataset?.mapArea?.geometry;

    if (
      !map ||
      !geometry
    ) {
      return;
    }

    map.getView().fit(
      areaGeometryToViewExtent(
        geometry
      ),
      {
        padding: [
          70,
          70,
          70,
          70,
        ],
        duration: 500,
        maxZoom: 20,
      }
    );
  }

  function clearTransientEditorState() {
    setPendingPlacement(
      null
    );

    setBatchPlacements(
      []
    );

    setNewBatchPlots(
      []
    );

    setBatchStartIndex(
      0
    );

    setPendingAreaGeometry(
      null
    );

    extentInteractionRef
      .current
      ?.setActive(
        false
      );
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

    clearTransientEditorState();

    setEditorMode(
      "browse"
    );

    setEditorMessage(
      null
    );
  }


  /* ========================================================
     APP 013
     Editor shell
     ======================================================== */

  function toggleEditor() {
    if (editorOpen) {
      setEditorOpen(
        false
      );

      setEditorMode(
        "browse"
      );

      clearTransientEditorState();

      setEditorMessage(
        null
      );

      return;
    }

    setEditorOpen(
      true
    );

    setEditorMode(
      "browse"
    );

    setEditorMessage(
      "Choose Resize Area, Batch Place, or select a single plot."
    );
  }


  /* ========================================================
     APP 014
     Single plot placement
     ======================================================== */

  function startPlacement(
    plot: PlotRecord
  ) {
    extentInteractionRef
      .current
      ?.setActive(
        false
      );

    setBatchPlacements(
      []
    );

    setSelectedPlotId(
      plot.id
    );

    setEditorOpen(
      true
    );

    setEditorMode(
      "place"
    );

    setPendingPlacement(
      null
    );

    setEditorMessage(
      "Placement mode: click the exact center of the headstone."
    );
  }

  function cancelPlacement() {
    setPendingPlacement(
      null
    );

    setEditorMode(
      "browse"
    );

    setEditorMessage(
      "Placement canceled."
    );
  }

  async function savePlacement() {
    if (
      !pendingPlacement ||
      !dataset
    ) {
      return;
    }

    try {
      setSavingPlacement(
        true
      );

      await updatePlotPlacement(
        pendingPlacement.plotId,
        pendingPlacement.longitude,
        pendingPlacement.latitude
      );

      setDataset(
        (current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,

            plots:
              current.plots.map(
                (plot) =>
                  plot.id ===
                  pendingPlacement.plotId
                    ? {
                        ...plot,
                        longitude:
                          pendingPlacement.longitude,
                        latitude:
                          pendingPlacement.latitude,
                      }
                    : plot
              ),
          };
        }
      );

      setPendingPlacement(
        null
      );

      setEditorMode(
        "browse"
      );

      setEditorMessage(
        "Plot placement saved."
      );
    } catch (saveError) {
      console.error(
        "PlotMap placement save error:",
        saveError
      );

      setEditorMessage(
        saveError instanceof Error
          ? `Save failed: ${saveError.message}`
          : "Save failed."
      );
    } finally {
      setSavingPlacement(
        false
      );
    }
  }


  /* ========================================================
     APP 015
     Batch plot placement

     Each click stages the NEXT unmapped plot.
     One Save Batch call persists every staged dot.
     ======================================================== */

  function startBatchPlacement() {
    extentInteractionRef
      .current
      ?.setActive(
        false
      );

    setPendingPlacement(
      null
    );

    setSelectedPlotId(
      null
    );

    setEditorOpen(
      true
    );

    setEditorMode(
      "batch-place"
    );

    setBatchPlacements(
      []
    );

    setNewBatchPlots(
      []
    );

    setBatchStartIndex(
      0
    );

    setNextPlotNumber(
      nextSuggestedPlotNumber
    );

    setEditorMessage(
      `Batch mode: click headstones continuously. New records will begin at Plot ${nextSuggestedPlotNumber}.`
    );
  }

  function undoLastBatchPlacement() {
    setNewBatchPlots(
      (current) =>
        current.slice(
          0,
          -1
        )
    );

    setEditorMessage(
      "Last staged dot removed."
    );
  }

  function cancelBatchPlacement() {
    setBatchPlacements(
      []
    );

    setNewBatchPlots(
      []
    );

    setBatchStartIndex(
      0
    );

    setEditorMode(
      "browse"
    );

    setEditorMessage(
      "Batch placement canceled. Nothing was saved."
    );
  }

  async function saveBatchPlacement() {
    if (
      newBatchPlots.length === 0 ||
      !dataset
    ) {
      return;
    }

    try {
      setSavingBatch(
        true
      );

      setEditorMessage(
        `Creating ${newBatchPlots.length} new plot records…`
      );

      const createdPlots =
        await createPlotsBatch(
          dataset.cemetery.id,
          newBatchPlots
        );

      setDataset(
        (current) => {
          if (!current) {
            return current;
          }

          const defaultSection =
            current.sections.find(
              (section) =>
                section.code ===
                "UNASSIGNED"
            );

          const normalizedNewPlots =
            createdPlots.map(
              (plot) => ({
                ...plot,
                section:
                  defaultSection,
                row:
                  undefined,
                burials:
                  [],
              })
            );

          return {
            ...current,
            plots: [
              ...current.plots,
              ...normalizedNewPlots,
            ],
          };
        }
      );

      const savedCount =
        createdPlots.length;

      setNewBatchPlots(
        []
      );

      setBatchPlacements(
        []
      );

      setBatchStartIndex(
        0
      );

      setEditorMode(
        "browse"
      );

      setEditorMessage(
        `${savedCount} new plots created and mapped.`
      );
    } catch (saveError) {
      console.error(
        "PlotMap batch create error:",
        saveError
      );

      setEditorMessage(
        saveError instanceof Error
          ? `Batch save failed: ${saveError.message}`
          : "Batch save failed."
      );
    } finally {
      setSavingBatch(
        false
      );
    }
  }



  /* ========================================================
     APP 016
     Rename map area
     ======================================================== */

  async function saveAreaName() {
    const area =
      dataset?.mapArea;

    const trimmedName =
      areaName.trim();

    if (!area) {
      setEditorMessage(
        "Map area is not available."
      );

      return;
    }

    if (!trimmedName) {
      setEditorMessage(
        "Enter a name for the map area."
      );

      return;
    }

    if (
      trimmedName.length > 80
    ) {
      setEditorMessage(
        "Area names are limited to 80 characters."
      );

      return;
    }

    try {
      setSavingAreaName(
        true
      );

      await updateMapAreaLabel(
        area.id,
        trimmedName
      );

      setDataset(
        (current) => {
          if (
            !current ||
            !current.mapArea
          ) {
            return current;
          }

          return {
            ...current,

            mapArea: {
              ...current.mapArea,
              label:
                trimmedName,
            },
          };
        }
      );

      setAreaName(
        trimmedName
      );

      setEditorMessage(
        `Area renamed to "${trimmedName}".`
      );
    } catch (saveError) {
      console.error(
        "PlotMap area name save error:",
        saveError
      );

      setEditorMessage(
        saveError instanceof Error
          ? `Name save failed: ${saveError.message}`
          : "Name save failed."
      );
    } finally {
      setSavingAreaName(
        false
      );
    }
  }


  /* ========================================================
     APP 017
     ONE map area resize / move
     ======================================================== */

  function startAreaResize() {
    const interaction =
      extentInteractionRef.current;

    const map =
      mapRef.current;

    const geometry =
      dataset?.mapArea?.geometry;

    if (
      !interaction ||
      !map ||
      !geometry
    ) {
      setEditorMessage(
        "Map area is not available."
      );

      return;
    }

    setPendingPlacement(
      null
    );

    setBatchPlacements(
      []
    );

    setSelectedPlotId(
      null
    );

    setEditorOpen(
      true
    );

    setEditorMode(
      "resize-area"
    );

    setPendingAreaGeometry(
      geometry
    );

    interaction.setExtent(
      areaGeometryToViewExtent(
        geometry
      )
    );

    interaction.setActive(
      true
    );

    map.getView().fit(
      areaGeometryToViewExtent(
        geometry
      ),
      {
        padding: [
          80,
          80,
          80,
          80,
        ],
        duration: 450,
        maxZoom: 20,
      }
    );

    setEditorMessage(
      "Drag the area handles to resize it. Save when it looks right."
    );
  }

  function cancelAreaResize(
    showMessage = true
  ) {
    extentInteractionRef
      .current
      ?.setActive(
        false
      );

    setPendingAreaGeometry(
      null
    );

    if (
      editorMode ===
      "resize-area"
    ) {
      setEditorMode(
        "browse"
      );
    }

    if (showMessage) {
      setEditorMessage(
        "Map area changes canceled."
      );
    }
  }

  async function saveAreaResize() {
    const area =
      dataset?.mapArea;

    if (
      !area ||
      !pendingAreaGeometry
    ) {
      return;
    }

    try {
      setSavingArea(
        true
      );

      await updateMapAreaGeometry(
        area.id,
        pendingAreaGeometry
      );

      setDataset(
        (current) => {
          if (
            !current ||
            !current.mapArea
          ) {
            return current;
          }

          return {
            ...current,

            mapArea: {
              ...current.mapArea,
              geometry:
                pendingAreaGeometry,
            },
          };
        }
      );

      extentInteractionRef
        .current
        ?.setActive(
          false
        );

      setPendingAreaGeometry(
        null
      );

      setEditorMode(
        "browse"
      );

      setEditorMessage(
        "Map area saved."
      );
    } catch (saveError) {
      console.error(
        "PlotMap area save error:",
        saveError
      );

      setEditorMessage(
        saveError instanceof Error
          ? `Area save failed: ${saveError.message}`
          : "Area save failed."
      );
    } finally {
      setSavingArea(
        false
      );
    }
  }


  /* ========================================================
     APP 018
     Stats
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

        mapped:
          plots.filter(
            (plot) =>
              plotHasRealPlacement(
                plot
              )
          ).length,
      };
    }, [dataset]);


  /* ========================================================
     APP 019
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

        <div className="plotmap-header-actions">
          <button
            type="button"
            className={
              editorOpen
                ? "editor-toggle active"
                : "editor-toggle"
            }
            onClick={
              toggleEditor
            }
          >
            <Pencil
              size={13}
            />

            {editorOpen
              ? "Exit Map Editor"
              : "Edit Map"}
          </button>

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

          {editorOpen && (
            <section className="editor-sidebar-note">
              <strong>
                MAP EDITOR
              </strong>

              <span>
                One named map area. Add the real plots inside it.
              </span>

              <small>
                {stats.mapped} of{" "}
                {stats.total} plots
                have real coordinates.
              </small>

              <div className="area-editor-card">
                <div>
                  <BoxSelect
                    size={14}
                  />

                  <span>
                    <b>
                      {dataset?.mapArea?.label ||
                        "Map Area"}
                    </b>

                    <small>
                      Rename or resize the cemetery working area.
                    </small>
                  </span>
                </div>

                <div className="area-name-editor">
                  <input
                    type="text"
                    value={
                      areaName
                    }
                    maxLength={80}
                    placeholder="Plot A1"
                    disabled={
                      editorMode !==
                      "browse" ||
                      !dataset?.mapArea
                    }
                    onChange={
                      (event) =>
                        setAreaName(
                          event.target.value
                        )
                    }
                    onKeyDown={
                      (event) => {
                        if (
                          event.key ===
                          "Enter"
                        ) {
                          saveAreaName();
                        }
                      }
                    }
                  />

                  <button
                    type="button"
                    className="area-name-save"
                    disabled={
                      editorMode !==
                        "browse" ||
                      !dataset?.mapArea ||
                      savingAreaName ||
                      !areaName.trim() ||
                      areaName.trim() ===
                        dataset?.mapArea?.label
                    }
                    onClick={
                      saveAreaName
                    }
                  >
                    {savingAreaName
                      ? "Saving…"
                      : "Save Name"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={
                    startAreaResize
                  }
                  disabled={
                    editorMode !==
                    "browse"
                  }
                >
                  Resize Area
                </button>
              </div>

              <div className="batch-editor-card">
                <div>
                  <MousePointerClick
                    size={14}
                  />

                  <span>
                    <b>
                      Batch Placement
                    </b>

                    <small>
                      Click many headstones. New plot records are created only when you save the batch.
                    </small>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={
                    startBatchPlacement
                  }
                  disabled={
                    editorMode !==
                    "browse"
                  }
                >
                  Start Batch
                </button>
              </div>
            </section>
          )}

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
                  stats.mapped
                }
              </strong>
              <span>
                Precisely mapped
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
                  100
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
                        onClick={() => {
                          if (
                            editorMode !==
                            "browse"
                          ) {
                            return;
                          }

                          focusPlot(
                            plot
                          );
                        }}
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

                        {plotHasRealPlacement(
                          plot
                        ) && (
                          <span
                            className="mapped-dot"
                            title="Real geographic coordinates saved"
                          />
                        )}
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
            className={
              editorMode ===
                "place" ||
              editorMode ===
                "batch-place" ||
              editorMode ===
                "resize-area"
                ? "plotmap-map editing"
                : "plotmap-map"
            }
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

            <button
              type="button"
              onClick={
                fitPlotArea
              }
              disabled={
                !dataset?.mapArea
              }
            >
              <BoxSelect
                size={14}
              />
              {dataset?.mapArea?.label ||
                "Map Area"}
            </button>
          </div>

          {editorOpen && (
            <div
              className={
                editorMode ===
                  "resize-area"
                  ? "map-editor-hint area-resize"
                  : editorMode ===
                    "batch-place"
                    ? "map-editor-hint batch-place"
                    : editorMode ===
                      "place"
                      ? "map-editor-hint placing"
                      : "map-editor-hint"
              }
            >
              <Pencil
                size={13}
              />

              <span>
                {editorMode ===
                  "resize-area"
                  ? `AREA MODE — resize ${dataset?.mapArea?.label || "Map Area"}`
                  : editorMode ===
                    "batch-place"
                    ? `BATCH MODE — ${newBatchPlots.length} staged; click headstones continuously`
                    : editorMode ===
                      "place"
                      ? "PLACEMENT MODE — click exact headstone"
                      : editorMessage ||
                        "MAP EDITOR"}
              </span>
            </div>
          )}

          {editorMode ===
            "resize-area" && (
            <div className="area-save-panel">
              <div>
                <strong>
                  {dataset?.mapArea?.label ||
                    "Map Area"}
                </strong>

                <span>
                  Resize the working area, then save once.
                </span>
              </div>

              {pendingAreaGeometry && (
                <div className="area-coordinates">
                  <span>
                    W{" "}
                    {pendingAreaGeometry.west.toFixed(
                      6
                    )}
                  </span>

                  <span>
                    E{" "}
                    {pendingAreaGeometry.east.toFixed(
                      6
                    )}
                  </span>

                  <span>
                    N{" "}
                    {pendingAreaGeometry.north.toFixed(
                      6
                    )}
                  </span>

                  <span>
                    S{" "}
                    {pendingAreaGeometry.south.toFixed(
                      6
                    )}
                  </span>
                </div>
              )}

              <div className="area-save-actions">
                <button
                  type="button"
                  className="secondary-action"
                  disabled={
                    savingArea
                  }
                  onClick={() =>
                    cancelAreaResize()
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-action"
                  disabled={
                    savingArea ||
                    !pendingAreaGeometry
                  }
                  onClick={
                    saveAreaResize
                  }
                >
                  <Save
                    size={14}
                  />

                  {savingArea
                    ? "Saving…"
                    : "Save Area"}
                </button>
              </div>
            </div>
          )}

          {editorMode ===
            "batch-place" && (
            <div className="batch-save-panel">
              <div className="batch-save-heading">
                <div>
                  <strong>
                    Batch Placement
                  </strong>

                  <span>
                    No per-dot saves.
                  </span>
                </div>

                <b>
                  {
                    newBatchPlots.length
                  }
                  {" "}
                  staged
                </b>
              </div>

              <div className="batch-next">
                <small>
                  NEXT NEW RECORD
                </small>

                <strong>
                  Plot{" "}
                  {
                    nextPlotNumber +
                    newBatchPlots.length
                  }
                </strong>
              </div>

              <div className="batch-progress">
                <span>
                  {
                    newBatchPlots.length
                  }
                  {" staged"}
                </span>

                <span>
                  One save creates them all
                </span>
              </div>

              {editorMessage && (
                <div className="batch-message">
                  {editorMessage}
                </div>
              )}

              <div className="batch-actions">
                <button
                  type="button"
                  className="secondary-action"
                  disabled={
                    newBatchPlots.length ===
                      0 ||
                    savingBatch
                  }
                  onClick={
                    undoLastBatchPlacement
                  }
                >
                  <Undo2
                    size={14}
                  />
                  Undo Last
                </button>

                <button
                  type="button"
                  className="secondary-action"
                  disabled={
                    savingBatch
                  }
                  onClick={
                    cancelBatchPlacement
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-action"
                  disabled={
                    newBatchPlots.length ===
                      0 ||
                    savingBatch
                  }
                  onClick={
                    saveBatchPlacement
                  }
                >
                  <Save
                    size={14}
                  />

                  {savingBatch
                    ? "Saving…"
                    : `Save ${newBatchPlots.length}`}
                </button>
              </div>
            </div>
          )}

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

            <span>
              <i className="legend mapped" />
              Precisely mapped
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

          {selectedPlot &&
            editorMode !==
              "resize-area" &&
            editorMode !==
              "batch-place" && (
            <article
              className={
                editorOpen
                  ? "plot-detail-card editor-active"
                  : "plot-detail-card"
              }
            >
              <button
                type="button"
                className="detail-close"
                onClick={() => {
                  setSelectedPlotId(
                    null
                  );

                  setPendingPlacement(
                    null
                  );

                  setEditorMode(
                    "browse"
                  );
                }}
                aria-label="Close plot details"
              >
                <X
                  size={17}
                />
              </button>

              <div className="detail-badges">
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

                {editorOpen && (
                  <span
                    className={
                      plotHasRealPlacement(
                        selectedPlot
                      )
                        ? "placement-badge mapped"
                        : "placement-badge"
                    }
                  >
                    {plotHasRealPlacement(
                      selectedPlot
                    )
                      ? "Mapped"
                      : "Approximate"}
                  </span>
                )}
              </div>

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

              {editorOpen && (
                <div className="placement-panel">
                  <div className="placement-panel-heading">
                    Geographic placement
                  </div>

                  {pendingPlacement?.plotId ===
                  selectedPlot.id ? (
                    <>
                      <div className="coordinate-row">
                        <span>
                          Latitude
                        </span>

                        <code>
                          {pendingPlacement.latitude.toFixed(
                            7
                          )}
                        </code>
                      </div>

                      <div className="coordinate-row">
                        <span>
                          Longitude
                        </span>

                        <code>
                          {pendingPlacement.longitude.toFixed(
                            7
                          )}
                        </code>
                      </div>
                    </>
                  ) : plotHasRealPlacement(
                      selectedPlot
                    ) ? (
                    <>
                      <div className="coordinate-row">
                        <span>
                          Latitude
                        </span>

                        <code>
                          {selectedPlot.latitude?.toFixed(
                            7
                          )}
                        </code>
                      </div>

                      <div className="coordinate-row">
                        <span>
                          Longitude
                        </span>

                        <code>
                          {selectedPlot.longitude?.toFixed(
                            7
                          )}
                        </code>
                      </div>
                    </>
                  ) : (
                    <p className="placement-help">
                      This plot is still using its synthetic demo position.
                    </p>
                  )}

                  {editorMessage && (
                    <div className="editor-message">
                      {editorMessage}
                    </div>
                  )}
                </div>
              )}

              {pendingPlacement?.plotId ===
              selectedPlot.id ? (
                <div className="detail-actions split">
                  <button
                    type="button"
                    className="secondary-action"
                    disabled={
                      savingPlacement
                    }
                    onClick={
                      cancelPlacement
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="primary-action"
                    disabled={
                      savingPlacement
                    }
                    onClick={
                      savePlacement
                    }
                  >
                    <Save
                      size={15}
                    />

                    {savingPlacement
                      ? "Saving…"
                      : "Save Placement"}
                  </button>
                </div>
              ) : (
                <div className="detail-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() =>
                      focusPlot(
                        selectedPlot
                      )
                    }
                  >
                    <MapPin
                      size={15}
                    />
                    Center
                  </button>

                  {editorOpen && (
                    <button
                      type="button"
                      className="primary-action"
                      onClick={() =>
                        startPlacement(
                          selectedPlot
                        )
                      }
                    >
                      <Crosshair
                        size={15}
                      />

                      {plotHasRealPlacement(
                        selectedPlot
                      )
                        ? "Reposition"
                        : "Place Plot"}
                    </button>
                  )}
                </div>
              )}
            </article>
          )}
        </section>
      </main>
    </div>
  );
}
