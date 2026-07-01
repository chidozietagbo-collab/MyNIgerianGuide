"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/components/require-permission";

const TRENDING_WINDOW_DAYS = 30;

function trendingWindowStart() {
  const d = new Date();
  d.setDate(d.getDate() - TRENDING_WINDOW_DAYS);
  return d;
}

export type KeywordPricingRow = {
  keywordId: string;
  keywordName: string;
  categoryName: string;
  lgaId: string;
  lgaName: string;
  stateName: string;
  searchCount: number;
  competitorCount: number;
  formulaPriceNaira: number;
  overridePriceNaira: number | null;
  effectivePriceNaira: number;
};

export async function getTopKeywordLocationSignals(limit = 50): Promise<KeywordPricingRow[]> {
  await requirePermission("ad.view");

  const windowStart = trendingWindowStart();
  const BASE_PRICE_30 = 15000;
  const COMP_STEP = 0.15;
  const MAX_MULT = 2;

  const searchCounts = await prisma.$queryRaw<
    { keywordId: string; lgaId: string; count: bigint }[]
  >`
    SELECT "keywordId", "localGovernmentId" as "lgaId", COUNT(*) as count
    FROM keyword_search_events
    WHERE "searchedAt" >= ${windowStart}
      AND "keywordId" IS NOT NULL
      AND "localGovernmentId" IS NOT NULL
    GROUP BY "keywordId", "localGovernmentId"
    ORDER BY count DESC
    LIMIT ${limit}
  `;

  const competitorCounts = await prisma.$queryRaw<
    { keywordId: string; lgaId: string; count: bigint }[]
  >`
    SELECT act."keywordId", act."localGovernmentId" as "lgaId", COUNT(*) as count
    FROM ad_campaign_targets act
    JOIN ad_campaigns ac ON ac.id = act."campaignId"
    WHERE ac."isActive" = true AND ac."isPaused" = false AND ac."endDate" >= NOW()
    GROUP BY act."keywordId", act."localGovernmentId"
  `;

  const combinationKeys = new Map<string, { keywordId: string; lgaId: string }>();
  for (const r of searchCounts) {
    combinationKeys.set(`${r.keywordId}::${r.lgaId}`, { keywordId: r.keywordId, lgaId: r.lgaId });
  }
  for (const r of competitorCounts) {
    combinationKeys.set(`${r.keywordId}::${r.lgaId}`, { keywordId: r.keywordId, lgaId: r.lgaId });
  }

  if (combinationKeys.size === 0) return [];

  const keywordIds = Array.from(new Set([...combinationKeys.values()].map((c) => c.keywordId)));
  const lgaIds = Array.from(new Set([...combinationKeys.values()].map((c) => c.lgaId)));

  const [keywords, lgas, overrides] = await Promise.all([
    prisma.keyword.findMany({
      where: { id: { in: keywordIds } },
      select: { id: true, name: true, category: { select: { name: true } } },
    }),
    prisma.localGovernment.findMany({
      where: { id: { in: lgaIds } },
      select: { id: true, name: true, state: { select: { name: true } } },
    }),
    prisma.adPriceOverride.findMany({
      where: {
        OR: [
          { keywordId: { in: keywordIds }, localGovernmentId: null },
          { localGovernmentId: { in: lgaIds }, keywordId: null },
          { keywordId: { in: keywordIds }, localGovernmentId: { in: lgaIds } },
        ],
      },
      select: { keywordId: true, localGovernmentId: true, fixedPriceNairaPer30Days: true },
    }),
  ]);

  const kwMap = new Map(keywords.map((k) => [k.id, k]));
  const lgaMap = new Map(lgas.map((l) => [l.id, l]));
  const searchMap = new Map(searchCounts.map((r) => [`${r.keywordId}::${r.lgaId}`, Number(r.count)]));
  const compMap = new Map(competitorCounts.map((r) => [`${r.keywordId}::${r.lgaId}`, Number(r.count)]));

  const rows: KeywordPricingRow[] = [];
  for (const { keywordId, lgaId } of combinationKeys.values()) {
    const kw = kwMap.get(keywordId);
    const lga = lgaMap.get(lgaId);
    if (!kw || !lga) continue;

    const competitorCount = compMap.get(`${keywordId}::${lgaId}`) ?? 0;
    const searchCount = searchMap.get(`${keywordId}::${lgaId}`) ?? 0;

    const exactOverride = overrides.find((o) => o.keywordId === keywordId && o.localGovernmentId === lgaId);
    const kwOnlyOverride = overrides.find((o) => o.keywordId === keywordId && o.localGovernmentId === null);
    const lgaOnlyOverride = overrides.find((o) => o.localGovernmentId === lgaId && o.keywordId === null);
    const override = exactOverride ?? kwOnlyOverride ?? lgaOnlyOverride;

    const mult = Math.min(1 + competitorCount * COMP_STEP, MAX_MULT);
    const formulaPrice = Math.round(BASE_PRICE_30 * mult);
    const overridePrice = override?.fixedPriceNairaPer30Days ?? null;

    rows.push({
      keywordId,
      keywordName: kw.name,
      categoryName: kw.category.name,
      lgaId,
      lgaName: lga.name,
      stateName: lga.state.name,
      searchCount,
      competitorCount,
      formulaPriceNaira: formulaPrice,
      overridePriceNaira: overridePrice,
      effectivePriceNaira: overridePrice ?? formulaPrice,
    });
  }

  return rows.sort((a, b) => (b.searchCount + b.competitorCount) - (a.searchCount + a.competitorCount));
}

