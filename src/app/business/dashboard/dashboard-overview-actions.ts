"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { calculateCompletenessScore } from "@/lib/completeness-score";

async function requireOwnedBusinessPage(businessPageId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const page = await prisma.businessPage.findUnique({
    where: { id: businessPageId },
    select: { ownerUserId: true },
  });
  if (!page || page.ownerUserId !== user.id) {
    throw new Error("You don't own this business page.");
  }

  return user;
}

// All business pages the signed-in user owns — feeds the page switcher at
// the top of the dashboard, since an owner can have more than one page
// (confirmed via UserManagementClient's businessPages list elsewhere).
export async function getOwnedBusinessPages() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  return prisma.businessPage.findMany({
    where: { ownerUserId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true },
  });
}

function getWeekBoundaries() {
  const now = new Date();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - 7);
  const startOfLastWeek = new Date(now);
  startOfLastWeek.setDate(now.getDate() - 14);

  return { now, startOfThisWeek, startOfLastWeek };
}

// Overview tab: page views, followers, and review score, each "this week
// vs last week" per brief Section 11. Follower count and review score are
// point-in-time values (there's no historical snapshot table for these),
// so "vs last week" for those two means "as of 7 days ago" computed from
// the underlying rows' own createdAt timestamps — followers gained/lost
// and reviews submitted in each window — not a literal stored snapshot.
export async function getDashboardOverview(businessPageId: string) {
  await requireOwnedBusinessPage(businessPageId);

  const { now, startOfThisWeek, startOfLastWeek } = getWeekBoundaries();

  const [
    pageViewsThisWeek,
    pageViewsLastWeek,
    followersThisWeek,
    followersLastWeek,
    totalFollowers,
    reviewsThisWeek,
    reviewsLastWeek,
    allReviews,
  ] = await Promise.all([
    prisma.pageView.count({ where: { businessPageId, createdAt: { gte: startOfThisWeek, lte: now } } }),
    prisma.pageView.count({ where: { businessPageId, createdAt: { gte: startOfLastWeek, lt: startOfThisWeek } } }),
    prisma.follow.count({ where: { businessPageId, createdAt: { gte: startOfThisWeek, lte: now } } }),
    prisma.follow.count({ where: { businessPageId, createdAt: { gte: startOfLastWeek, lt: startOfThisWeek } } }),
    prisma.follow.count({ where: { businessPageId } }),
    prisma.review.findMany({
      where: { businessPageId, createdAt: { gte: startOfThisWeek, lte: now } },
      select: { rating: true },
    }),
    prisma.review.findMany({
      where: { businessPageId, createdAt: { gte: startOfLastWeek, lt: startOfThisWeek } },
      select: { rating: true },
    }),
    prisma.review.findMany({ where: { businessPageId }, select: { rating: true } }),
  ]);

  const avg = (rows: { rating: number }[]) =>
    rows.length > 0 ? rows.reduce((sum, r) => sum + r.rating, 0) / rows.length : null;

  return {
    pageViews: { thisWeek: pageViewsThisWeek, lastWeek: pageViewsLastWeek },
    newFollowers: { thisWeek: followersThisWeek, lastWeek: followersLastWeek },
    totalFollowers,
    reviewScore: {
      overall: avg(allReviews),
      thisWeek: avg(reviewsThisWeek),
      lastWeek: avg(reviewsLastWeek),
      countThisWeek: reviewsThisWeek.length,
    },
  };
}

// Profile completeness — see src/lib/completeness-score.ts for the
// formula itself. This action both computes the live score AND persists
// it back to BusinessPage.completenessScore, since that column already
// exists and is read elsewhere (e.g. business page management's detail
// view) but has never actually been kept up to date.
export async function getCompletenessScore(businessPageId: string) {
  await requireOwnedBusinessPage(businessPageId);

  const page = await prisma.businessPage.findUnique({
    where: { id: businessPageId },
    select: {
      description: true,
      address: true,
      phone: true,
      email: true,
      website: true,
      hours: true,
      _count: { select: { media: true, businessKeywords: true } },
    },
  });
  if (!page) {
    throw new Error("Business page not found.");
  }

  const result = calculateCompletenessScore({
    description: page.description,
    address: page.address,
    phone: page.phone,
    email: page.email,
    website: page.website,
    hours: page.hours,
    hasPhoto: page._count.media > 0,
    hasKeyword: page._count.businessKeywords > 0,
  });

  // Best-effort sync of the stored column — if this write fails for any
  // reason, the score we just calculated is still returned to the caller
  // correctly, so the dashboard never shows a stale 0 just because this
  // particular write had a hiccup.
  await prisma.businessPage
    .update({ where: { id: businessPageId }, data: { completenessScore: result.score } })
    .catch((err) => console.error("Failed to persist completenessScore:", err));

  return result;
}

// Verification status — current state plus the most recent request's
// details, reusing the same shape already established by
// VerificationSection on the public business page, since the dashboard
// is meant to surface the same information, not a different version of it.
export async function getVerificationStatus(businessPageId: string) {
  await requireOwnedBusinessPage(businessPageId);

  const [page, latestRequest] = await Promise.all([
    prisma.businessPage.findUnique({
      where: { id: businessPageId },
      select: { verificationStatus: true },
    }),
    prisma.verificationRequest.findFirst({
      where: { businessPageId },
      orderBy: { createdAt: "desc" },
      select: { cacNumber: true, status: true, reviewNotes: true, createdAt: true },
    }),
  ]);
  if (!page) {
    throw new Error("Business page not found.");
  }

  return {
    verificationStatus: page.verificationStatus,
    latestRequest: latestRequest
      ? {
          cacNumber: latestRequest.cacNumber,
          status: latestRequest.status,
          reviewNotes: latestRequest.reviewNotes,
          createdAt: latestRequest.createdAt.toISOString(),
        }
      : null,
  };
}
