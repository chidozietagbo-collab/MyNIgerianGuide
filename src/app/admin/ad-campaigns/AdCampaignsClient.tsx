"use client";

import { useState } from "react";
import Link from "next/link";
import { Rocket, ImageOff, Settings2 } from "lucide-react";
import {
  getAllCampaignsForAdmin,
  approveCampaignCreative,
  rejectCampaignCreative,
  deleteCampaignAsAdmin,
} from "./ad-campaigns-admin-actions";

type AdminCampaign = Awaited<ReturnType<typeof getAllCampaignsForAdmin>>[number];

const CREATIVE_STATUS_STYLES: Record<string, string> = {
  NONE: "bg-ink-100 text-ink-500",
  PENDING: "bg-[#FFFBEB] text-[#B45309]",
  APPROVED: "bg-green-50 text-green-600",
  REJECTED: "bg-red-50 text-danger",
};

export default function AdCampaignsClient({
  initialCampaigns,
  canReviewCreative,
  canSetPricing,
  canDelete,
}: {
  initialCampaigns: AdminCampaign[];
  canReviewCreative: boolean;
  canSetPricing: boolean;
  canDelete: boolean;
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [filter, setFilter] = useState<"all" | "pending_review">("all");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  async function refresh(nextFilter: "all" | "pending_review") {
    setLoading(true);
    try {
      const data = await getAllCampaignsForAdmin(nextFilter === "all" ? undefined : nextFilter);
      setCampaigns(data);
      setFilter(nextFilter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load campaigns.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(campaign: AdminCampaign) {
    setPendingId(campaign.id);
    setError(null);
    try {
      const result = await approveCampaignCreative(campaign.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage(`Approved the ad for "${campaign.name}".`);
      await refresh(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't approve this ad.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleReject(campaign: AdminCampaign) {
    setPendingId(campaign.id);
    setError(null);
    try {
      const result = await rejectCampaignCreative(campaign.id, rejectReason);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage(`Rejected the ad for "${campaign.name}". The placement itself keeps running.`);
      setRejectingId(null);
      setRejectReason("");
      await refresh(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reject this ad.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(campaign: AdminCampaign) {
    setPendingId(campaign.id);
    setError(null);
    try {
      const result = await deleteCampaignAsAdmin(campaign.id, deleteReason);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage(`Removed "${campaign.name}" entirely.`);
      setDeletingId(null);
      setDeleteReason("");
      await refresh(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove this campaign.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Ad campaigns</h1>
          <p className="mt-1 text-sm text-ink-500">Review ad creative, manage pricing, and remove campaigns.</p>
        </div>
        {canSetPricing && (
          <Link
            href="/admin/ad-campaigns/pricing"
            className="flex items-center gap-1.5 rounded-md border border-ink-100 px-3 py-2 text-sm font-semibold text-ink-700 hover:border-ink-300"
          >
            <Settings2 className="h-4 w-4" />
            Pricing overrides
          </Link>
        )}
      </div>

      <div className="mt-6 flex gap-1 rounded-md bg-ink-50 p-1">
        <button
          type="button"
          onClick={() => refresh("all")}
          className={
            filter === "all"
              ? "flex-1 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-ink-900 shadow-sm"
              : "flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-ink-500"
          }
        >
          All campaigns
        </button>
        <button
          type="button"
          onClick={() => refresh("pending_review")}
          className={
            filter === "pending_review"
              ? "flex-1 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-ink-900 shadow-sm"
              : "flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-ink-500"
          }
        >
          Pending ad review
        </button>
      </div>

      {message && <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-600">{message}</p>}
      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
      {loading && <p className="mt-4 text-sm text-ink-300">Loading…</p>}

      <div className="mt-4 space-y-3">
        {!loading && campaigns.length === 0 && (
          <p className="rounded-lg border border-ink-100 bg-white p-6 text-center text-sm text-ink-500 shadow-sm">
            {filter === "pending_review" ? "Nothing waiting for review." : "No campaigns yet."}
          </p>
        )}

        {!loading &&
          campaigns.map((campaign) => (
            <div key={campaign.id} className="rounded-lg border border-ink-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {campaign.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={campaign.imageUrl} alt="" className="h-16 w-16 flex-shrink-0 rounded-md object-cover" />
                  ) : (
                    <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md bg-ink-50 text-ink-300">
                      <ImageOff className="h-5 w-5" />
                    </span>
                  )}
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                      <Rocket className="h-3.5 w-3.5 text-green-600" />
                      {campaign.name}
                    </p>
                    {campaign.caption && <p className="mt-0.5 text-sm text-ink-700">{campaign.caption}</p>}
                    <Link
                      href={`/b/${campaign.businessPage.slug}`}
                      target="_blank"
                      className="mt-0.5 block text-xs text-green-600 hover:underline"
                    >
                      {campaign.businessPage.name} →
                    </Link>
                    <p className="mt-1 text-xs text-ink-300">
                      {campaign.placementType === "TOP_OF_SEARCH" ? "Top of Search Results" : "Featured Badge"} ·{" "}
                      {new Date(campaign.startDate).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                      {" – "}
                      {new Date(campaign.endDate).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                  <span className="font-display text-sm font-bold text-ink-900">
                    ₦{campaign.totalPriceNaira.toLocaleString("en-NG")}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${CREATIVE_STATUS_STYLES[campaign.creativeApprovalStatus]}`}
                  >
                    {campaign.creativeApprovalStatus === "NONE" ? "No ad image" : campaign.creativeApprovalStatus}
                  </span>
                  {campaign.isExpired ? (
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-500">Ended</span>
                  ) : campaign.isPaused ? (
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-500">Paused</span>
                  ) : (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">Active</span>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-1 border-t border-ink-100 pt-3 text-sm text-ink-700">
                {campaign.targets.map((t) => (
                  <div key={t.id} className="flex items-center justify-between">
                    <span>
                      {t.keyword.name} · {t.localGovernment.name}
                    </span>
                    <span className="text-xs text-ink-300">
                      ₦{t.priceNaira.toLocaleString("en-NG")} · {t.impressionCount} views · {t.clickCount} clicks
                    </span>
                  </div>
                ))}
              </div>

              {campaign.creativeReviewedBy && campaign.creativeApprovalStatus !== "PENDING" && (
                <p className="mt-2 text-xs text-ink-300">
                  {campaign.creativeApprovalStatus === "APPROVED" ? "Approved" : "Rejected"} by{" "}
                  {campaign.creativeReviewedBy.name || campaign.creativeReviewedBy.email.split("@")[0]}
                  {campaign.creativeReviewNotes && ` — ${campaign.creativeReviewNotes}`}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {canReviewCreative && campaign.creativeApprovalStatus === "PENDING" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApprove(campaign)}
                      disabled={pendingId === campaign.id}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Approve ad
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectingId(rejectingId === campaign.id ? null : campaign.id)}
                      className="rounded-md border border-danger px-3 py-1.5 text-xs font-semibold text-danger hover:bg-red-50"
                    >
                      Reject ad
                    </button>
                  </>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setDeletingId(deletingId === campaign.id ? null : campaign.id)}
                    className="rounded-md border border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-ink-300"
                  >
                    Remove campaign
                  </button>
                )}
              </div>

              {rejectingId === campaign.id && (
                <div className="mt-3 space-y-2 rounded-md bg-red-50 p-3">
                  <p className="text-xs text-ink-700">
                    Rejecting the ad image doesn&apos;t stop the campaign — the paid placement keeps running, only
                    the image and caption are removed.
                  </p>
                  <textarea
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejecting this ad…"
                    className="w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleReject(campaign)}
                      disabled={pendingId === campaign.id}
                      className="rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Confirm rejection
                    </button>
                    <button type="button" onClick={() => setRejectingId(null)} className="text-xs text-ink-500">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {deletingId === campaign.id && (
                <div className="mt-3 space-y-2 rounded-md bg-red-50 p-3">
                  <p className="text-xs text-danger">
                    This permanently removes the entire campaign and all its targets — not just the ad image. No
                    refund. This can&apos;t be undone.
                  </p>
                  <textarea
                    rows={2}
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Reason for removing this campaign…"
                    className="w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(campaign)}
                      disabled={pendingId === campaign.id}
                      className="rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Yes, remove it
                    </button>
                    <button type="button" onClick={() => setDeletingId(null)} className="text-xs text-ink-500">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>
    </main>
  );
}
