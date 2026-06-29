"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { calculateSponsoredListingPrice, DURATION_OPTIONS, type DurationDays } from "@/lib/sponsored-pricing";
import { createNotification } from "@/components/create-notification";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

async function requireOwnership(businessPageId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const business = await prisma.businessPage.findUnique({
    where: { id: businessPageId },
    select: { ownerUserId: true, name: true, slug: true, isPublished: true, categoryId: true },
  });
  if (!business || business.ownerUserId !== user.id) {
    throw new Error("You don't own this business page.");
  }

  return { user, business };
}

// The business's own tagged keywords — shown as quick-pick defaults
// since they're the most likely targets, but per the founder's explicit
// feedback, a campaign is no longer limited to ONLY these. See
// searchKeywordsForCampaign below for targeting any approved keyword in
// the business's category.
export async function getBusinessKeywordsForCampaign(businessPageId: string) {
  await requireOwnership(businessPageId);

  const rows = await prisma.businessKeyword.findMany({
    where: { businessPageId },
    select: { keyword: { select: { id: true, name: true } } },
    orderBy: { keyword: { name: "asc" } },
  });
  return rows.map((r) => r.keyword);
}

// Lets a business target any approved keyword within its OWN category —
// not limited to what's already tagged on the page, per the founder's
// explicit feedback ("ideally they should be able to expand beyond
// those keywords"). Scoped to the business's own category rather than
// every keyword platform-wide, since a plumber buying visibility for
// "wedding photography" wouldn't make sense for anyone — reuses the
// same scoping reasoning as searchKeywordsForEdit in
// src/components/actions.ts, which already does the equivalent search
// during page setup.
export type KeywordSearchResult = {
  matches: { id: string; name: string }[];
  // Names only, not full keyword objects — these can't be selected as
  // a target (wrong category), they're shown purely to explain why the
  // search came up empty rather than implying "suggest it as new" is a
  // real option, which it isn't when the name already exists elsewhere.
  offCategoryMatchNames: string[];
};

export async function searchKeywordsForCampaign(
  businessPageId: string,
  query: string
): Promise<KeywordSearchResult> {
  const { business } = await requireOwnership(businessPageId);
  const trimmed = query.trim();
  if (!trimmed) return { matches: [], offCategoryMatchNames: [] };

  const [matches, offCategoryMatches] = await Promise.all([
    prisma.keyword.findMany({
      where: {
        status: "APPROVED",
        categoryId: business.categoryId,
        name: { contains: trimmed, mode: "insensitive" },
      },
      orderBy: { usageCount: "desc" },
      take: 10,
      select: { id: true, name: true },
    }),
    // Per the founder's explicit decision: keep targeting scoped to the
    // business's own category (so a school can't accidentally end up
    // targeting "Car Rental"), but be upfront when a search term exists
    // under a different category instead of silently finding nothing.
    prisma.keyword.findMany({
      where: {
        status: "APPROVED",
        categoryId: { not: business.categoryId },
        name: { contains: trimmed, mode: "insensitive" },
      },
      take: 5,
      select: { name: true, category: { select: { name: true } } },
    }),
  ]);

  return {
    matches,
    offCategoryMatchNames: offCategoryMatches.map((k) => `${k.name} (${k.category.name})`),
  };
}

