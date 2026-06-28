"use client";

import { useEffect, useState } from "react";
import { Rocket, TrendingUp, Star, Plus, Pause, Play, Image as ImageIcon, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getBusinessKeywordsForCampaign,
  getAllStatesForCampaign,
  getLocalGovernmentsForCampaign,
  getCampaignTargetsPricing,
  getOwnedCampaigns,
  initiateCampaignPurchase,
  pauseCampaign,
  resumeCampaign,
  type CampaignTargetInput,
} from "./campaign-actions";
import { DURATION_OPTIONS, type DurationDays } from "@/lib/sponsored-pricing";

type Keyword = { id: string; name: string };
type LocationOption = { id: string; name: string };

type OwnedCampaign = Awaited<ReturnType<typeof getOwnedCampaigns>>[number];

const PLACEMENT_OPTIONS = [
  {
    value: "TOP_OF_SEARCH" as const,
    label: "Top of Search Results",
    description: "Appears above regular results for each keyword and city you target.",
    icon: TrendingUp,
  },
  {
    value: "FEATURED_BADGE" as const,
    label: "Featured Badge",
    description: "A featured badge on your business page, drawing extra attention.",
    icon: Star,
  },
];

const CREATIVE_STATUS_STYLES: Record<string, string> = {
  NONE: "bg-ink-100 text-ink-500",
  PENDING: "bg-[#FFFBEB] text-[#B45309]",
  APPROVED: "bg-green-50 text-green-600",
  REJECTED: "bg-red-50 text-danger",
};

const CREATIVE_STATUS_LABELS: Record<string, string> = {
  NONE: "No ad image",
  PENDING: "Ad pending review",
  APPROVED: "Ad approved",
  REJECTED: "Ad rejected",
};

