import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import Feature from "ol/Feature.js";
import OLMap from "ol/Map.js";
import View from "ol/View.js";
import Point from "ol/geom/Point.js";
import Polygon from "ol/geom/Polygon.js";
import ImageLayer from "ol/layer/Image.js";
import TileLayer from "ol/layer/Tile.js";
import VectorLayer from "ol/layer/Vector.js";
import ImageArcGISRest from "ol/source/ImageArcGISRest.js";
import VectorSource from "ol/source/Vector.js";
import XYZ from "ol/source/XYZ.js";
import {
  fromLonLat,
} from "ol/proj.js";
import {
  Fill,
  Stroke,
  Style,
  Text,
  Circle as CircleStyle,
} from "ol/style.js";

import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  LocateFixed,
  MapPin,
  Search,
  Send,
  UserRound,
} from "lucide-react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  plotMapConfig,
} from "../config/plotmap";

import {
  loadPublicAvailablePlots,
  loadPublicMapMarkers,
  loadPublicMemorial,
  loadPublicPortalConfig,
  publicPhotoUrl,
  searchPublicMemorials,
  submitPublicCorrection,
} from "../services/publicPortal";

import type {
  PublicAvailablePlot,
  PublicMapArea,
  PublicMapMarker,
  PublicMapOccupant,
  PublicMemorial,
  PublicPortalConfig,
  PublicSearchResult,
} from "../types/publicPortal";

import "../css/PublicSearch.css";


