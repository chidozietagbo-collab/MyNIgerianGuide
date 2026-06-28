"use client";

import { useEffect, useState } from "react";
import { Rocket, TrendingUp, Star } from "lucide-react";
import {
  getBusinessKeywordsForBoost,
  getActiveSponsoredListing,
  getSponsoredListingPrice,
  initiateSponsoredListingPurchase,
} from "./sponsored-listing-actions";
import { DURATION_OPTIONS, type DurationDays } from "@/lib/sponsored-pricing";

type Keyword = { id: string; name: string };
type ActiveListing = {
  id: string;
  placementType: "TOP_OF_SEARCH" | "FEATURED_BADGE";
  city: string | null;
  startDate: Date;
  endDate: Date;
  priceNaira: number;
  keyword: { name: string } | null;
};

const PLACEMENT_OPTIONS = [
  {
    value: "TOP_OF_SEARCH" as const,
    label: "Top of Search Results",
    description: "Your business appears above regular results for this keyword and city.",
    icon: TrendingUp,
  },
  {
    value: "FEATURED_BADGE" as const,
    label: "Featured Badge",
    description: "A featured badge on your business page, drawing extra attention.",
    icon: Star,
  },
];

export default function BoostListingPanel({ businessPageId }: { businessPageId: string }) {
  const [keywords, setKeywords] = useState<Keyword[] | null>(null);
  const [activeListing, setActiveListing] = useState<ActiveListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [placementType, setPlacementType] = useState<"TOP_OF_SEARCH" | "FEATURED_BADGE">("TOP_OF_SEARCH");
  const [durationDays, setDurationDays] = useState<DurationDays>(30);
  const [keywordId, setKeywordId] = useState<string | null>(null);

  const [priceNaira, setPriceNaira] = useState<number | null>(null);
  const [competitorCount, setCompetitorCount] = useState<number | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getBusinessKeywordsForBoost(businessPageId), getActiveSponsoredListing(businessPageId)])
      .then(([kw, active]) => {
        if (cancelled) return;
        setKeywords(kw);
        setActiveListing(active);
        if (kw.length > 0) setKeywordId(kw[0].id);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Couldn't load boost options.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessPageId]);

  useEffect(() => {
    if (!keywordId) return;
    let cancelled = false;
    setPricingLoading(true);
    getSponsoredListingPrice(businessPageId, placementType, durationDays, keywordId)
      .then((result) => {
        if (cancelled) return;
        setPriceNaira(result.priceNaira);
        setCompetitorCount(result.competitorCount);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Couldn't calculate pricing.");
      })
      .finally(() => {
        if (!cancelled) setPricingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessPageId, placementType, durationDays, keywordId]);

  async function handleProceedToPayment() {
    if (!keywordId) return;
    setError(null);
    setIsPurchasing(true);
    try {
      const { authorizationUrl } = await initiateSponsoredListingPurchase(
        businessPageId,
        placementType,
        durationDays,
        keywordId
      );
      window.location.href = authorizationUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start payment.");
      setIsPurchasing(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-ink-300">Loading…</p>;
  }

  if (error && !keywords) {
    return <p className="text-sm text-danger">{error}</p>;
  }

  return (
    <div className="space-y-6">
      {activeListing && (
        <div className="rounded-lg border border-green-500 bg-green-50 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
            <Rocket className="h-4 w-4" />
            Sponsored listing active
          </p>
          <p className="mt-1 text-sm text-ink-700">
            {activeListing.placementType === "TOP_OF_SEARCH" ? "Top of Search Results" : "Featured Badge"} for{" "}
            <span className="font-medium">{activeListing.keyword?.name ?? "your business"}</span>
            {activeListing.city && ` in ${activeListing.city}`}, until{" "}
            {new Date(activeListing.endDate).toLocaleDateString("en-NG", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            .
          </p>
        </div>
      )}

      {!keywords || keywords.length === 0 ? (
        <p className="rounded-lg border border-ink-100 bg-white p-6 text-sm text-ink-500 shadow-sm">
          Add at least one service or keyword to your business page before boosting a listing — boosting promotes
          you for a specific service you already offer.
        </p>
      ) : (
        <div className="rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
          <h3 className="font-display text-sm font-bold text-ink-900">Boost this listing</h3>
          <p className="mt-1 text-sm text-ink-500">
            Get more visibility for a specific service, in your city, for a set period.
          </p>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">Placement</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PLACEMENT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = placementType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPlacementType(opt.value)}
                    className={
                      selected
                        ? "rounded-md border border-green-500 bg-green-50 p-3 text-left"
                        : "rounded-md border border-ink-100 p-3 text-left hover:border-ink-300"
                    }
                  >
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                      <Icon className="h-4 w-4" />
                      {opt.label}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">Keyword</p>
            <select
              value={keywordId ?? ""}
              onChange={(e) => setKeywordId(e.target.value)}
              className="mt-2 w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900"
            >
              {keywords.map((kw) => (
                <option key={kw.id} value={kw.id}>
                  {kw.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">Duration</p>
            <div className="mt-2 flex gap-2">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDurationDays(d)}
                  className={
                    durationDays === d
                      ? "rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white"
                      : "rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:border-ink-300"
                  }
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-md bg-ink-50 p-4">
            {pricingLoading ? (
              <p className="text-sm text-ink-300">Calculating price…</p>
            ) : priceNaira !== null ? (
              <>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium text-ink-700">Price</p>
                  <p className="font-display text-2xl font-extrabold text-ink-900">
                    ₦{priceNaira.toLocaleString("en-NG")}
                  </p>
                </div>
                {competitorCount !== null && competitorCount > 0 && (
                  <p className="mt-1 text-xs text-ink-300">
                    {competitorCount} other business{competitorCount === 1 ? "" : "es"} already boosting this
                    keyword in your area — pricing reflects demand.
                  </p>
                )}
              </>
            ) : null}
          </div>

          {error && <p className="mt-3 text-sm text-danger">{error}</p>}

          <button
            type="button"
            onClick={handleProceedToPayment}
            disabled={isPurchasing || pricingLoading || !priceNaira}
            className="mt-4 w-full rounded-md bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50"
          >
            {isPurchasing ? "Redirecting to payment…" : "Proceed to Payment"}
          </button>
          <p className="mt-2 text-center text-xs text-ink-300">You&apos;ll be taken to Paystack to complete payment securely.</p>
        </div>
      )}
    </div>
  );
}
