"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type SearchResult = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  verificationStatus: string;
  averageRating: number;
  categoryName: string;
  stateName: string;
  lgaName: string;
  townName: string | null;
  keywordNames: string[];
  isSponsored: boolean;
  // Only set for sponsored results — the specific AdCampaignTarget that
  // earned this result its placement, so a click can be attributed to
  // the right keyword+city combination in the campaign owner's
  // performance view, not just "this business got a click somewhere."
  sponsoredTargetId?: string;
};

type SearchParams = {
  keyword?: string;
  location?: string;
  verifiedOnly?: boolean;
};

// Per brief Section 8.2: verified businesses rank above unverified, higher
// rating ranks above lower within each tier. Sponsored listings (brief
// 16.5/22) are pinned above all of that, but only when they actually
// match what's being searched — a TOP_OF_SEARCH listing was purchased
// for a specific keyword and city, so it only surfaces for searches that
// genuinely match both, not for every search indiscriminately.
export async function searchBusinesses({
  keyword,
  location,
  verifiedOnly,
}: SearchParams): Promise<SearchResult[]> {
  const trimmedKeyword = keyword?.trim();
  const trimmedLocation = location?.trim();

  const where: Prisma.BusinessPageWhereInput = {
    isPublished: true,
  };

  if (verifiedOnly) {
    where.verificationStatus = "VERIFIED";
  }

  // A single search box should find a business either by what it's
  // CALLED (its name) or by what it OFFERS (a tagged keyword/service) —
  // previously this only checked keywords, so searching a real business
  // name like "NewVic Sixth Form College" returned nothing even though
  // the business genuinely exists. AND-ing this with the location OR
  // below (rather than merging into one big OR) keeps "plumbing in Lagos"
  // behaving correctly: both conditions must hold, even though each one
  // internally is an "either/or" match.
  if (trimmedKeyword) {
    where.OR = [
      { name: { contains: trimmedKeyword, mode: "insensitive" } },
      { businessKeywords: { some: { keyword: { name: { contains: trimmedKeyword, mode: "insensitive" } } } } },
    ];
  }

  if (trimmedLocation) {
    const locationFilter: Prisma.BusinessPageWhereInput = {
      OR: [
        { state: { name: { contains: trimmedLocation, mode: "insensitive" } } },
        { localGovernment: { name: { contains: trimmedLocation, mode: "insensitive" } } },
        { town: { name: { contains: trimmedLocation, mode: "insensitive" } } },
      ],
    };
    // If a keyword search is also active, AND the two together via
    // Prisma's implicit top-level AND (every key on `where` is ANDed).
    // Putting the location OR under its own key (rather than overwriting
    // where.OR from the keyword block above) means both conditions apply
    // at once.
    where.AND = [locationFilter];
  }

  // Sponsored results: only fetched when there's an actual keyword to
  // match against, since a TOP_OF_SEARCH target is tied to one specific
  // keyword+city pair — without a keyword search, there's no honest
  // basis for deciding which target, if any, is relevant to pin above
  // the rest.
  //
  // Queries AdCampaignTarget (the multi-target campaign model), not the
  // superseded SponsoredListing table — new campaigns never write there.
  // Matching is against the TARGET's own keyword+LGA, which can be any
  // city in Nigeria (founder's explicit decision to allow targeting
  // outside a business's own location), not the business's address like
  // the original single-target model used.
  let sponsoredResults: SearchResult[] = [];
  if (trimmedKeyword) {
    const now = new Date();
    const campaignTargets = await prisma.adCampaignTarget.findMany({
      where: {
        keyword: { name: { contains: trimmedKeyword, mode: "insensitive" } },
        campaign: {
          isActive: true,
          isPaused: false,
          endDate: { gte: now },
          placementType: "TOP_OF_SEARCH",
          // A campaign with creative must be APPROVED to show; a
          // campaign with no creative at all (NONE) never needed review
          // and shows as soon as it's active.
          creativeApprovalStatus: { in: ["NONE", "APPROVED"] },
          businessPage: {
            isPublished: true,
            ...(verifiedOnly ? { verificationStatus: "VERIFIED" } : {}),
          },
        },
        ...(trimmedLocation
          ? { localGovernment: { name: { contains: trimmedLocation, mode: "insensitive" } } }
          : {}),
      },
      orderBy: { priceNaira: "desc" },
      take: 3,
      select: {
        id: true,
        campaign: {
          select: {
            businessPage: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                verificationStatus: true,
                averageRating: true,
                category: { select: { name: true } },
                state: { select: { name: true } },
                localGovernment: { select: { name: true } },
                town: { select: { name: true } },
                businessKeywords: { select: { keyword: { select: { name: true } } }, take: 5 },
              },
            },
          },
        },
      },
    });

    sponsoredResults = campaignTargets.map(({ id: targetId, campaign: { businessPage: b } }) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      description: b.description,
      verificationStatus: b.verificationStatus,
      averageRating: b.averageRating,
      categoryName: b.category.name,
      stateName: b.state.name,
      lgaName: b.localGovernment.name,
      townName: b.town?.name ?? null,
      keywordNames: b.businessKeywords.map((bk) => bk.keyword.name),
      isSponsored: true,
      sponsoredTargetId: targetId,
    }));

    // Impression tracking — each target actually shown to a searcher
    // counts as one impression, surfaced in the campaign owner's
    // performance view. Not awaited: a searcher shouldn't wait on an
    // analytics write to see results, same tradeoff already made for
    // page-view tracking elsewhere in this app (after() isn't available
    // in this Next.js version, confirmed earlier when that exact mistake
    // broke a deployment).
    if (campaignTargets.length > 0) {
      prisma.adCampaignTarget
        .updateMany({
          where: { id: { in: campaignTargets.map((t) => t.id) } },
          data: { impressionCount: { increment: 1 } },
        })
        .catch((err) => console.error("Failed to record ad impression:", err));
    }
  }

  const sponsoredIds = new Set(sponsoredResults.map((r) => r.id));

  const results = await prisma.businessPage.findMany({
    where,
    orderBy: [{ verificationStatus: "desc" }, { averageRating: "desc" }],
    take: 30,
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      verificationStatus: true,
      averageRating: true,
      category: { select: { name: true } },
      state: { select: { name: true } },
      localGovernment: { select: { name: true } },
      town: { select: { name: true } },
      businessKeywords: { select: { keyword: { select: { name: true } } }, take: 5 },
    },
  });

  const regularResults = results
    // A sponsored business already appears in the pinned section above —
    // showing it again further down would be confusing duplication, not
    // a second, separate result.
    .filter((b) => !sponsoredIds.has(b.id))
    .map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      description: b.description,
      verificationStatus: b.verificationStatus,
      averageRating: b.averageRating,
      categoryName: b.category.name,
      stateName: b.state.name,
      lgaName: b.localGovernment.name,
      townName: b.town?.name ?? null,
      keywordNames: b.businessKeywords.map((bk) => bk.keyword.name),
      isSponsored: false,
    }));

  return [...sponsoredResults, ...regularResults];
}