// Targeting is Nigeria-wide per the founder's explicit decision (a
// business can advertise in cities it doesn't physically operate in),
// so this isn't scoped to the business's own state like the existing
// getLocalGovernmentsForEdit used during page setup.
export async function getAllStatesForCampaign() {
  return prisma.state.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

export async function getLocalGovernmentsForCampaign(stateId: string) {
  return prisma.localGovernment.findMany({
    where: { stateId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export type CampaignTargetInput = {
  keywordId: string;
  localGovernmentId: string;
};

// Prices every requested target individually and returns both the
// itemized breakdown and the sum — per the founder's explicit pricing
// decision (sum of keyword x city combinations, not one flat campaign
// price). Each target is genuinely priced independently since
// competitiveness (and any admin override) can differ per combination.
export async function getCampaignTargetsPricing(
  businessPageId: string,
  placementType: "TOP_OF_SEARCH" | "FEATURED_BADGE",
  durationDays: DurationDays,
  targets: CampaignTargetInput[]
) {
  await requireOwnership(businessPageId);

  if (targets.length === 0) {
    throw new Error("Select at least one keyword and city combination.");
  }
  if (!DURATION_OPTIONS.includes(durationDays)) {
    throw new Error("Invalid duration.");
  }

  const priced = await Promise.all(
    targets.map(async (t) => {
      const result = await calculateSponsoredListingPrice({
        placementType,
        durationDays,
        keywordId: t.keywordId,
        localGovernmentId: t.localGovernmentId,
      });
      return { ...t, ...result };
    })
  );

  const totalPriceNaira = priced.reduce((sum, p) => sum + p.priceNaira, 0);
  return { targets: priced, totalPriceNaira };
}

export async function getOwnedCampaigns(businessPageId: string) {
  await requireOwnership(businessPageId);

  const campaigns = await prisma.adCampaign.findMany({
    where: { businessPageId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      placementType: true,
      imageUrl: true,
      caption: true,
      creativeApprovalStatus: true,
      creativeReviewNotes: true,
      startDate: true,
      endDate: true,
      totalPriceNaira: true,
      isActive: true,
      isPaused: true,
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
  return campaigns.map((c) => ({
    ...c,
    isExpired: c.endDate < now,
  }));
}

export async function pauseCampaign(campaignId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    select: { businessPage: { select: { ownerUserId: true } } },
  });
  if (!campaign || campaign.businessPage.ownerUserId !== user.id) {
    throw new Error("You don't own this campaign.");
  }

  await prisma.adCampaign.update({ where: { id: campaignId }, data: { isPaused: true } });
}

export async function resumeCampaign(campaignId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    select: { businessPage: { select: { ownerUserId: true } }, endDate: true },
  });
  if (!campaign || campaign.businessPage.ownerUserId !== user.id) {
    throw new Error("You don't own this campaign.");
  }
  if (campaign.endDate < new Date()) {
    throw new Error("This campaign has already ended — start a new one instead of resuming.");
  }

  await prisma.adCampaign.update({ where: { id: campaignId }, data: { isPaused: false } });
}

// Permanently stops a campaign — distinct from pause, which is meant to
// be temporary and resumable. No refund for unused time: per the
// founder's original decision to deactivate-rather-than-delete admin
// records for audit purposes, and since no refund policy was specified
// here, the safer default is "no surprise charges or refunds" — the UI
// calling this must say so plainly before letting someone confirm.
export async function endCampaign(campaignId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    select: { businessPage: { select: { ownerUserId: true } } },
  });
  if (!campaign || campaign.businessPage.ownerUserId !== user.id) {
    throw new Error("You don't own this campaign.");
  }

  await prisma.adCampaign.update({
    where: { id: campaignId },
    data: { isActive: false, isPaused: false },
  });
}

// Initiates payment for a multi-target campaign. Nothing is written to
// AdCampaign/AdCampaignTarget here — those are only created once payment
// is confirmed (see confirmCampaignPayment), so an abandoned checkout
// never leaves a half-real campaign behind. The full target list and
// pricing travel through Paystack's metadata, same approach as the
// original single-target boost flow, now confirmed reliable as long as
// numeric values are explicitly converted back from strings on the way
// out (see confirmCampaignPayment).
export async function initiateCampaignPurchase(
  businessPageId: string,
  name: string,
  placementType: "TOP_OF_SEARCH" | "FEATURED_BADGE",
  durationDays: DurationDays,
  targets: CampaignTargetInput[],
  imageUrl: string | null,
  caption: string | null
) {
  const { user, business } = await requireOwnership(businessPageId);

  if (!business.isPublished) {
    throw new Error("Publish your business page before running a campaign.");
  }
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Give this campaign a name.");
  }

  const { targets: pricedTargets, totalPriceNaira } = await getCampaignTargetsPricing(
    businessPageId,
    placementType,
    durationDays,
    targets
  );

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Payments aren't configured yet. Set PAYSTACK_SECRET_KEY in your environment variables.");
  }

  const reference = `campaign_${businessPageId}_${Date.now()}`;

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      amount: totalPriceNaira * 100,
      reference,
      callback_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-n-igerian-guide.vercel.app"}/business/dashboard/${businessPageId}/campaigns/callback`,
      metadata: {
        businessPageId,
        name: trimmedName,
        placementType,
        durationDays,
        totalPriceNaira,
        imageUrl,
        caption,
        targets: pricedTargets.map((t) => ({
          keywordId: t.keywordId,
          localGovernmentId: t.localGovernmentId,
          priceNaira: t.priceNaira,
        })),
      },
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    throw new Error(data.message ?? "Couldn't start the payment. Please try again.");
  }

  return { authorizationUrl: data.data.authorization_url as string, reference: data.data.reference as string };
}

