import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Collection from "ol/Collection.js";
import Feature from "ol/Feature.js";
import OLMap from "ol/Map.js";
import View from "ol/View.js";

import Point from "ol/geom/Point.js";
import Polygon from "ol/geom/Polygon.js";

import Draw from "ol/interaction/Draw.js";
import Modify from "ol/interaction/Modify.js";

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
  BoxSelect,
  Crosshair,
  Database,
  LoaderCircle,
  MapPin,
  MousePointerClick,
  Pencil,
  Plus,
  Save,
  Search,
  Shapes,
  Trash2,
  CheckSquare,
  Undo2,
  X,
} from "lucide-react";

import "./App.css";

import {
  plotMapConfig,
  type GeographicBounds,
} from "./config/plotmap";

import {
  assignPlotsToArea,
  createMapArea,
  createPlotsBatch,
  deletePlotsBatch,
  getPersonDisplayName,
  getYear,
  loadPlotMapDataset,
  updateMapAreaGeometry,
  updateMapAreaLabel,
  updatePlotDetails,
  updatePlotPlacement,
  savePlotPersonInfo,
} from "./services/plotmap";

import type {
  MapAreaGeometry,
  MapAreaPolygonGeometry,
  MapAreaRecord,
  NewPlotPlacement,
  PersonEditInput,
  PlotEditInput,
  PlotMapDataset,
  PlotPlacementUpdate,
  PlotRecord,
  PlotStatus,
} from "./types/plotmap";


/* ==========================================================
   APP 001
   Editor state
   ========================================================== */

type ImageryStatus =
  | "loading"
  | "racine"
  | "fallback";

type EditorMode =
  | "browse"
  | "place"
  | "batch-place"
  | "draw-area"
  | "new-area-review"
  | "edit-area-shape";

type PendingPlacement =
  PlotPlacementUpdate;


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
   Legacy synthetic coordinate helper

   Only used for an old record that has not yet been given
   real longitude / latitude.
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
    override.plotId ===
      plot.id
  ) {
    return fromLonLat([
      override.longitude,
      override.latitude,
    ]);
  }

  if (plotHasRealPlacement(plot)) {
    return fromLonLat([
      Number(
        plot.longitude
      ),

      Number(
        plot.latitude
      ),
    ]);
  }

  return percentToMapCoordinate(
    Number(
      plot.x ?? 0
    ),

    Number(
      plot.y ?? 0
    )
  );
}


/* ==========================================================
   APP 004
   Plot Area polygon helpers
   ========================================================== */

function areaGeometryToPolygon(
  geometry: MapAreaGeometry
): Polygon {
  if (
    geometry.type ===
    "bbox"
  ) {
    return new Polygon([
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
    ]);
  }

  const polygon =
    new Polygon(
      geometry.coordinates
    );

  polygon.transform(
    "EPSG:4326",
    "EPSG:3857"
  );

  return polygon;
}

function polygonToAreaGeometry(
  polygon: Polygon
): MapAreaPolygonGeometry {
  const clone =
    polygon.clone();

  clone.transform(
    "EPSG:3857",
    "EPSG:4326"
  );

  return {
    type:
      "Polygon",

    coordinates:
      clone.getCoordinates(),
  };
}

function areaExtent(
  area: MapAreaRecord
) {
  return areaGeometryToPolygon(
    area.geometry
  ).getExtent();
}


/* ==========================================================
   APP 005
   OpenLayers styles
   ========================================================== */

function createAreaStyle(
  label: string,
  selected: boolean
) {
  return new Style({
    fill:
      new Fill({
        color:
          selected
            ? "rgba(70,190,255,0.12)"
            : "rgba(255,255,255,0.035)",
      }),

    stroke:
      new Stroke({
        color:
          selected
            ? "#46beff"
            : "rgba(255,255,255,0.72)",

        width:
          selected
            ? 2.5
            : 1.5,
      }),

    text:
      new Text({
        text:
          label,

        font:
          "700 11px Inter, sans-serif",

        fill:
          new Fill({
            color:
              selected
                ? "#ccefff"
                : "#ffffff",
          }),

        stroke:
          new Stroke({
            color:
              "rgba(0,0,0,0.95)",

            width: 3,
          }),
      }),
  });
}

function createPlotStyle(
  status: PlotStatus,
  selected: boolean,
  mapped: boolean,
  staged: boolean,
  selectedLabel?: string
) {
  let outlineColor =
    mapped
      ? "#46beff"
      : "rgba(0,0,0,0.75)";

  let outlineWidth =
    mapped
      ? 1.6
      : 1;

  if (selected) {
    outlineColor =
      "#ffffff";

    outlineWidth =
      2.4;
  }

  if (staged) {
    outlineColor =
      "#ffffff";

    outlineWidth =
      1.8;
  }

  return new Style({
    image:
      new RegularShape({
        points: 4,

        radius:
          selected ||
          staged
            ? 7
            : 4.5,

        angle:
          Math.PI / 4,

        fill:
          new Fill({
            color:
              staged
                ? "#65d7ff"
                : STATUS_COLORS[
                    status
                  ],
          }),

        stroke:
          new Stroke({
            color:
              outlineColor,

            width:
              outlineWidth,
          }),
      }),

    text:
      selected &&
      selectedLabel
        ? new Text({
            text:
              selectedLabel,

            offsetY: -20,

            font:
              "700 11px Inter, sans-serif",

            fill:
              new Fill({
                color:
                  "#ffffff",
              }),

            stroke:
              new Stroke({
                color:
                  "rgba(0,0,0,0.95)",

                width: 4,
              }),

            padding: [
              3,
              5,
              3,
              5,
            ],
          })
        : undefined,
  });
}


/* ==========================================================
   APP 005A
   Draggable floating panel helper

   Uses CSS translate from each panel's normal anchored
   position. That lets the details window begin top-right and
   the editor window begin top-left, while both remain movable.
   ========================================================== */

type DragOffset = {
  x: number;
  y: number;
};

function usePanelDrag() {
  const [
    offset,
    setOffset,
  ] =
    useState<DragOffset>({
      x: 0,
      y: 0,
    });

  const dragRef =
    useRef<{
      pointerId: number;
      startX: number;
      startY: number;
      originX: number;
      originY: number;
    } | null>(
      null
    );

  function onPointerDown(
    event: any
  ) {
    if (
      event.button !== 0
    ) {
      return;
    }

    const target =
      event.target as HTMLElement;

    if (
      target.closest(
        "button,input,select,textarea"
      )
    ) {
      return;
    }

    dragRef.current = {
      pointerId:
        event.pointerId,

      startX:
        event.clientX,

      startY:
        event.clientY,

      originX:
        offset.x,

      originY:
        offset.y,
    };

    event.currentTarget
      .setPointerCapture(
        event.pointerId
      );
  }

  function onPointerMove(
    event: any
  ) {
    const drag =
      dragRef.current;

    if (
      !drag ||
      drag.pointerId !==
        event.pointerId
    ) {
      return;
    }

    setOffset({
      x:
        drag.originX +
        (
          event.clientX -
          drag.startX
        ),

      y:
        drag.originY +
        (
          event.clientY -
          drag.startY
        ),
    });
  }

  function onPointerUp(
    event: any
  ) {
    if (
      dragRef.current
        ?.pointerId !==
      event.pointerId
    ) {
      return;
    }

    dragRef.current =
      null;

    if (
      event.currentTarget
        .hasPointerCapture(
          event.pointerId
        )
    ) {
      event.currentTarget
        .releasePointerCapture(
          event.pointerId
        );
    }
  }

  function reset() {
    setOffset({
      x: 0,
      y: 0,
    });
  }

  return {
    style: {
      transform:
        `translate(${offset.x}px, ${offset.y}px)`,
    },

    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel:
        onPointerUp,
    },

    reset,
  };
}


/* ==========================================================
   APP 006
   Main component
   ========================================================== */

