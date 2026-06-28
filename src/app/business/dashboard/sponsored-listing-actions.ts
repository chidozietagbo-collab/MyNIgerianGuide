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
    select: {
      ownerUserId: true,
      name: true,
      slug: true,
      localGovernmentId: true,
      isPublished: true,
    },
  });
  if (!business || business.ownerUserId !== user.id) {
    throw new Error("You don't own this business page.");
  }

  return { user, business };
}

// The brief's purchase flow has the owner "select a keyword" — these are
// the keywords already tagged on THIS business, not a fresh search,
// since boosting only makes sense for a service the business already
// advertises (brief 16.5, step 3: "Selects keyword: Plumbers").
export async function getBusinessKeywordsForBoost(businessPageId: string) {
  await requireOwnership(businessPageId);

  const rows = await prisma.businessKeyword.findMany({
    where: { businessPageId },
    select: { keyword: { select: { id: true, name: true } } },
    orderBy: { keyword: { name: "asc" } },
  });

  return rows.map((r) => r.keyword);
}

export async function getActiveSponsoredListing(businessPageId: string) {
  await requireOwnership(businessPageId);

  return prisma.sponsoredListing.findFirst({
    where: { businessPageId, isActive: true, endDate: { gte: new Date() } },
    orderBy: { endDate: "desc" },
    select: {
      id: true,
      placementType: true,
      city: true,
      startDate: true,
      endDate: true,
      priceNaira: true,
      keyword: { select: { name: true } },
    },
  });
}

export async function getSponsoredListingPrice(
  businessPageId: string,
  placementType: "TOP_OF_SEARCH" | "FEATURED_BADGE",
  durationDays: DurationDays,
  keywordId: string
) {
  const { business } = await requireOwnership(businessPageId);

  if (!DURATION_OPTIONS.includes(durationDays)) {
    throw new Error("Invalid duration.");
  }

  return calculateSponsoredListingPrice({
    placementType,
    durationDays,
    keywordId,
    localGovernmentId: business.localGovernmentId,
  });
}

// Initializes the Paystack transaction and returns the checkout URL to
// redirect the browser to. Nothing is written to SponsoredListing here —
// the row is only created once payment is actually confirmed (see
// confirmSponsoredListingPayment below), so an abandoned checkout never
// leaves a half-real listing behind.
export async function initiateSponsoredListingPurchase(
  businessPageId: string,
  placementType: "TOP_OF_SEARCH" | "FEATURED_BADGE",
  durationDays: DurationDays,
  keywordId: string
) {
  const { user, business } = await requireOwnership(businessPageId);

  if (!business.isPublished) {
    throw new Error("Publish your business page before boosting it.");
  }

  const keyword = await prisma.keyword.findUnique({
    where: { id: keywordId },
    select: { id: true, name: true, categoryId: true },
  });
  if (!keyword) {
    throw new Error("Keyword not found.");
  }

  const localGovernment = await prisma.localGovernment.findUnique({
    where: { id: business.localGovernmentId },
    select: { name: true },
  });
  if (!localGovernment) {
    throw new Error("Business location not found.");
  }

  const { priceNaira } = await calculateSponsoredListingPrice({
    placementType,
    durationDays,
    keywordId,
    localGovernmentId: business.localGovernmentId,
  });

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Payments aren't configured yet. Set PAYSTACK_SECRET_KEY in your environment variables.");
  }

  // Paystack amounts are in kobo (₦1 = 100 kobo) — see initiate request
  // below. metadata carries everything confirmSponsoredListingPayment
  // needs to actually create the listing once payment is verified,
  // since nothing is written to our own database until that point.
  const reference = `sponsored_${businessPageId}_${Date.now()}`;

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      amount: priceNaira * 100,
      reference,
      callback_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-n-igerian-guide.vercel.app"}/business/dashboard/${businessPageId}/boost/callback`,
      metadata: {
        businessPageId,
        placementType,
        durationDays,
        keywordId,
        keywordName: keyword.name,
        localGovernmentName: localGovernment.name,
        priceNaira,
      },
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    throw new Error(data.message ?? "Couldn't start the payment. Please try again.");
  }

  return { authorizationUrl: data.data.authorization_url as string, reference: data.data.reference as string };
}

