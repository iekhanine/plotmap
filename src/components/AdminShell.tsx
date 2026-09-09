import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  Archive,
  ArrowLeft,
  ClipboardCheck,
  ClipboardList,
  Gauge,
  Globe2,
  GripVertical,
  History,
  LocateFixed,
  Settings,
  Users,
} from "lucide-react";

import {
  NavLink,
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext";

import {
  DEFAULT_ADMIN_NAV_ORDER,
  loadAdminNavOrder,
  saveAdminNavOrder,
  type AdminNavKey,
} from "../services/adminLayout";

import "../css/Admin.css";


type Props = {
  title: string;
  eyebrow: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};


const NAV_ITEMS: Record<
  AdminNavKey,
  {
    to: string;
    label: string;
    icon: typeof Gauge;
    end?: boolean;
  }
> = {
  overview: {
    to: "/admin",
    label: "Overview",
    icon: Gauge,
    end: true,
  },
  accounts: {
    to: "/admin/users",
    label: "Accounts",
    icon: Users,
  },
  settings: {
    to: "/admin/settings",
    label: "Site Settings",
    icon: Settings,
  },
  public: {
    to: "/admin/public",
    label: "Public Access",
    icon: Globe2,
  },
  verifications: {
    to: "/admin/verifications",
    label: "Field Verifications",
    icon: ClipboardCheck,
  },
  requests: {
    to: "/admin/requests",
    label: "Family Requests",
    icon: ClipboardList,
  },
  audit: {
    to: "/admin/audit",
    label: "Audit Log",
    icon: History,
  },
  export: {
    to: "/admin/export",
    label: "Backup & Export",
    icon: Archive,
  },
};


const ADMIN_SIDEBAR_WIDTH_KEY =
  "plotmap_admin_sidebar_width";


function initialSidebarWidth() {
  const saved =
    Number(
      window.localStorage.getItem(
        ADMIN_SIDEBAR_WIDTH_KEY
      )
    );

  if (
    Number.isFinite(saved) &&
    saved >= 190 &&
    saved <= 460
  ) {
    return saved;
  }

  return 230;
}


export default function AdminShell({
  title,
  eyebrow,
  description,
  actions,
  children,
}: Props) {
  const navigate =
    useNavigate();

  const {
    profile,
  } = useAuth();

  const [
    navOrder,
    setNavOrder,
  ] =
    useState<AdminNavKey[]>(
      DEFAULT_ADMIN_NAV_ORDER
    );

  const [
    dragKey,
    setDragKey,
  ] =
    useState<AdminNavKey | null>(
      null
    );

  const [
    layoutMessage,
    setLayoutMessage,
  ] =
    useState<string | null>(
      null
    );

  const [
    sidebarWidth,
    setSidebarWidth,
  ] =
    useState(
      initialSidebarWidth
    );

  const resizingRef =
    useRef(false);

  const canReorder =
    profile?.role ===
      "owner";


  useEffect(() => {
    void loadAdminNavOrder()
      .then(
        setNavOrder
      )
      .catch(() => {
        setNavOrder(
          DEFAULT_ADMIN_NAV_ORDER
        );
      });
  }, []);


  useEffect(() => {
    function move(
      event: PointerEvent
    ) {
      if (
        !resizingRef.current
      ) {
        return;
      }

      const next =
        Math.min(
          460,
          Math.max(
            190,
            event.clientX
          )
        );

      setSidebarWidth(
        next
      );
    }

    function stop() {
      if (
        !resizingRef.current
      ) {
        return;
      }

      resizingRef.current =
        false;

      document.body.style
        .cursor = "";

      document.body.style
        .userSelect = "";
    }

    window.addEventListener(
      "pointermove",
      move
    );

    window.addEventListener(
      "pointerup",
      stop
    );

    return () => {
      window.removeEventListener(
        "pointermove",
        move
      );

      window.removeEventListener(
        "pointerup",
        stop
      );
    };
  }, []);


  useEffect(() => {
    window.localStorage.setItem(
      ADMIN_SIDEBAR_WIDTH_KEY,
      String(
        sidebarWidth
      )
    );
  }, [
    sidebarWidth,
  ]);


  const items =
    useMemo(
      () =>
        navOrder.map(
          (key) => ({
            key,
            ...NAV_ITEMS[key],
          })
        ),
      [navOrder]
    );


  async function dropOn(
    targetKey: AdminNavKey
  ) {
    if (
      !canReorder ||
      !dragKey ||
      dragKey === targetKey
    ) {
      setDragKey(
        null
      );
      return;
    }

    const next =
      [...navOrder];

    const from =
      next.indexOf(
        dragKey
      );

    const to =
      next.indexOf(
        targetKey
      );

    if (
      from < 0 ||
      to < 0
    ) {
      setDragKey(
        null
      );
      return;
    }

    next.splice(
      from,
      1
    );

    next.splice(
      to,
      0,
      dragKey
    );

    setNavOrder(
      next
    );

    setDragKey(
      null
    );

    try {
      await saveAdminNavOrder(
        next
      );

      setLayoutMessage(
        "Menu order saved."
      );

      window.setTimeout(
        () =>
          setLayoutMessage(
            null
          ),
        1500
      );
    } catch (
      saveError
    ) {
      setLayoutMessage(
        saveError instanceof Error
          ? saveError.message
          : "Could not save menu order."
      );
    }
  }


  function startResize() {
    resizingRef.current =
      true;

    document.body.style
      .cursor =
        "col-resize";

    document.body.style
      .userSelect =
        "none";
  }


  return (
    <>
      <div className="admin-mobile-gate-v17">
        <div>
          <LocateFixed
            size={28}
          />
          <h1>
            Field Verification
          </h1>
          <p>
            Full Administration is intentionally desktop-only. On a phone or small tablet, use the focused Field Verification view instead.
          </p>
          <button
            type="button"
            onClick={() =>
              navigate(
                "/field"
              )
            }
          >
            Open Field Verification
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              navigate(
                "/staff"
              )
            }
          >
            Open Staff Map
          </button>
        </div>
      </div>

      <div className="admin-desktop-frame-v17">
        <div
          className="admin-shell-v15"
          style={{
            gridTemplateColumns:
              `${sidebarWidth}px minmax(0, 1fr)`,
          }}
        >
          <aside className="admin-sidebar-v15">
            <div className="admin-sidebar-brand">
              <div className="admin-sidebar-mark">
                P
              </div>

              <div>
                <strong>
                  PlotMap
                </strong>
                <span>
                  Administration
                </span>
              </div>
            </div>

            <nav className="admin-nav-v15">
              {items.map(
                (item) => {
                  const Icon =
                    item.icon;

                  return (
                    <div
                      key={
                        item.key
                      }
                      className={
                        canReorder
                          ? "admin-nav-row-v18 reorderable"
                          : "admin-nav-row-v18"
                      }
                      draggable={
                        canReorder
                      }
                      onDragStart={() =>
                        setDragKey(
                          item.key
                        )
                      }
                      onDragEnd={() =>
                        setDragKey(
                          null
                        )
                      }
                      onDragOver={(
                        event
                      ) => {
                        if (
                          canReorder
                        ) {
                          event.preventDefault();
                        }
                      }}
                      onDrop={() =>
                        void dropOn(
                          item.key
                        )
                      }
                    >
                      {canReorder && (
                        <GripVertical
                          className="admin-nav-grip-v18"
                          size={13}
                        />
                      )}

                      <NavLink
                        to={
                          item.to
                        }
                        end={
                          item.end
                        }
                        className={({
                          isActive,
                        }) =>
                          isActive
                            ? "active"
                            : ""
                        }
                      >
                        <Icon
                          size={15}
                        />
                        <span>
                          {item.label}
                        </span>
                      </NavLink>
                    </div>
                  );
                }
              )}
            </nav>

            {canReorder && (
              <div className="admin-nav-help-v18">
                Drag menu items to reorder them for this installation.
              </div>
            )}

            {layoutMessage && (
              <div className="admin-nav-layout-message-v18">
                {layoutMessage}
              </div>
            )}

            <div className="admin-sidebar-footer">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/staff"
                  )
                }
              >
                <ArrowLeft
                  size={14}
                />
                Back to Map
              </button>

              <div>
                <strong>
                  {profile?.displayName ||
                    profile?.email ||
                    "PlotMap User"}
                </strong>
                <span>
                  {profile?.role
                    .replaceAll(
                      "_",
                      " "
                    )
                    .toUpperCase()}
                </span>
              </div>
            </div>

            <div
              className="admin-sidebar-resizer-v18"
              role="separator"
              aria-orientation="vertical"
              title="Drag to resize sidebar"
              onPointerDown={
                startResize
              }
            />
          </aside>

          <main className="admin-content-v15">
            <header className="admin-page-header-v15">
              <div>
                <span className="admin-eyebrow-v15">
                  {eyebrow}
                </span>

                <h1>
                  {title}
                </h1>

                {description && (
                  <p>
                    {description}
                  </p>
                )}
              </div>

              {actions && (
                <div className="admin-page-actions-v15">
                  {actions}
                </div>
              )}
            </header>

            {children}
          </main>
        </div>
      </div>
    </>
  );
}
