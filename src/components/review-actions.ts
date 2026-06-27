"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "./create-notification";

async function recalculateAverageRating(businessPageId: string) {
  const result = await prisma.review.aggregate({
    where: { businessPageId },
    _avg: { rating: true },
  });

  await prisma.businessPage.update({
    where: { id: businessPageId },
    data: { averageRating: result._avg.rating ?? 0 },
  });
}

async function requireSignedIn() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }
  return user;
}

// ---------------------------------------------------------------------------
// Create — must already be following the business. No extra time delay
// beyond that, matching the Instagram/Twitter-style follow-then-review
// pattern decided earlier.
// ---------------------------------------------------------------------------
export async function createReview(businessPageId: string, rating: number, body: string) {
  const user = await requireSignedIn();

  const business = await prisma.businessPage.findUnique({
    where: { id: businessPageId },
    select: { slug: true, name: true, ownerUserId: true },
  });
  if (!business) {
    throw new Error("Business not found.");
  }
  if (business.ownerUserId === user.id) {
    throw new Error("You can't review your own business.");
  }
  if (rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }

  const isFollowing = await prisma.follow.findUnique({
    where: { followerUserId_businessPageId: { followerUserId: user.id, businessPageId } },
  });
  if (!isFollowing) {
    throw new Error("Follow this business before leaving a review.");
  }

  await prisma.review.create({
    data: {
      userId: user.id,
      businessPageId,
      rating,
      body: body.trim() || null,
    },
  });

  await recalculateAverageRating(businessPageId);

  const reviewer = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true },
  });
  const reviewerName = reviewer?.name || reviewer?.email.split("@")[0] || "Someone";

  await createNotification({
    userId: business.ownerUserId,
    type: "NEW_REVIEW",
    title: `${reviewerName} left a ${rating}-star review on ${business.name}`,
    entityType: "BUSINESS_PAGE",
    entityId: businessPageId,
  });

  revalidatePath(`/b/${business.slug}`);
  revalidatePath(`/business/dashboard/${businessPageId}`);
}

// ---------------------------------------------------------------------------
// Update — the reviewer editing their own rating/text. Deliberately only
// ever sets rating/body, never ownerResponse, so a reviewer's edit can
// never overwrite the owner's reply even though the RLS policy technically
// permits writing to the same row.
// ---------------------------------------------------------------------------
export async function updateReview(reviewId: string, rating: number, body: string) {
  const user = await requireSignedIn();

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { userId: true, businessPage: { select: { id: true, slug: true } } },
  });
  if (!review || review.userId !== user.id) {
    throw new Error("You don't own this review.");
  }
  if (rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }

  await prisma.review.update({
    where: { id: reviewId },
    data: { rating, body: body.trim() || null },
  });

  await recalculateAverageRating(review.businessPage.id);
  revalidatePath(`/b/${review.businessPage.slug}`);
  revalidatePath(`/business/dashboard/${review.businessPage.id}`);
}

export async function deleteReview(reviewId: string) {
  const user = await requireSignedIn();

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { userId: true, businessPage: { select: { id: true, slug: true } } },
  });
  if (!review || review.userId !== user.id) {
    throw new Error("You don't own this review.");
  }

  await prisma.review.delete({ where: { id: reviewId } });
  await recalculateAverageRating(review.businessPage.id);
  revalidatePath(`/b/${review.businessPage.slug}`);
  revalidatePath(`/business/dashboard/${review.businessPage.id}`);
}

// ---------------------------------------------------------------------------
// Owner reply — deliberately only ever touches ownerResponse, never
// rating/body, so a reply can never alter the reviewer's actual review.
// ---------------------------------------------------------------------------
export async function replyToReview(reviewId: string, response: string) {
  const user = await requireSignedIn();

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { userId: true, businessPage: { select: { id: true, slug: true, ownerUserId: true, name: true } } },
  });
  if (!review || review.businessPage.ownerUserId !== user.id) {
    throw new Error("You don't own this business page.");
  }

  const trimmed = response.trim();
  if (!trimmed) {
    throw new Error("Reply can't be empty.");
  }

  await prisma.review.update({
    where: { id: reviewId },
    data: { ownerResponse: trimmed },
  });

  await createNotification({
    userId: review.userId,
    type: "REVIEW_REPLY",
    title: `${review.businessPage.name} replied to your review`,
    entityType: "BUSINESS_PAGE",
    entityId: review.businessPage.id,
  });

  revalidatePath(`/b/${review.businessPage.slug}`);
  revalidatePath(`/business/dashboard/${review.businessPage.id}`);
}

export async function deleteReply(reviewId: string) {
  const user = await requireSignedIn();

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { businessPage: { select: { id: true, slug: true, ownerUserId: true } } },
  });
  if (!review || review.businessPage.ownerUserId !== user.id) {
    throw new Error("You don't own this business page.");
  }

  await prisma.review.update({
    where: { id: reviewId },
    data: { ownerResponse: null },
  });

  revalidatePath(`/b/${review.businessPage.slug}`);
  revalidatePath(`/business/dashboard/${review.businessPage.id}`);
}
