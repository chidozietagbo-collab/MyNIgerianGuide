"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/components/require-permission";
import { createNotification } from "@/components/create-notification";
import { logAdminAction } from "@/components/log-admin-action";

export async function searchBusinessPages(query: string) {
  await requirePermission("business.view");

  const trimmed = query.trim();
  if (!trimmed) {
    return prisma.businessPage.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        slug: true,
        isPublished: true,
        verificationStatus: true,
        createdAt: true,
        owner: { select: { id: true, name: true, email: true } },
      },
    });
  }

  return prisma.businessPage.findMany({
    where: { name: { contains: trimmed, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      name: true,
      slug: true,
      isPublished: true,
      verificationStatus: true,
      createdAt: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getBusinessPageDetail(businessPageId: string) {
  await requirePermission("business.view");

  const page = await prisma.businessPage.findUnique({
    where: { id: businessPageId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      address: true,
      phone: true,
      email: true,
      website: true,
      isPublished: true,
      isClaimed: true,
      verificationStatus: true,
      averageRating: true,
      completenessScore: true,
      createdAt: true,
      owner: { select: { id: true, name: true, email: true } },
      category: { select: { name: true } },
      state: { select: { name: true } },
      localGovernment: { select: { name: true } },
      _count: { select: { posts: true, reviews: true, follows: true } },
    },
  });
  if (!page) {
    throw new Error("Business page not found.");
  }

  return page;
}

// Gated to admin.view_audit_log specifically, same pattern as the user
// detail page's account history section — returns null rather than
// throwing so the UI can simply not render this section for admins like
// Support Agent who can view business pages but not the full audit trail.
export async function getBusinessPageAuditHistory(businessPageId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: user.id },
    select: {
      isActive: true,
      userRoles: {
        select: {
          role: {
            select: { rolePermissions: { select: { permission: { select: { key: true } } } } },
          },
        },
      },
    },
  });

  const hasAuditPermission =
    !!adminUser?.isActive &&
    adminUser.userRoles.some((ur) =>
      ur.role.rolePermissions.some((rp) => rp.permission.key === "admin.view_audit_log")
    );

  if (!hasAuditPermission) {
    return null;
  }

  const entries = await prisma.auditLog.findMany({
    where: { entityType: "BUSINESS_PAGE", entityId: businessPageId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      action: true,
      reason: true,
      metadata: true,
      createdAt: true,
      adminUser: { select: { name: true, email: true } },
    },
  });

  return entries.map((e) => ({
    id: e.id,
    action: e.action,
    reason: e.reason,
    metadata: e.metadata,
    createdAt: e.createdAt.toISOString(),
    adminName: e.adminUser.name || e.adminUser.email.split("@")[0],
  }));
}

export async function unpublishBusinessPage(businessPageId: string, reason: string) {
  const admin = await requirePermission("business.unpublish");

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Please provide a reason for unpublishing this page.");
  }

  const page = await prisma.businessPage.update({
    where: { id: businessPageId },
    data: { isPublished: false },
    select: { slug: true, name: true, ownerUserId: true },
  });

  await createNotification({
    userId: page.ownerUserId,
    type: "BUSINESS_PAGE_UNPUBLISHED",
    title: `Your business page "${page.name}" has been unpublished`,
    body: trimmedReason,
    entityType: "BUSINESS_PAGE",
    entityId: businessPageId,
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: "business.unpublish",
    entityType: "BUSINESS_PAGE",
    entityId: businessPageId,
    reason: trimmedReason,
  });

  revalidatePath(`/b/${page.slug}`);
  revalidatePath("/admin/business-pages");
}

export async function republishBusinessPage(businessPageId: string, reason: string) {
  const admin = await requirePermission("business.unpublish");

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Please provide a reason for republishing this page.");
  }

  const page = await prisma.businessPage.update({
    where: { id: businessPageId },
    data: { isPublished: true },
    select: { slug: true, name: true, ownerUserId: true },
  });

  await createNotification({
    userId: page.ownerUserId,
    type: "BUSINESS_PAGE_REPUBLISHED",
    title: `Your business page "${page.name}" has been republished`,
    body: trimmedReason,
    entityType: "BUSINESS_PAGE",
    entityId: businessPageId,
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: "business.republish",
    entityType: "BUSINESS_PAGE",
    entityId: businessPageId,
    reason: trimmedReason,
  });

  revalidatePath(`/b/${page.slug}`);
  revalidatePath("/admin/business-pages");
}

// Manual override outside the normal verification-queue flow — for
// edge cases (e.g. verified in error, or verifying without a formal
// request on file). Sets verificationStatus directly rather than going
// through a VerificationRequest row, since there may not be one.
export async function verifyBusinessPageOverride(businessPageId: string, reason: string) {
  const admin = await requirePermission("business.verify");

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Please provide a reason for this verification override.");
  }

  const page = await prisma.businessPage.update({
    where: { id: businessPageId },
    data: { verificationStatus: "VERIFIED" },
    select: { slug: true, name: true, ownerUserId: true },
  });

  await createNotification({
    userId: page.ownerUserId,
    type: "BUSINESS_PAGE_VERIFIED",
    title: `Your business page "${page.name}" is now verified`,
    body: trimmedReason,
    entityType: "BUSINESS_PAGE",
    entityId: businessPageId,
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: "business.verify_override",
    entityType: "BUSINESS_PAGE",
    entityId: businessPageId,
    reason: trimmedReason,
  });

  revalidatePath(`/b/${page.slug}`);
  revalidatePath("/admin/business-pages");
}

