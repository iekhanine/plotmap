import type {
  ReactNode,
} from "react";

import {
  Archive,
  ArrowLeft,
  ClipboardList,
  Gauge,
  Globe2,
  History,
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

import "../css/Admin.css";


type Props = {
  title: string;
  eyebrow: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

const items = [
  {
    to: "/admin",
    label: "Overview",
    icon: Gauge,
    end: true,
  },
  {
    to: "/admin/users",
    label: "Accounts",
    icon: Users,
  },
  {
    to: "/admin/settings",
    label: "Cemetery Settings",
    icon: Settings,
  },
  {
    to: "/admin/public",
    label: "Public Access",
    icon: Globe2,
  },
  {
    to: "/admin/requests",
    label: "Family Requests",
    icon: ClipboardList,
  },
  {
    to: "/admin/audit",
    label: "Audit Log",
    icon: History,
  },
  {
    to: "/admin/export",
    label: "Backup & Export",
    icon: Archive,
  },
];


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

  return (
    <div className="admin-shell-v15">
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
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
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
              );
            }
          )}
        </nav>

        <div className="admin-sidebar-footer">
          <button
            type="button"
            onClick={() =>
              navigate("/staff")
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
                .replace(
                  "_",
                  " "
                )
                .toUpperCase()}
            </span>
          </div>
        </div>
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
  );
}
