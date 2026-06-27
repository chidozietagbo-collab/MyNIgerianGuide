"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { getAuditLog } from "./audit-log-actions";

const selectClass =
  "rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  metadata: unknown;
  createdAt: string;
  adminName: string;
  adminEmail: string;
  businessName: string | null;
  businessSlug: string | null;
};

type AdminOption = { id: string; label: string };

const ACTION_LABELS: Record<string, string> = {
  "user.warn": "Sent a warning",
  "user.suspend": "Suspended an account",
  "user.unsuspend": "Lifted a suspension",
  "user.ban": "Banned an account",
  "user.delete": "Deleted an account",
  "user.reset_password": "Sent a password reset",
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  USER: "User",
  BUSINESS_PAGE: "Business page",
  POST: "Post",
  REVIEW: "Review",
};

type AuditLogClientProps = {
  initialEntries: AuditEntry[];
  admins: AdminOption[];
};

export default function AuditLogClient({ initialEntries, admins }: AuditLogClientProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [adminFilter, setAdminFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [isPending, startTransition] = useTransition();

  function applyFilters(nextAdmin: string, nextEntityType: string) {
    startTransition(async () => {
      const results = await getAuditLog({
        adminUserId: nextAdmin || undefined,
        entityType: nextEntityType || undefined,
      });
      setEntries(results);
    });
  }

  function handleAdminChange(value: string) {
    setAdminFilter(value);
    applyFilters(value, entityTypeFilter);
  }

  function handleEntityTypeChange(value: string) {
    setEntityTypeFilter(value);
    applyFilters(adminFilter, value);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-ink-900">Audit log</h1>
      <p className="mt-1 text-sm text-ink-500">
        A permanent record of every admin action across the platform. This log can&apos;t be edited or deleted.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <select value={adminFilter} onChange={(e) => handleAdminChange(e.target.value)} className={selectClass}>
          <option value="">All admins</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>

        <select value={entityTypeFilter} onChange={(e) => handleEntityTypeChange(e.target.value)} className={selectClass}>
          <option value="">All types</option>
          {Object.entries(ENTITY_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {isPending && <p className="mt-4 text-sm text-ink-300">Loading…</p>}

      {!isPending && entries.length === 0 ? (
        <p className="mt-8 text-sm text-ink-300">No actions match these filters.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-ink-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-sm text-ink-900">
                  <span className="font-medium">{entry.adminName}</span>
                  {" — "}
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </p>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700">
                  {ENTITY_TYPE_LABELS[entry.entityType] ?? entry.entityType}
                </span>
              </div>

              {entry.reason && <p className="mt-1 text-sm text-ink-500">{entry.reason}</p>}

              <div className="mt-2 flex items-center gap-2 text-xs text-ink-300">
                <span>
                  {new Date(entry.createdAt).toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {" at "}
                  {new Date(entry.createdAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                </span>

                {entry.entityType === "USER" && (
                  <Link href="/admin/users" className="text-green-600 hover:underline">
                    View in user management →
                  </Link>
                )}
                {entry.entityType === "BUSINESS_PAGE" && entry.businessSlug && (
                  <Link href={`/b/${entry.businessSlug}`} target="_blank" className="text-green-600 hover:underline">
                    View {entry.businessName} →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