export default function App() {
  const mapContainerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const mapRef =
    useRef<OLMap | null>(
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

  const drawInteractionRef =
    useRef<Draw | null>(
      null
    );

  const modifyInteractionRef =
    useRef<Modify | null>(
      null
    );

  const pendingNewAreaFeatureRef =
    useRef<Feature | null>(
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
    selectedAreaId,
    setSelectedAreaId,
  ] =
    useState<string | null>(
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
    useState<
      PlotStatus | "all"
    >(
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
    editorMessage,
    setEditorMessage,
  ] =
    useState<string | null>(
      null
    );

  const [
    pendingPlacement,
    setPendingPlacement,
  ] =
    useState<PendingPlacement | null>(
      null
    );

  const [
    stagedPlots,
    setStagedPlots,
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
    pendingAreaGeometry,
    setPendingAreaGeometry,
  ] =
    useState<MapAreaPolygonGeometry | null>(
      null
    );

  const [
    newAreaName,
    setNewAreaName,
  ] =
    useState("");

  const [
    areaNameDraft,
    setAreaNameDraft,
  ] =
    useState("");

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    areaRenderRevision,
    setAreaRenderRevision,
  ] =
    useState(0);

  /*
   * APP 006A
   * Plot Manager state.
   */
  const [
    selectedPlotIds,
    setSelectedPlotIds,
  ] =
    useState<Set<string>>(
      new Set()
    );

  const [
    selectionMode,
    setSelectionMode,
  ] =
    useState(false);

  const [
    bulkAreaId,
    setBulkAreaId,
  ] =
    useState("");

  const [
    plotEditDraft,
    setPlotEditDraft,
  ] =
    useState<PlotEditInput | null>(
      null
    );

  const [
    confirmingDelete,
    setConfirmingDelete,
  ] =
    useState(false);

  /*
   * APP 006B
   * Zone browser + details tabs.
   */
  const [
    zoneFilter,
    setZoneFilter,
  ] =
    useState("all");

  const [
    detailTab,
    setDetailTab,
  ] =
    useState<
      "person" | "settings"
    >(
      "person"
    );

  const [
    personEditDraft,
    setPersonEditDraft,
  ] =
    useState<PersonEditInput | null>(
      null
    );

  const editorPanelDrag =
    usePanelDrag();

  const detailsPanelDrag =
    usePanelDrag();


  /* ========================================================
     APP 007
     Load Supabase records
     ======================================================== */

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(
          true
        );

        const nextDataset =
          await loadPlotMapDataset(
            plotMapConfig
              .cemeterySlug
          );

        if (!active) {
          return;
        }

        setDataset(
          nextDataset
        );

        const firstArea =
          nextDataset
            .mapAreas[0];

        if (firstArea) {
          setSelectedAreaId(
            firstArea.id
          );

          setAreaNameDraft(
            firstArea.label
          );
        }
      } catch (loadError) {
        console.error(
          "PlotMap database error:",
          loadError
        );

        if (active) {
          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "Unable to load PlotMap data."
          );
        }
      } finally {
        if (active) {
          setLoading(
            false
          );
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);


  /* ========================================================
     APP 008
     Derived selection / lookup state
     ======================================================== */

  const selectedArea =
    dataset?.mapAreas.find(
      (area) =>
        area.id ===
        selectedAreaId
    ) || null;

  const selectedPlot =
    dataset?.plots.find(
      (plot) =>
        plot.id ===
        selectedPlotId
    ) || null;

  useEffect(() => {
    setAreaNameDraft(
      selectedArea?.label ||
      ""
    );
  }, [
    selectedArea?.id,
    selectedArea?.label,
  ]);


  useEffect(() => {
    if (!selectedPlot) {
      setPlotEditDraft(
        null
      );

      setPersonEditDraft(
        null
      );

      return;
    }

    setDetailTab(
      "person"
    );

    setPlotEditDraft({
      plotAreaId:
        selectedPlot.plot_area_id,

      plotNumber:
        selectedPlot.plot_number,

      displayName:
        selectedPlot.display_name,

      status:
        selectedPlot.status,

      plotType:
        selectedPlot.plot_type,

      notes:
        selectedPlot.notes,
    });

    const primary =
      selectedPlot.burials[0];

    setPersonEditDraft({
      personId:
        primary?.person.id ||
        null,

      firstName:
        primary?.person.first_name ||
        "",

      middleName:
        primary?.person.middle_name ||
        "",

      lastName:
        primary?.person.last_name ||
        "",

      suffix:
        primary?.person.suffix ||
        "",

      birthDate:
        primary?.person.birth_date ||
        "",

      deathDate:
        primary?.person.death_date ||
        "",

      obituary:
        primary?.person.obituary ||
        "",

      biography:
        primary?.person.biography ||
        "",

      personNotes:
        primary?.person.notes ||
        "",

      burialDate:
        primary?.burial.burial_date ||
        "",

      intermentType:
        primary?.burial.interment_type ||
        "burial",

      burialNotes:
        primary?.burial.notes ||
        "",
    });
  }, [
    selectedPlot?.id,
    selectedPlot?.plot_area_id,
    selectedPlot?.plot_number,
    selectedPlot?.display_name,
    selectedPlot?.status,
    selectedPlot?.plot_type,
    selectedPlot?.notes,
    selectedPlot?.burials,
  ]);


  const areaById =
    useMemo(
      () =>
        new Map(
          (
            dataset?.mapAreas ||
            []
          ).map(
            (area) => [
              area.id,
              area,
            ]
          )
        ),
      [dataset]
    );

  const zoneCounts =
    useMemo(() => {
      const counts =
        new Map<string, number>();

      for (
        const plot
        of dataset?.plots ||
        []
      ) {
        const key =
          plot.plot_area_id ||
          "none";

        counts.set(
          key,
          (
            counts.get(
              key
            ) ||
            0
          ) + 1
        );
      }

      return counts;
    }, [
      dataset,
    ]);

  const filteredPlots =
    useMemo(() => {
      if (!dataset) {
        return [];
      }

      const query =
        searchTerm
          .trim()
          .toLowerCase();

      const matching =
        dataset.plots.filter(
          (plot) => {
            /*
             * Zone dropdown.
             */
            if (
              zoneFilter ===
              "none"
            ) {
              if (
                plot.plot_area_id !==
                null
              ) {
                return false;
              }
            } else if (
              zoneFilter !==
              "all" &&
              plot.plot_area_id !==
                zoneFilter
            ) {
              return false;
            }

            if (
              statusFilter !==
                "all" &&
              plot.status !==
                statusFilter
            ) {
              return false;
            }

            if (!query) {
              return true;
            }

            const areaLabel =
              plot.plot_area_id
                ? areaById.get(
                    plot.plot_area_id
                  )?.label ||
                  ""
                : "no area";

            const personSearch =
              plot.burials.flatMap(
                ({
                  person,
                  burial,
                }) => [
                  getPersonDisplayName(
                    person
                  ),

                  person.first_name,
                  person.middle_name,
                  person.last_name,
                  person.suffix,

                  person.birth_date,
                  person.birth_date
                    ? getYear(
                        person.birth_date
                      )
                    : "",

                  person.death_date,
                  person.death_date
                    ? getYear(
                        person.death_date
                      )
                    : "",

                  burial.burial_date,
                ]
              );

            const haystack = [
              plot.display_name,
              plot.plot_number,
              `plot ${plot.plot_number}`,
              areaLabel,
              plot.section?.name,
              plot.row?.name,
              ...personSearch,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return haystack.includes(
              query
            );
          }
        );

      /*
       * When browsing one Zone, the only meaningful sort is
       * natural plot-number order.
       *
       * All Zones remains grouped by Zone and then plot number.
       */
      return matching.sort(
        (
          a,
          b
        ) => {
          if (
            zoneFilter ===
            "all"
          ) {
            const areaA =
              a.plot_area_id
                ? areaById.get(
                    a.plot_area_id
                  )?.label ||
                  ""
                : "zzzz no area";

            const areaB =
              b.plot_area_id
                ? areaById.get(
                    b.plot_area_id
                  )?.label ||
                  ""
                : "zzzz no area";

            const areaCompare =
              areaA.localeCompare(
                areaB,
                undefined,
                {
                  numeric: true,
                  sensitivity:
                    "base",
                }
              );

            if (
              areaCompare !==
              0
            ) {
              return areaCompare;
            }
          }

          return a.plot_number.localeCompare(
            b.plot_number,
            undefined,
            {
              numeric: true,
              sensitivity:
                "base",
            }
          );
        }
      );
    }, [
      dataset,
      searchTerm,
      statusFilter,
      zoneFilter,
      areaById,
    ]);


  const nextSuggestedPlotNumber =
    useMemo(() => {
      if (
        !dataset ||
        !selectedAreaId
      ) {
        return 1;
      }

      let highest = 0;

      for (
        const plot
        of dataset.plots
      ) {
        if (
          plot.plot_area_id !==
          selectedAreaId
        ) {
          continue;
        }

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
          Number.isFinite(
            value
          ) &&
          value > highest
        ) {
          highest = value;
        }
      }

      return highest + 1;
    }, [
      dataset,
      selectedAreaId,
    ]);


  /* ========================================================
     APP 009
     Create OpenLayers map
     ======================================================== */

  useEffect(() => {
    if (
      !mapContainerRef.current
    ) {
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

    const plotSource =
      new VectorSource();

    areaSourceRef.current =
      areaSource;

    plotsSourceRef.current =
      plotSource;

    const areaLayer =
      new VectorLayer({
        source:
          areaSource,

        zIndex: 10,
      });

    const plotLayer =
      new VectorLayer({
        source:
          plotSource,

        zIndex: 20,
      });

    const map =
      new OLMap({
        target:
          mapContainerRef.current,

        layers: [
          fallbackLayer,
          racineLayer,
          areaLayer,
          plotLayer,
        ],

        view:
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
          }),
      });

    mapRef.current =
      map;

    setMapReady(
      true
    );

    let racineFailed =
      false;

    const onRacineLoad =
      () => {
        if (!racineFailed) {
          setImageryStatus(
            "racine"
          );
        }
      };

    const onRacineError =
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
      onRacineLoad
    );

    racineSource.on(
      "imageloaderror",
      onRacineError
    );

    return () => {
      racineSource.un(
        "imageloadend",
        onRacineLoad
      );

      racineSource.un(
        "imageloaderror",
        onRacineError
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
    };
  }, []);


  /* ========================================================
     APP 010
     Render all Plot Areas
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

    /*
     * Do not redraw while an existing feature is actively
     * being modified.
     */
    if (
      editorMode ===
      "edit-area-shape"
    ) {
      return;
    }

    source.clear();

    for (
      const area
      of dataset.mapAreas
    ) {
      const feature =
        new Feature({
          geometry:
            areaGeometryToPolygon(
              area.geometry
            ),

          kind:
            "plot-area",

          areaId:
            area.id,
        });

      feature.setStyle(
        createAreaStyle(
          area.label,
          area.id ===
            selectedAreaId
        )
      );

      source.addFeature(
        feature
      );
    }
  }, [
    dataset,
    mapReady,
    selectedAreaId,
    editorMode,
    areaRenderRevision,
  ]);


  /* ========================================================
     APP 011
     Render plots + staged new dots
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
      const override =
        pendingPlacement?.plotId ===
        plot.id
          ? pendingPlacement
          : null;

      const feature =
        new Feature({
          geometry:
            new Point(
              plotCoordinate(
                plot,
                override
              )
            ),

          kind:
            "plot",

          plotId:
            plot.id,
        });

      const areaLabel =
        plot.plot_area_id
          ? areaById.get(
              plot.plot_area_id
            )?.label ||
            "NO AREA"
          : "NO AREA";

      feature.setStyle(
        createPlotStyle(
          plot.status,
          selectedPlotId ===
            plot.id,
          plotHasRealPlacement(
            plot
          ),
          false,
          selectedPlotId ===
            plot.id
            ? `PLOT ${plot.plot_number} · ${areaLabel.toUpperCase()}`
            : undefined
        )
      );

      source.addFeature(
        feature
      );
    }

    for (
      const staged
      of stagedPlots
    ) {
      const feature =
        new Feature({
          geometry:
            new Point(
              fromLonLat([
                staged.longitude,
                staged.latitude,
              ])
            ),

          kind:
            "staged-plot",

          tempId:
            staged.tempId,
        });

      feature.setStyle(
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
                    "#65d7ff",
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
                    "#000000",
                  width: 3,
                }),
            }),
        })
      );

      source.addFeature(
        feature
      );
    }
  }, [
    dataset,
    mapReady,
    selectedPlotId,
    pendingPlacement,
    stagedPlots,
    areaById,
  ]);


  /* ========================================================
     APP 012
     Exact plot focus

     No drifting animation.

     Selecting a plot from the left list now puts that exact
     geographic coordinate at map center and then sets zoom.
     ======================================================== */

  function focusPlot(
    plot: PlotRecord
  ) {
    const map =
      mapRef.current;

    if (!map) {
      return;
    }

    /*
     * APP 012A
     * Nuclear snap-focus.
     *
     * We use the exact coordinate of the rendered marker and
     * replace the OpenLayers View entirely. No inherited center,
     * animation, resolution state, or previous constraints can
     * influence the result.
     */
    const feature =
      plotsSourceRef.current
        ?.getFeatures()
        .find(
          (candidate) =>
            candidate.get(
              "kind"
            ) === "plot" &&
            candidate.get(
              "plotId"
            ) === plot.id
        );

    const geometry =
      feature?.getGeometry();

    const coordinate =
      geometry instanceof Point
        ? geometry.getCoordinates()
        : plotCoordinate(
            plot,
            null
          );

    setSelectedPlotId(
      plot.id
    );

    if (
      plot.plot_area_id
    ) {
      setSelectedAreaId(
        plot.plot_area_id
      );
    }

    map.updateSize();

    map.setView(
      new View({
        center:
          coordinate,

        zoom: 21.5,

        minZoom: 13,
        maxZoom: 22,

        rotation: 0,
      })
    );

    map.renderSync();

    window.requestAnimationFrame(
      () => {
        map.updateSize();

        const currentView =
          map.getView();

        currentView.setCenter(
          coordinate
        );

        currentView.setZoom(
          21.5
        );

        map.renderSync();

        console.debug(
          "PlotMap snap focus:",
          {
            plotId:
              plot.id,

            plotNumber:
              plot.plot_number,

            area:
              plot.plot_area_id
                ? areaById.get(
                    plot.plot_area_id
                  )?.label
                : null,

            longitude:
              plot.longitude,

            latitude:
              plot.latitude,

            renderedCoordinate:
              coordinate,

            viewCenter:
              currentView.getCenter(),

            zoom:
              currentView.getZoom(),
          }
        );
      }
    );
  }

  function focusArea(
    area: MapAreaRecord
  ) {
    const map =
      mapRef.current;

    if (!map) {
      return;
    }

    setSelectedAreaId(
      area.id
    );

    setSelectedPlotId(
      null
    );

    map.updateSize();

    map.getView().fit(
      areaExtent(
        area
      ),
      {
        padding: [
          70,
          70,
          70,
          70,
        ],

        maxZoom: 20,

        duration: 350,
      }
    );
  }


  /* ========================================================
     APP 013
     General interaction cleanup
     ======================================================== */

  function removeDrawInteraction() {
    const map =
      mapRef.current;

    const interaction =
      drawInteractionRef.current;

    if (
      map &&
      interaction
    ) {
      map.removeInteraction(
        interaction
      );
    }

    drawInteractionRef.current =
      null;
  }

  function removeModifyInteraction() {
    const map =
      mapRef.current;

    const interaction =
      modifyInteractionRef.current;

    if (
      map &&
      interaction
    ) {
      map.removeInteraction(
        interaction
      );
    }

    modifyInteractionRef.current =
      null;
  }

  function clearTransientState() {
    removeDrawInteraction();
    removeModifyInteraction();

    setPendingPlacement(
      null
    );

    setStagedPlots(
      []
    );

    setPendingAreaGeometry(
      null
    );

    if (
      pendingNewAreaFeatureRef
        .current
    ) {
      areaSourceRef
        .current
        ?.removeFeature(
          pendingNewAreaFeatureRef
            .current
        );

      pendingNewAreaFeatureRef.current =
        null;
    }
  }


  /* ========================================================
     APP 014
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
            "draw-area" ||
          editorMode ===
            "edit-area-shape" ||
          editorMode ===
            "new-area-review"
        ) {
          return;
        }

        if (
          editorOpen &&
          editorMode ===
            "batch-place"
        ) {
          if (
            !selectedAreaId
          ) {
            setEditorMessage(
              "Select a Plot Area first."
            );

            return;
          }

          const coordinate =
            event.coordinate;

          const lonLat =
            new Point(
              coordinate
            );

          lonLat.transform(
            "EPSG:3857",
            "EPSG:4326"
          );

          const [
            longitude,
            latitude,
          ] =
            lonLat.getCoordinates();

          const number =
            String(
              nextPlotNumber +
              stagedPlots.length
            );

          const staged:
            NewPlotPlacement = {
              tempId:
                crypto.randomUUID(),

              plotNumber:
                number,

              displayName:
                `Plot ${number}`,

              longitude,
              latitude,
            };

          setStagedPlots(
            (current) => [
              ...current,
              staged,
            ]
          );

          setEditorMessage(
            `Staged ${staged.displayName}. Keep clicking.`
          );

          return;
        }

        if (
          editorOpen &&
          editorMode ===
            "place" &&
          selectedPlotId
        ) {
          const point =
            new Point(
              event.coordinate
            );

          point.transform(
            "EPSG:3857",
            "EPSG:4326"
          );

          const [
            longitude,
            latitude,
          ] =
            point.getCoordinates();

          setPendingPlacement({
            plotId:
              selectedPlotId,

            longitude,
            latitude,
          });

          setEditorMessage(
            "Placement preview updated."
          );

          return;
        }

        const hit =
          map.forEachFeatureAtPixel(
            event.pixel,

            (
              candidate
            ) => {
              const kind =
                candidate.get(
                  "kind"
                );

              if (
                kind ===
                  "plot" ||
                kind ===
                  "plot-area"
              ) {
                return candidate;
              }

              return undefined;
            }
          ) as
            | Feature
            | undefined;

        if (!hit) {
          return;
        }

        if (
          hit.get(
            "kind"
          ) === "plot"
        ) {
          const plotId =
            hit.get(
              "plotId"
            );

          const plot =
            dataset?.plots.find(
              (item) =>
                item.id ===
                plotId
            );

          if (plot) {
            focusPlot(
              plot
            );
          }

          return;
        }

        const areaId =
          hit.get(
            "areaId"
          );

        const area =
          dataset?.mapAreas.find(
            (item) =>
              item.id ===
              areaId
          );

        if (area) {
          setSelectedAreaId(
            area.id
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
    dataset,
    editorOpen,
    editorMode,
    selectedPlotId,
    selectedAreaId,
    nextPlotNumber,
    stagedPlots.length,
  ]);


  /* ========================================================
     APP 015
     Editor toggle
     ======================================================== */

  function toggleEditor() {
    if (editorOpen) {
      clearTransientState();

      setEditorOpen(
        false
      );

      setEditorMode(
        "browse"
      );

      setEditorMessage(
        null
      );

      setAreaRenderRevision(
        (value) =>
          value + 1
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
      "Select an area, create another area, edit its shape, or batch-place plots."
    );
  }


  /* ========================================================
     APP 016
     Create a NEW arbitrary polygon Plot Area
     ======================================================== */

  function startNewArea() {
    const map =
      mapRef.current;

    const source =
      areaSourceRef.current;

    if (
      !map ||
      !source
    ) {
      return;
    }

    clearTransientState();

    setSelectedPlotId(
      null
    );

    setEditorMode(
      "draw-area"
    );

    setNewAreaName(
      `Plot Area ${
        (
          dataset?.mapAreas
            .length ||
          0
        ) + 1
      }`
    );

    setEditorMessage(
      "Click each corner of the new area. Double-click the final corner to finish."
    );

    const interaction =
      new Draw({
        source,
        type:
          "Polygon",
      });

    drawInteractionRef.current =
      interaction;

    interaction.on(
      "drawend",
      (event: any) => {
        const feature =
          event.feature as Feature;

        const geometry =
          feature.getGeometry();

        if (
          !(geometry instanceof
            Polygon)
        ) {
          return;
        }

        pendingNewAreaFeatureRef.current =
          feature;

        setPendingAreaGeometry(
          polygonToAreaGeometry(
            geometry
          )
        );

        removeDrawInteraction();

        setEditorMode(
          "new-area-review"
        );

        setEditorMessage(
          "Area shape staged. Name it and save, or cancel and redraw."
        );
      }
    );

    map.addInteraction(
      interaction
    );
  }

  function cancelNewArea() {
    removeDrawInteraction();

    if (
      pendingNewAreaFeatureRef
        .current
    ) {
      areaSourceRef
        .current
        ?.removeFeature(
          pendingNewAreaFeatureRef
            .current
        );

      pendingNewAreaFeatureRef.current =
        null;
    }

    setPendingAreaGeometry(
      null
    );

    setEditorMode(
      "browse"
    );

    setEditorMessage(
      "New area canceled."
    );

    setAreaRenderRevision(
      (value) =>
        value + 1
    );
  }

  async function saveNewArea() {
    if (
      !dataset ||
      !pendingAreaGeometry
    ) {
      return;
    }

    const label =
      newAreaName.trim();

    if (!label) {
      setEditorMessage(
        "Enter an area name."
      );

      return;
    }

    try {
      setSaving(
        true
      );

      const created =
        await createMapArea(
          dataset.cemetery.id,
          label,
          pendingAreaGeometry
        );

      setDataset(
        (current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,

            mapAreas: [
              ...current.mapAreas,
              created,
            ],
          };
        }
      );

      pendingNewAreaFeatureRef.current =
        null;

      setPendingAreaGeometry(
        null
      );

      setSelectedAreaId(
        created.id
      );

      setAreaNameDraft(
        created.label
      );

      setEditorMode(
        "browse"
      );

      setEditorMessage(
        `${created.label} created.`
      );
    } catch (saveError) {
      console.error(
        "PlotMap create area error:",
        saveError
      );

      setEditorMessage(
        saveError instanceof
          Error
          ? saveError.message
          : "Could not create area."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  /* ========================================================
     APP 017
     Modify ANY existing area polygon

     - Drag a corner to change its angle.
     - OpenLayers Modify supports adding vertices along edges.
     - Alt-click a vertex removes it.
     ======================================================== */

  function startEditAreaShape() {
    const map =
      mapRef.current;

    const source =
      areaSourceRef.current;

    if (
      !map ||
      !source ||
      !selectedArea
    ) {
      return;
    }

    clearTransientState();

    /*
     * Make sure the source reflects database state before
     * selecting the feature to modify.
     */
    setAreaRenderRevision(
      (value) =>
        value + 1
    );

    const feature =
      source
        .getFeatures()
        .find(
          (item) =>
            item.get(
              "areaId"
            ) ===
            selectedArea.id
        );

    if (!feature) {
      setEditorMessage(
        "Could not locate the selected area on the map."
      );

      return;
    }

    const interaction =
      new Modify({
        features:
          new Collection([
            feature,
          ]),
      });

    modifyInteractionRef.current =
      interaction;

    interaction.on(
      "modifyend",
      () => {
        const geometry =
          feature.getGeometry();

        if (
          geometry instanceof
          Polygon
        ) {
          setPendingAreaGeometry(
            polygonToAreaGeometry(
              geometry
            )
          );

          setEditorMessage(
            "Shape changed. Continue adjusting vertices or save."
          );
        }
      }
    );

    map.addInteraction(
      interaction
    );

    setEditorMode(
      "edit-area-shape"
    );

    setEditorMessage(
      "Drag vertices to change corners. Add a bend on an edge as needed. Alt-click a vertex to remove it."
    );
  }

  function cancelAreaShapeEdit() {
    removeModifyInteraction();

    setPendingAreaGeometry(
      null
    );

    setEditorMode(
      "browse"
    );

    setAreaRenderRevision(
      (value) =>
        value + 1
    );

    setEditorMessage(
      "Shape changes canceled."
    );
  }

  async function saveAreaShape() {
    if (
      !selectedArea ||
      !pendingAreaGeometry
    ) {
      return;
    }

    try {
      setSaving(
        true
      );

      await updateMapAreaGeometry(
        selectedArea.id,
        pendingAreaGeometry
      );

      setDataset(
        (current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,

            mapAreas:
              current.mapAreas.map(
                (area) =>
                  area.id ===
                  selectedArea.id
                    ? {
                        ...area,

                        geometry:
                          pendingAreaGeometry,
                      }
                    : area
              ),
          };
        }
      );

      removeModifyInteraction();

      setPendingAreaGeometry(
        null
      );

      setEditorMode(
        "browse"
      );

      setEditorMessage(
        "Area shape saved."
      );
    } catch (saveError) {
      console.error(
        "PlotMap area shape save error:",
        saveError
      );

      setEditorMessage(
        saveError instanceof
          Error
          ? saveError.message
          : "Could not save area shape."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  /* ========================================================
     APP 018
     Rename selected area
     ======================================================== */

  async function saveAreaName() {
    if (!selectedArea) {
      return;
    }

    const label =
      areaNameDraft.trim();

    if (!label) {
      setEditorMessage(
        "Enter an area name."
      );

      return;
    }

    try {
      setSaving(
        true
      );

      await updateMapAreaLabel(
        selectedArea.id,
        label
      );

      setDataset(
        (current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,

            mapAreas:
              current.mapAreas.map(
                (area) =>
                  area.id ===
                  selectedArea.id
                    ? {
                        ...area,
                        label,
                      }
                    : area
              ),
          };
        }
      );

      setEditorMessage(
        `Renamed area to ${label}.`
      );
    } catch (saveError) {
      setEditorMessage(
        saveError instanceof
          Error
          ? saveError.message
          : "Could not rename area."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  /* ========================================================
     APP 019
     Batch-create plots INSIDE selected area
     ======================================================== */

  function startBatchPlacement() {
    if (!selectedAreaId) {
      setEditorMessage(
        "Select or create a Plot Area first."
      );

      return;
    }

    clearTransientState();

    setEditorMode(
      "batch-place"
    );

    setSelectedPlotId(
      null
    );

    setNextPlotNumber(
      nextSuggestedPlotNumber
    );

    setEditorMessage(
      `Batch placement in ${selectedArea?.label}. Click headstones continuously.`
    );
  }

  function undoLastStagedPlot() {
    setStagedPlots(
      (current) =>
        current.slice(
          0,
          -1
        )
    );
  }

  function cancelBatchPlacement() {
    setStagedPlots(
      []
    );

    setEditorMode(
      "browse"
    );

    setEditorMessage(
      "Batch canceled. Nothing saved."
    );
  }

  async function saveBatchPlacement() {
    if (
      !dataset ||
      !selectedAreaId ||
      stagedPlots.length ===
        0
    ) {
      return;
    }

    try {
      setSaving(
        true
      );

      const created =
        await createPlotsBatch(
          dataset.cemetery.id,
          selectedAreaId,
          stagedPlots
        );

      const unassigned =
        dataset.sections.find(
          (section) =>
            section.code ===
            "UNASSIGNED"
        );

      const normalized:
        PlotRecord[] =
        created.map(
          (plot) => ({
            ...plot,

            section:
              unassigned,

            row:
              undefined,

            burials:
              [],
          })
        );

      setDataset(
        (current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,

            plots: [
              ...current.plots,
              ...normalized,
            ],
          };
        }
      );

      setStagedPlots(
        []
      );

      setEditorMode(
        "browse"
      );

      setEditorMessage(
        `${normalized.length} plots created in ${selectedArea?.label}.`
      );
    } catch (saveError) {
      console.error(
        "PlotMap batch save error:",
        saveError
      );

      setEditorMessage(
        saveError instanceof
          Error
          ? saveError.message
          : "Could not save batch."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  /* ========================================================
     APP 020
     Reposition a single existing plot
     ======================================================== */

  function startPlotPlacement(
    plot: PlotRecord
  ) {
    clearTransientState();

    setSelectedPlotId(
      plot.id
    );

    if (
      plot.plot_area_id
    ) {
      setSelectedAreaId(
        plot.plot_area_id
      );
    }

    setEditorMode(
      "place"
    );

    setEditorMessage(
      "Click the exact new position for this plot."
    );
  }

  function cancelPlotPlacement() {
    setPendingPlacement(
      null
    );

    setEditorMode(
      "browse"
    );
  }

  async function savePlotPlacement() {
    if (
      !pendingPlacement
    ) {
      return;
    }

    try {
      setSaving(
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
        "Plot position saved."
      );
    } catch (saveError) {
      setEditorMessage(
        saveError instanceof
          Error
          ? saveError.message
          : "Could not save plot."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  /* ========================================================
     APP 021
     Plot Manager — selection / bulk actions
     ======================================================== */

  function togglePlotSelected(
    plotId: string
  ) {
    setSelectedPlotIds(
      (current) => {
        const next =
          new Set(
            current
          );

        if (
          next.has(
            plotId
          )
        ) {
          next.delete(
            plotId
          );
        } else {
          next.add(
            plotId
          );
        }

        return next;
      }
    );
  }

  function clearPlotSelection() {
    setSelectedPlotIds(
      new Set()
    );

    setConfirmingDelete(
      false
    );
  }

  function selectAllVisiblePlots() {
    setSelectedPlotIds(
      new Set(
        filteredPlots.map(
          (plot) =>
            plot.id
        )
      )
    );
  }

  async function bulkAssignSelectedPlots() {
    if (
      selectedPlotIds.size ===
      0
    ) {
      return;
    }

    const ids =
      Array.from(
        selectedPlotIds
      );

    const expectedCount =
      ids.length;

    const targetAreaId =
      bulkAreaId ||
      null;

    try {
      setSaving(
        true
      );

      setEditorMessage(
        `Assigning ${expectedCount} plots…`
      );

      const result =
        await assignPlotsToArea(
          ids,
          targetAreaId
        );

      if (
        result.requestedCount !==
          expectedCount ||
        result.updatedCount !==
          expectedCount
      ) {
        throw new Error(
          `PostgreSQL verified ${result.updatedCount} of ${expectedCount} requested assignments.`
        );
      }

      /*
       * Reload database truth.
       */
      const refreshed =
        await loadPlotMapDataset(
          plotMapConfig
            .cemeterySlug
        );

      /*
       * Then independently verify every selected record has the
       * target area ID after that reload.
       */
      const refreshedById =
        new Map(
          refreshed.plots.map(
            (plot) => [
              plot.id,
              plot,
            ]
          )
        );

      const mismatches =
        ids.filter(
          (id) => {
            const plot =
              refreshedById.get(
                id
              );

            if (!plot) {
              return true;
            }

            return (
              plot.plot_area_id !==
              targetAreaId
            );
          }
        );

      if (
        mismatches.length >
        0
      ) {
        throw new Error(
          `${mismatches.length} plots still do not contain the requested Plot Area after reloading Supabase.`
        );
      }

      setDataset(
        refreshed
      );

      const targetName =
        targetAreaId
          ? refreshed.mapAreas.find(
              (area) =>
                area.id ===
                targetAreaId
            )?.label ||
            "selected area"
          : "No Area";

      setEditorMessage(
        `${expectedCount} plots persisted to ${targetName}.`
      );

      clearPlotSelection();
    } catch (saveError) {
      console.error(
        "PlotMap verified bulk assignment error:",
        saveError
      );

      setEditorMessage(
        saveError instanceof Error
          ? `Assignment failed: ${saveError.message}`
          : "Assignment failed."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  async function bulkDeleteSelectedPlots() {
    if (
      selectedPlotIds.size ===
      0
    ) {
      return;
    }

    try {
      setSaving(
        true
      );

      const ids =
        Array.from(
          selectedPlotIds
        );

      const deleted =
        await deletePlotsBatch(
          ids
        );

      setDataset(
        (current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,

            plots:
              current.plots.filter(
                (plot) =>
                  !selectedPlotIds.has(
                    plot.id
                  )
              ),
          };
        }
      );

      if (
        selectedPlotId &&
        selectedPlotIds.has(
          selectedPlotId
        )
      ) {
        setSelectedPlotId(
          null
        );
      }

      clearPlotSelection();

      setEditorMessage(
        `${deleted} plots deleted.`
      );
    } catch (saveError) {
      setEditorMessage(
        saveError instanceof Error
          ? saveError.message
          : "Could not delete selected plots."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  /* ========================================================
     APP 022
     Edit one plot's data
     ======================================================== */

  async function saveSelectedPlotDetails() {
    if (
      !selectedPlot ||
      !plotEditDraft
    ) {
      return;
    }

    const cleanNumber =
      plotEditDraft
        .plotNumber
        .trim();

    if (!cleanNumber) {
      setEditorMessage(
        "Plot number is required."
      );

      return;
    }

    try {
      setSaving(
        true
      );

      const input:
        PlotEditInput = {
          ...plotEditDraft,

          plotNumber:
            cleanNumber,

          displayName:
            plotEditDraft
              .displayName
              ?.trim() ||
            null,

          notes:
            plotEditDraft
              .notes
              ?.trim() ||
            null,
        };

      await updatePlotDetails(
        selectedPlot.id,
        input
      );

      /*
       * Reload persisted state after an edit for the same reason
       * as bulk assignment: the UI should show database truth.
       */
      const refreshed =
        await loadPlotMapDataset(
          plotMapConfig
            .cemeterySlug
        );

      setDataset(
        refreshed
      );

      const refreshedPlot =
        refreshed.plots.find(
          (plot) =>
            plot.id ===
            selectedPlot.id
        );

      if (
        refreshedPlot
      ) {
        setPlotEditDraft({
          plotAreaId:
            refreshedPlot
              .plot_area_id,

          plotNumber:
            refreshedPlot
              .plot_number,

          displayName:
            refreshedPlot
              .display_name,

          status:
            refreshedPlot
              .status,

          plotType:
            refreshedPlot
              .plot_type,

          notes:
            refreshedPlot
              .notes,
        });
      }

      setEditorMessage(
        "Plot details saved to Supabase."
      );
    } catch (saveError) {
      setEditorMessage(
        saveError instanceof Error
          ? saveError.message
          : "Could not save plot details."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  /* ========================================================
     APP 023
     Person Info — create/update primary person
     ======================================================== */

  async function saveSelectedPersonInfo() {
    if (
      !selectedPlot ||
      !personEditDraft
    ) {
      return;
    }

    if (
      !personEditDraft
        .lastName
        .trim()
    ) {
      setEditorMessage(
        "Last name is required."
      );

      return;
    }

    try {
      setSaving(
        true
      );

      await savePlotPersonInfo(
        selectedPlot.id,
        personEditDraft
      );

      const refreshed =
        await loadPlotMapDataset(
          plotMapConfig
            .cemeterySlug
        );

      setDataset(
        refreshed
      );

      const refreshedPlot =
        refreshed.plots.find(
          (plot) =>
            plot.id ===
            selectedPlot.id
        );

      if (
        refreshedPlot
      ) {
        const primary =
          refreshedPlot
            .burials[0];

        setPersonEditDraft({
          personId:
            primary?.person.id ||
            null,

          firstName:
            primary?.person.first_name ||
            "",

          middleName:
            primary?.person.middle_name ||
            "",

          lastName:
            primary?.person.last_name ||
            "",

          suffix:
            primary?.person.suffix ||
            "",

          birthDate:
            primary?.person.birth_date ||
            "",

          deathDate:
            primary?.person.death_date ||
            "",

          obituary:
            primary?.person.obituary ||
            "",

          biography:
            primary?.person.biography ||
            "",

          personNotes:
            primary?.person.notes ||
            "",

          burialDate:
            primary?.burial.burial_date ||
            "",

          intermentType:
            primary?.burial.interment_type ||
            "burial",

          burialNotes:
            primary?.burial.notes ||
            "",
        });
      }

      setEditorMessage(
        "Person information saved."
      );
    } catch (saveError) {
      console.error(
        "PlotMap person save error:",
        saveError
      );

      setEditorMessage(
        saveError instanceof Error
          ? saveError.message
          : "Could not save person information."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  /* ========================================================
     APP 024
     Stats
     ======================================================== */

  const stats =
    useMemo(() => {
      const plots =
        dataset?.plots ||
        [];

      return {
        total:
          plots.length,

        mapped:
          plots.filter(
            plotHasRealPlacement
          ).length,

        areas:
          dataset?.mapAreas
            .length ||
          0,
      };
    }, [dataset]);


  /* ========================================================
     APP 025
     Render
     ======================================================== */

  return (
    <div className="plotmap-shell">
      <header className="plotmap-header">
        <div className="plotmap-brand">
          <div className="plotmap-brand-icon">
            <MapPin
              size={18}
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
            <span className="status-dot ready" />

            {imageryStatus ===
              "racine"
              ? "Racine 2025 aerial"
              : imageryStatus ===
                  "fallback"
                ? "Fallback aerial"
                : "Loading aerial"}
          </div>
        </div>
      </header>

      <main className="plotmap-workspace">
        <aside className="plotmap-sidebar">
          <section className="cemetery-summary">
            <span className="eyebrow">
              CEMETERY
            </span>

            <h1>
              {dataset?.cemetery
                .name ||
                "Loading…"}
            </h1>

            <p>
              {dataset?.cemetery
                .address_line_1}
            </p>
          </section>


          <section className="search-section">
            <div className="zone-browser-row">
              <label>
                ZONE
              </label>

              <select
                value={
                  zoneFilter
                }
                onChange={
                  (event) =>
                    setZoneFilter(
                      event.target
                        .value
                    )
                }
              >
                <option value="all">
                  All Zones
                  {" · "}
                  {dataset?.plots.length ||
                    0}
                </option>

                {dataset?.mapAreas.map(
                  (area) => (
                    <option
                      key={
                        area.id
                      }
                      value={
                        area.id
                      }
                    >
                      {
                        area.label
                      }
                      {" · "}
                      {zoneCounts.get(
                        area.id
                      ) || 0}
                    </option>
                  )
                )}

                {(zoneCounts.get(
                  "none"
                ) || 0) >
                  0 && (
                  <option value="none">
                    No Area
                    {" · "}
                    {zoneCounts.get(
                      "none"
                    ) || 0}
                  </option>
                )}
              </select>
            </div>

            <div className="search-box">
              <Search
                size={15}
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
                placeholder="Last name, YOD, plot #, zone…"
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
                >
                  <X
                    size={14}
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
                    type="button"
                    key={
                      filter
                    }
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
                  stats.areas
                }
              </strong>
              <span>
                Areas
              </span>
            </div>

            <div>
              <strong>
                {
                  stats.total
                }
              </strong>
              <span>
                Plots
              </span>
            </div>

            <div>
              <strong>
                {
                  stats.mapped
                }
              </strong>
              <span>
                Mapped
              </span>
            </div>
          </section>

          <section className="results-section">
            <div className="section-heading plot-list-heading">
              <span>
                Plots
              </span>

              <div>
                <button
                  type="button"
                  className={
                    selectionMode
                      ? "selection-toggle active"
                      : "selection-toggle"
                  }
                  onClick={() => {
                    setSelectionMode(
                      (current) => {
                        const next =
                          !current;

                        if (next) {
                          setBulkAreaId(
                            selectedAreaId ||
                            ""
                          );
                        }

                        return next;
                      }
                    );

                    clearPlotSelection();
                  }}
                >
                  <CheckSquare
                    size={12}
                  />

                  {selectionMode
                    ? "Done"
                    : "Select"}
                </button>

                <small>
                  {
                    filteredPlots.length
                  }
                </small>
              </div>
            </div>

            {selectionMode && (
              <div className="bulk-plot-toolbar">
                <div className="bulk-selection-row">
                  <span>
                    {selectedPlotIds.size}
                    {" "}
                    selected
                  </span>

                  <button
                    type="button"
                    onClick={
                      selectAllVisiblePlots
                    }
                  >
                    Select All
                  </button>

                  <button
                    type="button"
                    onClick={
                      clearPlotSelection
                    }
                  >
                    Clear
                  </button>
                </div>

                <div className="bulk-area-row">
                  <select
                    value={
                      bulkAreaId
                    }
                    onChange={
                      (event) =>
                        setBulkAreaId(
                          event.target.value
                        )
                    }
                  >
                    <option value="">
                      No Area
                    </option>

                    {dataset?.mapAreas.map(
                      (area) => (
                        <option
                          key={
                            area.id
                          }
                          value={
                            area.id
                          }
                        >
                          {
                            area.label
                          }
                        </option>
                      )
                    )}
                  </select>

                  <button
                    type="button"
                    className="bulk-assign"
                    disabled={
                      selectedPlotIds.size ===
                        0 ||
                      saving
                    }
                    onClick={
                      bulkAssignSelectedPlots
                    }
                  >
                    Assign Area
                  </button>
                </div>

                {!confirmingDelete ? (
                  <button
                    type="button"
                    className="bulk-delete"
                    disabled={
                      selectedPlotIds.size ===
                      0
                    }
                    onClick={() =>
                      setConfirmingDelete(
                        true
                      )
                    }
                  >
                    <Trash2
                      size={12}
                    />

                    Delete Selected
                  </button>
                ) : (
                  <div className="delete-confirm-row">
                    <span>
                      Delete{" "}
                      {
                        selectedPlotIds.size
                      }
                      {" "}
                      plots?
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setConfirmingDelete(
                          false
                        )
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className="confirm-delete"
                      disabled={
                        saving
                      }
                      onClick={
                        bulkDeleteSelectedPlots
                      }
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="results-list">
              {filteredPlots.map(
                (plot) => {
                  const area =
                    plot.plot_area_id
                      ? areaById.get(
                          plot.plot_area_id
                        )
                      : null;

                  const firstBurial =
                    plot.burials[0];

                  return (
                    <button
                      type="button"
                      key={
                        plot.id
                      }
                      className={
                        selectedPlotIds.has(
                          plot.id
                        )
                          ? "result-card bulk-selected"
                          : selectedPlotId ===
                              plot.id
                            ? "result-card selected"
                            : "result-card"
                      }
                      onClick={() => {
                        if (
                          selectionMode
                        ) {
                          togglePlotSelected(
                            plot.id
                          );

                          return;
                        }

                        focusPlot(
                          plot
                        );
                      }}
                    >
                      {selectionMode && (
                        <span
                          className={
                            selectedPlotIds.has(
                              plot.id
                            )
                              ? "plot-checkbox checked"
                              : "plot-checkbox"
                          }
                        >
                          {selectedPlotIds.has(
                            plot.id
                          )
                            ? "✓"
                            : ""}
                        </span>
                      )}
                      <span
                        className={`plot-status ${plot.status}`}
                      />

                      <span className="result-copy">
                        <strong>
                          Plot{" "}
                          {
                            plot.plot_number
                          }
                        </strong>

                        <small>
                          {area?.label ||
                            "No Area"}

                          {firstBurial && (
                            <>
                              {" · "}
                              {firstBurial
                                .person
                                .last_name}
                              {firstBurial
                                .person
                                .first_name
                                ? `, ${firstBurial.person.first_name}`
                                : ""}

                              {firstBurial
                                .person
                                .death_date && (
                                <>
                                  {" · "}
                                  YOD{" "}
                                  {getYear(
                                    firstBurial
                                      .person
                                      .death_date
                                  )}
                                </>
                              )}
                            </>
                          )}
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
            className={
              editorMode ===
                "batch-place" ||
              editorMode ===
                "place" ||
              editorMode ===
                "draw-area" ||
              editorMode ===
                "edit-area-shape"
                ? "plotmap-map editing"
                : "plotmap-map"
            }
          />

          {editorOpen && (
            <section
              className="map-editor-window draggable-window"
              style={
                editorPanelDrag.style
              }
            >
              <div
                className="draggable-titlebar"
                {...editorPanelDrag.handleProps}
              >
                <div>
                  <Pencil
                    size={13}
                  />
                  <strong>
                    MAP EDITOR
                  </strong>
                </div>

                <button
                  type="button"
                  title="Reset window position"
                  onClick={
                    editorPanelDrag.reset
                  }
                >
                  ↺
                </button>
              </div>

              <div className="area-manager floating-area-manager">
                <div className="area-manager-heading">
                <span>
                  PLOT AREAS
                </span>

                <button
                  type="button"
                  onClick={
                    startNewArea
                  }
                  disabled={
                    editorMode !==
                    "browse"
                  }
                >
                  <Plus
                    size={12}
                  />
                  New Area
                </button>
              </div>

              <div className="area-list">
                {dataset?.mapAreas.map(
                  (area) => {
                    const count =
                      dataset.plots.filter(
                        (plot) =>
                          plot.plot_area_id ===
                          area.id
                      ).length;

                    return (
                      <button
                        type="button"
                        key={
                          area.id
                        }
                        className={
                          selectedAreaId ===
                          area.id
                            ? "area-list-item selected"
                            : "area-list-item"
                        }
                        onClick={() => {
                          if (
                            editorMode !==
                            "browse"
                          ) {
                            return;
                          }

                          focusArea(
                            area
                          );
                        }}
                      >
                        <Shapes
                          size={13}
                        />

                        <span>
                          <strong>
                            {
                              area.label
                            }
                          </strong>

                          <small>
                            {count}
                            {" "}
                            plots
                          </small>
                        </span>
                      </button>
                    );
                  }
                )}
              </div>

              {selectedArea && (
                <div className="selected-area-editor">
                  <label>
                    Area name
                  </label>

                  <div className="area-name-row">
                    <input
                      value={
                        areaNameDraft
                      }
                      maxLength={80}
                      disabled={
                        editorMode !==
                        "browse"
                      }
                      onChange={
                        (event) =>
                          setAreaNameDraft(
                            event.target
                              .value
                          )
                      }
                    />

                    <button
                      type="button"
                      disabled={
                        saving ||
                        editorMode !==
                          "browse" ||
                        !areaNameDraft
                          .trim() ||
                        areaNameDraft
                          .trim() ===
                          selectedArea
                            .label
                      }
                      onClick={
                        saveAreaName
                      }
                    >
                      Save
                    </button>
                  </div>

                  <div className="area-action-grid">
                    <button
                      type="button"
                      disabled={
                        editorMode !==
                        "browse"
                      }
                      onClick={
                        startEditAreaShape
                      }
                    >
                      <BoxSelect
                        size={13}
                      />
                      Edit Shape
                    </button>

                    <button
                      type="button"
                      disabled={
                        editorMode !==
                        "browse"
                      }
                      onClick={
                        startBatchPlacement
                      }
                    >
                      <MousePointerClick
                        size={13}
                      />
                      Batch Place
                    </button>
                  </div>
                </div>
              )}

                <div className="editor-message">
                  {editorMessage ||
                    "Select an area or create another one."}
                </div>
              </div>
            </section>
          )}


          <div className="map-toolbar">
            {selectedArea && (
              <button
                type="button"
                onClick={() =>
                  focusArea(
                    selectedArea
                  )
                }
              >
                <BoxSelect
                  size={14}
                />
                {
                  selectedArea.label
                }
              </button>
            )}
          </div>

          {editorOpen && (
            <div className="map-editor-status">
              {editorMode ===
                "draw-area" &&
                "NEW AREA — click corners; double-click to finish"}

              {editorMode ===
                "edit-area-shape" &&
                "EDIT SHAPE — drag vertices; Alt-click a vertex to remove"}

              {editorMode ===
                "batch-place" &&
                `BATCH — ${stagedPlots.length} staged in ${selectedArea?.label}`}

              {editorMode ===
                "place" &&
                "REPOSITION — click the exact plot location"}

              {editorMode ===
                "browse" &&
                (editorMessage ||
                  "MAP EDITOR")}
            </div>
          )}

          {editorMode ===
            "new-area-review" && (
            <div className="floating-editor-panel">
              <strong>
                New Plot Area
              </strong>

              <label>
                Name
              </label>

              <input
                value={
                  newAreaName
                }
                maxLength={80}
                onChange={
                  (event) =>
                    setNewAreaName(
                      event.target
                        .value
                    )
                }
              />

              <div className="floating-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={
                    cancelNewArea
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-action"
                  disabled={
                    saving ||
                    !newAreaName
                      .trim()
                  }
                  onClick={
                    saveNewArea
                  }
                >
                  <Save
                    size={14}
                  />
                  Save Area
                </button>
              </div>
            </div>
          )}

          {editorMode ===
            "edit-area-shape" && (
            <div className="floating-editor-panel">
              <strong>
                Edit{" "}
                {
                  selectedArea
                    ?.label
                }
              </strong>

              <p>
                Corners do not need to be 90°. Make a triangle, clipped corner, or any polygon that matches the property.
              </p>

              <div className="floating-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={
                    cancelAreaShapeEdit
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-action"
                  disabled={
                    saving ||
                    !pendingAreaGeometry
                  }
                  onClick={
                    saveAreaShape
                  }
                >
                  <Save
                    size={14}
                  />
                  Save Shape
                </button>
              </div>
            </div>
          )}

          {editorMode ===
            "batch-place" && (
            <div className="floating-editor-panel batch-panel">
              <strong>
                Batch Placement
              </strong>

              <p>
                Area:{" "}
                {
                  selectedArea
                    ?.label
                }
              </p>

              <div className="batch-next">
                Next:
                {" "}
                <b>
                  Plot{" "}
                  {
                    nextPlotNumber +
                    stagedPlots.length
                  }
                </b>
              </div>

              <div className="batch-count">
                {
                  stagedPlots.length
                }
                {" "}
                staged
              </div>

              <div className="batch-three-actions">
                <button
                  type="button"
                  className="secondary-action"
                  disabled={
                    stagedPlots.length ===
                    0
                  }
                  onClick={
                    undoLastStagedPlot
                  }
                >
                  <Undo2
                    size={13}
                  />
                  Undo
                </button>

                <button
                  type="button"
                  className="secondary-action"
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
                    saving ||
                    stagedPlots.length ===
                      0
                  }
                  onClick={
                    saveBatchPlacement
                  }
                >
                  <Save
                    size={13}
                  />
                  Save{" "}
                  {
                    stagedPlots.length
                  }
                </button>
              </div>
            </div>
          )}

          {selectedPlot &&
            editorMode !==
              "batch-place" &&
            editorMode !==
              "draw-area" &&
            editorMode !==
              "new-area-review" &&
            editorMode !==
              "edit-area-shape" && (
              <article
                className="plot-detail-card draggable-window"
                style={
                  detailsPanelDrag.style
                }
              >
                <div
                  className="draggable-titlebar detail-dragbar"
                  {...detailsPanelDrag.handleProps}
                >
                  <div>
                    <MapPin
                      size={13}
                    />
                    <strong>
                      PLOT DETAILS
                    </strong>
                  </div>

                  <button
                    type="button"
                    title="Reset window position"
                    onClick={
                      detailsPanelDrag.reset
                    }
                  >
                    ↺
                  </button>
                </div>

                <button
                  type="button"
                  className="detail-close"
                  onClick={() =>
                    setSelectedPlotId(
                      null
                    )
                  }
                >
                  <X
                    size={16}
                  />
                </button>

                <div className="plot-detail-tabs">
                  <button
                    type="button"
                    className={
                      detailTab ===
                      "person"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setDetailTab(
                        "person"
                      )
                    }
                  >
                    PERSON INFO
                  </button>

                  <button
                    type="button"
                    className={
                      detailTab ===
                      "settings"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setDetailTab(
                        "settings"
                      )
                    }
                  >
                    SETTINGS
                  </button>
                </div>

                {detailTab ===
                "person" ? (
                  <div className="person-info-panel">
                    {selectedPlot
                      .burials[0] ? (
                      <div className="person-summary">
                        <span>
                          PRIMARY PERSON
                        </span>

                        <h2>
                          {getPersonDisplayName(
                            selectedPlot
                              .burials[0]
                              .person
                          )}
                        </h2>

                        <small>
                          {selectedPlot
                            .burials[0]
                            .person
                            .birth_date
                            ? getYear(
                                selectedPlot
                                  .burials[0]
                                  .person
                                  .birth_date
                              )
                            : "—"}
                          {" — "}
                          {selectedPlot
                            .burials[0]
                            .person
                            .death_date
                            ? getYear(
                                selectedPlot
                                  .burials[0]
                                  .person
                                  .death_date
                              )
                            : "—"}
                        </small>
                      </div>
                    ) : (
                      <div className="empty-person">
                        <strong>
                          No person linked
                        </strong>

                        <span>
                          This plot does not have a person record yet.
                        </span>
                      </div>
                    )}

                    {editorOpen &&
                    personEditDraft ? (
                      <div className="person-edit-form">
                        <div className="person-name-grid">
                          <div>
                            <label>
                              First name
                            </label>

                            <input
                              value={
                                personEditDraft
                                  .firstName
                              }
                              onChange={
                                (event) =>
                                  setPersonEditDraft(
                                    (current) =>
                                      current
                                        ? {
                                            ...current,
                                            firstName:
                                              event
                                                .target
                                                .value,
                                          }
                                        : current
                                  )
                              }
                            />
                          </div>

                          <div>
                            <label>
                              Middle
                            </label>

                            <input
                              value={
                                personEditDraft
                                  .middleName
                              }
                              onChange={
                                (event) =>
                                  setPersonEditDraft(
                                    (current) =>
                                      current
                                        ? {
                                            ...current,
                                            middleName:
                                              event
                                                .target
                                                .value,
                                          }
                                        : current
                                  )
                              }
                            />
                          </div>
                        </div>

                        <div className="person-name-grid">
                          <div>
                            <label>
                              Last name
                            </label>

                            <input
                              value={
                                personEditDraft
                                  .lastName
                              }
                              onChange={
                                (event) =>
                                  setPersonEditDraft(
                                    (current) =>
                                      current
                                        ? {
                                            ...current,
                                            lastName:
                                              event
                                                .target
                                                .value,
                                          }
                                        : current
                                  )
                              }
                            />
                          </div>

                          <div>
                            <label>
                              Suffix
                            </label>

                            <input
                              value={
                                personEditDraft
                                  .suffix
                              }
                              placeholder="Jr."
                              onChange={
                                (event) =>
                                  setPersonEditDraft(
                                    (current) =>
                                      current
                                        ? {
                                            ...current,
                                            suffix:
                                              event
                                                .target
                                                .value,
                                          }
                                        : current
                                  )
                              }
                            />
                          </div>
                        </div>

                        <div className="person-name-grid">
                          <div>
                            <label>
                              Date of birth
                            </label>

                            <input
                              type="date"
                              value={
                                personEditDraft
                                  .birthDate
                              }
                              onChange={
                                (event) =>
                                  setPersonEditDraft(
                                    (current) =>
                                      current
                                        ? {
                                            ...current,
                                            birthDate:
                                              event
                                                .target
                                                .value,
                                          }
                                        : current
                                  )
                              }
                            />
                          </div>

                          <div>
                            <label>
                              Date of death
                            </label>

                            <input
                              type="date"
                              value={
                                personEditDraft
                                  .deathDate
                              }
                              onChange={
                                (event) =>
                                  setPersonEditDraft(
                                    (current) =>
                                      current
                                        ? {
                                            ...current,
                                            deathDate:
                                              event
                                                .target
                                                .value,
                                          }
                                        : current
                                  )
                              }
                            />
                          </div>
                        </div>

                        <div className="person-name-grid">
                          <div>
                            <label>
                              Burial date
                            </label>

                            <input
                              type="date"
                              value={
                                personEditDraft
                                  .burialDate
                              }
                              onChange={
                                (event) =>
                                  setPersonEditDraft(
                                    (current) =>
                                      current
                                        ? {
                                            ...current,
                                            burialDate:
                                              event
                                                .target
                                                .value,
                                          }
                                        : current
                                  )
                              }
                            />
                          </div>

                          <div>
                            <label>
                              Interment
                            </label>

                            <select
                              value={
                                personEditDraft
                                  .intermentType
                              }
                              onChange={
                                (event) =>
                                  setPersonEditDraft(
                                    (current) =>
                                      current
                                        ? {
                                            ...current,
                                            intermentType:
                                              event
                                                .target
                                                .value,
                                          }
                                        : current
                                  )
                              }
                            >
                              <option value="burial">
                                Burial
                              </option>
                              <option value="cremation">
                                Cremation
                              </option>
                              <option value="mausoleum">
                                Mausoleum
                              </option>
                              <option value="other">
                                Other
                              </option>
                            </select>
                          </div>
                        </div>

                        <label>
                          Biography
                        </label>

                        <textarea
                          rows={3}
                          value={
                            personEditDraft
                              .biography
                          }
                          onChange={
                            (event) =>
                              setPersonEditDraft(
                                (current) =>
                                  current
                                    ? {
                                        ...current,
                                        biography:
                                          event
                                            .target
                                            .value,
                                      }
                                    : current
                              )
                          }
                        />

                        <label>
                          Obituary
                        </label>

                        <textarea
                          rows={3}
                          value={
                            personEditDraft
                              .obituary
                          }
                          onChange={
                            (event) =>
                              setPersonEditDraft(
                                (current) =>
                                  current
                                    ? {
                                        ...current,
                                        obituary:
                                          event
                                            .target
                                            .value,
                                      }
                                    : current
                              )
                          }
                        />

                        <label>
                          Person notes
                        </label>

                        <textarea
                          rows={2}
                          value={
                            personEditDraft
                              .personNotes
                          }
                          onChange={
                            (event) =>
                              setPersonEditDraft(
                                (current) =>
                                  current
                                    ? {
                                        ...current,
                                        personNotes:
                                          event
                                            .target
                                            .value,
                                      }
                                    : current
                              )
                          }
                        />

                        <label>
                          Burial notes
                        </label>

                        <textarea
                          rows={2}
                          value={
                            personEditDraft
                              .burialNotes
                          }
                          onChange={
                            (event) =>
                              setPersonEditDraft(
                                (current) =>
                                  current
                                    ? {
                                        ...current,
                                        burialNotes:
                                          event
                                            .target
                                            .value,
                                      }
                                    : current
                              )
                          }
                        />

                        <button
                          type="button"
                          className="primary-action full"
                          disabled={
                            saving ||
                            !personEditDraft
                              .lastName
                              .trim()
                          }
                          onClick={
                            saveSelectedPersonInfo
                          }
                        >
                          <Save
                            size={14}
                          />

                          {personEditDraft
                            .personId
                            ? "Save Person Info"
                            : "Create Person"}
                        </button>
                      </div>
                    ) : selectedPlot
                        .burials[0] ? (
                      <dl className="person-readonly">
                        <div>
                          <dt>
                            Last name
                          </dt>
                          <dd>
                            {
                              selectedPlot
                                .burials[0]
                                .person
                                .last_name
                            }
                          </dd>
                        </div>

                        <div>
                          <dt>
                            DOB
                          </dt>
                          <dd>
                            {selectedPlot
                              .burials[0]
                              .person
                              .birth_date ||
                              "—"}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            DOD
                          </dt>
                          <dd>
                            {selectedPlot
                              .burials[0]
                              .person
                              .death_date ||
                              "—"}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Burial
                          </dt>
                          <dd>
                            {selectedPlot
                              .burials[0]
                              .burial
                              .burial_date ||
                              "—"}
                          </dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="edit-mode-hint">
                        Open Map Editor to add person information.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="settings-panel">
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
                        .display_name ||
                        `Plot ${selectedPlot.plot_number}`}
                    </h2>

                    {editorOpen &&
                    plotEditDraft ? (
                      <div className="plot-edit-form">
                        <label>
                          Area
                        </label>

                        <select
                          value={
                            plotEditDraft
                              .plotAreaId ||
                            ""
                          }
                          onChange={
                            (event) =>
                              setPlotEditDraft(
                                (current) =>
                                  current
                                    ? {
                                        ...current,

                                        plotAreaId:
                                          event
                                            .target
                                            .value ||
                                          null,
                                      }
                                    : current
                              )
                          }
                        >
                          <option value="">
                            No Area
                          </option>

                          {dataset?.mapAreas.map(
                            (area) => (
                              <option
                                key={
                                  area.id
                                }
                                value={
                                  area.id
                                }
                              >
                                {
                                  area.label
                                }
                              </option>
                            )
                          )}
                        </select>

                        <label>
                          Plot number / ID
                        </label>

                        <input
                          value={
                            plotEditDraft
                              .plotNumber
                          }
                          onChange={
                            (event) =>
                              setPlotEditDraft(
                                (current) =>
                                  current
                                    ? {
                                        ...current,

                                        plotNumber:
                                          event
                                            .target
                                            .value,
                                      }
                                    : current
                              )
                          }
                        />

                        <label>
                          Display name
                        </label>

                        <input
                          value={
                            plotEditDraft
                              .displayName ||
                            ""
                          }
                          placeholder="Plot 1"
                          onChange={
                            (event) =>
                              setPlotEditDraft(
                                (current) =>
                                  current
                                    ? {
                                        ...current,

                                        displayName:
                                          event
                                            .target
                                            .value,
                                      }
                                    : current
                              )
                          }
                        />

                        <div className="plot-edit-grid">
                          <div>
                            <label>
                              Status
                            </label>

                            <select
                              value={
                                plotEditDraft
                                  .status
                              }
                              onChange={
                                (event) =>
                                  setPlotEditDraft(
                                    (current) =>
                                      current
                                        ? {
                                            ...current,

                                            status:
                                              event
                                                .target
                                                .value as PlotStatus,
                                          }
                                        : current
                                  )
                              }
                            >
                              <option value="available">
                                Available
                              </option>
                              <option value="reserved">
                                Reserved
                              </option>
                              <option value="occupied">
                                Occupied
                              </option>
                              <option value="unavailable">
                                Unavailable
                              </option>
                            </select>
                          </div>

                          <div>
                            <label>
                              Type
                            </label>

                            <select
                              value={
                                plotEditDraft
                                  .plotType
                              }
                              onChange={
                                (event) =>
                                  setPlotEditDraft(
                                    (current) =>
                                      current
                                        ? {
                                            ...current,

                                            plotType:
                                              event
                                                .target
                                                .value,
                                          }
                                        : current
                                  )
                              }
                            >
                              <option value="standard">
                                Standard
                              </option>
                              <option value="cremation">
                                Cremation
                              </option>
                              <option value="mausoleum">
                                Mausoleum
                              </option>
                              <option value="family">
                                Family
                              </option>
                              <option value="other">
                                Other
                              </option>
                            </select>
                          </div>
                        </div>

                        <label>
                          Plot notes
                        </label>

                        <textarea
                          rows={3}
                          value={
                            plotEditDraft
                              .notes ||
                            ""
                          }
                          onChange={
                            (event) =>
                              setPlotEditDraft(
                                (current) =>
                                  current
                                    ? {
                                        ...current,

                                        notes:
                                          event
                                            .target
                                            .value,
                                      }
                                    : current
                              )
                          }
                        />

                        <button
                          type="button"
                          className="primary-action full"
                          disabled={
                            saving ||
                            !plotEditDraft
                              .plotNumber
                              .trim()
                          }
                          onClick={
                            saveSelectedPlotDetails
                          }
                        >
                          <Save
                            size={14}
                          />
                          Save Plot Settings
                        </button>
                      </div>
                    ) : (
                      <dl>
                        <div>
                          <dt>
                            Area
                          </dt>
                          <dd>
                            {selectedPlot
                              .plot_area_id
                              ? areaById.get(
                                  selectedPlot
                                    .plot_area_id
                                )?.label ||
                                "—"
                              : "No Area"}
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
                    )}
                  </div>
                )}

                {editorOpen &&
                detailTab ===
                  "settings" && (
                  pendingPlacement?.plotId ===
                  selectedPlot.id ? (
                    <div className="detail-actions">
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={
                          cancelPlotPlacement
                        }
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        className="primary-action"
                        disabled={
                          saving
                        }
                        onClick={
                          savePlotPlacement
                        }
                      >
                        Save Position
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="primary-action full"
                      onClick={() =>
                        startPlotPlacement(
                          selectedPlot
                        )
                      }
                    >
                      <Crosshair
                        size={14}
                      />
                      Reposition Plot
                    </button>
                  )
                )}
              </article>
            )}

          <div className="prototype-notice">
            <Database
              size={13}
            />
            Live map · Supabase records
          </div>

          {loading &&
            !error && (
              <div className="map-loading">
                <LoaderCircle
                  size={28}
                  className="spin"
                />
                Loading PlotMap…
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
        </section>
      </main>
    </div>
  );
}
