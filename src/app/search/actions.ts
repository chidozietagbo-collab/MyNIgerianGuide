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
};

type SearchParams = {
  keyword?: string;
  location?: string;
  verifiedOnly?: boolean;
};

// Per brief Section 8.2: verified businesses rank above unverified, higher
// rating ranks above lower within each tier. Sponsored listings are meant to
// be injected separately at the top — sponsored_listings has zero rows today
// (Milestone 6 territory), so that step is a no-op for now but the shape of
// this function leaves room for it later without a rewrite.
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

  return results.map((b) => ({
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
  }));
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
