"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppRole, DashboardPreset } from "@/lib/auth";

type ManagedUser = {
  username: string;
  role: AppRole;
  dashboardPreset: DashboardPreset;
  createdAt: string;
  updatedAt: string;
  mustChangePassword: boolean;
};

type AuditEvent = {
  id: string;
  at: string;
  actorUsername: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  summary: string;
  changes: { field: string; from: unknown; to: unknown }[];
};

const roleOptions: AppRole[] = ["Admin", "Boss", "Sales", "Showroom", "AccountManager", "TeamLeadAM", "OperationManager", "Logistics", "Service", "Insurance"];
const presetOptions: DashboardPreset[] = ["pipeline", "stats"];

export function AdminDashboard({ activeUsername }: { activeUsername: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [error, setError] = useState("");
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [creating, setCreating] = useState({
    username: "",
    password: "",
    role: "Sales" as AppRole,
    dashboardPreset: "pipeline" as DashboardPreset,
  });
  const [resetPasswordByUser, setResetPasswordByUser] = useState<Record<string, string>>({});

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setUsers((await response.json()) as ManagedUser[]);
    } catch {
      setError("Неуспешно зареждане на профили.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAuditEvents = useCallback(async () => {
    setAuditLoading(true);
    try {
      const response = await fetch("/api/audit-log?limit=50", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setAuditEvents((await response.json()) as AuditEvent[]);
    } catch {
      setAuditEvents([]);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
    void loadAuditEvents();
  }, [loadUsers, loadAuditEvents]);

  const sortedUsers = useMemo(() => [...users].sort((a, b) => a.username.localeCompare(b.username)), [users]);

  async function create() {
    setError("");
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creating),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Неуспешно създаване на профил.");
      return;
    }
    setCreating({ username: "", password: "", role: "Sales", dashboardPreset: "pipeline" });
    await loadUsers();
    await loadAuditEvents();
  }

  async function patchUser(username: string, patch: Partial<Pick<ManagedUser, "role" | "dashboardPreset" | "mustChangePassword">>) {
    setError("");
    const response = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Неуспешна промяна.");
      return;
    }
    await loadUsers();
    await loadAuditEvents();
  }

  async function removeUser(username: string) {
    if (!window.confirm(`Delete profile "${username}"?`)) return;
    setError("");
    const response = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Неуспешно изтриване.");
      return;
    }
    await loadUsers();
    await loadAuditEvents();
  }

  async function resetPassword(username: string) {
    const nextPassword = (resetPasswordByUser[username] ?? "").trim();
    if (!nextPassword) {
      setError("Въведи нова парола за reset.");
      return;
    }
    setError("");
    const response = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_password", newPassword: nextPassword }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Неуспешен reset.");
      return;
    }
    setResetPasswordByUser((prev) => ({ ...prev, [username]: "" }));
    await loadUsers();
    await loadAuditEvents();
  }

  function formatAuditDate(iso: string) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat("bg-BG", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Sofia" }).format(date);
  }

  return (
    <section className="space-y-5">
      <section className="module-shell">
        <div className="module-header">
          <h2 className="module-title">Admin: Profile Management</h2>
          <span className="badge brand-chip">Users / Roles / Passwords / Views</span>
        </div>
        <div className="module-body space-y-4">
          {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {loading ? <p className="text-sm text-gray-600">Loading profiles...</p> : null}

          <div className="rounded-lg border border-gray-200 p-3">
            <p className="mb-2 text-sm font-semibold">Create Profile</p>
            <div className="grid gap-2 md:grid-cols-4">
              <label>
                <span className="field-label">Username</span>
                <input className="brand-input" value={creating.username} onChange={(e) => setCreating((s) => ({ ...s, username: e.target.value }))} />
              </label>
              <label>
                <span className="field-label">Password</span>
                <input className="brand-input" type="password" value={creating.password} onChange={(e) => setCreating((s) => ({ ...s, password: e.target.value }))} />
              </label>
              <label>
                <span className="field-label">Role</span>
                <select className="brand-input" value={creating.role} onChange={(e) => setCreating((s) => ({ ...s, role: e.target.value as AppRole }))}>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">Dashboard View</span>
                <select className="brand-input" value={creating.dashboardPreset} onChange={(e) => setCreating((s) => ({ ...s, dashboardPreset: e.target.value as DashboardPreset }))}>
                  {presetOptions.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="button" className="brand-btn mt-3 px-4 py-2 text-sm" onClick={() => void create()}>
              Create Profile
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="brand-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Dashboard</th>
                  <th>Force Password Change</th>
                  <th>Reset Password</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => (
                  <tr key={user.username}>
                    <td>{user.username}{user.username === activeUsername ? " (you)" : ""}</td>
                    <td>
                      <select className="brand-input" value={user.role} onChange={(e) => void patchUser(user.username, { role: e.target.value as AppRole })}>
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select className="brand-input" value={user.dashboardPreset} onChange={(e) => void patchUser(user.username, { dashboardPreset: e.target.value as DashboardPreset })}>
                        {presetOptions.map((preset) => (
                          <option key={preset} value={preset}>
                            {preset}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <label className="inline-flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={user.mustChangePassword} onChange={(e) => void patchUser(user.username, { mustChangePassword: e.target.checked })} />
                        Required
                      </label>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          className="brand-input"
                          placeholder="new pass"
                          value={resetPasswordByUser[user.username] ?? ""}
                          onChange={(e) => setResetPasswordByUser((prev) => ({ ...prev, [user.username]: e.target.value }))}
                        />
                        <button type="button" className="mini-btn" onClick={() => void resetPassword(user.username)}>
                          Reset
                        </button>
                      </div>
                    </td>
                    <td>
                      <button type="button" className="mini-btn" disabled={user.username === activeUsername} onClick={() => void removeUser(user.username)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-gray-200 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Audit Log</p>
                <p className="text-xs text-gray-500">Последните 50 действия: профили, lead промени, изтривания и документи.</p>
              </div>
              <button type="button" className="mini-btn" onClick={() => void loadAuditEvents()}>
                Refresh
              </button>
            </div>
            {auditLoading ? <p className="text-sm text-gray-600">Loading audit log...</p> : null}
            {!auditLoading && auditEvents.length === 0 ? <p className="text-sm text-gray-600">Няма записани действия.</p> : null}
            {auditEvents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="brand-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Summary</th>
                      <th>Changed Fields</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEvents.map((event) => (
                      <tr key={event.id}>
                        <td>{formatAuditDate(event.at)}</td>
                        <td>{event.actorUsername} ({event.actorRole})</td>
                        <td>{event.action}</td>
                        <td>{event.entityType}: {event.entityLabel || event.entityId}</td>
                        <td>{event.summary}</td>
                        <td>{event.changes.map((change) => change.field).join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </section>
  );
}
