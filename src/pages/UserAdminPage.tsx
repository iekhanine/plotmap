import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ChevronDown,
  ChevronUp,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";

import AdminShell from "../components/AdminShell";

import {
  useAuth,
} from "../context/AuthContext";

import {
  createManagedUser,
  deleteManagedUser,
  listManagedUsers,
  updateManagedIdentity,
  updateManagedUser,
  type ManagedUser,
} from "../services/userAdmin";

import "../css/UserAdmin.css";


type RoleFilter =
  | "all"
  | "owner"
  | "manager"
  | "user";

type StatusFilter =
  | "all"
  | "active"
  | "inactive";


function roleLabel(
  role: ManagedUser["role"]
) {
  if (
    role === "recovery_owner"
  ) {
    return "Recovery Owner";
  }

  if (
    role === "platform_recovery"
  ) {
    return "Platform Recovery";
  }

  return role
    .replace(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}


function formatCreatedAt(
  value: string
) {
  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleDateString();
}


export default function UserAdminPage() {
  const {
    profile,
    isOwner,
  } = useAuth();

  const [
    users,
    setUsers,
  ] = useState<ManagedUser[]>(
    []
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    busyId,
    setBusyId,
  ] = useState<string | null>(
    null
  );

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const [
    success,
    setSuccess,
  ] = useState<string | null>(
    null
  );

  const [
    showCreate,
    setShowCreate,
  ] = useState(false);

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    displayName,
    setDisplayName,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    role,
    setRole,
  ] = useState<
    | "recovery_owner"
    | "manager"
    | "user"
  >(
    "user"
  );

  const [
    canEditPlotNames,
    setCanEditPlotNames,
  ] = useState(false);

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    roleFilter,
    setRoleFilter,
  ] = useState<RoleFilter>(
    "all"
  );

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<StatusFilter>(
    "all"
  );

  const [
    editingId,
    setEditingId,
  ] = useState<string | null>(
    null
  );

  const [
    editRole,
    setEditRole,
  ] = useState<
    "manager" | "user"
  >(
    "user"
  );

  const [
    editActive,
    setEditActive,
  ] = useState(true);

  const [
    editCanEditPlotNames,
    setEditCanEditPlotNames,
  ] = useState(false);


  const [
    identityDisplayName,
    setIdentityDisplayName,
  ] = useState("");

  const [
    identityEmail,
    setIdentityEmail,
  ] = useState("");

  const [
    identityPassword,
    setIdentityPassword,
  ] = useState("");


  async function reload() {
    try {
      setLoading(
        true
      );
      setError(
        null
      );

      const next =
        await listManagedUsers();

      setUsers(
        next
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load accounts."
      );
    } finally {
      setLoading(
        false
      );
    }
  }


  useEffect(() => {
    void reload();
  }, []);


  const recoveryOwner =
    useMemo(
      () =>
        users.find(
          (user) =>
            user.role ===
            "recovery_owner"
        ) || null,
      [users]
    );


  const platformRecovery =
    useMemo(
      () =>
        users.find(
          (user) =>
            user.role ===
            "platform_recovery"
        ) || null,
      [users]
    );


  const stats =
    useMemo(() => {
      return {
        total:
          users.length,
        owners:
          users.filter(
            (user) =>
              user.role === "owner" ||
              user.role === "recovery_owner" ||
              user.role === "platform_recovery"
          ).length,
        managers:
          users.filter(
            (user) =>
              user.role === "manager"
          ).length,
        users:
          users.filter(
            (user) =>
              user.role === "user"
          ).length,
        inactive:
          users.filter(
            (user) =>
              !user.active
          ).length,
      };
    }, [users]);


  const filteredUsers =
    useMemo(() => {
      const needle =
        searchTerm
          .trim()
          .toLowerCase();

      const roleWeight:
        Record<ManagedUser["role"], number> = {
          owner: 0,
          recovery_owner: 1,
          platform_recovery: 2,
          manager: 3,
          user: 4,
        };

      return users
        .filter(
          (user) => {
            if (
              roleFilter === "owner" &&
              user.role !== "owner" &&
              user.role !== "recovery_owner" &&
              user.role !== "platform_recovery"
            ) {
              return false;
            }

            if (
              roleFilter === "manager" &&
              user.role !== "manager"
            ) {
              return false;
            }

            if (
              roleFilter === "user" &&
              user.role !== "user"
            ) {
              return false;
            }

            if (
              statusFilter === "active" &&
              !user.active
            ) {
              return false;
            }

            if (
              statusFilter === "inactive" &&
              user.active
            ) {
              return false;
            }

            if (!needle) {
              return true;
            }

            return [
              user.displayName || "",
              user.email,
              roleLabel(
                user.role
              ),
            ]
              .join(" ")
              .toLowerCase()
              .includes(
                needle
              );
          }
        )
        .sort(
          (a, b) => {
            const roleDiff =
              roleWeight[a.role] -
              roleWeight[b.role];

            if (roleDiff !== 0) {
              return roleDiff;
            }

            return (
              a.displayName ||
              a.email
            ).localeCompare(
              b.displayName ||
              b.email
            );
          }
        );
    }, [
      users,
      searchTerm,
      roleFilter,
      statusFilter,
    ]);


  async function handleCreate(
    event: any
  ) {
    event.preventDefault();

    if (
      password.length < 10
    ) {
      setError(
        "Temporary password must be at least 10 characters."
      );
      return;
    }

    try {
      setBusyId(
        "create"
      );
      setError(
        null
      );
      setSuccess(
        null
      );

      const effectiveRole =
        isOwner
          ? role
          : "user";

      await createManagedUser({
        email:
          email.trim(),
        password,
        displayName:
          displayName.trim(),
        role:
          effectiveRole,
        canEditPlotNames:
          effectiveRole === "user" &&
          canEditPlotNames,
      });

      setEmail("");
      setDisplayName("");
      setPassword("");
      setRole(
        "user"
      );
      setCanEditPlotNames(
        false
      );
      setShowCreate(
        false
      );

      setSuccess(
        "Account created."
      );

      await reload();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create account."
      );
    } finally {
      setBusyId(
        null
      );
    }
  }


  function canEditAccount(
    user: ManagedUser
  ) {
    if (
      user.role === "owner" ||
      user.role === "recovery_owner" ||
      user.role === "platform_recovery"
    ) {
      return isOwner;
    }

    if (
      profile?.role === "manager"
    ) {
      return user.role === "user";
    }

    return isOwner;
  }


  function startEdit(
    user: ManagedUser
  ) {
    if (
      !canEditAccount(
        user
      )
    ) {
      return;
    }

    setEditingId(
      user.memberId
    );

    setEditRole(
      user.role === "manager"
        ? "manager"
        : "user"
    );

    setEditActive(
      user.active
    );

    setEditCanEditPlotNames(
      user.canEditPlotNames
    );

    setIdentityDisplayName(
      user.displayName ||
      ""
    );

    setIdentityEmail(
      user.email
    );

    setIdentityPassword(
      ""
    );

    setError(
      null
    );
    setSuccess(
      null
    );
  }


  async function saveProtectedIdentity(
    user: ManagedUser
  ) {
    if (
      identityPassword &&
      identityPassword.length <
        10
    ) {
      setError(
        "New password must be at least 10 characters."
      );
      return;
    }

    try {
      setBusyId(
        user.memberId
      );
      setError(
        null
      );
      setSuccess(
        null
      );

      await updateManagedIdentity({
        memberId:
          user.memberId,
        displayName:
          identityDisplayName.trim(),
        email:
          user.role ===
            "platform_recovery"
            ? undefined
            : identityEmail.trim(),
        password:
          user.role ===
            "platform_recovery" ||
          !identityPassword
            ? undefined
            : identityPassword,
      });

      setEditingId(
        null
      );

      setIdentityPassword(
        ""
      );

      setSuccess(
        user.role ===
          "platform_recovery"
          ? "Platform recovery display name updated."
          : "Owner identity updated. If you changed your own sign-in credentials, use the new credentials the next time you sign in."
      );

      await reload();
    } catch (
      saveError
    ) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not update protected account."
      );
    } finally {
      setBusyId(
        null
      );
    }
  }


  async function saveEditedUser(
    user: ManagedUser
  ) {
    try {
      setBusyId(
        user.memberId
      );
      setError(
        null
      );
      setSuccess(
        null
      );

      const effectiveRole =
        isOwner
          ? editRole
          : "user";

      await updateManagedUser({
        memberId:
          user.memberId,
        role:
          effectiveRole,
        active:
          editActive,
        canEditPlotNames:
          effectiveRole === "user" &&
          editCanEditPlotNames,
      });

      setEditingId(
        null
      );

      setSuccess(
        "Account updated."
      );

      await reload();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not update account."
      );
    } finally {
      setBusyId(
        null
      );
    }
  }


  async function removeUser(
    user: ManagedUser
  ) {
    if (
      !window.confirm(
        `Delete ${user.email}? This removes the PlotMap login account.`
      )
    ) {
      return;
    }

    try {
      setBusyId(
        user.memberId
      );
      setError(
        null
      );
      setSuccess(
        null
      );

      await deleteManagedUser(
        user.memberId
      );

      setEditingId(
        null
      );

      setSuccess(
        "Account deleted."
      );

      await reload();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete account."
      );
    } finally {
      setBusyId(
        null
      );
    }
  }


  return (
    <AdminShell
      eyebrow="ACCESS CONTROL"
      title="Accounts & Permissions"
      description="Manage client Owners, Recovery Owners, Managers and Users while keeping the OneTime Labs platform recovery account protected."
    >
      <div className="user-admin-main v15-embedded">
        <section className="user-admin-intro-row">
          <div className="user-admin-intro">
            <span className="admin-eyebrow">
              ACCESS CONTROL
            </span>

            <h1>
              Accounts & Permissions
            </h1>

            <p>
              Find an account, open it, and change only the access that needs to change. Owners can manage Managers and Users; Managers can manage Users.
            </p>
          </div>

          <button
            type="button"
            className="admin-create-toggle"
            onClick={() =>
              setShowCreate(
                (current) =>
                  !current
              )
            }
          >
            {showCreate ? (
              <ChevronUp
                size={13}
              />
            ) : (
              <UserPlus
                size={13}
              />
            )}

            {showCreate
              ? "Close New Account"
              : "Create Account"}
          </button>
        </section>

        {isOwner && (
          <section className="special-account-strip-v18">
            <div className="recovery-owner-card">
              <ShieldCheck
                size={18}
              />

              <div>
                <strong>
                  Client Recovery Owner
                </strong>

                <span>
                  {recoveryOwner
                    ? `${recoveryOwner.email} · email and password can be changed`
                    : "Not configured — create a Recovery Owner account below if the organization wants one."}
                </span>
              </div>
            </div>

            <div className="recovery-owner-card platform">
              <ShieldCheck
                size={18}
              />

              <div>
                <strong>
                  OneTime Labs Platform Recovery
                </strong>

                <span>
                  {platformRecovery
                    ? `${platformRecovery.email} · protected break-glass account`
                    : "Platform recovery account not detected."}
                </span>
              </div>
            </div>
          </section>
        )}

        <section className="admin-stat-grid">
          <div className="admin-stat-card">
            <Users
              size={14}
            />
            <span>
              Total accounts
            </span>
            <strong>
              {stats.total}
            </strong>
          </div>

          <div className="admin-stat-card">
            <ShieldCheck
              size={14}
            />
            <span>
              Owners
            </span>
            <strong>
              {stats.owners}
            </strong>
          </div>

          <div className="admin-stat-card">
            <UserCog
              size={14}
            />
            <span>
              Managers
            </span>
            <strong>
              {stats.managers}
            </strong>
          </div>

          <div className="admin-stat-card">
            <Users
              size={14}
            />
            <span>
              Users
            </span>
            <strong>
              {stats.users}
            </strong>
          </div>

          <div className="admin-stat-card warning">
            <span>
              Inactive
            </span>
            <strong>
              {stats.inactive}
            </strong>
          </div>
        </section>

        {showCreate && (
          <form
            className="create-account-panel"
            onSubmit={
              handleCreate
            }
          >
            <div className="admin-panel-title">
              <div>
                <UserPlus
                  size={15}
                />
                <strong>
                  New Account
                </strong>
              </div>

              <span>
                Set the minimum access required.
              </span>
            </div>

            <div className="create-account-fields">
              <label>
                <span>
                  Display name
                </span>
                <input
                  value={
                    displayName
                  }
                  onChange={
                    (event) =>
                      setDisplayName(
                        event.target.value
                      )
                  }
                  required
                />
              </label>

              <label>
                <span>
                  Email
                </span>
                <input
                  type="email"
                  value={
                    email
                  }
                  onChange={
                    (event) =>
                      setEmail(
                        event.target.value
                      )
                  }
                  required
                />
              </label>

              <label>
                <span>
                  Temporary password
                </span>
                <input
                  type="password"
                  value={
                    password
                  }
                  onChange={
                    (event) =>
                      setPassword(
                        event.target.value
                      )
                  }
                  minLength={10}
                  required
                />
              </label>

              {isOwner && (
                <label>
                  <span>
                    Role
                  </span>
                  <select
                    value={
                      role
                    }
                    onChange={
                      (event) => {
                        const nextRole =
                          event.target.value as
                            | "recovery_owner"
                            | "manager"
                            | "user";

                        setRole(
                          nextRole
                        );

                        if (
                          nextRole === "manager"
                        ) {
                          setCanEditPlotNames(
                            false
                          );
                        }
                      }
                    }
                  >
                    <option value="user">
                      User — view only
                    </option>
                    <option value="manager">
                      Manager — operational editor
                    </option>
                    {!recoveryOwner && (
                      <option value="recovery_owner">
                        Recovery Owner — protected client recovery
                      </option>
                    )}
                  </select>
                </label>
              )}
            </div>

            {((role === "user") ||
              !isOwner) && (
              <label className="permission-checkbox wide">
                <input
                  type="checkbox"
                  checked={
                    canEditPlotNames
                  }
                  onChange={
                    (event) =>
                      setCanEditPlotNames(
                        event.target.checked
                      )
                  }
                />

                <span>
                  <strong>
                    Allow plot-name editing
                  </strong>

                  <small>
                    The User may change only Plot Number / ID and Display Name. All other editing remains blocked.
                  </small>
                </span>
              </label>
            )}

            <div className="create-account-actions">
              <button
                type="button"
                className="admin-secondary"
                onClick={() =>
                  setShowCreate(
                    false
                  )
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="admin-primary"
                disabled={
                  busyId === "create"
                }
              >
                {busyId === "create"
                  ? "Creating…"
                  : "Create Account"}
              </button>
            </div>
          </form>
        )}

        <section className="account-directory-card">
          <div className="account-directory-heading">
            <div>
              <strong>
                Account Directory
              </strong>
              <span>
                {filteredUsers.length} shown
              </span>
            </div>

            <div className="account-filter-bar">
              <label className="account-search">
                <Search
                  size={12}
                />
                <input
                  type="search"
                  placeholder="Search name or email…"
                  value={
                    searchTerm
                  }
                  onChange={
                    (event) =>
                      setSearchTerm(
                        event.target.value
                      )
                  }
                />
              </label>

              <select
                aria-label="Filter by role"
                value={
                  roleFilter
                }
                onChange={
                  (event) =>
                    setRoleFilter(
                      event.target.value as RoleFilter
                    )
                }
              >
                <option value="all">
                  All roles
                </option>
                <option value="owner">
                  Owners
                </option>
                <option value="manager">
                  Managers
                </option>
                <option value="user">
                  Users
                </option>
              </select>

              <select
                aria-label="Filter by status"
                value={
                  statusFilter
                }
                onChange={
                  (event) =>
                    setStatusFilter(
                      event.target.value as StatusFilter
                    )
                }
              >
                <option value="all">
                  All status
                </option>
                <option value="active">
                  Active
                </option>
                <option value="inactive">
                  Inactive
                </option>
              </select>
            </div>
          </div>

          {error && (
            <div className="admin-message error">
              {error}
            </div>
          )}

          {success && (
            <div className="admin-message success">
              {success}
            </div>
          )}

          {loading ? (
            <div className="account-empty">
              Loading accounts…
            </div>
          ) : error ? (
            <div className="account-empty">
              Accounts could not be loaded. The error above is the server response.
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="account-empty">
              No accounts match the current filters.
            </div>
          ) : (
            <div className="account-table">
              <div className="account-table-header">
                <span>
                  Account
                </span>
                <span>
                  Role
                </span>
                <span>
                  Access
                </span>
                <span>
                  Status
                </span>
                <span />
              </div>

              {filteredUsers.map(
                (user) => {
                  const editable =
                    canEditAccount(
                      user
                    );

                  const editing =
                    editingId ===
                    user.memberId;

                  const accessLabel =
                    user.role === "platform_recovery"
                      ? "Protected platform recovery"
                      : user.role === "owner" ||
                        user.role === "recovery_owner"
                        ? "Full owner access"
                      : user.role === "manager"
                        ? "Full operational access"
                        : user.canEditPlotNames
                          ? "View + plot names"
                          : "View only";

                  return (
                    <article
                      key={
                        user.memberId
                      }
                      className={
                        user.active
                          ? "account-row"
                          : "account-row inactive"
                      }
                    >
                      <div className="account-row-main">
                        <div className="account-identity">
                          <strong>
                            {user.displayName ||
                              user.email}
                          </strong>
                          <span>
                            {user.email}
                          </span>
                          <small>
                            Created {formatCreatedAt(
                              user.createdAt
                            )}
                          </small>
                        </div>

                        <div>
                          <span
                            className={`role-badge ${user.role}`}
                          >
                            {roleLabel(
                              user.role
                            )}
                          </span>
                        </div>

                        <div className="account-access-summary">
                          <strong>
                            {accessLabel}
                          </strong>
                          {user.role === "user" && (
                            <span>
                              {user.canEditPlotNames
                                ? "Plot names enabled"
                                : "No edit permissions"}
                            </span>
                          )}
                        </div>

                        <div>
                          <span
                            className={
                              user.active
                                ? "status-badge active"
                                : "status-badge inactive"
                            }
                          >
                            {user.active
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </div>

                        <div className="account-row-action">
                          {editable ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (editing) {
                                  setEditingId(
                                    null
                                  );
                                } else {
                                  startEdit(
                                    user
                                  );
                                }
                              }}
                            >
                              {editing ? (
                                <ChevronUp
                                  size={12}
                                />
                              ) : (
                                <ChevronDown
                                  size={12}
                                />
                              )}
                              {editing
                                ? "Close"
                                : "Edit"}
                            </button>
                          ) : (
                            <span className="protected-account-label">
                              Protected
                            </span>
                          )}
                        </div>
                      </div>

                      {editing && (
                        <div className="account-editor">
                          {(
                            user.role === "owner" ||
                            user.role === "recovery_owner" ||
                            user.role === "platform_recovery"
                          ) ? (
                            <>
                              <div className="account-editor-copy">
                                <strong>
                                  Protected Identity
                                </strong>
                                <span>
                                  {user.role === "platform_recovery"
                                    ? "Only the display name may be changed. The OneTime Labs recovery email and password are immutable in PlotMap."
                                    : "Owner and client Recovery Owner email/password credentials may be changed here."}
                                </span>
                              </div>

                              <div className="account-editor-fields identity-fields-v18">
                                <label>
                                  <span>
                                    Display name
                                  </span>
                                  <input
                                    value={identityDisplayName}
                                    onChange={(event) =>
                                      setIdentityDisplayName(
                                        event.target.value
                                      )
                                    }
                                  />
                                </label>

                                <label>
                                  <span>
                                    Email
                                  </span>
                                  <input
                                    type="email"
                                    disabled={
                                      user.role === "platform_recovery"
                                    }
                                    value={
                                      user.role === "platform_recovery"
                                        ? user.email
                                        : identityEmail
                                    }
                                    onChange={(event) =>
                                      setIdentityEmail(
                                        event.target.value
                                      )
                                    }
                                  />
                                </label>

                                <label>
                                  <span>
                                    New password
                                  </span>
                                  <input
                                    type="password"
                                    disabled={
                                      user.role === "platform_recovery"
                                    }
                                    value={identityPassword}
                                    placeholder={
                                      user.role === "platform_recovery"
                                        ? "Protected"
                                        : "Leave blank to keep current password"
                                    }
                                    onChange={(event) =>
                                      setIdentityPassword(
                                        event.target.value
                                      )
                                    }
                                  />
                                </label>
                              </div>

                              <div className="account-editor-actions">
                                <span className="protected-account-note-v18">
                                  {user.role === "platform_recovery"
                                    ? "Email, password, role, status and deletion are locked."
                                    : "Role, active status and deletion remain protected."}
                                </span>

                                <div>
                                  <button
                                    type="button"
                                    className="admin-secondary"
                                    onClick={() =>
                                      setEditingId(
                                        null
                                      )
                                    }
                                  >
                                    Cancel
                                  </button>

                                  <button
                                    type="button"
                                    className="admin-primary compact-button"
                                    disabled={
                                      busyId === user.memberId
                                    }
                                    onClick={() =>
                                      void saveProtectedIdentity(
                                        user
                                      )
                                    }
                                  >
                                    {busyId === user.memberId
                                      ? "Saving…"
                                      : "Save Identity"}
                                  </button>
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="account-editor-copy">
                                <strong>
                                  Account Settings
                                </strong>
                                <span>
                                  Change this account's role, status, or narrow User permissions.
                                </span>
                              </div>

                              <div className="account-editor-fields">
                                {isOwner && (
                                  <label>
                                    <span>
                                      Role
                                    </span>
                                    <select
                                      value={editRole}
                                      onChange={(event) => {
                                        const nextRole =
                                          event.target.value as
                                            | "manager"
                                            | "user";

                                        setEditRole(
                                          nextRole
                                        );

                                        if (
                                          nextRole === "manager"
                                        ) {
                                          setEditCanEditPlotNames(
                                            false
                                          );
                                        }
                                      }}
                                    >
                                      <option value="user">
                                        User
                                      </option>
                                      <option value="manager">
                                        Manager
                                      </option>
                                    </select>
                                  </label>
                                )}

                                <label>
                                  <span>
                                    Account status
                                  </span>
                                  <select
                                    value={
                                      editActive
                                        ? "active"
                                        : "inactive"
                                    }
                                    onChange={(event) =>
                                      setEditActive(
                                        event.target.value === "active"
                                      )
                                    }
                                  >
                                    <option value="active">
                                      Active
                                    </option>
                                    <option value="inactive">
                                      Inactive
                                    </option>
                                  </select>
                                </label>

                                {editRole === "user" && (
                                  <label className="permission-checkbox inline-edit">
                                    <input
                                      type="checkbox"
                                      checked={editCanEditPlotNames}
                                      onChange={(event) =>
                                        setEditCanEditPlotNames(
                                          event.target.checked
                                        )
                                      }
                                    />

                                    <span>
                                      <strong>
                                        Can edit plot names
                                      </strong>
                                      <small>
                                        Plot Number / ID and Display Name only.
                                      </small>
                                    </span>
                                  </label>
                                )}
                              </div>

                              <div className="account-editor-actions">
                                <button
                                  type="button"
                                  className="admin-danger"
                                  disabled={
                                    busyId === user.memberId
                                  }
                                  onClick={() =>
                                    void removeUser(
                                      user
                                    )
                                  }
                                >
                                  <Trash2
                                    size={12}
                                  />
                                  Delete Account
                                </button>

                                <div>
                                  <button
                                    type="button"
                                    className="admin-secondary"
                                    onClick={() =>
                                      setEditingId(
                                        null
                                      )
                                    }
                                  >
                                    Cancel
                                  </button>

                                  <button
                                    type="button"
                                    className="admin-primary compact-button"
                                    disabled={
                                      busyId === user.memberId
                                    }
                                    onClick={() =>
                                      void saveEditedUser(
                                        user
                                      )
                                    }
                                  >
                                    {busyId === user.memberId
                                      ? "Saving…"
                                      : "Save Changes"}
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