// Shared by both the callback route and (once added) the webhook route.
// Idempotent via AdCampaign.paystackReference's unique constraint, same
// pattern proven correct on the original single-target boost flow.
export async function confirmCampaignPayment(reference: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Payments aren't configured.");
  }

  const existingCampaign = await prisma.adCampaign.findUnique({
    where: { paystackReference: reference },
    select: { id: true },
  });
  if (existingCampaign) {
    return { success: true as const, campaignId: existingCampaign.id, alreadyProcessed: true };
  }

  const verifyResponse = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const verifyData = await verifyResponse.json();

  if (!verifyResponse.ok || !verifyData.status || verifyData.data?.status !== "success") {
    console.error("Paystack verify did not return success (campaign):", {
      reference,
      httpOk: verifyResponse.ok,
      apiStatus: verifyData.status,
      transactionStatus: verifyData.data?.status,
    });
    return { success: false as const, reason: "Payment was not successful." };
  }

  const rawMetadata = verifyData.data.metadata;
  if (!rawMetadata || typeof rawMetadata !== "object") {
    console.error("Paystack verify returned empty/non-object metadata (campaign):", {
      reference,
      metadataType: typeof rawMetadata,
    });
    return {
      success: false as const,
      reason: "Payment confirmed, but the campaign details were missing. Contact support with this reference: " + reference,
    };
  }

  // Confirmed via the original boost flow's debugging: Paystack returns
  // metadata values as STRINGS even when sent as real numbers/arrays at
  // initiation. Every numeric field and the targets array are explicitly
  // parsed here rather than trusted by type.
  const rawMeta = rawMetadata as Record<string, unknown>;
  const totalPriceNaira = Number(rawMeta.totalPriceNaira);
  const durationDays = Number(rawMeta.durationDays);
  const businessPageId = String(rawMeta.businessPageId ?? "");
  const name = String(rawMeta.name ?? "");
  const placementType = rawMeta.placementType as "TOP_OF_SEARCH" | "FEATURED_BADGE";
  const imageUrl = rawMeta.imageUrl ? String(rawMeta.imageUrl) : null;
  const caption = rawMeta.caption ? String(rawMeta.caption) : null;

  // Paystack's metadata round-trip can turn a nested array into a JSON
  // string in some cases (the same stringification behavior already
  // observed on plain numbers) — handle both a real array and a
  // stringified array defensively, rather than assuming one shape.
  let rawTargets: unknown = rawMeta.targets;
  if (typeof rawTargets === "string") {
    try {
      rawTargets = JSON.parse(rawTargets);
    } catch {
      rawTargets = [];
    }
  }
  const targets = Array.isArray(rawTargets)
    ? rawTargets.map((t) => {
        const tt = t as Record<string, unknown>;
        return {
          keywordId: String(tt.keywordId ?? ""),
          localGovernmentId: String(tt.localGovernmentId ?? ""),
          priceNaira: Number(tt.priceNaira),
        };
      })
    : [];

  if (
    !businessPageId ||
    !name ||
    !placementType ||
    !durationDays ||
    Number.isNaN(durationDays) ||
    Number.isNaN(totalPriceNaira) ||
    targets.length === 0 ||
    targets.some((t) => !t.keywordId || !t.localGovernmentId || Number.isNaN(t.priceNaira))
  ) {
    console.error("Campaign metadata failed validation after normalization:", {
      reference,
      businessPageId,
      name,
      placementType,
      durationDays,
      totalPriceNaira,
      targets,
    });
    return {
      success: false as const,
      reason: "Payment confirmed, but the campaign details were incomplete. Contact support with this reference: " + reference,
    };
  }

  const amountPaidNaira = verifyData.data.amount / 100;
  if (amountPaidNaira !== totalPriceNaira) {
    console.error("Amount mismatch on campaign payment:", { reference, amountPaidNaira, totalPriceNaira });
    return { success: false as const, reason: "Amount mismatch — payment not applied." };
  }

  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

  try {
    const campaign = await prisma.adCampaign.create({
      data: {
        businessPageId,
        name,
        placementType,
        imageUrl,
        caption,
        creativeApprovalStatus: imageUrl || caption ? "PENDING" : "NONE",
        startDate,
        endDate,
        totalPriceNaira,
        isActive: true,
        paystackReference: reference,
        targets: {
          create: targets.map((t) => ({
            keywordId: t.keywordId,
            localGovernmentId: t.localGovernmentId,
            priceNaira: t.priceNaira,
          })),
        },
      },
    });

    const business = await prisma.businessPage.findUnique({
      where: { id: businessPageId },
      select: { ownerUserId: true },
    });
    if (business) {
      await createNotification({
        userId: business.ownerUserId,
        type: imageUrl || caption ? "AD_CAMPAIGN_PENDING_REVIEW" : "AD_CAMPAIGN_ACTIVE",
        title:
          imageUrl || caption
            ? `Your campaign "${name}" is awaiting ad review`
            : `Your campaign "${name}" is now live`,
        body:
          imageUrl || caption
            ? "We'll review your ad image and caption before it goes live. This usually takes a short while."
            : `Running for ${durationDays} days across ${targets.length} target${targets.length === 1 ? "" : "s"}.`,
        entityType: "BUSINESS_PAGE",
        entityId: businessPageId,
      });
    }

    return { success: true as const, campaignId: campaign.id, alreadyProcessed: false };
  } catch (err) {
    const raceWinner = await prisma.adCampaign.findUnique({
      where: { paystackReference: reference },
      select: { id: true },
    });
    if (raceWinner) {
      return { success: true as const, campaignId: raceWinner.id, alreadyProcessed: true };
    }
    throw err;
  }
}