export default function CampaignsPanel({ businessPageId }: { businessPageId: string }) {
  const [campaigns, setCampaigns] = useState<OwnedCampaign[] | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  async function refresh() {
    try {
      const data = await getOwnedCampaigns(businessPageId);
      setCampaigns(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load campaigns.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessPageId]);

  async function handlePauseToggle(campaign: OwnedCampaign) {
    setPendingActionId(campaign.id);
    setError(null);
    try {
      if (campaign.isPaused) {
        await resumeCampaign(campaign.id);
        setMessage(`"${campaign.name}" resumed.`);
      } else {
        await pauseCampaign(campaign.id);
        setMessage(`"${campaign.name}" paused.`);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update this campaign.");
    } finally {
      setPendingActionId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-ink-300">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-bold text-ink-900">Your campaigns</h3>
          <p className="mt-0.5 text-sm text-ink-500">
            Boost visibility for specific services, in specific cities, for a set period.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500"
        >
          <Plus className="h-4 w-4" />
          New campaign
        </button>
      </div>

      {message && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-600">{message}</p>}
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}

      {showCreateForm && (
        <CreateCampaignForm
          businessPageId={businessPageId}
          onDone={async (successMessage) => {
            setShowCreateForm(false);
            setMessage(successMessage);
            setError(null);
            await refresh();
          }}
          onError={setError}
        />
      )}

      {campaigns && campaigns.length === 0 && !showCreateForm && (
        <p className="rounded-lg border border-ink-100 bg-white p-6 text-center text-sm text-ink-500 shadow-sm">
          No campaigns yet. Create one to boost your visibility for a specific service and city.
        </p>
      )}

      <div className="space-y-3">
        {campaigns?.map((campaign) => (
          <div key={campaign.id} className="rounded-lg border border-ink-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {campaign.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={campaign.imageUrl}
                    alt=""
                    className="h-14 w-14 flex-shrink-0 rounded-md object-cover"
                  />
                )}
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                    <Rocket className="h-3.5 w-3.5 text-green-600" />
                    {campaign.name}
                  </p>
                  {campaign.caption && <p className="mt-0.5 text-sm text-ink-700">{campaign.caption}</p>}
                  <p className="mt-1 text-xs text-ink-300">
                    {campaign.placementType === "TOP_OF_SEARCH" ? "Top of Search Results" : "Featured Badge"} ·
                    {" "}
                    {new Date(campaign.startDate).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                    {" – "}
                    {new Date(campaign.endDate).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>

              <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                <span className="font-display text-sm font-bold text-ink-900">
                  ₦{campaign.totalPriceNaira.toLocaleString("en-NG")}
                </span>
                {campaign.creativeApprovalStatus !== "NONE" && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${CREATIVE_STATUS_STYLES[campaign.creativeApprovalStatus]}`}
                  >
                    {CREATIVE_STATUS_LABELS[campaign.creativeApprovalStatus]}
                  </span>
                )}
                {campaign.isExpired ? (
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-500">Ended</span>
                ) : campaign.isPaused ? (
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-500">Paused</span>
                ) : (
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">Active</span>
                )}
              </div>
            </div>

            {campaign.creativeApprovalStatus === "REJECTED" && campaign.creativeReviewNotes && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
                Ad rejected: {campaign.creativeReviewNotes}
              </p>
            )}

            <div className="mt-3 space-y-1.5 border-t border-ink-100 pt-3">
              {campaign.targets.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">
                    {t.keyword.name} · {t.localGovernment.name}
                  </span>
                  <span className="text-ink-300">
                    ₦{t.priceNaira.toLocaleString("en-NG")} · {t.impressionCount} views · {t.clickCount} clicks
                  </span>
                </div>
              ))}
            </div>

            {!campaign.isExpired && (
              <button
                type="button"
                onClick={() => handlePauseToggle(campaign)}
                disabled={pendingActionId === campaign.id}
                className="mt-3 flex items-center gap-1.5 rounded-md border border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-ink-300 disabled:opacity-50"
              >
                {campaign.isPaused ? (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    Pause
                  </>
                )}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateCampaignForm({
  businessPageId,
  onDone,
  onError,
}: {
  businessPageId: string;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [placementType, setPlacementType] = useState<"TOP_OF_SEARCH" | "FEATURED_BADGE">("TOP_OF_SEARCH");
  const [durationDays, setDurationDays] = useState<DurationDays>(30);

  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [states, setStates] = useState<LocationOption[]>([]);
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [lgas, setLgas] = useState<LocationOption[]>([]);
  const [lgasLoading, setLgasLoading] = useState(false);

  const [pendingKeywordId, setPendingKeywordId] = useState<string | null>(null);
  const [pendingLgaId, setPendingLgaId] = useState<string | null>(null);
  const [targets, setTargets] = useState<CampaignTargetInput[]>([]);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  const [pricedTargets, setPricedTargets] = useState<
    { keywordId: string; localGovernmentId: string; priceNaira: number; competitorCount: number; isAdminOverride: boolean }[]
  >([]);
  const [totalPriceNaira, setTotalPriceNaira] = useState<number | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    Promise.all([getBusinessKeywordsForCampaign(businessPageId), getAllStatesForCampaign()])
      .then(([kw, st]) => {
        setKeywords(kw);
        setStates(st);
        if (kw.length > 0) setPendingKeywordId(kw[0].id);
      })
      .catch((e) => onError(e instanceof Error ? e.message : "Couldn't load campaign options."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessPageId]);

  useEffect(() => {
    if (!selectedStateId) {
      setLgas([]);
      return;
    }
    setLgasLoading(true);
    getLocalGovernmentsForCampaign(selectedStateId)
      .then((data) => {
        setLgas(data);
        setPendingLgaId(data[0]?.id ?? null);
      })
      .finally(() => setLgasLoading(false));
  }, [selectedStateId]);

  useEffect(() => {
    if (targets.length === 0) {
      setPricedTargets([]);
      setTotalPriceNaira(null);
      return;
    }
    setPricingLoading(true);
    getCampaignTargetsPricing(businessPageId, placementType, durationDays, targets)
      .then((result) => {
        setPricedTargets(result.targets);
        setTotalPriceNaira(result.totalPriceNaira);
      })
      .catch((e) => onError(e instanceof Error ? e.message : "Couldn't calculate pricing."))
      .finally(() => setPricingLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessPageId, placementType, durationDays, targets]);

  function addTarget() {
    if (!pendingKeywordId || !pendingLgaId) {
      onError("Pick a keyword and a city first.");
      return;
    }
    const alreadyAdded = targets.some(
      (t) => t.keywordId === pendingKeywordId && t.localGovernmentId === pendingLgaId
    );
    if (alreadyAdded) {
      onError("You've already added this keyword and city combination.");
      return;
    }
    setTargets((prev) => [...prev, { keywordId: pendingKeywordId, localGovernmentId: pendingLgaId }]);
  }

  function removeTarget(index: number) {
    setTargets((prev) => prev.filter((_, i) => i !== index));
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      onError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError("Image must be under 5MB.");
      return;
    }
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit() {
    if (targets.length === 0) {
      onError("Add at least one keyword and city target.");
      return;
    }
    setIsPurchasing(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        const supabase = createClient();
        const ext = imageFile.name.split(".").pop();
        const path = `${businessPageId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("ad-creative-images")
          .upload(path, imageFile);
        if (uploadError) {
          throw new Error("Couldn't upload your image. Please try again.");
        }
        const { data: urlData } = supabase.storage.from("ad-creative-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      const { authorizationUrl } = await initiateCampaignPurchase(
        businessPageId,
        name,
        placementType,
        durationDays,
        targets,
        imageUrl,
        caption.trim() || null
      );
      window.location.href = authorizationUrl;
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't start payment.");
      setIsPurchasing(false);
    }
  }

  return (
    <div className="rounded-lg border border-ink-100 bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">Campaign name</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Summer Promo"
          className="mt-2 w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300"
        />
      </div>

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

      <div className="mt-4 rounded-md bg-ink-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">
          Add a keyword + city target
        </p>
        <p className="mt-1 text-xs text-ink-500">
          You can target any city in Nigeria, not just your own. Add as many keyword/city combinations as you like —
          each is priced individually.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <select
            value={pendingKeywordId ?? ""}
            onChange={(e) => setPendingKeywordId(e.target.value)}
            className="rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900"
          >
            {keywords.length === 0 && <option value="">No keywords on your page yet</option>}
            {keywords.map((kw) => (
              <option key={kw.id} value={kw.id}>
                {kw.name}
              </option>
            ))}
          </select>
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
            value={pendingLgaId ?? ""}
            onChange={(e) => setPendingLgaId(e.target.value)}
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
        <button
          type="button"
          onClick={addTarget}
          disabled={keywords.length === 0}
          className="mt-2 rounded-md border border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-ink-300 disabled:opacity-50"
        >
          + Add target
        </button>
      </div>

      {targets.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {targets.map((t, i) => {
            const priced = pricedTargets.find(
              (p) => p.keywordId === t.keywordId && p.localGovernmentId === t.localGovernmentId
            );
            const keywordName = keywords.find((k) => k.id === t.keywordId)?.name ?? "…";
            const lgaName = lgas.find((l) => l.id === t.localGovernmentId)?.name ?? "…";
            return (
              <div key={i} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm">
                <span className="text-ink-700">
                  {keywordName} · {lgaName}
                  {priced && priced.competitorCount > 0 && (
                    <span className="text-ink-300"> ({priced.competitorCount} competing)</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-900">
                    {priced ? `₦${priced.priceNaira.toLocaleString("en-NG")}` : pricingLoading ? "…" : ""}
                  </span>
                  <button type="button" onClick={() => removeTarget(i)} className="text-ink-300 hover:text-danger">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">
          Ad creative <span className="text-ink-300">(optional — needs admin approval before it goes live)</span>
        </p>
        <div className="mt-2 flex items-center gap-3">
          <label className="flex h-20 w-20 flex-shrink-0 cursor-pointer items-center justify-center rounded-md border border-dashed border-ink-100 text-ink-300 hover:border-ink-300">
            {imagePreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreviewUrl} alt="" className="h-full w-full rounded-md object-cover" />
            ) : (
              <ImageIcon className="h-6 w-6" />
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageSelect} className="hidden" />
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 120))}
            placeholder="Short caption (max 120 characters)…"
            rows={2}
            className="flex-1 rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300"
          />
        </div>
      </div>

      <div className="mt-5 rounded-md bg-ink-50 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-ink-700">Total price</p>
          <p className="font-display text-2xl font-extrabold text-ink-900">
            {totalPriceNaira !== null ? `₦${totalPriceNaira.toLocaleString("en-NG")}` : "—"}
          </p>
        </div>
        {targets.length > 0 && (
          <p className="mt-1 text-xs text-ink-300">
            {targets.length} target{targets.length === 1 ? "" : "s"} — price is the sum of each keyword + city
            combination.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPurchasing || targets.length === 0 || pricingLoading || !name.trim()}
        className="mt-4 w-full rounded-md bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50"
      >
        {isPurchasing ? "Redirecting to payment…" : "Proceed to Payment"}
      </button>
      <p className="mt-2 text-center text-xs text-ink-300">You&apos;ll be taken to Paystack to complete payment securely.</p>
    </div>
  );
}