function displayName(
  record: Pick<
    PublicSearchResult,
    "firstName" | "middleName" | "lastName" | "suffix"
  >
) {
  return [
    record.firstName,
    record.middleName,
    record.lastName,
    record.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}


function occupantName(
  record: PublicMapOccupant
) {
  return [
    record.firstName,
    record.middleName,
    record.lastName,
    record.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}


function year(
  value: string | null
) {
  return value
    ? value.slice(0, 4)
    : "—";
}


function areaPolygon(
  area: PublicMapArea
) {
  if (
    area.geometry.type ===
    "bbox"
  ) {
    return new Polygon([
      [
        fromLonLat([
          area.geometry.west,
          area.geometry.north,
        ]),
        fromLonLat([
          area.geometry.east,
          area.geometry.north,
        ]),
        fromLonLat([
          area.geometry.east,
          area.geometry.south,
        ]),
        fromLonLat([
          area.geometry.west,
          area.geometry.south,
        ]),
        fromLonLat([
          area.geometry.west,
          area.geometry.north,
        ]),
      ],
    ]);
  }

  const polygon =
    new Polygon(
      area.geometry.coordinates
    );

  polygon.transform(
    "EPSG:4326",
    "EPSG:3857"
  );

  return polygon;
}


function graveStyle(
  selected: boolean,
  label: string
) {
  /*
   * Public memorial markers:
   * small polished dot with a soft halo instead of the old
   * tombstone icon. Much cleaner at cemetery scale.
   */
  const halo =
    new Style({
      image:
        new CircleStyle({
          radius:
            selected
              ? 11
              : 8,
          fill:
            new Fill({
              color:
                selected
                  ? "rgba(21, 141, 189, .22)"
                  : "rgba(52, 182, 247, .16)",
            }),
        }),
    });

  const dot =
    new Style({
      image:
        new CircleStyle({
          radius:
            selected
              ? 5.5
              : 4.25,
          fill:
            new Fill({
              color:
                selected
                  ? "#158dbd"
                  : "#33b5f6",
            }),
          stroke:
            new Stroke({
              color: "#ffffff",
              width:
                selected
                  ? 2.2
                  : 1.7,
            }),
        }),
    });

  const labelStyle =
    selected
      ? new Style({
          text:
            new Text({
              text: label,
              offsetY: -18,
              font: "700 11px sans-serif",
              fill:
                new Fill({
                  color: "#17313d",
                }),
              stroke:
                new Stroke({
                  color: "#ffffff",
                  width: 4,
                }),
            }),
        })
      : null;

  return labelStyle
    ? [
        halo,
        dot,
        labelStyle,
      ]
    : [
        halo,
        dot,
      ];
}



type PublicMapProps = {
  config: PublicPortalConfig;
  markers: PublicMapMarker[];
  availablePlots: PublicAvailablePlot[];
  mode: "people" | "available";
  selectedPlotId: string | null;
  onSelectMarker: (
    marker: PublicMapMarker
  ) => void;
};


function PublicCemeteryMap({
  config,
  markers,
  availablePlots,
  mode,
  selectedPlotId,
  onSelectMarker,
}: PublicMapProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const mapRef =
    useRef<OLMap | null>(
      null
    );

  const vectorSourceRef =
    useRef<VectorSource | null>(
      null
    );

  const onSelectMarkerRef =
    useRef(onSelectMarker);

  useEffect(() => {
    onSelectMarkerRef.current =
      onSelectMarker;
  }, [onSelectMarker]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const fallback =
      new TileLayer({
        source:
          new XYZ({
            url:
              plotMapConfig.fallbackTileUrl,
            crossOrigin:
              "anonymous",
            attributions:
              "Tiles © Esri",
          }),
      });

    const aerialSource =
      new ImageArcGISRest({
        url:
          plotMapConfig.racineAerialServiceUrl,
        ratio: 1,
        params: {
          FORMAT: "JPG",
          TRANSPARENT: false,
        },
        crossOrigin:
          "anonymous",
      });

    const aerial =
      new ImageLayer({
        source:
          aerialSource,
      });

    aerialSource.on(
      "imageloaderror",
      () =>
        aerial.setVisible(
          false
        )
    );

    const vectorSource =
      new VectorSource();

    vectorSourceRef.current =
      vectorSource;

    for (
      const area
      of config.mapAreas || []
    ) {
      const feature =
        new Feature({
          geometry:
            areaPolygon(area),
        });

      feature.set("kind", "area");

      feature.setStyle(
        new Style({
          stroke:
            new Stroke({
              color:
                "rgba(32, 145, 194, 0.72)",
              width: 1.5,
            }),
          fill:
            new Fill({
              color:
                "rgba(32, 145, 194, 0.05)",
            }),
          text:
            new Text({
              text:
                area.label,
              font:
                "600 11px sans-serif",
              fill:
                new Fill({
                  color:
                    "#163b4e",
                }),
              stroke:
                new Stroke({
                  color:
                    "rgba(255,255,255,.92)",
                  width: 3,
                }),
            }),
        })
      );

      vectorSource.addFeature(
        feature
      );
    }

    if (mode === "people") {
      for (const marker of markers) {
        const feature =
          new Feature({
            geometry:
              new Point(
                fromLonLat([
                  Number(marker.longitude),
                  Number(marker.latitude),
                ])
              ),
          });

        feature.set(
          "kind",
          "grave"
        );
        feature.set(
          "marker",
          marker
        );
        feature.setId(
          `grave:${marker.plotId}`
        );

        const primary =
          marker.occupants[0];

        feature.setStyle(
          graveStyle(
            marker.plotId ===
              selectedPlotId,
            primary
              ? occupantName(primary)
              : marker.plotName ||
                `Plot ${marker.plotNumber || ""}`
          )
        );

        vectorSource.addFeature(
          feature
        );
      }
    } else {
      for (
        const plot
        of availablePlots
      ) {
        if (
          plot.latitude == null ||
          plot.longitude == null
        ) {
          continue;
        }

        const feature =
          new Feature({
            geometry:
              new Point(
                fromLonLat([
                  Number(plot.longitude),
                  Number(plot.latitude),
                ])
              ),
          });

        feature.set(
          "kind",
          "available"
        );

        feature.setStyle(
          new Style({
            image:
              new CircleStyle({
                radius: 5.5,
                fill:
                  new Fill({
                    color:
                      "rgba(60, 166, 100, .90)",
                  }),
                stroke:
                  new Stroke({
                    color:
                      "#ffffff",
                    width: 1.9,
                  }),
              }),
          })
        );

        vectorSource.addFeature(
          feature
        );
      }
    }

    const centerLon =
      config.cemetery.longitude ??
      plotMapConfig.initialView.longitude;

    const centerLat =
      config.cemetery.latitude ??
      plotMapConfig.initialView.latitude;

    const view =
      new View({
        center:
          fromLonLat([
            Number(centerLon),
            Number(centerLat),
          ]),
        zoom: 17.3,
        minZoom: 13,
        maxZoom: 22,
      });

    const map =
      new OLMap({
        target:
          containerRef.current,
        layers: [
          fallback,
          aerial,
          new VectorLayer({
            source:
              vectorSource,
          }),
        ],
        view,
      });

    mapRef.current = map;

    if (
      vectorSource.getFeatures()
        .length > 0
    ) {
      window.setTimeout(
        () => {
          try {
            view.fit(
              vectorSource.getExtent(),
              {
                padding:
                  [52, 52, 52, 52],
                maxZoom: 17.8,
                duration: 0,
              }
            );
          } catch {
            // Keep configured center if an extent cannot be fitted.
          }
        },
        0
      );
    }

    const clickHandler =
      (event: unknown) => {
        const mapEvent =
          event as {
            pixel: number[];
          };

        map.forEachFeatureAtPixel(
          mapEvent.pixel,
          (feature) => {
            if (
              feature.get("kind") !==
              "grave"
            ) {
              return undefined;
            }

            const marker =
              feature.get(
                "marker"
              ) as PublicMapMarker;

            onSelectMarkerRef.current(
              marker
            );

            return feature;
          },
          {
            hitTolerance: 7,
          }
        );
      };

    map.on(
      "singleclick",
      clickHandler
    );

    return () => {
      map.un(
        "singleclick",
        clickHandler
      );
      map.setTarget(undefined);
      mapRef.current = null;
      vectorSourceRef.current = null;
    };
  }, [
    config,
    markers,
    availablePlots,
    mode,
  ]);

  useEffect(() => {
    const map =
      mapRef.current;
    const source =
      vectorSourceRef.current;

    if (!map || !source) {
      return;
    }

    for (
      const marker
      of markers
    ) {
      const feature =
        source.getFeatureById(
          `grave:${marker.plotId}`
        );

      if (!feature) {
        continue;
      }

      const primary =
        marker.occupants[0];

      feature.setStyle(
        graveStyle(
          marker.plotId ===
            selectedPlotId,
          primary
            ? occupantName(primary)
            : marker.plotName ||
              `Plot ${marker.plotNumber || ""}`
        )
      );
    }

    if (!selectedPlotId) {
      return;
    }

    const selected =
      markers.find(
        (marker) =>
          marker.plotId ===
          selectedPlotId
      );

    if (selected) {
      map.getView().animate({
        center:
          fromLonLat([
            Number(selected.longitude),
            Number(selected.latitude),
          ]),
        zoom:
          Math.min(
            Math.max(
              map.getView().getZoom() || 17.8,
              18.1
            ),
            18.6
          ),
        duration: 180,
      });
    }
  }, [
    markers,
    selectedPlotId,
  ]);

  return (
    <div
      className="public-map"
      ref={containerRef}
    />
  );
}


export default function PublicSearchPage() {
  const navigate =
    useNavigate();

  const [params, setParams] =
    useSearchParams();

  const [config, setConfig] =
    useState<PublicPortalConfig | null>(
      null
    );

  const [query, setQuery] =
    useState(
      params.get("q") || ""
    );

  const [results, setResults] =
    useState<PublicSearchResult[]>(
      []
    );

  const [markers, setMarkers] =
    useState<PublicMapMarker[]>(
      []
    );

  const [selectedMarker, setSelectedMarker] =
    useState<PublicMapMarker | null>(
      null
    );

  const [memorial, setMemorial] =
    useState<PublicMemorial | null>(
      null
    );

  const [availablePlots, setAvailablePlots] =
    useState<PublicAvailablePlot[]>(
      []
    );

  const [mode, setMode] =
    useState<"people" | "available">(
      "people"
    );

  const [loading, setLoading] =
    useState(true);

  const [searching, setSearching] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const [copied, setCopied] =
    useState(false);

  const [showCorrection, setShowCorrection] =
    useState(false);

  const [correctionBusy, setCorrectionBusy] =
    useState(false);

  const [correctionMessage, setCorrectionMessage] =
    useState<string | null>(null);

  const [correctionForm, setCorrectionForm] =
    useState({
      name: "",
      email: "",
      relationship: "",
      message: "",
    });

  const kioskRequested =
    params.get("kiosk") === "1";

  const kioskMode =
    Boolean(
      kioskRequested &&
      config?.kioskEnabled
    );

  const personParam =
    params.get("person");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const nextConfig =
          await loadPublicPortalConfig();

        if (!active) {
          return;
        }

        setConfig(nextConfig);

        if (
          nextConfig.publicEnabled
        ) {
          const nextMarkers =
            await loadPublicMapMarkers();

          if (active) {
            setMarkers(nextMarkers);
          }
        }

        if (
          personParam &&
          nextConfig.publicEnabled
        ) {
          const nextMemorial =
            await loadPublicMemorial(
              personParam
            );

          if (
            active &&
            nextMemorial
          ) {
            setMemorial(
              nextMemorial
            );
          }
        }

        const initialQuery =
          params.get("q") || "";

        if (
          initialQuery.trim().length >= 2 &&
          nextConfig.publicEnabled
        ) {
          const nextResults =
            await searchPublicMemorials(
              initialQuery
            );

          if (active) {
            setResults(
              nextResults
            );
          }
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Public memorial access could not be loaded."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!memorial) {
      return;
    }

    setSelectedMarker(
      markers.find(
        (marker) =>
          marker.plotId ===
          memorial.plotId
      ) || null
    );
  }, [
    markers,
    memorial,
  ]);

  async function runSearch(
    event?: FormEvent
  ) {
    event?.preventDefault();

    const needle =
      query.trim();

    if (needle.length < 2) {
      setError(
        "Enter at least two letters, a year, or a plot number."
      );
      return;
    }

    try {
      setSearching(true);
      setError(null);
      setMemorial(null);
      setSelectedMarker(null);
      setShowCorrection(false);
      setMode("people");

      const next =
        await searchPublicMemorials(
          needle
        );

      setResults(next);
      setParams(
        (current) => {
          const nextParams =
            new URLSearchParams(
              current
            );
          nextParams.set(
            "q",
            needle
          );
          nextParams.delete(
            "person"
          );
          return nextParams;
        }
      );
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Search failed."
      );
    } finally {
      setSearching(false);
    }
  }

  async function openPerson(
    personId: string,
    plotId?: string
  ) {
    try {
      setSearching(true);
      setError(null);
      setShowCorrection(false);

      const next =
        await loadPublicMemorial(
          personId
        );

      if (!next) {
        setError(
          "This memorial is not available for public viewing."
        );
        setMemorial(null);
        return;
      }

      setMemorial(next);

      if (plotId) {
        setSelectedMarker(
          markers.find(
            (marker) =>
              marker.plotId === plotId
          ) || null
        );
      }

      setParams(
        (current) => {
          const nextParams =
            new URLSearchParams(
              current
            );
          nextParams.set(
            "person",
            personId
          );
          return nextParams;
        }
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not open memorial record."
      );
    } finally {
      setSearching(false);
    }
  }

  function selectMapMarker(
    marker: PublicMapMarker
  ) {
    setMode("people");
    setSelectedMarker(marker);
    setMemorial(null);
    setShowCorrection(false);

    if (
      marker.occupants.length === 1
    ) {
      void openPerson(
        marker.occupants[0].personId,
        marker.plotId
      );
    }
  }

  async function showAvailable() {
    try {
      setMode("available");
      setSearching(true);
      setError(null);
      setMemorial(null);
      setSelectedMarker(null);

      const rows =
        await loadPublicAvailablePlots();

      setAvailablePlots(rows);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load available plots."
      );
    } finally {
      setSearching(false);
    }
  }

  async function copyLink() {
    if (!memorial) {
      return;
    }

    const url =
      `${window.location.origin}/find?person=${encodeURIComponent(
        memorial.personId
      )}`;

    await navigator.clipboard.writeText(
      url
    );

    setCopied(true);
    window.setTimeout(
      () => setCopied(false),
      1800
    );
  }

  function directions() {
    if (
      memorial?.latitude == null ||
      memorial.longitude == null
    ) {
      return;
    }

    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${memorial.latitude},${memorial.longitude}`
      )}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function submitCorrection(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!memorial) {
      return;
    }

    try {
      setCorrectionBusy(true);
      setCorrectionMessage(null);
      setError(null);

      await submitPublicCorrection({
        personId:
          memorial.personId,
        requesterName:
          correctionForm.name,
        requesterEmail:
          correctionForm.email,
        relationship:
          correctionForm.relationship,
        message:
          correctionForm.message,
      });

      setCorrectionMessage(
        "Thank you. Your request was sent to staff for review."
      );

      setCorrectionForm({
        name: "",
        email: "",
        relationship: "",
        message: "",
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not submit your request."
      );
    } finally {
      setCorrectionBusy(false);
    }
  }

  const address =
    useMemo(() => {
      if (!config) {
        return "";
      }

      return [
        config.cemetery.addressLine1,
        config.cemetery.city,
        config.cemetery.state,
        config.cemetery.postalCode,
      ]
        .filter(Boolean)
        .join(", ");
    }, [config]);

  const selectedPlotId =
    memorial?.plotId ||
    selectedMarker?.plotId ||
    null;

  if (loading) {
    return (
      <div className="public-loading">
        <MapPin size={20} />
        Loading memorial map…
      </div>
    );
  }

  if (!config) {
    return (
      <div className="public-loading error">
        {error || "Public memorial access is not configured."}
      </div>
    );
  }

  if (!config.publicEnabled) {
    return (
      <div className="public-loading">
        <MapPin size={20} />
        <strong>{config.cemetery.name}</strong>
        <span>Public memorial access is currently unavailable.</span>
        <button type="button" onClick={() => navigate("/")}>Return to Home</button>
      </div>
    );
  }

  return (
    <div className={kioskMode ? "public-shell kiosk" : "public-shell"}>
      <header className="public-header">
        <div className="public-brand">
          <div className="public-brand-mark">
            <MapPin size={19} />
          </div>
          <div>
            <strong>{config.publicTitle}</strong>
            <span>{address || config.instanceName}</span>
          </div>
        </div>

        {!kioskMode && (
          <div className="public-header-actions">
            <button type="button" onClick={() => navigate("/")}>Home</button>
            <button type="button" onClick={() => navigate("/#staff-access")}>Staff Sign In</button>
          </div>
        )}

        {kioskMode && (
          <button
            type="button"
            className="public-kiosk-reset"
            onClick={() => {
              setQuery("");
              setResults([]);
              setMemorial(null);
              setSelectedMarker(null);
              setMode("people");
              setParams({ kiosk: "1" });
            }}
          >
            Start Over
          </button>
        )}
      </header>

      <main className="public-main public-map-main">
        <section className="public-map-intro">
          <div>
            <span className="public-eyebrow">PUBLIC MEMORIAL MAP</span>
            <h1>Find a Loved One</h1>
            <p>{config.publicSubtitle}</p>
          </div>

          <div className="public-map-intro-note">
            <MapPin size={14} />
            <span>
              Search by name or browse the map. Click a tombstone to view the public memorial record for that grave.
            </span>
          </div>
        </section>

        {error && (
          <div className="public-message error">{error}</div>
        )}

        <section className="public-browser">
          <aside className="public-browser-panel">
            <form className="public-search-form public-search-form-panel" onSubmit={runSearch}>
              <Search size={17} />
              <input
                autoFocus={kioskMode}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Last name, full name, year, or plot #"
              />
              <button type="submit" disabled={searching}>
                {searching ? "…" : "Search"}
              </button>
            </form>

            {config.showAvailablePlots && (
              <div className="public-mode-tabs public-mode-tabs-panel">
                <button
                  type="button"
                  className={mode === "people" ? "active" : ""}
                  onClick={() => {
                    setMode("people");
                    setMemorial(null);
                    setSelectedMarker(null);
                  }}
                >
                  Memorials
                </button>
                <button
                  type="button"
                  className={mode === "available" ? "active" : ""}
                  onClick={() => void showAvailable()}
                >
                  Available Plots
                </button>
              </div>
            )}

            {mode === "people" && memorial && (
              <div className="public-memorial-panel">
                <button
                  type="button"
                  className="public-back"
                  onClick={() => {
                    setMemorial(null);
                    setSelectedMarker(null);
                    setShowCorrection(false);
                    setParams((current) => {
                      const next = new URLSearchParams(current);
                      next.delete("person");
                      return next;
                    });
                  }}
                >
                  <ArrowLeft size={13} /> Back
                </button>

                <span className="public-eyebrow">MEMORIAL RECORD</span>
                <h2>{displayName(memorial)}</h2>
                <div className="public-life-dates">
                  {year(memorial.birthDate)} — {year(memorial.deathDate)}
                </div>

                {memorial.verificationStatus === "verified" && (
                  <div className="public-verified"><Check size={12} /> Record verified by staff</div>
                )}

                <dl className="public-record-grid">
                  {memorial.birthDate && <div><dt>Born</dt><dd>{memorial.birthDate}</dd></div>}
                  {memorial.deathDate && <div><dt>Died</dt><dd>{memorial.deathDate}</dd></div>}
                  {memorial.burialDate && <div><dt>Interred</dt><dd>{memorial.burialDate}</dd></div>}
                  <div><dt>Interment</dt><dd>{memorial.intermentType}</dd></div>
                  {memorial.plotNumber && <div><dt>Plot</dt><dd>{memorial.plotName || memorial.plotNumber}</dd></div>}
                  {memorial.areaName && <div><dt>Area</dt><dd>{memorial.areaName}</dd></div>}
                </dl>

                {memorial.biography && (
                  <div className="public-text-section">
                    <h3>Biography</h3>
                    <p>{memorial.biography}</p>
                  </div>
                )}

                {memorial.obituary && (
                  <div className="public-text-section">
                    <h3>Obituary</h3>
                    <p>{memorial.obituary}</p>
                  </div>
                )}

                {memorial.photos.length > 0 && (
                  <div className="public-photo-grid">
                    {memorial.photos.map((photo) => (
                      <img
                        key={photo.id}
                        src={publicPhotoUrl(photo.bucket, photo.path)}
                        alt={photo.title || displayName(memorial)}
                      />
                    ))}
                  </div>
                )}

                <div className="public-memorial-actions">
                  {memorial.latitude != null && memorial.longitude != null && (
                    <button type="button" onClick={directions}>
                      <LocateFixed size={13} /> Directions
                    </button>
                  )}

                  <button type="button" onClick={() => void copyLink()}>
                    <Copy size={13} /> {copied ? "Copied" : "Share"}
                  </button>
                </div>

                {memorial.allowCorrections && (
                  <div className="public-correction-wrap">
                    <button
                      type="button"
                      className="public-correction-toggle"
                      onClick={() => setShowCorrection((current) => !current)}
                    >
                      <Send size={13} /> Suggest a Correction
                    </button>

                    {showCorrection && (
                      <form className="public-correction-form" onSubmit={submitCorrection}>
                        <label>
                          Your name
                          <input
                            value={correctionForm.name}
                            onChange={(event) => setCorrectionForm((current) => ({ ...current, name: event.target.value }))}
                          />
                        </label>

                        <label>
                          Email
                          <input
                            type="email"
                            value={correctionForm.email}
                            onChange={(event) => setCorrectionForm((current) => ({ ...current, email: event.target.value }))}
                          />
                        </label>

                        <label>
                          Relationship
                          <input
                            value={correctionForm.relationship}
                            placeholder="Optional"
                            onChange={(event) => setCorrectionForm((current) => ({ ...current, relationship: event.target.value }))}
                          />
                        </label>

                        <label>
                          Correction or additional information
                          <textarea
                            rows={4}
                            value={correctionForm.message}
                            onChange={(event) => setCorrectionForm((current) => ({ ...current, message: event.target.value }))}
                          />
                        </label>

                        <button type="submit" disabled={correctionBusy}>
                          <Send size={13} /> {correctionBusy ? "Sending…" : "Send to Staff"}
                        </button>

                        {correctionMessage && (
                          <div className="public-message success">{correctionMessage}</div>
                        )}
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}

            {mode === "people" && !memorial && selectedMarker && (
              <div className="public-grave-panel">
                <span className="public-eyebrow">SELECTED GRAVE</span>
                <h2>{selectedMarker.plotName || `Plot ${selectedMarker.plotNumber || ""}`}</h2>
                <p>{selectedMarker.areaName || "Memorial plot"}</p>

                <div className="public-grave-occupants">
                  {selectedMarker.occupants.map((occupant) => (
                    <button
                      type="button"
                      key={occupant.personId}
                      onClick={() => void openPerson(occupant.personId, selectedMarker.plotId)}
                    >
                      <UserRound size={16} />
                      <span>
                        <strong>{occupantName(occupant)}</strong>
                        <small>{year(occupant.birthDate)} — {year(occupant.deathDate)}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "people" && !memorial && !selectedMarker && results.length > 0 && (
              <div className="public-panel-results">
                <div className="public-results-heading">
                  <strong>{results.length} record{results.length === 1 ? "" : "s"}</strong>
                  <span>Select a person.</span>
                </div>

                <div className="public-result-grid">
                  {results.map((result) => (
                    <button
                      type="button"
                      className="public-result-card"
                      key={`${result.personId}-${result.plotId}`}
                      onClick={() => void openPerson(result.personId, result.plotId)}
                    >
                      <div className="public-result-icon"><UserRound size={16} /></div>
                      <div>
                        <strong>{displayName(result)}</strong>
                        <span>{year(result.birthDate)} — {year(result.deathDate)}</span>
                        {result.plotNumber && (
                          <small>
                            {result.areaName ? `${result.areaName} · ` : ""}
                            {result.plotName || `Plot ${result.plotNumber}`}
                          </small>
                        )}
                      </div>
                      <MapPin size={14} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "people" && !memorial && !selectedMarker && results.length === 0 && (
              <div className="public-browse-prompt">
                <MapPin size={23} />
                <strong>Browse the grounds</strong>
                <span>
                  {markers.length > 0
                    ? `${markers.length} mapped grave${markers.length === 1 ? "" : "s"} are available to browse. Click any tombstone on the map.`
                    : "Use search to find a public memorial record."}
                </span>
              </div>
            )}

            {mode === "available" && (
              <div className="public-panel-results">
                <div className="public-results-heading">
                  <strong>{availablePlots.length} available plot{availablePlots.length === 1 ? "" : "s"}</strong>
                  <span>Confirm availability with staff.</span>
                </div>

                <div className="public-result-grid">
                  {availablePlots.map((plot) => (
                    <div className="public-result-card static" key={plot.plotId}>
                      <div className="public-result-icon"><MapPin size={16} /></div>
                      <div>
                        <strong>{plot.plotName || `Plot ${plot.plotNumber}`}</strong>
                        <span>{plot.areaName || "Unassigned area"}</span>
                        <small>{plot.plotType}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <div className="public-map-stage">
            <PublicCemeteryMap
              config={config}
              markers={markers}
              availablePlots={availablePlots}
              mode={mode}
              selectedPlotId={selectedPlotId}
              onSelectMarker={selectMapMarker}
            />

            <div className="public-map-legend">
              {mode === "people" ? (
                <>
                  <span className="public-memorial-dot" />
                  <span>Public memorial</span>
                </>
              ) : (
                <>
                  <span className="public-available-dot" />
                  <span>Available plot</span>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <div>
          <strong>{config.cemetery.name}</strong>
          <span>{address || config.cemetery.description || "Memorial records and mapping"}</span>
        </div>

        <div className="public-footer-links">
          {config.contactEmail && <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>}
          {config.contactPhone && <a href={`tel:${config.contactPhone}`}>{config.contactPhone}</a>}
          {!kioskMode && (
            <button type="button" onClick={() => navigate("/#staff-access")}>Staff Sign In <ExternalLink size={11} /></button>
          )}
        </div>
      </footer>
    </div>
  );
}
