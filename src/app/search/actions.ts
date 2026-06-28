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
  // match against, since a TOP_OF_SEARCH listing is tied to one specific
  // keyword (see boost purchase flow) — without a keyword search, there's
  // no honest basis for deciding which sponsored listing, if any, is
  // relevant to pin above the rest.
  let sponsoredResults: SearchResult[] = [];
  if (trimmedKeyword) {
    const sponsoredListings = await prisma.sponsoredListing.findMany({
      where: {
        isActive: true,
        endDate: { gte: new Date() },
        placementType: "TOP_OF_SEARCH",
        keyword: { name: { contains: trimmedKeyword, mode: "insensitive" } },
        businessPage: {
          isPublished: true,
          ...(verifiedOnly ? { verificationStatus: "VERIFIED" } : {}),
          ...(trimmedLocation
            ? {
                OR: [
                  { state: { name: { contains: trimmedLocation, mode: "insensitive" } } },
                  { localGovernment: { name: { contains: trimmedLocation, mode: "insensitive" } } },
                  { town: { name: { contains: trimmedLocation, mode: "insensitive" } } },
                ],
              }
            : {}),
        },
      },
      orderBy: { priceNaira: "desc" },
      take: 3,
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
    });

    sponsoredResults = sponsoredListings.map(({ businessPage: b }) => ({
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
    }));
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
