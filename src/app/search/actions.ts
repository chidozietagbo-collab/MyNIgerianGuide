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

  if (trimmedKeyword) {
    where.businessKeywords = {
      some: {
        keyword: { name: { contains: trimmedKeyword, mode: "insensitive" } },
      },
    };
  }

  if (trimmedLocation) {
    where.OR = [
      { state: { name: { contains: trimmedLocation, mode: "insensitive" } } },
      { localGovernment: { name: { contains: trimmedLocation, mode: "insensitive" } } },
      { town: { name: { contains: trimmedLocation, mode: "insensitive" } } },
    ];
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