export type KeywordLocationSignal = {
  lgaId: string;
  lgaName: string;
  stateName: string;
  searchCount: number;
  competitorCount: number;
  formulaPriceNaira: number;
  overridePriceNaira: number | null;
  effectivePriceNaira: number;
};

// No permission guard — this is public demand info shown to business
// owners choosing which cities to target. Returns how a specific keyword
// is performing across all LGAs that have either searches or active
// campaigns for it, sorted by combined demand signal.
export async function getKeywordLocationSignals(keywordId: string): Promise<KeywordLocationSignal[]> {
  const windowStart = trendingWindowStart();
  const BASE_PRICE_30 = 15000;
  const COMP_STEP = 0.15;
  const MAX_MULT = 2;

  const [searchCounts, competitorCounts] = await Promise.all([
    prisma.$queryRaw<{ lgaId: string; count: bigint }[]>`
      SELECT "localGovernmentId" as "lgaId", COUNT(*) as count
      FROM keyword_search_events
      WHERE "keywordId" = ${keywordId}
        AND "localGovernmentId" IS NOT NULL
        AND "searchedAt" >= ${windowStart}
      GROUP BY "localGovernmentId"
      ORDER BY count DESC
      LIMIT 20
    `,
    prisma.$queryRaw<{ lgaId: string; count: bigint }[]>`
      SELECT act."localGovernmentId" as "lgaId", COUNT(*) as count
      FROM ad_campaign_targets act
      JOIN ad_campaigns ac ON ac.id = act."campaignId"
      WHERE act."keywordId" = ${keywordId}
        AND ac."isActive" = true AND ac."isPaused" = false AND ac."endDate" >= NOW()
      GROUP BY act."localGovernmentId"
    `,
  ]);

  const lgaIds = Array.from(new Set([...searchCounts.map((r) => r.lgaId), ...competitorCounts.map((r) => r.lgaId)]));
  if (lgaIds.length === 0) return [];

  const [lgas, overrides] = await Promise.all([
    prisma.localGovernment.findMany({
      where: { id: { in: lgaIds } },
      select: { id: true, name: true, state: { select: { name: true } } },
    }),
    prisma.adPriceOverride.findMany({
      where: {
        OR: [
          { keywordId, localGovernmentId: { in: lgaIds } },
          { keywordId, localGovernmentId: null },
          { keywordId: null, localGovernmentId: { in: lgaIds } },
        ],
      },
      select: { keywordId: true, localGovernmentId: true, fixedPriceNairaPer30Days: true },
    }),
  ]);

  const lgaMap = new Map(lgas.map((l) => [l.id, l]));
  const searchMap = new Map(searchCounts.map((r) => [r.lgaId, Number(r.count)]));
  const compMap = new Map(competitorCounts.map((r) => [r.lgaId, Number(r.count)]));

  return lgaIds
    .map((lgaId) => {
      const lga = lgaMap.get(lgaId);
      if (!lga) return null;

      const competitorCount = compMap.get(lgaId) ?? 0;
      const searchCount = searchMap.get(lgaId) ?? 0;

      const exactOverride = overrides.find((o) => o.keywordId === keywordId && o.localGovernmentId === lgaId);
      const kwOnlyOverride = overrides.find((o) => o.keywordId === keywordId && o.localGovernmentId === null);
      const lgaOnlyOverride = overrides.find((o) => o.localGovernmentId === lgaId && o.keywordId === null);
      const override = exactOverride ?? kwOnlyOverride ?? lgaOnlyOverride;

      const mult = Math.min(1 + competitorCount * COMP_STEP, MAX_MULT);
      const formulaPrice = Math.round(BASE_PRICE_30 * mult);
      const overridePrice = override?.fixedPriceNairaPer30Days ?? null;

      return {
        lgaId,
        lgaName: lga.name,
        stateName: lga.state.name,
        searchCount,
        competitorCount,
        formulaPriceNaira: formulaPrice,
        overridePriceNaira: overridePrice,
        effectivePriceNaira: overridePrice ?? formulaPrice,
      };
    })
    .filter((r): r is KeywordLocationSignal => r !== null)
    .sort((a, b) => (b.searchCount + b.competitorCount) - (a.searchCount + a.competitorCount));
}
