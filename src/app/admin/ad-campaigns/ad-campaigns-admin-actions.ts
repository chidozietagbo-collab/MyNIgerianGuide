"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/components/require-permission";
import { logAdminAction } from "@/components/log-admin-action";
import { createNotification } from "@/components/create-notification";

// Returns a result object rather than throwing for business-logic
// errors (e.g. missing reason, campaign not found) — Next.js redacts
// thrown Server Action error messages to a generic placeholder in
// production builds, confirmed as a real, observed issue earlier in
// this project when the same pattern silently broke a user-facing error
// message. requirePermission() itself still throws, since an access
// denial is a security boundary, not something a legitimate admin needs
// a specific reason surfaced for.
type ActionResult = { success: true } | { success: false; error: string };

export async function getAllCampaignsForAdmin(filter?: "pending_review" | "all") {
  await requirePermission("ad.view");

  const campaigns = await prisma.adCampaign.findMany({
    where: filter === "pending_review" ? { creativeApprovalStatus: "PENDING" } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      placementType: true,
      imageUrl: true,
      caption: true,
      creativeApprovalStatus: true,
      creativeReviewNotes: true,
      creativeReviewedAt: true,
      creativeReviewedBy: { select: { name: true, email: true } },
      startDate: true,
      endDate: true,
      totalPriceNaira: true,
      isActive: true,
      isPaused: true,
      businessPage: { select: { id: true, name: true, slug: true, ownerUserId: true } },
      targets: {
        select: {
          id: true,
          priceNaira: true,
          impressionCount: true,
          clickCount: true,
          keyword: { select: { name: true } },
          localGovernment: { select: { name: true } },
        },
      },
    },
  });

  const now = new Date();
  return campaigns.map((c) => ({ ...c, isExpired: c.endDate < now }));
}

export async function approveCampaignCreative(campaignId: string): Promise<ActionResult> {
  const admin = await requirePermission("ad.review_creative");

  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    select: {
      name: true,
      creativeApprovalStatus: true,
      businessPage: { select: { id: true, ownerUserId: true, slug: true } },
    },
  });
  if (!campaign) {
    return { success: false, error: "Campaign not found." };
  }
  if (campaign.creativeApprovalStatus !== "PENDING") {
    return { success: false, error: "This campaign's creative isn't pending review." };
  }

  await prisma.adCampaign.update({
    where: { id: campaignId },
    data: {
      creativeApprovalStatus: "APPROVED",
      creativeReviewedById: admin.id,
      creativeReviewedAt: new Date(),
      creativeReviewNotes: null,
    },
  });

  await createNotification({
    userId: campaign.businessPage.ownerUserId,
    type: "AD_CAMPAIGN_CREATIVE_APPROVED",
    title: `Your ad for "${campaign.name}" has been approved`,
    body: "It's now live and showing to searchers.",
    entityType: "BUSINESS_PAGE",
    entityId: campaign.businessPage.id,
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: "ad.approve_creative",
    entityType: "AD_CAMPAIGN",
    entityId: campaignId,
    metadata: { campaignName: campaign.name },
  });

  revalidatePath("/admin/ad-campaigns");
  revalidatePath(`/b/${campaign.businessPage.slug}`);
  return { success: true };
}

export async function rejectCampaignCreative(campaignId: string, reason: string): Promise<ActionResult> {
  const admin = await requirePermission("ad.review_creative");

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    return { success: false, error: "Please provide a reason for rejecting this ad." };
  }

  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    select: {
      name: true,
      creativeApprovalStatus: true,
      businessPage: { select: { id: true, ownerUserId: true } },
    },
  });
  if (!campaign) {
    return { success: false, error: "Campaign not found." };
  }
  if (campaign.creativeApprovalStatus !== "PENDING") {
    return { success: false, error: "This campaign's creative isn't pending review." };
  }

  await prisma.adCampaign.update({
    where: { id: campaignId },
    data: {
      creativeApprovalStatus: "REJECTED",
      creativeReviewedById: admin.id,
      creativeReviewedAt: new Date(),
      creativeReviewNotes: trimmedReason,
    },
  });

  await createNotification({
    userId: campaign.businessPage.ownerUserId,
    type: "AD_CAMPAIGN_CREATIVE_REJECTED",
    title: `Your ad image for "${campaign.name}" wasn't approved`,
    body: trimmedReason,
    entityType: "BUSINESS_PAGE",
    entityId: campaign.businessPage.id,
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: "ad.reject_creative",
    entityType: "AD_CAMPAIGN",
    entityId: campaignId,
    reason: trimmedReason,
    metadata: { campaignName: campaign.name },
  });

  revalidatePath("/admin/ad-campaigns");
  return { success: true };
}

