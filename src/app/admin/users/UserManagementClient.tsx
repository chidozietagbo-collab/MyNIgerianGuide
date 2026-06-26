"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { BadgeCheck, History, Search } from "lucide-react";
import {
  searchUsers,
  getUserDetail,
  getUserAuditHistory,
  warnUser,
  suspendUser,
  unsuspendUser,
  banUser,
  deleteUser,
  resetUserPassword,
} from "./user-management-actions";

const inputClass =
  "w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";
const textareaClass = inputClass;

type UserListItem = {
  id: string;
  email: string;
  name: string | null;
  accountStatus: string;
  createdAt: string;
};

type UserDetail = {
  id: string;
  email: string;
  name: string | null;
  accountStatus: string;
  createdAt: Date;
  businessPages: { id: string; name: string; slug: string; isPublished: boolean; verificationStatus: string }[];
  _count: { posts: number; reviews: number; follows: number };
};

type AuditEntry = {
  id: string;
  action: string;
  reason: string | null;
  metadata: unknown;
  createdAt: string;
  adminName: string;
};

type UserManagementClientProps = {
  initialUsers: UserListItem[];
  canWarn: boolean;
  canSuspend: boolean;
  canBan: boolean;
  canDelete: boolean;
  canResetPassword: boolean;
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-50 text-green-600",
  SUSPENDED: "bg-ink-100 text-ink-900",
  BANNED: "bg-red-50 text-danger",
  DELETED: "bg-ink-100 text-ink-300",
};

const ACTION_LABELS: Record<string, string> = {
  "user.warn": "Sent a warning",
  "user.suspend": "Suspended the account",
  "user.unsuspend": "Lifted a suspension",
  "user.ban": "Banned the account",
  "user.delete": "Deleted the account",
  "user.reset_password": "Sent a password reset",
};

