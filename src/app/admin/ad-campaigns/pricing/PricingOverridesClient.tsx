"use client";

import { useState } from "react";
import { X, TrendingUp, Search } from "lucide-react";
import {
  getAdPriceOverrides,
  setAdPriceOverride,
  removeAdPriceOverride,
  searchKeywordsForPricing,
  searchLocalGovernmentsForPricing,
} from "../ad-campaigns-admin-actions";
import {
  getTopKeywordLocationSignals,
  type KeywordPricingRow,
} from "@/app/admin/ad-campaigns/ad-intelligence-actions";

type Override = Awaited<ReturnType<typeof getAdPriceOverrides>>[number];
type KeywordOption = { id: string; name: string; category: { name: string } };
type LgaOption = { id: string; name: string; state: { name: string } };

export default function PricingOverridesClient({
  initialOverrides,
  initialSignals,
}: {
  initialOverrides: Override[];
  initialSignals: KeywordPricingRow[];
}) {
  const [overrides, setOverrides] = useState(initialOverrides);
  const [signals, setSignals] = useState(initialSignals);
  const [activeTab, setActiveTab] = useState<"intelligence" | "overrides">("intelligence");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [newKeywordQuery, setNewKeywordQuery] = useState("");
  const [newKeywordResults, setNewKeywordResults] = useState<KeywordOption[]>([]);
  const [selectedNewKeyword, setSelectedNewKeyword] = useState<KeywordOption | null>(null);
  const [newLgaQuery, setNewLgaQuery] = useState("");
  const [newLgaResults, setNewLgaResults] = useState<LgaOption[]>([]);
  const [selectedNewLga, setSelectedNewLga] = useState<LgaOption | null>(null);
  const [newPrice, setNewPrice] = useState("");

  async function refresh() {
    const [freshOverrides, freshSignals] = await Promise.all([
      getAdPriceOverrides(),
      getTopKeywordLocationSignals(100),
    ]);
    setOverrides(freshOverrides);
    setSignals(freshSignals);
  }

  async function handleSetOverride(keywordId: string | null, lgaId: string | null, price: string) {
    const parsed = Number(price);
    setIsSaving(true);
    setError(null);
    try {
      const result = await setAdPriceOverride(keywordId, lgaId, parsed);
      if (!result.success) { setError(result.error); return; }
      setMessage("Price override saved.");
      setEditingKey(null);
      setEditPrice("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save this price.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveOverride(overrideId: string) {
    setRemovingId(overrideId);
    setError(null);
    try {
      const result = await removeAdPriceOverride(overrideId);
      if (!result.success) { setError(result.error); return; }
      setMessage("Override removed — this combination now uses the formula price.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove this override.");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleNewOverride() {
    await handleSetOverride(selectedNewKeyword?.id ?? null, selectedNewLga?.id ?? null, newPrice);
    setSelectedNewKeyword(null);
    setSelectedNewLga(null);
    setNewPrice("");
    setNewKeywordQuery("");
    setNewLgaQuery("");
  }

  const filteredSignals = signals.filter(
    (s) =>
      !filterQuery ||
      s.keywordName.toLowerCase().includes(filterQuery.toLowerCase()) ||
      s.lgaName.toLowerCase().includes(filterQuery.toLowerCase()) ||
      s.stateName.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Ad pricing intelligence</h1>
        <p className="mt-1 text-sm text-ink-500">
          See demand signals and current effective prices per keyword and city. Set a fixed override for any
          combination, or let the formula run automatically.
        </p>
      </div>

      <div className="mt-6 flex gap-1 rounded-md bg-ink-50 p-1">
        {(["intelligence", "overrides"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={
              activeTab === tab
                ? "flex-1 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-ink-900 shadow-sm"
                : "flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-ink-500"
            }
          >
            {tab === "intelligence" ? "Demand signals" : `Price overrides (${overrides.length})`}
          </button>
        ))}
      </div>

      {message && <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-600">{message}</p>}
      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}

      {activeTab === "intelligence" && (
        <IntelligenceTab
          signals={filteredSignals}
          filterQuery={filterQuery}
          setFilterQuery={setFilterQuery}
          editingKey={editingKey}
          setEditingKey={setEditingKey}
          editPrice={editPrice}
          setEditPrice={setEditPrice}
          isSaving={isSaving}
          onSetOverride={handleSetOverride}
          onClearMessage={() => setMessage(null)}
        />
      )}

      {activeTab === "overrides" && (
        <OverridesTab
          overrides={overrides}
          isSaving={isSaving}
          removingId={removingId}
          newKeywordQuery={newKeywordQuery}
          setNewKeywordQuery={setNewKeywordQuery}
          newKeywordResults={newKeywordResults}
          setNewKeywordResults={setNewKeywordResults}
          selectedNewKeyword={selectedNewKeyword}
          setSelectedNewKeyword={setSelectedNewKeyword}
          newLgaQuery={newLgaQuery}
          setNewLgaQuery={setNewLgaQuery}
          newLgaResults={newLgaResults}
          setNewLgaResults={setNewLgaResults}
          selectedNewLga={selectedNewLga}
          setSelectedNewLga={setSelectedNewLga}
          newPrice={newPrice}
          setNewPrice={setNewPrice}
          onSaveNew={handleNewOverride}
          onRemove={handleRemoveOverride}
        />
      )}
    </main>
  );
}

function IntelligenceTab({
  signals, filterQuery, setFilterQuery, editingKey, setEditingKey,
  editPrice, setEditPrice, isSaving, onSetOverride, onClearMessage,
}: {
  signals: KeywordPricingRow[];
  filterQuery: string;
  setFilterQuery: (v: string) => void;
  editingKey: string | null;
  setEditingKey: (v: string | null) => void;
  editPrice: string;
  setEditPrice: (v: string) => void;
  isSaving: boolean;
  onSetOverride: (kw: string | null, lga: string | null, price: string) => Promise<void>;
  onClearMessage: () => void;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 rounded-md border border-ink-100 bg-white px-3 py-2 shadow-sm">
        <Search className="h-4 w-4 text-ink-300" />
        <input
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Filter by keyword, city or state…"
          className="flex-1 border-none text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none"
        />
      </div>

      {signals.length === 0 ? (
        <div className="mt-4 rounded-lg border border-ink-100 bg-white p-8 text-center shadow-sm">
          <TrendingUp className="mx-auto h-8 w-8 text-ink-100" />
          <p className="mt-3 text-sm font-medium text-ink-500">No demand signals yet</p>
          <p className="mt-1 text-sm text-ink-300">
            Data will appear here as people search the platform and businesses run campaigns. Check back after
            launch.
          </p>
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-lg border border-ink-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 bg-ink-50">
              <tr>
                {["Keyword", "City", "Searches", "Competitors", "Formula", "Effective", "Override"].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-300 ${
                      ["Searches", "Competitors", "Formula", "Effective"].includes(h) ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {signals.map((row) => {
                const key = `${row.keywordId}::${row.lgaId}`;
                const isEditing = editingKey === key;
                return (
                  <tr key={key} className="hover:bg-ink-50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-ink-900">{row.keywordName}</p>
                      <p className="text-xs text-ink-300">{row.categoryName}</p>
                    </td>
                    <td className="px-4 py-2.5 text-ink-700">
                      {row.lgaName}
                      <span className="ml-1 text-xs text-ink-300">({row.stateName})</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-ink-700">
                      {row.searchCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-ink-700">{row.competitorCount}</td>
                    <td className="px-4 py-2.5 text-right text-ink-500">
                      ₦{row.formulaPriceNaira.toLocaleString("en-NG")}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={row.overridePriceNaira ? "font-bold text-ink-900" : "text-ink-500"}>
                        ₦{row.effectivePriceNaira.toLocaleString("en-NG")}
                      </span>
                      {row.overridePriceNaira && (
                        <span className="ml-1 rounded bg-[#FFFBEB] px-1 text-xs text-[#B45309]">fixed</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            placeholder="₦"
                            className="w-24 rounded-md border border-ink-100 px-2 py-1 text-xs text-ink-900"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => onSetOverride(row.keywordId, row.lgaId, editPrice)}
                            disabled={isSaving}
                            className="rounded-md bg-green-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button type="button" onClick={() => setEditingKey(null)} className="text-ink-300">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingKey(key);
                            setEditPrice(row.overridePriceNaira?.toString() ?? row.formulaPriceNaira.toString());
                            onClearMessage();
                          }}
                          className="text-xs text-green-600 hover:underline"
                        >
                          {row.overridePriceNaira ? "Edit" : "Set override"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OverridesTab({
  overrides, isSaving, removingId,
  newKeywordQuery, setNewKeywordQuery, newKeywordResults, setNewKeywordResults,
  selectedNewKeyword, setSelectedNewKeyword,
  newLgaQuery, setNewLgaQuery, newLgaResults, setNewLgaResults,
  selectedNewLga, setSelectedNewLga,
  newPrice, setNewPrice, onSaveNew, onRemove,
}: {
  overrides: Override[];
  isSaving: boolean;
  removingId: string | null;
  newKeywordQuery: string;
  setNewKeywordQuery: (v: string) => void;
  newKeywordResults: KeywordOption[];
  setNewKeywordResults: (v: KeywordOption[]) => void;
  selectedNewKeyword: KeywordOption | null;
  setSelectedNewKeyword: (v: KeywordOption | null) => void;
  newLgaQuery: string;
  setNewLgaQuery: (v: string) => void;
  newLgaResults: LgaOption[];
  setNewLgaResults: (v: LgaOption[]) => void;
  selectedNewLga: LgaOption | null;
  setSelectedNewLga: (v: LgaOption | null) => void;
  newPrice: string;
  setNewPrice: (v: string) => void;
  onSaveNew: () => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  return (
    <div className="mt-4 space-y-6">
      <div className="rounded-lg border border-ink-100 bg-white p-5 shadow-sm">
        <h2 className="font-display text-sm font-bold text-ink-900">New override</h2>
        <p className="mt-1 text-xs text-ink-500">
          Leave one blank for a broader rule: keyword-only applies across every city; city-only applies across
          every keyword. Both set = exact combination only.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">Keyword (optional)</p>
            {selectedNewKeyword ? (
              <div className="mt-1.5 flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-sm">
                <span>{selectedNewKeyword.name}</span>
                <button type="button" onClick={() => setSelectedNewKeyword(null)}>
                  <X className="h-3.5 w-3.5 text-ink-300" />
                </button>
              </div>
            ) : (
              <>
                <input
                  value={newKeywordQuery}
                  onChange={async (e) => {
                    setNewKeywordQuery(e.target.value);
                    if (e.target.value.trim()) {
                      const r = await searchKeywordsForPricing(e.target.value);
                      setNewKeywordResults(r);
                    } else setNewKeywordResults([]);
                  }}
                  placeholder="Search…"
                  className="mt-1.5 w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300"
                />
                {newKeywordResults.map((kw) => (
                  <button
                    key={kw.id}
                    type="button"
                    onClick={() => { setSelectedNewKeyword(kw); setNewKeywordQuery(""); setNewKeywordResults([]); }}
                    className="mt-1 block w-full rounded-md border border-ink-100 px-3 py-1.5 text-left text-sm text-ink-700 hover:border-green-500"
                  >
                    {kw.name} <span className="text-ink-300">({kw.category.name})</span>
                  </button>
                ))}
              </>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">City / LGA (optional)</p>
            {selectedNewLga ? (
              <div className="mt-1.5 flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-sm">
                <span>{selectedNewLga.name} ({selectedNewLga.state.name})</span>
                <button type="button" onClick={() => setSelectedNewLga(null)}>
                  <X className="h-3.5 w-3.5 text-ink-300" />
                </button>
              </div>
            ) : (
              <>
                <input
                  value={newLgaQuery}
                  onChange={async (e) => {
                    setNewLgaQuery(e.target.value);
                    if (e.target.value.trim()) {
                      const r = await searchLocalGovernmentsForPricing(e.target.value);
                      setNewLgaResults(r);
                    } else setNewLgaResults([]);
                  }}
                  placeholder="Search…"
                  className="mt-1.5 w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300"
                />
                {newLgaResults.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => { setSelectedNewLga(l); setNewLgaQuery(""); setNewLgaResults([]); }}
                    className="mt-1 block w-full rounded-md border border-ink-100 px-3 py-1.5 text-left text-sm text-ink-700 hover:border-green-500"
                  >
                    {l.name} <span className="text-ink-300">({l.state.name})</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">Fixed price per 30 days (₦)</p>
          <input
            type="number"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="e.g. 20000"
            className="mt-1.5 rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300"
          />
          <p className="mt-1 text-xs text-ink-300">Automatically scaled for 7 or 14-day campaigns.</p>
        </div>

        <button
          type="button"
          onClick={onSaveNew}
          disabled={isSaving || (!selectedNewKeyword && !selectedNewLga) || !newPrice}
          className="mt-4 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save override"}
        </button>
      </div>

      <div>
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">Current overrides</h2>
        {overrides.length === 0 ? (
          <p className="mt-2 text-sm text-ink-300">No overrides set — everything uses the formula.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {overrides.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg border border-ink-100 bg-white p-4 shadow-sm">
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    {o.keyword?.name ?? "Any keyword"} · {o.localGovernment ? `${o.localGovernment.name} (${o.localGovernment.state.name})` : "Any city"}
                  </p>
                  <p className="text-xs text-ink-300">
                    Set by {o.setBy.name || o.setBy.email.split("@")[0]} ·{" "}
                    {new Date(o.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-sm font-bold text-ink-900">
                    ₦{o.fixedPriceNairaPer30Days.toLocaleString("en-NG")} / 30d
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(o.id)}
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
    </div>
  );
}