// Shared by both the callback route (immediate, best-effort) and the
// webhook route (reliable, eventual) — see brief on why both paths
// exist: the callback can be missed if the customer's connection drops,
// the webhook is Paystack's own recommended source of truth. Both call
// this same function, and it's safe to call more than once for the same
// reference (idempotent via the SponsoredListing existence check),
// since Paystack may legitimately deliver the same webhook more than
// once on retry.
export async function confirmSponsoredListingPayment(reference: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Payments aren't configured.");
  }

  // Real idempotency: SponsoredListing.paystackReference is unique at
  // the database level. The callback route and the webhook route both
  // call this same function for the same reference — whichever runs
  // first creates the row, the other sees it already exists and returns
  // the existing listing instead of attempting a second insert.
  const existingListing = await prisma.sponsoredListing.findUnique({
    where: { paystackReference: reference },
    select: { id: true },
  });
  if (existingListing) {
    return { success: true as const, listingId: existingListing.id, alreadyProcessed: true };
  }

  const verifyResponse = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const verifyData = await verifyResponse.json();

  // Temporary full-response logging — every previous attempt to narrow
  // this down from partial log lines failed to actually explain the
  // mismatch between what Paystack's dashboard showed (Success, correct
  // amount) and what this function concluded. Logging the entire raw
  // response removes all guesswork for the next test attempt.
  console.error("FULL Paystack verify response:", JSON.stringify(verifyData));

  if (!verifyResponse.ok || !verifyData.status || verifyData.data?.status !== "success") {
    console.error("Paystack verify did not return success:", {
      reference,
      httpOk: verifyResponse.ok,
      apiStatus: verifyData.status,
      transactionStatus: verifyData.data?.status,
    });
    return { success: false as const, reason: "Payment was not successful." };
  }

  // Paystack's own documentation shows verify can legitimately return
  // metadata as an empty string ("") rather than an object — this is
  // documented, real behavior, not an edge case. A bare type assertion
  // here (`as {...}`) would silently let metadata.priceNaira become
  // undefined in that case, which made every payment fail the amount
  // check below with a misleading "Amount mismatch" message even though
  // the payment itself was genuinely successful and for the right
  // amount — confirmed by checking the actual Paystack dashboard
  // transaction record. Validating explicitly here instead of trusting
  // the cast.
  const rawMetadata = verifyData.data.metadata;
  if (!rawMetadata || typeof rawMetadata !== "object") {
    console.error("Paystack verify returned empty/non-object metadata:", {
      reference,
      metadataType: typeof rawMetadata,
      metadataValue: rawMetadata,
    });
    return {
      success: false as const,
      reason: "Payment confirmed, but the listing details were missing. Contact support with this reference: " + reference,
    };
  }

  const metadata = rawMetadata as {
    businessPageId: string;
    placementType: "TOP_OF_SEARCH" | "FEATURED_BADGE";
    durationDays: number;
    keywordId: string;
    keywordName: string;
    localGovernmentName: string;
    priceNaira: number;
  };

  if (
    !metadata.businessPageId ||
    !metadata.placementType ||
    !metadata.durationDays ||
    !metadata.keywordId ||
    typeof metadata.priceNaira !== "number"
  ) {
    return {
      success: false as const,
      reason: "Payment confirmed, but the listing details were incomplete. Contact support with this reference: " + reference,
    };
  }

  // Always re-derive the amount check from what Paystack confirms was
  // actually charged, compared against metadata.priceNaira that WE set
  // at initiation time — this catches any tampering with the amount
  // between initiation and payment, since metadata itself round-trips
  // through Paystack unmodified but the actual charged amount is the
  // one fact that matters for fraud prevention.
  const amountPaidNaira = verifyData.data.amount / 100;
  if (amountPaidNaira !== metadata.priceNaira) {
    console.error("Amount mismatch on sponsored listing payment:", {
      reference,
      amountPaidNaira,
      expectedPriceNaira: metadata.priceNaira,
    });
    return { success: false as const, reason: "Amount mismatch — payment not applied." };
  }

  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + metadata.durationDays * 24 * 60 * 60 * 1000);

  // If the callback route and the webhook route both reach this exact
  // point at nearly the same instant (a real possibility — Paystack
  // documents webhooks firing within seconds of the charge), the
  // database's own unique constraint on paystackReference is the final
  // guard: whichever insert loses the race gets a unique-constraint
  // error here, which is caught and treated as "already processed"
  // rather than as a real failure.
  try {
    const listing = await prisma.sponsoredListing.create({
      data: {
        businessPageId: metadata.businessPageId,
        placementType: metadata.placementType,
        keywordId: metadata.keywordId,
        city: metadata.localGovernmentName,
        startDate,
        endDate,
        priceNaira: metadata.priceNaira,
        isActive: true,
        paystackReference: reference,
      },
    });

    const business = await prisma.businessPage.findUnique({
      where: { id: metadata.businessPageId },
      select: { ownerUserId: true, name: true },
    });
    if (business) {
      await createNotification({
        userId: business.ownerUserId,
        type: "SPONSORED_LISTING_ACTIVE",
        title: `Your sponsored listing for "${metadata.keywordName}" is now live`,
        body: `Boosted for ${metadata.durationDays} days. It'll run until ${endDate.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}.`,
        entityType: "BUSINESS_PAGE",
        entityId: metadata.businessPageId,
      });
    }

    return { success: true as const, listingId: listing.id, alreadyProcessed: false };
  } catch (err) {
    // Unique constraint violation on paystackReference means the other
    // path (webhook or callback) won the race and already created this
    // listing — fetch and return it rather than treating this as an error.
    const raceWinner = await prisma.sponsoredListing.findUnique({
      where: { paystackReference: reference },
      select: { id: true },
    });
    if (raceWinner) {
      return { success: true as const, listingId: raceWinner.id, alreadyProcessed: true };
    }
    throw err;
  }
}
