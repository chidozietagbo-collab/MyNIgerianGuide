"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/components/require-permission";

type ReportWithContext = {
  id: string;
  entityType: string;
  entityId: string;
  reason: string;
  createdAt: string;
  reporterEmail: string;
  // Context differs by entity type — only the relevant one is populated.
  context: {
    label: string;
    detail: string;
    businessSlug?: string;
  } | null;
};

export async function getOpenReports(): Promise<ReportWithContext[]> {
  await requirePermission("report.view");

  const reports = await prisma.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      reason: true,
      createdAt: true,
      reporter: { select: { email: true } },
    },
  });

  // Each report's entityId points to a different table depending on
  // entityType — Prisma can't do a single polymorphic include for this,
  // so fetch context per type and stitch it together.
  const results: ReportWithContext[] = [];

  for (const report of reports) {
    let context: ReportWithContext["context"] = null;

    if (report.entityType === "POST") {
      const post = await prisma.post.findUnique({
        where: { id: report.entityId },
        select: { content: true, businessPage: { select: { name: true, slug: true } } },
      });
      if (post) {
        context = {
          label: `Post on ${post.businessPage.name}`,
          detail: post.content,
          businessSlug: post.businessPage.slug,
        };
      }
    } else if (report.entityType === "REVIEW") {
      const review = await prisma.review.findUnique({
        where: { id: report.entityId },
        select: { body: true, rating: true, businessPage: { select: { name: true, slug: true } } },
      });
      if (review) {
        context = {
          label: `${review.rating}-star review on ${review.businessPage.name}`,
          detail: review.body || "(no written review, rating only)",
          businessSlug: review.businessPage.slug,
        };
      }
    } else if (report.entityType === "BUSINESS_PAGE") {
      const business = await prisma.businessPage.findUnique({
        where: { id: report.entityId },
        select: { name: true, slug: true, description: true },
      });
      if (business) {
        context = {
          label: business.name,
          detail: business.description || "(no description)",
          businessSlug: business.slug,
        };
      }
    }

    results.push({
      id: report.id,
      entityType: report.entityType,
      entityId: report.entityId,
      reason: report.reason,
      createdAt: report.createdAt.toISOString(),
      reporterEmail: report.reporter.email,
      context,
    });
  }

  return results;
}

async function resolveReport(reportId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  await prisma.report.update({
    where: { id: reportId },
    data: { status: "RESOLVED", resolvedById: user.id, resolvedAt: new Date() },
  });
}

export async function dismissReport(reportId: string) {
  await requirePermission("report.resolve");
  await resolveReport(reportId);
  revalidatePath("/admin/moderation-queue");
}

// "Take action" — hides/deletes the underlying content, then closes the
// report. Permission checks are per-entity-type since a Moderation
// Officer might have report.resolve but the specific content permission
// is what actually authorizes touching the post/review/business itself.
export async function takeActionOnPost(reportId: string, postId: string, action: "hide" | "delete") {
  if (action === "hide") {
    await requirePermission("post.moderate");
    await prisma.post.update({ where: { id: postId }, data: { isHidden: true } });
  } else {
    await requirePermission("post.delete");
    await prisma.post.delete({ where: { id: postId } });
  }
  await resolveReport(reportId);
  revalidatePath("/admin/moderation-queue");
}

export async function takeActionOnReview(reportId: string, reviewId: string) {
  await requirePermission("review.delete");

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { businessPageId: true },
  });

  await prisma.review.delete({ where: { id: reviewId } });

  // Recalculate the business's average rating after removing a review —
  // same logic as the reviewer-initiated delete path in review-actions.ts,
  // since leaving averageRating stale after a moderator removes a fake
  // review would be a real, visible bug.
  if (review) {
    const result = await prisma.review.aggregate({
      where: { businessPageId: review.businessPageId },
      _avg: { rating: true },
    });
    await prisma.businessPage.update({
      where: { id: review.businessPageId },
      data: { averageRating: result._avg.rating ?? 0 },
    });
  }

  await resolveReport(reportId);
  revalidatePath("/admin/moderation-queue");
}

export async function takeActionOnBusiness(reportId: string, businessPageId: string) {
  await requirePermission("business.unpublish");
  await prisma.businessPage.update({ where: { id: businessPageId }, data: { isPublished: false } });
  await resolveReport(reportId);
  revalidatePath("/admin/moderation-queue");
}
