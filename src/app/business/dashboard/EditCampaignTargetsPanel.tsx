"use client";

import { useEffect, useState } from "react";
import { X, Plus } from "lucide-react";
import {
  searchKeywordsForCampaign,
  getAllStatesForCampaign,
  getLocalGovernmentsForCampaign,
  getAddedTargetPrice,
  initiateAddTargetPurchase,
  removeTargetFromCampaign,
} from "./campaign-actions";
import { submitNewKeywordForEdit } from "@/components/actions";

type Keyword = { id: string; name: string };
type LocationOption = { id: string; name: string };
type Target = {
  id: string;
  priceNaira: number;
  impressionCount: number;
  clickCount: number;
  keyword: { name: string };
  localGovernment: { name: string };
};

export default function EditCampaignTargetsPanel({
  campaignId,
  businessPageId,
  categoryId,
  targets,
  onClose,
  onChanged,
}: {
  campaignId: string;
  businessPageId: string;
  categoryId: string;
  targets: Target[];
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  async function handleRemove(targetId: string) {
    setRemovingId(targetId);
    setError(null);
    try {
      await removeTargetFromCampaign(campaignId, targetId);
      setConfirmingRemoveId(null);
      onChanged("Target removed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove this target.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="mt-3 rounded-md border border-ink-100 bg-ink-50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">Edit targets</p>
        <button type="button" onClick={onClose} className="text-xs text-ink-500">
          Close
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-3 space-y-1.5">
        {targets.map((t) => (
          <div key={t.id} className="rounded-md bg-white px-3 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-700">
                {t.keyword.name} · {t.localGovernment.name}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-ink-300">₦{t.priceNaira.toLocaleString("en-NG")}</span>
                <button
                  type="button"
                  onClick={() => setConfirmingRemoveId(confirmingRemoveId === t.id ? null : t.id)}
                  disabled={removingId === t.id}
                  className="text-ink-300 hover:text-danger disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {confirmingRemoveId === t.id && (
              <div className="mt-2 flex items-center justify-between rounded-md bg-red-50 px-2 py-1.5">
                <p className="text-xs text-danger">Remove this target now? No refund for the unused time.</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRemove(t.id)}
                    disabled={removingId === t.id}
                    className="text-xs font-semibold text-danger disabled:opacity-50"
                  >
                    Remove
                  </button>
                  <button type="button" onClick={() => setConfirmingRemoveId(null)} className="text-xs text-ink-500">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {!showAddForm ? (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="mt-3 flex items-center gap-1.5 rounded-md border border-ink-100 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-ink-300"
        >
          <Plus className="h-3.5 w-3.5" />
          Add a target
        </button>
      ) : (
        <AddTargetForm
          campaignId={campaignId}
          businessPageId={businessPageId}
          categoryId={categoryId}
          onCancel={() => setShowAddForm(false)}
          onError={setError}
        />
      )}
    </div>
  );
}

function AddTargetForm({
  campaignId,
  businessPageId,
  categoryId,
  onCancel,
  onError,
}: {
  campaignId: string;
  businessPageId: string;
  categoryId: string;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Keyword[]>([]);
  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);
  const [selectedKeywordName, setSelectedKeywordName] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);

  const [states, setStates] = useState<LocationOption[]>([]);
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [lgas, setLgas] = useState<LocationOption[]>([]);
  const [selectedLgaId, setSelectedLgaId] = useState<string | null>(null);
  const [lgasLoading, setLgasLoading] = useState(false);

  const [priceNaira, setPriceNaira] = useState<number | null>(null);
  const [remainingDays, setRemainingDays] = useState<number | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isSubmittingNewKeyword, setIsSubmittingNewKeyword] = useState(false);
  const [justSuggestedKeywordId, setJustSuggestedKeywordId] = useState<string | null>(null);

  useEffect(() => {
    getAllStatesForCampaign().then(setStates);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    const timeout = setTimeout(() => {
      searchKeywordsForCampaign(businessPageId, trimmed)
        .then(setResults)
        .catch((e) => onError(e instanceof Error ? e.message : "Couldn't search keywords."))
        .finally(() => setIsSearching(false));
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, businessPageId]);

  useEffect(() => {
    if (!selectedStateId) {
      setLgas([]);
      return;
    }
    setLgasLoading(true);
    getLocalGovernmentsForCampaign(selectedStateId)
      .then(setLgas)
      .finally(() => setLgasLoading(false));
  }, [selectedStateId]);

  useEffect(() => {
    if (!selectedKeywordId || !selectedLgaId) {
      setPriceNaira(null);
      setRemainingDays(null);
      return;
    }
    setPricingLoading(true);
    getAddedTargetPrice(campaignId, selectedKeywordId, selectedLgaId)
      .then((result) => {
        setPriceNaira(result.priceNaira);
        setRemainingDays(result.remainingDays);
      })
      .catch((e) => onError(e instanceof Error ? e.message : "Couldn't calculate pricing."))
      .finally(() => setPricingLoading(false));
  }, [campaignId, selectedKeywordId, selectedLgaId, onError]);

  async function handleSuggestNewKeyword() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setIsSubmittingNewKeyword(true);
    try {
      const result = await submitNewKeywordForEdit(categoryId, trimmed);
      if (!result.success) {
        onError(result.error);
        return;
      }
      setSelectedKeywordId(result.keyword.id);
      setSelectedKeywordName(result.keyword.name);
      setJustSuggestedKeywordId(result.keyword.id);
      setQuery(result.keyword.name);
      setResults([]);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't submit this keyword.");
    } finally {
      setIsSubmittingNewKeyword(false);
    }
  }

  async function handlePurchase() {
    if (!selectedKeywordId || !selectedLgaId) {
      onError("Pick a keyword and a city first.");
      return;
    }
    setIsPurchasing(true);
    try {
      const { authorizationUrl } = await initiateAddTargetPurchase(campaignId, selectedKeywordId, selectedLgaId);
      window.location.href = authorizationUrl;
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't start payment.");
      setIsPurchasing(false);
    }
  }

  return (
    <div className="mt-3 rounded-md border border-ink-100 bg-white p-3">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedKeywordId(null);
        }}
        placeholder="Search for a keyword…"
        className="w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300"
      />

      {isSearching && <p className="mt-1.5 text-xs text-ink-300">Searching…</p>}

      {!isSearching && query.trim() && results.length === 0 && !selectedKeywordId && (
        <div className="mt-1.5 rounded-md bg-[#FFFBEB] px-3 py-2">
          <p className="text-xs text-ink-700">
            No matching keyword found. You can suggest &quot;{query.trim()}&quot; as a new one — it&apos;ll need
            admin approval before you can use it (same review process as adding a new service when setting up your
            page).
          </p>
          <button
            type="button"
            onClick={handleSuggestNewKeyword}
            disabled={isSubmittingNewKeyword}
            className="mt-1.5 rounded-md border border-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-700 hover:border-ink-300 disabled:opacity-50"
          >
            {isSubmittingNewKeyword ? "Submitting…" : `Suggest "${query.trim()}"`}
          </button>
        </div>
      )}

      {!isSearching && results.length > 0 && !selectedKeywordId && (
        <div className="mt-1.5 space-y-1">
          {results.map((kw) => (
            <button
              key={kw.id}
              type="button"
              onClick={() => {
                setSelectedKeywordId(kw.id);
                setSelectedKeywordName(kw.name);
                setQuery(kw.name);
                setResults([]);
              }}
              className="block w-full rounded-md border border-ink-100 px-3 py-1.5 text-left text-sm text-ink-700 hover:border-green-500"
            >
              {kw.name}
            </button>
          ))}
        </div>
      )}

      {selectedKeywordId && (
        <p className="mt-1.5 text-xs text-green-600">
          Targeting: {selectedKeywordName}
          {justSuggestedKeywordId === selectedKeywordId && (
            <span className="ml-1 text-[#B45309]">— awaiting admin approval, can&apos;t be used yet</span>
          )}
        </p>
      )}

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <select
          value={selectedStateId ?? ""}
          onChange={(e) => setSelectedStateId(e.target.value || null)}
          className="rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900"
        >
          <option value="">Select a state…</option>
          {states.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={selectedLgaId ?? ""}
          onChange={(e) => setSelectedLgaId(e.target.value)}
          disabled={!selectedStateId || lgasLoading}
          className="rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 disabled:opacity-50"
        >
          {lgasLoading && <option>Loading…</option>}
          {!lgasLoading && lgas.length === 0 && <option value="">Pick a state first</option>}
          {lgas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      {selectedKeywordId && selectedLgaId && (
        <div className="mt-3 rounded-md bg-ink-50 p-3">
          {pricingLoading ? (
            <p className="text-sm text-ink-300">Calculating price…</p>
          ) : priceNaira !== null ? (
            <>
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium text-ink-700">Price for remaining {remainingDays} days</p>
                <p className="font-display text-lg font-extrabold text-ink-900">
                  ₦{priceNaira.toLocaleString("en-NG")}
                </p>
              </div>
              <p className="mt-1 text-xs text-ink-300">
                Priced for the time left in this campaign, not a fresh full duration.
              </p>
            </>
          ) : null}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handlePurchase}
          disabled={
            !selectedKeywordId ||
            !selectedLgaId ||
            isPurchasing ||
            pricingLoading ||
            justSuggestedKeywordId === selectedKeywordId
          }
          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {isPurchasing ? "Redirecting to payment…" : "Pay and add target"}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-ink-500">
          Cancel
        </button>
      </div>
    </div>
  );
}
