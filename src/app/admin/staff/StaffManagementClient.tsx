"use client";

import { useEffect, useState, useTransition } from "react";
import { Search, UserPlus, ShieldCheck, ShieldOff } from "lucide-react";
import {
  getAdminUsers,
  searchPromotableUsers,
  promoteUserToAdmin,
  inviteNewAdmin,
  updateAdminRoles,
  deactivateAdmin,
  reactivateAdmin,
} from "./staff-actions";

const inputClass =
  "w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

type RoleTemplate = { id: string; name: string; description: string | null; isSystemRole: boolean };
type AdminUserRow = {
  id: string;
  isActive: boolean;
  createdAt: string;
  userId: string;
  name: string | null;
  email: string;
  roles: { id: string; name: string }[];
};

export default function StaffManagementClient({
  initialAdmins,
  roleTemplates,
}: {
  initialAdmins: AdminUserRow[];
  roleTemplates: RoleTemplate[];
}) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [deactivatingAdminId, setDeactivatingAdminId] = useState<string | null>(null);
  const [reactivatingAdminId, setReactivatingAdminId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refreshAdmins() {
    const fresh = await getAdminUsers();
    setAdmins(fresh);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Staff management</h1>
          <p className="mt-1 text-sm text-ink-500">Add admins and manage their roles. Super Admin only.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddPanel((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500"
        >
          <UserPlus className="h-4 w-4" />
          Add admin
        </button>
      </div>

      {message && <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-600">{message}</p>}
      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}

      {showAddPanel && (
        <AddAdminPanel
          roleTemplates={roleTemplates}
          onDone={async (successMessage) => {
            setShowAddPanel(false);
            setMessage(successMessage);
            setError(null);
            await refreshAdmins();
          }}
          onError={setError}
        />
      )}

      <div className="mt-6 space-y-2">
        {admins.map((admin) => (
          <div key={admin.id} className="rounded-lg border border-ink-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                  {admin.name || admin.email.split("@")[0]}
                  {!admin.isActive && (
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-500">
                      Deactivated
                    </span>
                  )}
                </p>
                <p className="text-xs text-ink-500">{admin.email}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {admin.roles.map((r) => (
                    <span
                      key={r.id}
                      className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600"
                    >
                      {r.name}
                    </span>
                  ))}
                  {admin.roles.length === 0 && (
                    <span className="text-xs text-ink-300">No roles assigned</span>
                  )}
                </div>
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAdminId(editingAdminId === admin.id ? null : admin.id)}
                  className="rounded-md border border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-ink-300"
                >
                  Edit roles
                </button>
                {admin.isActive ? (
                  <button
                    type="button"
                    onClick={() => setDeactivatingAdminId(deactivatingAdminId === admin.id ? null : admin.id)}
                    className="flex items-center gap-1 rounded-md border border-danger px-3 py-1.5 text-xs font-semibold text-danger hover:bg-red-50"
                  >
                    <ShieldOff className="h-3.5 w-3.5" />
                    Deactivate
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setReactivatingAdminId(reactivatingAdminId === admin.id ? null : admin.id)}
                    className="flex items-center gap-1 rounded-md border border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-ink-300"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Reactivate
                  </button>
                )}
              </div>
            </div>

            {editingAdminId === admin.id && (
              <EditRolesPanel
                admin={admin}
                roleTemplates={roleTemplates}
                isPending={isPending}
                onSave={(roleIds) => {
                  setError(null);
                  startTransition(async () => {
                    try {
                      await updateAdminRoles(admin.id, roleIds);
                      setEditingAdminId(null);
                      setMessage(`Updated roles for ${admin.name || admin.email}.`);
                      await refreshAdmins();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Couldn't update roles.");
                    }
                  });
                }}
                onCancel={() => setEditingAdminId(null)}
              />
            )}

            {deactivatingAdminId === admin.id && (
              <ReasonPanel
                isPending={isPending}
                confirmLabel="Confirm deactivation"
                confirmClassName="bg-danger"
                placeholder="Reason for removing this admin's access…"
                onConfirm={(reason) => {
                  setError(null);
                  startTransition(async () => {
                    try {
                      await deactivateAdmin(admin.id, reason);
                      setDeactivatingAdminId(null);
                      setMessage(`Deactivated ${admin.name || admin.email}.`);
                      await refreshAdmins();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Couldn't deactivate this admin.");
                    }
                  });
                }}
                onCancel={() => setDeactivatingAdminId(null)}
              />
            )}

            {reactivatingAdminId === admin.id && (
              <ReasonPanel
                isPending={isPending}
                confirmLabel="Confirm reactivation"
                confirmClassName="bg-ink-700"
                placeholder="Reason for restoring this admin's access…"
                onConfirm={(reason) => {
                  setError(null);
                  startTransition(async () => {
                    try {
                      await reactivateAdmin(admin.id, reason);
                      setReactivatingAdminId(null);
                      setMessage(`Reactivated ${admin.name || admin.email}.`);
                      await refreshAdmins();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Couldn't reactivate this admin.");
                    }
                  });
                }}
                onCancel={() => setReactivatingAdminId(null)}
              />
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

function RoleCheckboxes({
  roleTemplates,
  selectedRoleIds,
  onChange,
}: {
  roleTemplates: RoleTemplate[];
  selectedRoleIds: string[];
  onChange: (roleIds: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      {roleTemplates.map((role) => (
        <label key={role.id} className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={selectedRoleIds.includes(role.id)}
            onChange={(e) => {
              if (e.target.checked) {
                onChange([...selectedRoleIds, role.id]);
              } else {
                onChange(selectedRoleIds.filter((id) => id !== role.id));
              }
            }}
          />
          <span>
            <span className="font-medium text-ink-900">{role.name}</span>
            {role.description && <span className="text-ink-500"> — {role.description}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

function EditRolesPanel({
  admin,
  roleTemplates,
  isPending,
  onSave,
  onCancel,
}: {
  admin: AdminUserRow;
  roleTemplates: RoleTemplate[];
  isPending: boolean;
  onSave: (roleIds: string[]) => void;
  onCancel: () => void;
}) {
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(admin.roles.map((r) => r.id));

  return (
    <div className="mt-3 space-y-3 rounded-md bg-ink-50 p-3">
      <RoleCheckboxes roleTemplates={roleTemplates} selectedRoleIds={selectedRoleIds} onChange={setSelectedRoleIds} />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSave(selectedRoleIds)}
          disabled={isPending}
          className="rounded-md bg-ink-700 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Save roles
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-ink-500">
          Cancel
        </button>
      </div>
    </div>
  );
}

function ReasonPanel({
  isPending,
  confirmLabel,
  confirmClassName,
  placeholder,
  onConfirm,
  onCancel,
}: {
  isPending: boolean;
  confirmLabel: string;
  confirmClassName: string;
  placeholder: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="mt-3 space-y-2 rounded-md bg-ink-50 p-3">
      <textarea
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className={inputClass}
        placeholder={placeholder}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onConfirm(reason)}
          disabled={isPending}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white ${confirmClassName}`}
        >
          {confirmLabel}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-ink-500">
          Cancel
        </button>
      </div>
    </div>
  );
}

function AddAdminPanel({
  roleTemplates,
  onDone,
  onError,
}: {
  roleTemplates: RoleTemplate[];
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [mode, setMode] = useState<"promote" | "invite">("promote");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [isSearching, startSearchTransition] = useTransition();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (mode !== "promote") return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    startSearchTransition(async () => {
      const found = await searchPromotableUsers(trimmed);
      setResults(found);
    });
  }, [query, mode]);

  function handleSubmit() {
    if (selectedRoleIds.length === 0) {
      onError("Select at least one role.");
      return;
    }

    startTransition(async () => {
      try {
        if (mode === "promote") {
          if (!selectedUserId) {
            onError("Search for and select a person first.");
            return;
          }
          const selected = results.find((r) => r.id === selectedUserId);
          await promoteUserToAdmin(selectedUserId, selectedRoleIds);
          onDone(`${selected?.name || selected?.email || "User"} is now an admin.`);
        } else {
          if (!inviteEmail.trim()) {
            onError("Enter an email address.");
            return;
          }
          await inviteNewAdmin(inviteEmail, selectedRoleIds);
          onDone(`Invite sent to ${inviteEmail}.`);
        }
      } catch (e) {
        onError(e instanceof Error ? e.message : "Couldn't add this admin.");
      }
    });
  }

  return (
    <div className="mt-4 rounded-lg border border-ink-100 bg-white p-5 shadow-sm">
      <div className="flex gap-1 rounded-md bg-ink-50 p-1">
        <button
          type="button"
          onClick={() => setMode("promote")}
          className={
            mode === "promote"
              ? "flex-1 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-ink-900 shadow-sm"
              : "flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-ink-500"
          }
        >
          Existing user
        </button>
        <button
          type="button"
          onClick={() => setMode("invite")}
          className={
            mode === "invite"
              ? "flex-1 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-ink-900 shadow-sm"
              : "flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-ink-500"
          }
        >
          Invite new person
        </button>
      </div>

      {mode === "promote" ? (
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedUserId(null);
              }}
              placeholder="Search by name or email…"
              className={`${inputClass} pl-9`}
            />
          </div>
          {isSearching && <p className="mt-2 text-xs text-ink-300">Searching…</p>}
          {!isSearching && query.trim() && results.length === 0 && (
            <p className="mt-2 text-xs text-ink-300">
              No matching users found (they may already be an admin, or don&apos;t have an account yet — try inviting
              them instead).
            </p>
          )}
          {!isSearching && results.length > 0 && (
            <div className="mt-2 space-y-1">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedUserId(r.id)}
                  className={
                    selectedUserId === r.id
                      ? "block w-full rounded-md border border-green-500 bg-green-50 px-3 py-2 text-left text-sm text-ink-900"
                      : "block w-full rounded-md border border-ink-100 px-3 py-2 text-left text-sm text-ink-700 hover:border-ink-300"
                  }
                >
                  {r.name || r.email.split("@")[0]} <span className="text-ink-300">· {r.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@example.com"
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-ink-300">
            They&apos;ll get an email to set up their account and sign in for the first time.
          </p>
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">Roles</p>
        <div className="mt-2">
          <RoleCheckboxes roleTemplates={roleTemplates} selectedRoleIds={selectedRoleIds} onChange={setSelectedRoleIds} />
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="mt-4 w-full rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50"
      >
        {mode === "promote" ? "Make admin" : "Send invite"}
      </button>
    </div>
  );
}
