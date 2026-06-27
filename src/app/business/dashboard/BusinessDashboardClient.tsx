"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import {
  BarChart3,
  Users,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  MessageSquare,
  Settings as SettingsIcon,
} from "lucide-react";
import VerificationSection from "@/components/VerificationSection";
import {
  getDashboardOverview,
  getCompletenessScore,
  getVerificationStatus,
} from "./dashboard-overview-actions";

type OwnedPage = { id: string; name: string; slug: string };

type OverviewData = Awaited<ReturnType<typeof getDashboardOverview>>;
type CompletenessData = Awaited<ReturnType<typeof getCompletenessScore>>;
type VerificationData = Awaited<ReturnType<typeof getVerificationStatus>>;

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "posts", label: "Posts", icon: FileText },
  { id: "reviews", label: "Reviews", icon: MessageSquare },
  { id: "settings", label: "Settings", icon: SettingsIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function BusinessDashboardClient({
  ownedPages,
  initialPageId,
}: {
  ownedPages: OwnedPage[];
  initialPageId: string;
}) {
  const [activePageId, setActivePageId] = useState(initialPageId);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const activePage = ownedPages.find((p) => p.id === activePageId) ?? ownedPages[0];

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Business dashboard</h1>
          <p className="mt-1 text-sm text-ink-500">{activePage.name}</p>
        </div>

        {ownedPages.length > 1 && (
          <select
            value={activePageId}
            onChange={(e) => setActivePageId(e.target.value)}
            className="rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900"
          >
            {ownedPages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-6 flex gap-1 border-b border-ink-100">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={
                activeTab === tab.id
                  ? "flex items-center gap-1.5 border-b-2 border-green-600 px-3 py-2.5 text-sm font-semibold text-green-600"
                  : "flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-ink-500 hover:text-ink-900"
              }
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {activeTab === "overview" && <OverviewTab businessPageId={activePage.id} businessSlug={activePage.slug} />}
        {activeTab === "posts" && <ComingSoonTab label="Posts" />}
        {activeTab === "reviews" && <ComingSoonTab label="Reviews" />}
        {activeTab === "settings" && <ComingSoonTab label="Settings" />}
      </div>
    </main>
  );
}

function ComingSoonTab({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-white p-6 text-center shadow-sm">
      <p className="text-sm text-ink-500">
        {label} management is coming to this dashboard shortly. For now, you can manage{" "}
        {label.toLowerCase()} directly on your business page.
      </p>
    </div>
  );
}

function OverviewTab({ businessPageId, businessSlug }: { businessPageId: string; businessSlug: string }) {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [completeness, setCompleteness] = useState<CompletenessData | null>(null);
  const [verification, setVerification] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getDashboardOverview(businessPageId),
      getCompletenessScore(businessPageId),
      getVerificationStatus(businessPageId),
    ])
      .then(([o, c, v]) => {
        if (cancelled) return;
        setOverview(o);
        setCompleteness(c);
        setVerification(v);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Couldn't load your dashboard.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [businessPageId]);

  if (loading) {
    return <p className="text-sm text-ink-300">Loading…</p>;
  }
  if (error || !overview || !completeness || !verification) {
    return <p className="text-sm text-danger">{error ?? "Couldn't load your dashboard."}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Stats — page views, followers, review score, each this week vs
          last week per brief Section 11 */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={BarChart3}
          label="Page views"
          value={overview.pageViews.thisWeek}
          previous={overview.pageViews.lastWeek}
          sublabel="this week"
        />
        <StatTile
          icon={Users}
          label="New followers"
          value={overview.newFollowers.thisWeek}
          previous={overview.newFollowers.lastWeek}
          sublabel={`${overview.totalFollowers} total`}
        />
        <StatTile
          icon={Star}
          label="Review score"
          value={overview.reviewScore.thisWeek}
          previous={overview.reviewScore.lastWeek}
          sublabel={
            overview.reviewScore.overall !== null
              ? `${overview.reviewScore.overall.toFixed(1)}★ overall`
              : "No reviews yet"
          }
          isRating
        />
      </div>

      {/* Profile completeness */}
      <div className="rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-sm font-bold text-ink-900">Profile strength</p>
          <p className="font-display text-2xl font-extrabold text-green-600">{completeness.score}%</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
          <div className="h-full rounded-full bg-green-600" style={{ width: `${completeness.score}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-xs text-ink-300">
          <span>Keep going</span>
          <span>100% = Priority ranking</span>
        </div>
        {completeness.missing.length > 0 && (
          <div className="mt-3 rounded-md bg-[#FFFBEB] px-3 py-2.5 text-sm text-ink-700">
            💡 {completeness.missing[0].label}
          </div>
        )}
      </div>

      {/* Verification — reuses the same VerificationSection component
          used on the public business page, since this is the same
          information, just surfaced in the dashboard too */}
      <VerificationSection
        businessPageId={businessPageId}
        existingRequest={verification.latestRequest}
        verificationStatus={verification.verificationStatus}
      />

      <Link
        href={`/b/${businessSlug}`}
        className="block text-center text-sm font-medium text-green-600 hover:underline"
      >
        View your public business page →
      </Link>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  previous,
  sublabel,
  isRating = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number | null;
  previous: number | null;
  sublabel: string;
  isRating?: boolean;
}) {
  const hasComparison = value !== null && previous !== null;
  const delta = hasComparison ? value - previous : null;
  const TrendIcon = delta === null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const trendColor = delta === null || delta === 0 ? "text-ink-300" : delta > 0 ? "text-green-600" : "text-danger";

  return (
    <div className="rounded-lg border border-ink-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-ink-300">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-1 font-display text-2xl font-bold text-ink-900">
        {value === null ? "—" : isRating ? `${value.toFixed(1)}★` : value}
      </p>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-xs text-ink-300">{sublabel}</p>
        {hasComparison && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />
            {Math.abs(delta!).toFixed(isRating ? 1 : 0)}
          </span>
        )}
      </div>
    </div>
  );
}
