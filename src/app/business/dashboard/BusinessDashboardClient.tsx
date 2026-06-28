"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  Rocket,
} from "lucide-react";
import VerificationSection from "@/components/VerificationSection";
import PostsSection from "@/components/PostsSection";
import ReviewsSection from "@/components/ReviewsSection";
import EditableAbout from "@/components/EditableAbout";
import EditableContact from "@/components/EditableContact";
import EditableHours from "@/components/EditableHours";
import EditableKeywords from "@/components/EditableKeywords";
import PhotoGallery from "@/components/PhotoGallery";
import BoostListingPanel from "./BoostListingPanel";
import {
  getDashboardOverview,
  getCompletenessScore,
  getVerificationStatus,
} from "./dashboard-overview-actions";

type OwnedPage = { id: string; name: string; slug: string };

type PostType = {
  id: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
  likeCount: number;
  isLiked: boolean;
  comments: {
    id: string;
    authorUserId: string;
    authorName: string;
    content: string;
    createdAt: string;
  }[];
};

type ReviewType = {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  body: string | null;
  ownerResponse: string | null;
  createdAt: string;
};

type BusinessDetail = {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  category: { id: string; name: string };
  state: { id: string; name: string };
  localGovernment: { id: string; name: string };
  town: { id: string; name: string } | null;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  whatsapp: string | null;
  hours: Partial<Record<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun", { open: string; close: string; closed: boolean }>> | null;
  businessKeywords: { id: string; name: string }[];
  media: { id: string; url: string }[];
};

type OverviewData = Awaited<ReturnType<typeof getDashboardOverview>>;
type CompletenessData = Awaited<ReturnType<typeof getCompletenessScore>>;
type VerificationData = Awaited<ReturnType<typeof getVerificationStatus>>;

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "posts", label: "Posts", icon: FileText },
  { id: "reviews", label: "Reviews", icon: MessageSquare },
  { id: "boost", label: "Boost", icon: Rocket },
  { id: "settings", label: "Settings", icon: SettingsIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

type BusinessDashboardClientProps = {
  ownedPages: OwnedPage[];
  activeBusinessPageId: string;
  business: BusinessDetail;
  currentUserId: string;
  posts: PostType[];
  reviews: ReviewType[];
  averageRating: number;
};

// useSearchParams() (used below to read ?boost=success etc. after the
// Paystack callback redirect) requires a Suspense boundary in the App
// Router — same pattern already established in src/app/search/page.tsx.
export default function BusinessDashboardClient(props: BusinessDashboardClientProps) {
  return (
    <Suspense fallback={null}>
      <BusinessDashboardClientInner {...props} />
    </Suspense>
  );
}

function BusinessDashboardClientInner({
  ownedPages,
  activeBusinessPageId,
  business,
  currentUserId,
  posts,
  reviews,
  averageRating,
}: BusinessDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [boostResult, setBoostResult] = useState<string | null>(null);

  // Reads the ?boost= param the Paystack callback route redirects back
  // with (see boost/callback/route.ts), shows a result banner, switches
  // to the Boost tab so the message is in context, then strips the
  // param from the URL so refreshing the page doesn't re-show it.
  useEffect(() => {
    const boost = searchParams.get("boost");
    if (boost) {
      setBoostResult(boost);
      setActiveTab("boost");
      router.replace(`/business/dashboard/${activeBusinessPageId}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Business dashboard</h1>
          <p className="mt-1 text-sm text-ink-500">{business.name}</p>
        </div>

        {/* A real navigation, not client state — the active page lives in
            the URL (/business/dashboard/[businessPageId]) so that
            PostsSection/ReviewsSection's router.refresh() calls correctly
            re-fetch THIS page's data after an edit. */}
        {ownedPages.length > 1 && (
          <select
            value={activeBusinessPageId}
            onChange={(e) => {
              window.location.href = `/business/dashboard/${e.target.value}`;
            }}
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
        {activeTab === "overview" && (
          <OverviewTab businessPageId={business.id} businessSlug={business.slug} />
        )}

        {activeTab === "posts" && (
          <PostsSection
            businessPageId={business.id}
            businessSlug={business.slug}
            initialPosts={posts}
            isOwner
            currentUserId={currentUserId}
            isSignedIn
          />
        )}

        {activeTab === "reviews" && (
          <ReviewsSection
            businessPageId={business.id}
            initialReviews={reviews}
            averageRating={averageRating}
            currentUserId={currentUserId}
            isOwner
            isFollowing={false}
            isSignedIn
          />
        )}

        {activeTab === "boost" && (
          <>
            {boostResult === "success" && (
              <p className="mb-4 rounded-md bg-green-50 px-3 py-2.5 text-sm text-green-600">
                Payment confirmed — your sponsored listing is now active.
              </p>
            )}
            {boostResult === "failed" && (
              <p className="mb-4 rounded-md bg-red-50 px-3 py-2.5 text-sm text-danger">
                Payment wasn&apos;t completed. You haven&apos;t been charged — feel free to try again.
              </p>
            )}
            {(boostResult === "error" || boostResult === "missing_reference") && (
              <p className="mb-4 rounded-md bg-[#FFFBEB] px-3 py-2.5 text-sm text-ink-700">
                We couldn&apos;t confirm your payment right away. If you were charged, it should still go through
                shortly — check back in a few minutes before trying again.
              </p>
            )}
            <BoostListingPanel businessPageId={business.id} />
          </>
        )}

        {activeTab === "settings" && (
          <div className="space-y-6">
            <section className="rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">About</h2>
                <EditableAbout
                  businessPageId={business.id}
                  currentDescription={business.description}
                  currentAddress={business.address}
                />
              </div>
              {business.description && (
                <p className="mt-2 text-sm leading-relaxed text-ink-700">{business.description}</p>
              )}
            </section>

            <section className="rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">Photos</h2>
              </div>
              <div className="mt-3">
                <PhotoGallery
                  businessPageId={business.id}
                  initialPhotos={business.media}
                  isOwner
                />
              </div>
            </section>

            <section className="rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">Contact</h2>
                <EditableContact
                  businessPageId={business.id}
                  currentPhone={business.phone}
                  currentEmail={business.email}
                  currentWebsite={business.website}
                  currentWhatsapp={business.whatsapp}
                />
              </div>
            </section>

            <section className="rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">
                  Opening hours
                </h2>
                <EditableHours businessPageId={business.id} currentHours={business.hours} />
              </div>
            </section>

            <section className="rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">Services</h2>
                <EditableKeywords
                  businessPageId={business.id}
                  categoryId={business.categoryId}
                  currentKeywords={business.businessKeywords}
                />
              </div>
            </section>

            <p className="text-center text-xs text-ink-300">
              Need to change your business name, category, or location? You can do that from{" "}
              <Link href={`/b/${business.slug}`} className="text-green-600 hover:underline">
                your public business page
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </main>
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
