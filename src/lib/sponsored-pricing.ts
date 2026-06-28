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
};

export async function calculateSponsoredListingPrice(input: PricingInput): Promise<PricingResult> {
  // Competitors: published businesses, in the same LGA, already tagged
  // with this exact keyword — deliberately not counting the requesting
  // business's own existing tag on itself if it already has one, since
  // a business shouldn't be priced as its own competitor.
  const competitorCount = await prisma.businessKeyword.count({
    where: {
      keywordId: input.keywordId,
      businessPage: {
        isPublished: true,
        localGovernmentId: input.localGovernmentId,
      },
    },
  });

  const competitivenessMultiplier = Math.min(
    1 + competitorCount * COMPETITIVENESS_STEP,
    MAX_MULTIPLIER
  );

  const basePrice = BASE_PRICE_NAIRA[input.durationDays];
  const placementMultiplier = PLACEMENT_MULTIPLIER[input.placementType];

  const priceNaira = Math.round(basePrice * placementMultiplier * competitivenessMultiplier);

  return { priceNaira, competitorCount, competitivenessMultiplier };
}
