"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { BadgeCheck, History, Search } from "lucide-react";
import {
  searchBusinessPages,
  getBusinessPageDetail,
  getBusinessPageAuditHistory,
  unpublishBusinessPage,
  republishBusinessPage,
  verifyBusinessPageOverride,
  revokeBusinessPageVerification,
  deleteBusinessPage,
} from "./business-page-management-actions";

const inputClass =
  "w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";
const textareaClass = inputClass;

type BusinessListItem = {
  id: string;
  name: string;
  slug: string;
  isPublished: boolean;
  verificationStatus: string;
  createdAt: string;
  owner: { id: string; name: string | null; email: string };
};

type BusinessDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  isPublished: boolean;
  isClaimed: boolean;
  verificationStatus: string;
  averageRating: number;
  completenessScore: number;
  createdAt: Date;
  owner: { id: string; name: string | null; email: string };
  category: { name: string };
  state: { name: string };
  localGovernment: { name: string };
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

type BusinessPageManagementClientProps = {
  initialPages: BusinessListItem[];
  canUnpublish: boolean;
  canVerify: boolean;
  canDelete: boolean;
};

const VERIFICATION_STYLES: Record<string, string> = {
  UNVERIFIED: "bg-ink-100 text-ink-300",
  PENDING: "bg-amber-50 text-amber-600",
  VERIFIED: "bg-green-50 text-green-600",
  REJECTED: "bg-red-50 text-danger",
  REVOKED: "bg-red-50 text-danger",
};

const PUBLISHED_STYLES: Record<string, string> = {
  true: "bg-green-50 text-green-600",
  false: "bg-ink-100 text-ink-900",
};

const ACTION_LABELS: Record<string, string> = {
  "business.unpublish": "Unpublished the page",
  "business.republish": "Republished the page",
  "business.verify_override": "Verified (manual override)",
  "business.verify_revoke": "Revoked verification",
  "business.delete": "Deleted the page",
};