// ---------------------------------------------------------------------------
// Quick suggestions for "as you type" dropdowns (homepage hero + search
// page). Deliberately small and fast: business name match only, top 5,
// just enough to show "here's a real business matching what you typed"
// before the person even hits Search.
// ---------------------------------------------------------------------------
export type BusinessSuggestion = {
  id: string;
  name: string;
  slug: string;
  stateName: string;
};

export async function suggestBusinesses(query: string): Promise<BusinessSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const results = await prisma.businessPage.findMany({
    where: {
      isPublished: true,
      name: { contains: trimmed, mode: "insensitive" },
    },
    orderBy: [{ verificationStatus: "desc" }, { averageRating: "desc" }],
    take: 5,
    select: {
      id: true,
      name: true,
      slug: true,
      state: { select: { name: true } },
    },
  });

  return results.map((b) => ({ id: b.id, name: b.name, slug: b.slug, stateName: b.state.name }));
}

// Called from the search results page when a sponsored result is
// clicked, so the campaign owner's performance view shows real
// click-through numbers per target, not just impressions. Deliberately
// not awaited by the caller (fire-and-forget) — a click shouldn't be
// delayed by an analytics write, same tradeoff as impression tracking
// above. No ownership check needed here: anyone clicking a publicly
// visible sponsored result is legitimate, there's nothing to protect
// against the way there is for the owner-only campaign actions.
export async function recordAdClick(targetId: string) {
  try {
    await prisma.adCampaignTarget.update({
      where: { id: targetId },
      data: { clickCount: { increment: 1 } },
    });
  } catch (err) {
    console.error("Failed to record ad click:", err);
  }
}