// Sets the status to REVOKED rather than UNVERIFIED — REVOKED records
// that this page WAS verified and that was deliberately taken away,
// which is a different fact than having never been verified at all.
export async function revokeBusinessPageVerification(businessPageId: string, reason: string) {
  const admin = await requirePermission("business.verify");

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Please provide a reason for revoking this page's verification.");
  }

  const page = await prisma.businessPage.update({
    where: { id: businessPageId },
    data: { verificationStatus: "REVOKED" },
    select: { slug: true, name: true, ownerUserId: true },
  });

  await createNotification({
    userId: page.ownerUserId,
    type: "BUSINESS_PAGE_VERIFICATION_REVOKED",
    title: `Verification for "${page.name}" has been revoked`,
    body: trimmedReason,
    entityType: "BUSINESS_PAGE",
    entityId: businessPageId,
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: "business.verify_revoke",
    entityType: "BUSINESS_PAGE",
    entityId: businessPageId,
    reason: trimmedReason,
  });

  revalidatePath(`/b/${page.slug}`);
  revalidatePath("/admin/business-pages");
}

// Hard delete. Unlike the user soft-delete pattern, there is no
// DELETED-style status on BusinessPage to mark instead (see schema:
// only isPublished and verificationStatus exist).
//
// None of BusinessPage's relations use onDelete: Cascade, so a plain
// prisma.businessPage.delete() would fail with a foreign key violation
// the moment the page has any posts, reviews, follows, media, etc. —
// which is true of almost every real page. Dependent rows have to be
// removed first, in dependency order (comments/likes before their
// posts, everything before the page itself), inside one transaction so
// a failure partway through doesn't leave the page half-deleted.
//
// Media rows point at real files in Supabase Storage (bucket
// "business-photos"), not just DB rows — those are removed too, using
// the same URL-to-path parsing already used for single-photo deletion
// in src/components/actions.ts, so no orphaned files are left behind.
export async function deleteBusinessPage(businessPageId: string, reason: string) {
  const admin = await requirePermission("business.delete");

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Please provide a reason for deleting this page.");
  }

  const page = await prisma.businessPage.findUnique({
    where: { id: businessPageId },
    select: {
      name: true,
      ownerUserId: true,
      media: { select: { url: true } },
    },
  });
  if (!page) {
    throw new Error("Business page not found.");
  }

  // Notify before deleting, since the row (and the FK it relies on)
  // won't exist afterward.
  await createNotification({
    userId: page.ownerUserId,
    type: "BUSINESS_PAGE_DELETED",
    title: `Your business page "${page.name}" has been deleted`,
    body: trimmedReason,
  });

  await prisma.$transaction(async (tx) => {
    const posts = await tx.post.findMany({
      where: { businessPageId },
      select: { id: true },
    });
    const postIds = posts.map((p) => p.id);

    const reviews = await tx.review.findMany({
      where: { businessPageId },
      select: { id: true },
    });
    const reviewIds = reviews.map((r) => r.id);

    // Report uses a generic entityType/entityId pair rather than a real
    // foreign key, so Prisma won't block on it — but leaving these rows
    // behind would mean the moderation queue points at IDs that no
    // longer exist. Clean up reports against the page itself and
    // against anything being deleted along with it.
    await tx.report.deleteMany({
      where: { entityType: "BUSINESS_PAGE", entityId: businessPageId },
    });
    if (postIds.length > 0) {
      await tx.report.deleteMany({ where: { entityType: "POST", entityId: { in: postIds } } });
      await tx.comment.deleteMany({ where: { postId: { in: postIds } } });
      await tx.postLike.deleteMany({ where: { postId: { in: postIds } } });
      await tx.post.deleteMany({ where: { businessPageId } });
    }
    if (reviewIds.length > 0) {
      await tx.report.deleteMany({ where: { entityType: "REVIEW", entityId: { in: reviewIds } } });
    }

    await tx.businessKeyword.deleteMany({ where: { businessPageId } });
    await tx.follow.deleteMany({ where: { businessPageId } });
    await tx.review.deleteMany({ where: { businessPageId } });
    await tx.media.deleteMany({ where: { businessPageId } });
    await tx.verificationRequest.deleteMany({ where: { businessPageId } });
    await tx.sponsoredListing.deleteMany({ where: { businessPageId } });
    await tx.pageView.deleteMany({ where: { businessPageId } });

    await tx.businessPage.delete({ where: { id: businessPageId } });
  });

  // Clean up Storage files for any photos this page had — best-effort,
  // outside the transaction since Storage isn't transactional with
  // Postgres anyway. A failure here would leave an orphaned file, not
  // a broken database state, so it's logged rather than thrown.
  const marker = "/business-photos/";
  const objectPaths = page.media
    .map((m) => {
      const idx = m.url.indexOf(marker);
      return idx !== -1 ? m.url.slice(idx + marker.length) : null;
    })
    .filter((p): p is string => p !== null);

  if (objectPaths.length > 0) {
    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin.storage.from("business-photos").remove(objectPaths);
    if (error) {
      console.error("Failed to remove business-photos files after page deletion:", error);
    }
  }

  await logAdminAction({
    adminUserId: admin.id,
    action: "business.delete",
    entityType: "BUSINESS_PAGE",
    entityId: businessPageId,
    reason: trimmedReason,
    metadata: { businessName: page.name },
  });

  revalidatePath("/admin/business-pages");
}