export default function BusinessPageManagementClient({
  initialPages,
  canUnpublish,
  canVerify,
  canDelete,
}: BusinessPageManagementClientProps) {
  const [pages, setPages] = useState(initialPages);
  const [query, setQuery] = useState("");
  const [isSearching, startSearchTransition] = useTransition();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  function handleSearch(value: string) {
    setQuery(value);
    startSearchTransition(async () => {
      const results = await searchBusinessPages(value);
      setPages(
        results.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))
      );
    });
  }

  if (selectedPageId) {
    return (
      <BusinessPageDetailView
        businessPageId={selectedPageId}
        onBack={() => setSelectedPageId(null)}
        canUnpublish={canUnpublish}
        canVerify={canVerify}
        canDelete={canDelete}
      />
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-ink-900">Business page management</h1>
      <p className="mt-1 text-sm text-ink-500">Search for a business page by name.</p>

      <div className="relative mt-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
        <input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by business name…"
          className={`${inputClass} pl-9`}
        />
      </div>

      <div className="mt-4 space-y-2">
        {isSearching && <p className="text-sm text-ink-300">Searching…</p>}
        {!isSearching && pages.length === 0 && <p className="text-sm text-ink-300">No business pages found.</p>}
        {!isSearching &&
          pages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPageId(p.id)}
              className="flex w-full items-center justify-between rounded-lg border border-ink-100 bg-white p-4 text-left shadow-sm transition hover:border-green-500"
            >
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                  {p.name}
                  {p.verificationStatus === "VERIFIED" && <BadgeCheck className="h-3.5 w-3.5 text-green-600" />}
                </p>
                <p className="text-xs text-ink-500">{p.owner.name || p.owner.email.split("@")[0]}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PUBLISHED_STYLES[String(p.isPublished)]}`}>
                  {p.isPublished ? "Published" : "Unpublished"}
                </span>
              </div>
            </button>
          ))}
      </div>
    </main>
  );
}

function BusinessPageDetailView({
  businessPageId,
  onBack,
  canUnpublish,
  canVerify,
  canDelete,
}: {
  businessPageId: string;
  onBack: () => void;
  canUnpublish: boolean;
  canVerify: boolean;
  canDelete: boolean;
}) {
  const [detail, setDetail] = useState<BusinessDetail | null>(null);
  const [history, setHistory] = useState<AuditEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  async function loadDetail() {
    setLoading(true);
    try {
      const [data, auditHistory] = await Promise.all([
        getBusinessPageDetail(businessPageId),
        getBusinessPageAuditHistory(businessPageId),
      ]);
      setDetail(data);
      // null means the viewing admin doesn't hold admin.view_audit_log —
      // the history section simply won't render in that case, rather
      // than erroring the whole page.
      setHistory(auditHistory);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this business page.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessPageId]);

  function runAction(fn: () => Promise<void>, successMessage: string, options?: { thenDeleted?: boolean }) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await fn();
        setActiveAction(null);
        setReason("");
        if (options?.thenDeleted) {
          setDeleted(true);
          setMessage(successMessage);
        } else {
          setMessage(successMessage);
          await loadDetail();
        }
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

  if (deleted) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <button type="button" onClick={onBack} className="text-sm font-medium text-green-600 hover:underline">
          ← Back to search
        </button>
        <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-600">{message}</p>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <button type="button" onClick={onBack} className="text-sm font-medium text-green-600 hover:underline">
          ← Back to search
        </button>
        <p className="mt-4 text-sm text-danger">{error ?? "Business page not found."}</p>
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
            <p className="flex items-center gap-1.5 font-display text-lg font-bold text-ink-900">
              {detail.name}
              {detail.verificationStatus === "VERIFIED" && <BadgeCheck className="h-4 w-4 text-green-600" />}
            </p>
            <Link href={`/b/${detail.slug}`} target="_blank" className="text-sm text-green-600 hover:underline">
              View public page →
            </Link>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PUBLISHED_STYLES[String(detail.isPublished)]}`}>
              {detail.isPublished ? "Published" : "Unpublished"}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${VERIFICATION_STYLES[detail.verificationStatus] ?? ""}`}>
              {detail.verificationStatus}
            </span>
          </div>
        </div>

        <p className="mt-3 text-xs text-ink-300">
          {detail.category.name} · {detail.localGovernment.name}, {detail.state.name}
        </p>
        <p className="mt-1 text-xs text-ink-300">
          Joined {new Date(detail.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
          {" · "}
          {detail._count.posts} posts · {detail._count.reviews} reviews · {detail._count.follows} followers
          {" · "}
          {detail.averageRating.toFixed(1)}★ · {detail.completenessScore}% complete
        </p>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">Owner</p>
          <Link
            href={`/admin/users`}
            className="mt-1 flex items-center justify-between rounded-md bg-ink-50 px-3 py-2 text-sm text-ink-700 hover:text-green-600"
          >
            <span>{detail.owner.name || detail.owner.email.split("@")[0]}</span>
            <span className="text-xs text-ink-300">{detail.owner.email}</span>
          </Link>
        </div>

        {(detail.phone || detail.email || detail.website || detail.address) && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">Contact details</p>
            <div className="mt-1 space-y-0.5 text-sm text-ink-700">
              {detail.address && <p>{detail.address}</p>}
              {detail.phone && <p>{detail.phone}</p>}
              {detail.email && <p>{detail.email}</p>}
              {detail.website && <p>{detail.website}</p>}
            </div>
          </div>
        )}

        {message && <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-600">{message}</p>}
        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-4">
          {canUnpublish && detail.isPublished && (
            <ActionTrigger
              label="Unpublish"
              danger
              active={activeAction === "unpublish"}
              onClick={() => setActiveAction("unpublish")}
            />
          )}
          {canUnpublish && !detail.isPublished && (
            <ActionTrigger
              label="Republish"
              active={activeAction === "republish"}
              onClick={() => setActiveAction("republish")}
            />
          )}
          {canVerify && detail.verificationStatus !== "VERIFIED" && (
            <ActionTrigger
              label="Verify (override)"
              active={activeAction === "verify"}
              onClick={() => setActiveAction("verify")}
            />
          )}
          {canVerify && detail.verificationStatus === "VERIFIED" && (
            <ActionTrigger
              label="Revoke verification"
              danger
              active={activeAction === "revoke"}
              onClick={() => setActiveAction("revoke")}
            />
          )}
          {canDelete && (
            <ActionTrigger
              label="Delete page"
              danger
              active={activeAction === "delete"}
              onClick={() => setActiveAction("delete")}
            />
          )}
        </div>

        {activeAction === "unpublish" && (
          <div className="mt-3 space-y-2 rounded-md bg-ink-50 p-3">
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={textareaClass} placeholder="Reason for unpublishing this page…" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runAction(() => unpublishBusinessPage(businessPageId, reason), "Page unpublished.")}
                disabled={isPending}
                className="rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white"
              >
                Confirm unpublish
              </button>
              <button type="button" onClick={() => setActiveAction(null)} className="text-xs text-ink-500">
                Cancel
              </button>
            </div>
          </div>
        )}

        {activeAction === "republish" && (
          <div className="mt-3 space-y-2 rounded-md bg-ink-50 p-3">
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={textareaClass} placeholder="Reason for republishing this page…" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runAction(() => republishBusinessPage(businessPageId, reason), "Page republished.")}
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

        {activeAction === "verify" && (
          <div className="mt-3 space-y-2 rounded-md bg-ink-50 p-3">
            <p className="text-xs text-ink-500">
              This sets verification directly, outside the normal verification queue. Use this only for edge cases
              (e.g. verifying without a formal request on file).
            </p>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={textareaClass} placeholder="Reason for this manual verification…" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runAction(() => verifyBusinessPageOverride(businessPageId, reason), "Page verified.")}
                disabled={isPending}
                className="rounded-md bg-ink-700 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Confirm verification
              </button>
              <button type="button" onClick={() => setActiveAction(null)} className="text-xs text-ink-500">
                Cancel
              </button>
            </div>
          </div>
        )}

        {activeAction === "revoke" && (
          <div className="mt-3 space-y-2 rounded-md bg-ink-50 p-3">
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={textareaClass} placeholder="Reason for revoking verification…" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runAction(() => revokeBusinessPageVerification(businessPageId, reason), "Verification revoked.")}
                disabled={isPending}
                className="rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white"
              >
                Confirm revoke
              </button>
              <button type="button" onClick={() => setActiveAction(null)} className="text-xs text-ink-500">
                Cancel
              </button>
            </div>
          </div>
        )}

        {activeAction === "delete" && (
          <div className="mt-3 space-y-2 rounded-md bg-ink-50 p-3">
            <p className="text-xs text-danger">
              This permanently deletes the page and everything on it — posts, reviews, photos, follows. This cannot
              be undone.
            </p>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={textareaClass} placeholder="Reason for this deletion…" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  runAction(
                    () => deleteBusinessPage(businessPageId, reason),
                    "Business page deleted.",
                    { thenDeleted: true }
                  )
                }
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

      {/* History — only renders for admins holding admin.view_audit_log;
          getBusinessPageAuditHistory returns null for everyone else, so
          this section simply doesn't appear for an admin who can manage
          the page but shouldn't see the full audit trail. */}
      {history && (
        <div className="mt-4 rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-ink-300" />
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">
              Page history
            </h2>
          </div>

          {history.length === 0 ? (
            <p className="mt-2 text-sm text-ink-300">No admin actions on record for this page.</p>
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