export async function deleteCampaignAsAdmin(campaignId: string, reason: string): Promise<ActionResult> {
  const admin = await requirePermission("ad.delete");

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    return { success: false, error: "Please provide a reason for removing this campaign." };
  }

  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    select: {
      name: true,
      businessPage: { select: { id: true, ownerUserId: true } },
    },
  });
  if (!campaign) {
    return { success: false, error: "Campaign not found." };
  }

  await prisma.adCampaign.delete({ where: { id: campaignId } });

  await createNotification({
    userId: campaign.businessPage.ownerUserId,
    type: "AD_CAMPAIGN_REMOVED_BY_ADMIN",
    title: `Your campaign "${campaign.name}" has been removed`,
    body: trimmedReason,
    entityType: "BUSINESS_PAGE",
    entityId: campaign.businessPage.id,
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: "ad.delete_campaign",
    entityType: "AD_CAMPAIGN",
    entityId: campaignId,
    reason: trimmedReason,
    metadata: { campaignName: campaign.name },
  });

  revalidatePath("/admin/ad-campaigns");
  return { success: true };
}

export async function getAdPriceOverrides() {
  await requirePermission("ad.set_pricing");

  return prisma.adPriceOverride.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fixedPriceNairaPer30Days: true,
      createdAt: true,
      keyword: { select: { id: true, name: true } },
      localGovernment: { select: { id: true, name: true, state: { select: { name: true } } } },
      setBy: { select: { name: true, email: true } },
    },
  });
}

export async function searchKeywordsForPricing(query: string) {
  await requirePermission("ad.set_pricing");
  const trimmed = query.trim();
  if (!trimmed) return [];

  return prisma.keyword.findMany({
    where: { status: "APPROVED", name: { contains: trimmed, mode: "insensitive" } },
    take: 10,
    select: { id: true, name: true, category: { select: { name: true } } },
  });
}

export async function searchLocalGovernmentsForPricing(query: string) {
  await requirePermission("ad.set_pricing");
  const trimmed = query.trim();
  if (!trimmed) return [];

  return prisma.localGovernment.findMany({
    where: { name: { contains: trimmed, mode: "insensitive" } },
    take: 10,
    select: { id: true, name: true, state: { select: { name: true } } },
  });
}

export async function setAdPriceOverride(
  keywordId: string | null,
  localGovernmentId: string | null,
  fixedPriceNairaPer30Days: number
): Promise<ActionResult> {
  const admin = await requirePermission("ad.set_pricing");

  if (!keywordId && !localGovernmentId) {
    return { success: false, error: "Select at least a keyword or a city to set a price for." };
  }
  if (!Number.isFinite(fixedPriceNairaPer30Days) || fixedPriceNairaPer30Days <= 0) {
    return { success: false, error: "Enter a valid price greater than zero." };
  }

  // Finds any existing override for this exact keyword/LGA combination
  // using ordinary Prisma where clauses, not raw SQL — a $executeRaw
  // COALESCE comparison with a possibly-null parameter risks a known
  // Prisma type-coercion issue on some versions (a null value with no
  // inferred Postgres type can fail to bind correctly), so this avoids
  // that entirely by using Prisma's own null-aware where matching.
  const existing = await prisma.adPriceOverride.findFirst({
    where: { keywordId, localGovernmentId },
    select: { id: true },
  });

  if (existing) {
    await prisma.adPriceOverride.update({
      where: { id: existing.id },
      data: { fixedPriceNairaPer30Days: Math.round(fixedPriceNairaPer30Days), setById: admin.id },
    });
  } else {
    await prisma.adPriceOverride.create({
      data: {
        keywordId,
        localGovernmentId,
        fixedPriceNairaPer30Days: Math.round(fixedPriceNairaPer30Days),
        setById: admin.id,
      },
    });
  }

  await logAdminAction({
    adminUserId: admin.id,
    action: "ad.set_price_override",
    entityType: "AD_PRICE_OVERRIDE",
    entityId: keywordId ?? localGovernmentId ?? "unknown",
    metadata: { keywordId, localGovernmentId, fixedPriceNairaPer30Days },
  });

  revalidatePath("/admin/ad-campaigns/pricing");
  return { success: true };
}

export async function removeAdPriceOverride(overrideId: string): Promise<ActionResult> {
  const admin = await requirePermission("ad.set_pricing");

  const override = await prisma.adPriceOverride.findUnique({
    where: { id: overrideId },
    select: { keywordId: true, localGovernmentId: true },
  });
  if (!override) {
    return { success: false, error: "Price override not found." };
  }

  await prisma.adPriceOverride.delete({ where: { id: overrideId } });

  await logAdminAction({
    adminUserId: admin.id,
    action: "ad.remove_price_override",
    entityType: "AD_PRICE_OVERRIDE",
    entityId: overrideId,
    metadata: override,
  });

  revalidatePath("/admin/ad-campaigns/pricing");
  return { success: true };
}