export default function UserManagementClient({
  initialUsers,
  canWarn,
  canSuspend,
  canBan,
  canDelete,
  canResetPassword,
}: UserManagementClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [isSearching, startSearchTransition] = useTransition();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  function handleSearch(value: string) {
    setQuery(value);
    startSearchTransition(async () => {
      const results = await searchUsers(value);
      setUsers(results.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })));
    });
  }

  if (selectedUserId) {
    return (
      <UserDetailView
        userId={selectedUserId}
        onBack={() => setSelectedUserId(null)}
        canWarn={canWarn}
        canSuspend={canSuspend}
        canBan={canBan}
        canDelete={canDelete}
        canResetPassword={canResetPassword}
      />
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-ink-900">User management</h1>
      <p className="mt-1 text-sm text-ink-500">Search for a user by name or email.</p>

      <div className="relative mt-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
        <input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name or email…"
          className={`${inputClass} pl-9`}
        />
      </div>

      <div className="mt-4 space-y-2">
        {isSearching && <p className="text-sm text-ink-300">Searching…</p>}
        {!isSearching && users.length === 0 && <p className="text-sm text-ink-300">No users found.</p>}
        {!isSearching &&
          users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelectedUserId(u.id)}
              className="flex w-full items-center justify-between rounded-lg border border-ink-100 bg-white p-4 text-left shadow-sm transition hover:border-green-500"
            >
              <div>
                <p className="text-sm font-semibold text-ink-900">{u.name || u.email.split("@")[0]}</p>
                <p className="text-xs text-ink-500">{u.email}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[u.accountStatus] ?? ""}`}>
                {u.accountStatus}
              </span>
            </button>
          ))}
      </div>
    </main>
  );
}

function UserDetailView({
  userId,
  onBack,
  canWarn,
  canSuspend,
  canBan,
  canDelete,
  canResetPassword,
}: {
  userId: string;
  onBack: () => void;
  canWarn: boolean;
  canSuspend: boolean;
  canBan: boolean;
  canDelete: boolean;
  canResetPassword: boolean;
}) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [history, setHistory] = useState<AuditEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [suspendDays, setSuspendDays] = useState("7");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadDetail() {
    setLoading(true);
    try {
      const [data, auditHistory] = await Promise.all([
        getUserDetail(userId),
        getUserAuditHistory(userId),
      ]);
      setDetail(data);
      // null means the viewing admin doesn't hold admin.view_audit_log —
      // the history section simply won't render in that case, rather
      // than erroring the whole page.
      setHistory(auditHistory);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this user.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function runAction(fn: () => Promise<void>, successMessage: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await fn();
        setActiveAction(null);
        setReason("");
        setMessage(successMessage);
        await loadDetail();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't complete this action.");
      }
    });
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-ink-300">Loading…</p>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <button type="button" onClick={onBack} className="text-sm font-medium text-green-600 hover:underline">
          ← Back to search
        </button>
        <p className="mt-4 text-sm text-danger">{error ?? "User not found."}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <button type="button" onClick={onBack} className="text-sm font-medium text-green-600 hover:underline">
        ← Back to search
      </button>

      <div className="mt-4 rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-bold text-ink-900">{detail.name || detail.email.split("@")[0]}</p>
            <p className="text-sm text-ink-500">{detail.email}</p>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[detail.accountStatus] ?? ""}`}>
            {detail.accountStatus}
          </span>
        </div>

        <p className="mt-3 text-xs text-ink-300">
          Joined {new Date(detail.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
          {" · "}
          {detail._count.posts} posts · {detail._count.reviews} reviews · {detail._count.follows} follows
        </p>

        {detail.businessPages.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">Business pages</p>
            <div className="mt-2 space-y-1.5">
              {detail.businessPages.map((bp) => (
                <Link
                  key={bp.id}
                  href={`/b/${bp.slug}`}
                  target="_blank"
                  className="flex items-center justify-between rounded-md bg-ink-50 px-3 py-2 text-sm text-ink-700 hover:text-green-600"
                >
                  <span className="flex items-center gap-1.5">
                    {bp.name}
                    {bp.verificationStatus === "VERIFIED" && <BadgeCheck className="h-3.5 w-3.5 text-green-600" />}
                  </span>
                  <span className="text-xs text-ink-300">{bp.isPublished ? "Published" : "Unpublished"}</span>
                </Link>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-300">
              To unpublish a business page, open it above and use the moderation queue or business tools.
            </p>
          </div>
        )}

        {message && <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-600">{message}</p>}
        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-4">
          {canWarn && (
            <ActionTrigger label="Warn" active={activeAction === "warn"} onClick={() => setActiveAction("warn")} />
          )}
          {canSuspend && detail.accountStatus !== "SUSPENDED" && (
            <ActionTrigger label="Suspend" active={activeAction === "suspend"} onClick={() => setActiveAction("suspend")} />
          )}
          {canSuspend && detail.accountStatus === "SUSPENDED" && (
            <ActionTrigger label="Lift suspension" active={activeAction === "unsuspend"} onClick={() => setActiveAction("unsuspend")} />
          )}
          {canBan && detail.accountStatus !== "BANNED" && (
            <ActionTrigger label="Ban" danger active={activeAction === "ban"} onClick={() => setActiveAction("ban")} />
          )}
          {canDelete && detail.accountStatus !== "DELETED" && (
            <ActionTrigger label="Delete account" danger active={activeAction === "delete"} onClick={() => setActiveAction("delete")} />
          )}
          {canResetPassword && (
            <button
              type="button"
              onClick={() => runAction(() => resetUserPassword(userId), "Password reset email sent.")}
              disabled={isPending}
              className="rounded-md border border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:border-ink-300 disabled:opacity-60"
            >
              Send password reset
            </button>
          )}
        </div>

        {activeAction === "warn" && (
          <div className="mt-3 space-y-2 rounded-md bg-ink-50 p-3">
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={textareaClass} placeholder="Reason for this warning…" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runAction(() => warnUser(userId, reason), "Warning sent.")}
                disabled={isPending}
                className="rounded-md bg-ink-700 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Send warning
              </button>
              <button type="button" onClick={() => setActiveAction(null)} className="text-xs text-ink-500">
                Cancel
              </button>
            </div>
          </div>
        )}

        {activeAction === "suspend" && (
          <div className="mt-3 space-y-2 rounded-md bg-ink-50 p-3">
            <div className="flex items-center gap-2">
              <label htmlFor="suspend-days" className="text-xs font-medium text-ink-700">
                Days
              </label>
              <input
                id="suspend-days"
                type="number"
                min={1}
                value={suspendDays}
                onChange={(e) => setSuspendDays(e.target.value)}
                className={`${inputClass} w-20`}
              />
            </div>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={textareaClass} placeholder="Reason for this suspension…" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runAction(() => suspendUser(userId, reason, Number(suspendDays)), "User suspended.")}
                disabled={isPending}
                className="rounded-md bg-ink-700 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Confirm suspension
              </button>
              <button type="button" onClick={() => setActiveAction(null)} className="text-xs text-ink-500">
                Cancel
              </button>
            </div>
          </div>
        )}

        {activeAction === "unsuspend" && (
          <div className="mt-3 space-y-2 rounded-md bg-ink-50 p-3">
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={textareaClass} placeholder="Reason for lifting this suspension…" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runAction(() => unsuspendUser(userId, reason), "Suspension lifted.")}
                disabled={isPending}
                className="rounded-md bg-ink-700 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Confirm
              </button>
              <button type="button" onClick={() => setActiveAction(null)} className="text-xs text-ink-500">
                Cancel
              </button>
            </div>
          </div>
        )}

        {activeAction === "ban" && (
          <div className="mt-3 space-y-2 rounded-md bg-ink-50 p-3">
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={textareaClass} placeholder="Reason for this ban…" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runAction(() => banUser(userId, reason), "User banned.")}
                disabled={isPending}
                className="rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white"
              >
                Confirm ban
              </button>
              <button type="button" onClick={() => setActiveAction(null)} className="text-xs text-ink-500">
                Cancel
              </button>
            </div>
          </div>
        )}

        {activeAction === "delete" && (
          <div className="mt-3 space-y-2 rounded-md bg-ink-50 p-3">
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={textareaClass} placeholder="Reason for this deletion…" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runAction(() => deleteUser(userId, reason), "Account deleted.")}
                disabled={isPending}
                className="rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white"
              >
                Confirm deletion
              </button>
              <button type="button" onClick={() => setActiveAction(null)} className="text-xs text-ink-500">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Account history — only renders for admins holding admin.view_audit_log;
          getUserAuditHistory returns null for everyone else, and history
          stays null, so this section simply doesn't appear rather than
          erroring for an admin who can manage the account but shouldn't
          see the full audit trail (e.g. a Support Agent). */}
      {history && (
        <div className="mt-4 rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-ink-300" />
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">
              Account history
            </h2>
          </div>

          {history.length === 0 ? (
            <p className="mt-2 text-sm text-ink-300">No admin actions on record for this account.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {history.map((entry) => (
                <div key={entry.id} className="border-l-2 border-ink-100 pl-3">
                  <p className="text-sm text-ink-900">
                    <span className="font-medium">{entry.adminName}</span>
                    {" — "}
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </p>
                  {entry.reason && <p className="mt-0.5 text-sm text-ink-500">{entry.reason}</p>}
                  <p className="mt-0.5 text-xs text-ink-300">
                    {new Date(entry.createdAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {" at "}
                    {new Date(entry.createdAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function ActionTrigger({
  label,
  active,
  onClick,
  danger = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-md bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white"
          : danger
            ? "rounded-md border border-danger px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-red-50"
            : "rounded-md border border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:border-ink-300"
      }
    >
      {label}
    </button>
  );
}
