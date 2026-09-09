import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Camera,
  CheckCircle2,
  Crosshair,
  LogOut,
  MapPin,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext";

import {
  plotMapConfig,
} from "../config/plotmap";

import {
  getPersonDisplayName,
  getYear,
  loadPlotMapDataset,
} from "../services/plotmap";

import {
  submitFieldVerification,
} from "../services/field";

import type {
  FieldOccupantMatch,
} from "../types/field";

import type {
  PlotMapDataset,
  PlotRecord,
} from "../types/plotmap";

import "../css/Field.css";


type GpsFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};


function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const radius =
    6371000;

  const toRadians =
    (value: number) =>
      value *
      Math.PI /
      180;

  const dLat =
    toRadians(
      lat2 - lat1
    );

  const dLon =
    toRadians(
      lon2 - lon1
    );

  const a =
    Math.sin(
      dLat / 2
    ) ** 2 +
    Math.cos(
      toRadians(lat1)
    ) *
    Math.cos(
      toRadians(lat2)
    ) *
    Math.sin(
      dLon / 2
    ) ** 2;

  return (
    radius *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}


function plotOccupants(
  plot: PlotRecord
) {
  return plot.burials.map(
    (entry) =>
      entry.person
  );
}


export default function FieldVerificationPage() {
  const navigate =
    useNavigate();

  const {
    profile,
    user,
    signOut,
  } = useAuth();

  const [
    dataset,
    setDataset,
  ] =
    useState<PlotMapDataset | null>(
      null
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    selectedPlotId,
    setSelectedPlotId,
  ] =
    useState<string | null>(
      null
    );

  const [
    selectedPersonId,
    setSelectedPersonId,
  ] =
    useState<string | null>(
      null
    );

  const [
    observedPlotNumber,
    setObservedPlotNumber,
  ] =
    useState("");

  const [
    observedName,
    setObservedName,
  ] =
    useState("");

  const [
    observedBirthYear,
    setObservedBirthYear,
  ] =
    useState("");

  const [
    observedDeathYear,
    setObservedDeathYear,
  ] =
    useState("");

  const [
    occupantMatch,
    setOccupantMatch,
  ] =
    useState<FieldOccupantMatch>(
      "match"
    );

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    photo,
    setPhoto,
  ] =
    useState<File | null>(
      null
    );

  const [
    photoPreview,
    setPhotoPreview,
  ] =
    useState<string | null>(
      null
    );

  const [
    gps,
    setGps,
  ] =
    useState<GpsFix | null>(
      null
    );

  const [
    gpsBusy,
    setGpsBusy,
  ] =
    useState(false);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    success,
    setSuccess,
  ] =
    useState<string | null>(
      null
    );


  useEffect(() => {
    void loadPlotMapDataset(
      plotMapConfig.cemeterySlug
    )
      .then(
        setDataset
      )
      .catch(
        (loadError) =>
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load PlotMap records."
          )
      );
  }, []);


  useEffect(() => {
    if (!photo) {
      setPhotoPreview(
        null
      );
      return;
    }

    const url =
      URL.createObjectURL(
        photo
      );

    setPhotoPreview(
      url
    );

    return () =>
      URL.revokeObjectURL(
        url
      );
  }, [photo]);


  const selectedPlot =
    useMemo(
      () =>
        dataset?.plots.find(
          (plot) =>
            plot.id ===
            selectedPlotId
        ) ||
        null,
      [
        dataset,
        selectedPlotId,
      ]
    );


  const occupants =
    useMemo(
      () =>
        selectedPlot
          ? plotOccupants(
              selectedPlot
            )
          : [],
      [selectedPlot]
    );


  const selectedPerson =
    useMemo(
      () =>
        occupants.find(
          (person) =>
            person.id ===
            selectedPersonId
        ) ||
        occupants[0] ||
        null,
      [
        occupants,
        selectedPersonId,
      ]
    );


  useEffect(() => {
    if (!selectedPlot) {
      return;
    }

    const person =
      selectedPerson;

    setObservedPlotNumber(
      selectedPlot.plot_number
    );

    setObservedName(
      person
        ? getPersonDisplayName(
            person
          )
        : ""
    );

    setObservedBirthYear(
      person
        ? getYear(
            person.birth_date
          ) || ""
        : ""
    );

    setObservedDeathYear(
      person
        ? getYear(
            person.death_date
          ) || ""
        : ""
    );

    setOccupantMatch(
      "match"
    );

    setNotes("");
    setPhoto(null);
    setGps(null);
    setError(null);
    setSuccess(null);
  }, [
    selectedPlot,
    selectedPerson,
  ]);


  const filteredPlots =
    useMemo(() => {
      if (!dataset) {
        return [];
      }

      const needle =
        search
          .trim()
          .toLowerCase();

      const rows =
        dataset.plots.filter(
          (plot) => {
            if (!needle) {
              return true;
            }

            const names =
              plot.burials.map(
                (entry) =>
                  getPersonDisplayName(
                    entry.person
                  )
              );

            const years =
              plot.burials.flatMap(
                (entry) => [
                  getYear(
                    entry.person
                      .birth_date
                  ),
                  getYear(
                    entry.person
                      .death_date
                  ),
                ]
              );

            const haystack =
              [
                plot.plot_number,
                `plot ${plot.plot_number}`,
                plot.display_name,
                plot.section?.name,
                ...names,
                ...years,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return haystack.includes(
              needle
            );
          }
        );

      return rows
        .sort(
          (a, b) =>
            a.plot_number.localeCompare(
              b.plot_number,
              undefined,
              {
                numeric: true,
              }
            )
        )
        .slice(0, 100);
    }, [
      dataset,
      search,
    ]);


  const distanceToMappedPlot =
    useMemo(() => {
      if (
        !gps ||
        !selectedPlot ||
        selectedPlot.latitude == null ||
        selectedPlot.longitude == null
      ) {
        return null;
      }

      return distanceMeters(
        gps.latitude,
        gps.longitude,
        Number(
          selectedPlot.latitude
        ),
        Number(
          selectedPlot.longitude
        )
      );
    }, [
      gps,
      selectedPlot,
    ]);


  function choosePlot(
    plot: PlotRecord
  ) {
    setSelectedPlotId(
      plot.id
    );

    setSelectedPersonId(
      plot.burials[0]
        ?.person.id ||
        null
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }


  function captureGps() {
    if (
      !navigator.geolocation
    ) {
      setError(
        "This browser does not support GPS location."
      );
      return;
    }

    setGpsBusy(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({
          latitude:
            position.coords.latitude,
          longitude:
            position.coords.longitude,
          accuracy:
            Number.isFinite(
              position.coords.accuracy
            )
              ? position.coords.accuracy
              : null,
        });
        setGpsBusy(false);
      },
      (geoError) => {
        setError(
          geoError.message ||
            "Could not read the phone location."
        );
        setGpsBusy(false);
      },
      {
        enableHighAccuracy:
          true,
        timeout:
          15000,
        maximumAge:
          0,
      }
    );
  }


  async function submit() {
    if (
      !dataset ||
      !selectedPlot ||
      !profile ||
      !user
    ) {
      return;
    }

    if (!photo) {
      setError(
        "Take or attach a grave-site photo before submitting."
      );
      return;
    }

    try {
      setBusy(true);
      setError(null);
      setSuccess(null);

      await submitFieldVerification({
        organizationId:
          profile.organizationId,
        cemeteryId:
          dataset.cemetery.id,
        plotId:
          selectedPlot.id,
        personId:
          selectedPerson?.id ||
          null,
        userId:
          user.id,

        recordedPlotNumber:
          selectedPlot.plot_number,
        recordedOccupantName:
          selectedPerson
            ? getPersonDisplayName(
                selectedPerson
              )
            : "",
        recordedBirthDate:
          selectedPerson
            ?.birth_date ||
          null,
        recordedDeathDate:
          selectedPerson
            ?.death_date ||
          null,

        observedPlotNumber,
        observedOccupantName:
          observedName,
        observedBirthYear,
        observedDeathYear,
        occupantMatch,

        latitude:
          gps?.latitude ||
          null,
        longitude:
          gps?.longitude ||
          null,
        accuracyMeters:
          gps?.accuracy ||
          null,

        notes,
        photo,
      });

      setSuccess(
        "Verification submitted for desktop review."
      );

      setPhoto(null);
      setNotes("");
      setGps(null);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not submit verification."
      );
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="field-shell-v17">
      <header className="field-header-v17">
        <div>
          <strong>
            PlotMap Field
          </strong>
          <span>
            Verification Mode
          </span>
        </div>

        <button
          type="button"
          onClick={() =>
            void signOut()
          }
          aria-label="Sign out"
        >
          <LogOut
            size={17}
          />
        </button>
      </header>

      <main className="field-main-v17">
        <section className="field-intro-v17">
          <ShieldCheck
            size={18}
          />
          <div>
            <strong>
              Field observations only
            </strong>
            <span>
              Nothing submitted here changes the official record until it is reviewed from desktop Administration.
            </span>
          </div>
        </section>

        {error && (
          <div className="field-message-v17 error">
            {error}
          </div>
        )}

        {success && (
          <div className="field-message-v17 success">
            <CheckCircle2
              size={15}
            />
            {success}
          </div>
        )}

        {!selectedPlot && (
          <>
            <div className="field-search-v17">
              <Search
                size={17}
              />
              <input
                value={search}
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Plot number or occupant name…"
                autoFocus
              />
            </div>

            <div className="field-result-count-v17">
              {dataset
                ? `${filteredPlots.length} shown`
                : "Loading records…"}
            </div>

            <div className="field-results-v17">
              {filteredPlots.map(
                (plot) => (
                  <button
                    key={plot.id}
                    type="button"
                    className="field-result-v17"
                    onClick={() =>
                      choosePlot(
                        plot
                      )
                    }
                  >
                    <div>
                      <strong>
                        Plot {plot.plot_number}
                      </strong>

                      <span>
                        {plot.display_name ||
                          plot.section?.name ||
                          "Mapped record"}
                      </span>
                    </div>

                    <div className="field-result-occupants-v17">
                      {plot.burials.length
                        ? plot.burials.map(
                            (entry) => (
                              <span
                                key={
                                  entry.person.id
                                }
                              >
                                {getPersonDisplayName(
                                  entry.person
                                )}
                              </span>
                            )
                          )
                        : (
                          <span>
                            No occupant recorded
                          </span>
                        )}
                    </div>
                  </button>
                )
              )}
            </div>
          </>
        )}

        {selectedPlot && (
          <div className="field-detail-v17">
            <button
              type="button"
              className="field-back-v17"
              onClick={() => {
                setSelectedPlotId(
                  null
                );
                setSelectedPersonId(
                  null
                );
              }}
            >
              ← Back to search
            </button>

            <section className="field-card-v17 field-record-v17">
              <span className="field-eyebrow-v17">
                PLOT
              </span>

              <h1>
                {selectedPlot.plot_number}
              </h1>

              {selectedPlot.display_name && (
                <p>
                  {selectedPlot.display_name}
                </p>
              )}

              <div className="field-location-v17">
                <MapPin
                  size={14}
                />
                {selectedPlot.latitude != null &&
                selectedPlot.longitude != null
                  ? "Mapped location available"
                  : "No mapped GPS point"}
              </div>
            </section>

            {occupants.length > 1 && (
              <section className="field-card-v17">
                <label>
                  Occupant to verify
                  <select
                    value={
                      selectedPerson?.id ||
                      ""
                    }
                    onChange={(
                      event
                    ) =>
                      setSelectedPersonId(
                        event.target.value
                      )
                    }
                  >
                    {occupants.map(
                      (person) => (
                        <option
                          key={person.id}
                          value={person.id}
                        >
                          {getPersonDisplayName(
                            person
                          )}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </section>
            )}

            <section className="field-card-v17">
              <span className="field-eyebrow-v17">
                RECORDED OCCUPANT
              </span>

              <strong className="field-person-name-v17">
                {selectedPerson
                  ? getPersonDisplayName(
                      selectedPerson
                    )
                  : "No occupant recorded"}
              </strong>

              {selectedPerson && (
                <span className="field-years-v17">
                  {getYear(
                    selectedPerson.birth_date
                  ) || "—"}
                  {" — "}
                  {getYear(
                    selectedPerson.death_date
                  ) || "—"}
                </span>
              )}
            </section>

            <section className="field-card-v17 field-form-v17">
              <span className="field-eyebrow-v17">
                WHAT YOU SEE
              </span>

              <label>
                Plot number on marker
                <input
                  value={
                    observedPlotNumber
                  }
                  onChange={(
                    event
                  ) =>
                    setObservedPlotNumber(
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Name on marker / stone
                <input
                  value={
                    observedName
                  }
                  onChange={(
                    event
                  ) =>
                    setObservedName(
                      event.target.value
                    )
                  }
                  placeholder="Name visible in the field"
                />
              </label>

              <div className="field-year-row-v17">
                <label>
                  Birth year
                  <input
                    inputMode="numeric"
                    value={
                      observedBirthYear
                    }
                    onChange={(
                      event
                    ) =>
                      setObservedBirthYear(
                        event.target.value.replace(
                          /\D/g,
                          ""
                        )
                      )
                    }
                    maxLength={4}
                  />
                </label>

                <label>
                  Death year
                  <input
                    inputMode="numeric"
                    value={
                      observedDeathYear
                    }
                    onChange={(
                      event
                    ) =>
                      setObservedDeathYear(
                        event.target.value.replace(
                          /\D/g,
                          ""
                        )
                      )
                    }
                    maxLength={4}
                  />
                </label>
              </div>

              <label>
                Does the field marker match the recorded occupant?
                <select
                  value={
                    occupantMatch
                  }
                  onChange={(
                    event
                  ) =>
                    setOccupantMatch(
                      event.target.value as FieldOccupantMatch
                    )
                  }
                >
                  <option value="match">
                    Yes — matches
                  </option>
                  <option value="mismatch">
                    No — mismatch
                  </option>
                  <option value="uncertain">
                    Unsure / unreadable
                  </option>
                </select>
              </label>

              <label>
                Field notes
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(
                    event
                  ) =>
                    setNotes(
                      event.target.value
                    )
                  }
                  placeholder="Damage, unreadable text, possible mismatch, nearby landmark…"
                />
              </label>
            </section>

            <section className="field-card-v17">
              <span className="field-eyebrow-v17">
                PHOTO
              </span>

              <label className="field-camera-v17">
                <Camera
                  size={20}
                />
                <strong>
                  Take grave-site photo
                </strong>
                <span>
                  Uses the rear camera when supported.
                </span>

                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(
                    event
                  ) =>
                    setPhoto(
                      event.target.files?.[0] ||
                      null
                    )
                  }
                />
              </label>

              {photoPreview && (
                <img
                  className="field-photo-preview-v17"
                  src={photoPreview}
                  alt="Field verification preview"
                />
              )}
            </section>

            <section className="field-card-v17">
              <span className="field-eyebrow-v17">
                GPS
              </span>

              <button
                type="button"
                className="field-gps-button-v17"
                disabled={gpsBusy}
                onClick={
                  captureGps
                }
              >
                <Crosshair
                  size={17}
                />
                {gpsBusy
                  ? "Getting location…"
                  : gps
                    ? "Refresh GPS"
                    : "Capture Current GPS"}
              </button>

              {gps && (
                <div className="field-gps-readout-v17">
                  <strong>
                    GPS captured
                  </strong>

                  <span>
                    Accuracy ±
                    {Math.round(
                      gps.accuracy ||
                      0
                    )}
                    m
                  </span>

                  {distanceToMappedPlot != null && (
                    <span>
                      About{" "}
                      {distanceToMappedPlot < 100
                        ? `${Math.round(
                            distanceToMappedPlot *
                              3.28084
                          )} ft`
                        : `${Math.round(
                            distanceToMappedPlot
                          )} m`}
                      {" "}from the mapped plot point
                    </span>
                  )}
                </div>
              )}
            </section>

            <button
              type="button"
              className="field-submit-v17"
              disabled={
                busy ||
                !photo
              }
              onClick={() =>
                void submit()
              }
            >
              <Send
                size={17}
              />
              {busy
                ? "Submitting…"
                : "Submit for Desktop Review"}
            </button>

            <button
              type="button"
              className="field-desktop-link-v17"
              onClick={() =>
                navigate(
                  "/staff"
                )
              }
            >
              Open Staff Map
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
