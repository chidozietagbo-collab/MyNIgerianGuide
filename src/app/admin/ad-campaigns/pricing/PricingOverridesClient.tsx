"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  getAdPriceOverrides,
  searchKeywordsForPricing,
  searchLocalGovernmentsForPricing,
  setAdPriceOverride,
  removeAdPriceOverride,
} from "../ad-campaigns-admin-actions";

type Override = Awaited<ReturnType<typeof getAdPriceOverrides>>[number];
type KeywordOption = { id: string; name: string; category: { name: string } };
type LgaOption = { id: string; name: string; state: { name: string } };

export default function PricingOverridesClient({ initialOverrides }: { initialOverrides: Override[] }) {
  const [overrides, setOverrides] = useState(initialOverrides);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [keywordQuery, setKeywordQuery] = useState("");
  const [keywordResults, setKeywordResults] = useState<KeywordOption[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordOption | null>(null);

  const [lgaQuery, setLgaQuery] = useState("");
  const [lgaResults, setLgaResults] = useState<LgaOption[]>([]);
  const [selectedLga, setSelectedLga] = useState<LgaOption | null>(null);

  const [priceInput, setPriceInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function refresh() {
    const data = await getAdPriceOverrides();
    setOverrides(data);
  }

  useEffect(() => {
    const trimmed = keywordQuery.trim();
    if (!trimmed) {
      setKeywordResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      searchKeywordsForPricing(trimmed).then(setKeywordResults);
    }, 300);
    return () => clearTimeout(timeout);
  }, [keywordQuery]);

  useEffect(() => {
    const trimmed = lgaQuery.trim();
    if (!trimmed) {
      setLgaResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      searchLocalGovernmentsForPricing(trimmed).then(setLgaResults);
    }, 300);
    return () => clearTimeout(timeout);
  }, [lgaQuery]);

  async function handleSave() {
    const price = Number(priceInput);
    setError(null);
    setIsSaving(true);
    try {
      const result = await setAdPriceOverride(selectedKeyword?.id ?? null, selectedLga?.id ?? null, price);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage("Price override saved.");
      setSelectedKeyword(null);
      setSelectedLga(null);
      setKeywordQuery("");
      setLgaQuery("");
      setPriceInput("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save this price.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    setError(null);
    try {
      const result = await removeAdPriceOverride(id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage("Price override removed.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove this override.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-ink-900">Ad pricing overrides</h1>
      <p className="mt-1 text-sm text-ink-500">
        Set a fixed price for a keyword and/or a city, overriding the automatic demand-based formula. Leave one
        blank to apply more broadly — a keyword-only override applies to that keyword in every city; a city-only
        override applies to every keyword in that city.
      </p>

      {message && <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-600">{message}</p>}
      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="mt-6 rounded-lg border border-ink-100 bg-white p-5 shadow-sm">
        <h2 className="font-display text-sm font-bold text-ink-900">New override</h2>

        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">Keyword (optional)</p>
          {selectedKeyword ? (
            <div className="mt-1.5 flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-sm">
              <span>
                {selectedKeyword.name} <span className="text-ink-300">({selectedKeyword.category.name})</span>
              </span>
              <button type="button" onClick={() => setSelectedKeyword(null)} className="text-ink-300 hover:text-danger">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <input
                value={keywordQuery}
                onChange={(e) => setKeywordQuery(e.target.value)}
                placeholder="Search for a keyword…"
                className="mt-1.5 w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300"
              />
              {keywordResults.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {keywordResults.map((kw) => (
                    <button
                      key={kw.id}
                      type="button"
                      onClick={() => {
                        setSelectedKeyword(kw);
                        setKeywordQuery("");
                        setKeywordResults([]);
                      }}
                      className="block w-full rounded-md border border-ink-100 px-3 py-1.5 text-left text-sm text-ink-700 hover:border-green-500"
                    >
                      {kw.name} <span className="text-ink-300">({kw.category.name})</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">City / LGA (optional)</p>
          {selectedLga ? (
            <div className="mt-1.5 flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-sm">
              <span>
                {selectedLga.name} <span className="text-ink-300">({selectedLga.state.name})</span>
              </span>
              <button type="button" onClick={() => setSelectedLga(null)} className="text-ink-300 hover:text-danger">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <input
                value={lgaQuery}
                onChange={(e) => setLgaQuery(e.target.value)}
                placeholder="Search for a city / LGA…"
                className="mt-1.5 w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300"
              />
              {lgaResults.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {lgaResults.map((lga) => (
                    <button
                      key={lga.id}
                      type="button"
                      onClick={() => {
                        setSelectedLga(lga);
                        setLgaQuery("");
                        setLgaResults([]);
                      }}
                      className="block w-full rounded-md border border-ink-100 px-3 py-1.5 text-left text-sm text-ink-700 hover:border-green-500"
                    >
                      {lga.name} <span className="text-ink-300">({lga.state.name})</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">Fixed price per 30 days (₦)</p>
          <input
            type="number"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            placeholder="e.g. 20000"
            className="mt-1.5 w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300"
          />
          <p className="mt-1 text-xs text-ink-300">
            Automatically scaled down for 7 or 14-day campaigns — businesses won&apos;t pay the full 30-day price
            for a shorter run.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || (!selectedKeyword && !selectedLga) || !priceInput}
          className="mt-4 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save override"}
        </button>
      </div>

      <div className="mt-6">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">
          Current overrides
        </h2>
        {overrides.length === 0 ? (
          <p className="mt-2 text-sm text-ink-300">No price overrides set — every keyword/city combination uses
            the automatic formula.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {overrides.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between rounded-lg border border-ink-100 bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    {o.keyword?.name ?? "Any keyword"}
                    {" · "}
                    {o.localGovernment ? `${o.localGovernment.name} (${o.localGovernment.state.name})` : "Any city"}
                  </p>
                  <p className="text-xs text-ink-300">
                    Set by {o.setBy.name || o.setBy.email.split("@")[0]} ·{" "}
                    {new Date(o.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-sm font-bold text-ink-900">
                    ₦{o.fixedPriceNairaPer30Days.toLocaleString("en-NG")} / 30 days
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(o.id)}
                    disabled={removingId === o.id}
                    className="text-xs font-semibold text-danger hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
