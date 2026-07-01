"use client";

import { useEffect, useState } from "react";
import { TrendingUp, MapPin } from "lucide-react";
import { getKeywordLocationSignals, type KeywordLocationSignal } from "@/app/admin/ad-campaigns/ad-intelligence-actions";

export default function KeywordIntelligencePanel({
  keywordId,
  keywordName,
  onSelectCity,
}: {
  keywordId: string;
  keywordName: string;
  onSelectCity?: (lgaId: string, lgaName: string, stateName: string) => void;
}) {
  const [signals, setSignals] = useState<KeywordLocationSignal[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getKeywordLocationSignals(keywordId)
      .then((data) => { if (!cancelled) setSignals(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [keywordId]);

  if (loading) return <p className="mt-2 text-xs text-ink-300">Loading demand data for {keywordName}...</p>;

  if (!signals || signals.length === 0) {
    return (
      <div className="mt-2 rounded-md border border-ink-100 bg-ink-50 p-3">
        <p className="text-xs font-medium text-ink-500">No location data yet for &quot;{keywordName}&quot;</p>
        <p className="mt-0.5 text-xs text-ink-300">
          This keyword hasn&apos;t been searched or advertised in specific cities yet. You can still target any
          city — the price will use our base formula until real demand data builds up.
        </p>
      </div>
    );
  }

  const maxSignal = signals[0] ? signals[0].searchCount + signals[0].competitorCount : 1;

  return (
    <div className="mt-2 rounded-md border border-ink-100 bg-white">
      <div className="flex items-center gap-1.5 border-b border-ink-100 px-3 py-2">
        <TrendingUp className="h-3.5 w-3.5 text-green-600" />
        <p className="text-xs font-semibold text-ink-900">
          &quot;{keywordName}&quot; — top cities by demand
        </p>
      </div>
      <div className="divide-y divide-ink-100">
        {signals.slice(0, 8).map((s) => {
          const totalSignal = s.searchCount + s.competitorCount;
          const barWidth = Math.max(4, Math.round((totalSignal / maxSignal) * 100));

          return (
            <div key={s.lgaId} className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-ink-300" />
                  <span className="text-xs font-medium text-ink-900">{s.lgaName}</span>
                  <span className="text-xs text-ink-300">({s.stateName})</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 rounded-full bg-ink-100">
                    <div className="h-1.5 rounded-full bg-green-400" style={{ width: `${barWidth}%` }} />
                  </div>
                  <span className="w-20 text-right text-xs text-ink-300">
                    {s.searchCount > 0 ? `${s.searchCount.toLocaleString()} searches` : `${s.competitorCount} ads`}
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-xs font-bold text-ink-900">
                  &#8358;{s.effectivePriceNaira.toLocaleString("en-NG")}
                  <span className="font-normal text-ink-300">/30d</span>
                </p>
                {s.overridePriceNaira && <p className="text-xs text-[#B45309]">fixed price</p>}
                {s.competitorCount > 0 && <p className="text-xs text-ink-300">{s.competitorCount} competing</p>}
              </div>
              {onSelectCity && (
                <button
                  type="button"
                  onClick={() => onSelectCity(s.lgaId, s.lgaName, s.stateName)}
                  className="flex-shrink-0 rounded-md border border-green-500 px-2 py-1 text-xs font-semibold text-green-600 hover:bg-green-50"
                >
                  Target
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="border-t border-ink-100 px-3 py-2 text-xs text-ink-300">
        Based on searches and active campaigns in the last 30 days.
      </p>
    </div>
  );
}
