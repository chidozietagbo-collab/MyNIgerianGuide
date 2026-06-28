import { prisma } from "@/lib/prisma";

// Pricing for sponsored listings (brief Section 16.5 / 22). "Initial
// pricing for Phase 1 sponsored listings — fixed fee or auction-based"
// was an explicitly open decision in the brief; this implements the
// founder's choice of competitiveness-based pricing rather than a flat
// fee, using the brief's own worked example (₦15,000 / 30 days / Top of
// Search) as the anchor for BASE_PRICES below.
//
// Competitiveness is computed LIVE by counting published businesses
// that already use the same keyword in the same city — not from
// Keyword.usageCount, which exists in the schema but is never actually
// incremented anywhere in the app (confirmed by checking every call
// site), so it would always read 0 and make every listing the same
// minimum price regardless of real competition.

export const DURATION_OPTIONS = [7, 14, 30] as const;
export type DurationDays = (typeof DURATION_OPTIONS)[number];

// Base price for the least competitive slot (no other businesses yet
// using this keyword in this city) at each duration. The 30-day price
// matches the brief's own example exactly; 7/14-day prices are scaled
// proportionally rather than invented separately, since no other figure
// was given to anchor them to.
const BASE_PRICE_NAIRA: Record<DurationDays, number> = {
  7: 5000,
  14: 9000,
  30: 15000,
};

// Featured Badge is a lighter-weight placement than Top of Search (badge
// on the business's own page vs. ranking boost across all searches for
// that keyword/city), priced lower accordingly.
const PLACEMENT_MULTIPLIER: Record<"TOP_OF_SEARCH" | "FEATURED_BADGE", number> = {
  TOP_OF_SEARCH: 1,
  FEATURED_BADGE: 0.6,
};

// Each existing competitor in the same keyword+city adds 15% to the
// price, capped at 2x the base — without a cap, an old established
// keyword/city combo could compound indefinitely as more businesses
// join, which would eventually price out the very competition that's
// supposed to justify the higher price in the first place.
const COMPETITIVENESS_STEP = 0.15;
const MAX_MULTIPLIER = 2;

export type PricingInput = {
  placementType: "TOP_OF_SEARCH" | "FEATURED_BADGE";
  durationDays: DurationDays;
  keywordId: string;
  localGovernmentId: string;
};

export type PricingResult = {
  priceNaira: number;
  competitorCount: number;
  competitivenessMultiplier: number;
  isAdminOverride: boolean;
};

// Admin price overrides (ad_price_overrides table) take precedence over
// the competitiveness formula entirely when one matches — per the
// founder's explicit decision: "keep my current competitiveness formula,
// but let admin override/adjust specific keyword or city prices when
// needed." Three specificity levels are checked in order, most specific
// first: exact keyword+LGA match, then keyword-only (applies across all
// cities for that keyword), then LGA-only (applies across all keywords
// in that city). fixedPriceNairaPer30Days is stored per-30-days and
// scaled to the requested duration, consistent with how the formula's
// own BASE_PRICE_NAIRA scales — an admin setting ₦20,000 for a keyword
// shouldn't mean ₦20,000 regardless of whether someone picks 7 or 30 days.
async function getAdminOverridePriceNaira(
  keywordId: string,
  localGovernmentId: string,
  durationDays: DurationDays
): Promise<number | null> {
  const exact = await prisma.$queryRaw<{ fixedPriceNairaPer30Days: number }[]>`
    SELECT "fixedPriceNairaPer30Days" FROM ad_price_overrides
    WHERE "keywordId" = ${keywordId} AND "localGovernmentId" = ${localGovernmentId}
    LIMIT 1
  `;
  if (exact[0]) return scaleToDays(exact[0].fixedPriceNairaPer30Days, durationDays);

  const keywordOnly = await prisma.$queryRaw<{ fixedPriceNairaPer30Days: number }[]>`
    SELECT "fixedPriceNairaPer30Days" FROM ad_price_overrides
    WHERE "keywordId" = ${keywordId} AND "localGovernmentId" IS NULL
    LIMIT 1
  `;
  if (keywordOnly[0]) return scaleToDays(keywordOnly[0].fixedPriceNairaPer30Days, durationDays);

  const lgaOnly = await prisma.$queryRaw<{ fixedPriceNairaPer30Days: number }[]>`
    SELECT "fixedPriceNairaPer30Days" FROM ad_price_overrides
    WHERE "localGovernmentId" = ${localGovernmentId} AND "keywordId" IS NULL
    LIMIT 1
  `;
  if (lgaOnly[0]) return scaleToDays(lgaOnly[0].fixedPriceNairaPer30Days, durationDays);

  return null;
}

function scaleToDays(priceFor30Days: number, durationDays: DurationDays): number {
  return Math.round((priceFor30Days / 30) * durationDays);
}

export async function calculateSponsoredListingPrice(input: PricingInput): Promise<PricingResult> {
  const overridePrice = await getAdminOverridePriceNaira(
    input.keywordId,
    input.localGovernmentId,
    input.durationDays
  );

  // Competitor count is still computed and returned even when an
  // override applies, since the UI shows "N other businesses boosting
  // this keyword" regardless of which pricing path produced the number
  // — that context is informative either way.
  const competitorCount = await prisma.businessKeyword.count({
    where: {
      keywordId: input.keywordId,
      businessPage: {
        isPublished: true,
        localGovernmentId: input.localGovernmentId,
      },
    },
  });

  if (overridePrice !== null) {
    return {
      priceNaira: overridePrice,
      competitorCount,
      competitivenessMultiplier: 1,
      isAdminOverride: true,
    };
  }

  const competitivenessMultiplier = Math.min(
    1 + competitorCount * COMPETITIVENESS_STEP,
    MAX_MULTIPLIER
  );

  const basePrice = BASE_PRICE_NAIRA[input.durationDays];
  const placementMultiplier = PLACEMENT_MULTIPLIER[input.placementType];

  const priceNaira = Math.round(basePrice * placementMultiplier * competitivenessMultiplier);

  return { priceNaira, competitorCount, competitivenessMultiplier, isAdminOverride: false };
}
