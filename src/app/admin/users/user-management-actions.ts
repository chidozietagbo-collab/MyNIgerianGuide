"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/components/require-permission";
import { createNotification } from "@/components/create-notification";
import { logAdminAction } from "@/components/log-admin-action";

export async function searchUsers(query: string) {
  await requirePermission("user.view");

  const trimmed = query.trim();
  if (!trimmed) {
    return prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, email: true, name: true, accountStatus: true, createdAt: true },
    });
  }

  return prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: trimmed, mode: "insensitive" } },
        { name: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, email: true, name: true, accountStatus: true, createdAt: true },
  });
}

export async function getUserDetail(userId: string) {
  await requirePermission("user.view");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      accountStatus: true,
      createdAt: true,
      businessPages: {
        select: { id: true, name: true, slug: true, isPublished: true, verificationStatus: true },
      },
      _count: { select: { posts: true, reviews: true, follows: true } },
    },
  });
  if (!user) {
    throw new Error("User not found.");
  }

  return user;
}

// Gated to admin.view_audit_log specifically — separate from user.view,
// since the brief reserves the full audit trail for a narrower set of
// roles (e.g. Support Agent has user.view but NOT admin.view_audit_log).
// Returns null (rather than throwing) if the caller lacks this permission,
// so the UI can simply not render the history section for those admins
// instead of erroring out the whole user detail view.
export async function getUserAuditHistory(userId: string) {
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
    where: { entityType: "USER", entityId: userId },
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

export async function warnUser(userId: string, reason: string) {
  const admin = await requirePermission("user.warn");

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Please provide a reason for this warning.");
  }

  // A warning doesn't change accountStatus — it's a notification on
  // record, not a restriction. Still logged to the audit trail either way.
  await createNotification({
    userId,
    type: "ACCOUNT_WARNING",
    title: "You've received a warning from MyNigerianGuide",
    body: trimmedReason,
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: "user.warn",
    entityType: "USER",
    entityId: userId,
    reason: trimmedReason,
  });

  revalidatePath("/admin/users");
}

export async function suspendUser(userId: string, reason: string, days: number) {
  const admin = await requirePermission("user.suspend");

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Please provide a reason for this suspension.");
  }
  if (!days || days < 1) {
    throw new Error("Please specify how many days the suspension should last.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { accountStatus: "SUSPENDED" },
  });

  await createNotification({
    userId,
    type: "ACCOUNT_SUSPENDED",
    title: `Your account has been suspended for ${days} day${days === 1 ? "" : "s"}`,
    body: trimmedReason,
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: "user.suspend",
    entityType: "USER",
    entityId: userId,
    reason: trimmedReason,
    metadata: { days },
  });

  revalidatePath("/admin/users");
}

export async function unsuspendUser(userId: string) {
  const admin = await requirePermission("user.suspend");

  await prisma.user.update({
    where: { id: userId },
    data: { accountStatus: "ACTIVE" },
  });

  await createNotification({
    userId,
    type: "ACCOUNT_REINSTATED",
    title: "Your suspension has been lifted",
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: "user.unsuspend",
    entityType: "USER",
    entityId: userId,
  });

  revalidatePath("/admin/users");
}

export async function banUser(userId: string, reason: string) {
  const admin = await requirePermission("user.ban");

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Please provide a reason for this ban.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { accountStatus: "BANNED" },
  });

  await createNotification({
    userId,
    type: "ACCOUNT_BANNED",
    title: "Your account has been permanently banned",
    body: trimmedReason,
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: "user.ban",
    entityType: "USER",
    entityId: userId,
    reason: trimmedReason,
  });

  revalidatePath("/admin/users");
}

// Soft delete — marks the account as DELETED but does not remove the row,
// preserving their posts/reviews/business history for record-keeping
// (their content stays attributed to a real row, even if the account
// itself is disabled). This matches AccountStatus already having a
// DELETED value, rather than a hard SQL DELETE.
export async function deleteUser(userId: string, reason: string) {
  const admin = await requirePermission("user.delete");

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Please provide a reason for this deletion.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { accountStatus: "DELETED" },
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: "user.delete",
    entityType: "USER",
    entityId: userId,
    reason: trimmedReason,
  });

  revalidatePath("/admin/users");
}

export async function resetUserPassword(userId: string) {
  const admin = await requirePermission("user.reset_password");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) {
    throw new Error("User not found.");
  }

  // Uses the admin client to trigger Supabase Auth's own password reset
  // email flow — same mechanism as the user's own "forgot password" page,
  // just triggered by an admin rather than the user themselves.
  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(user.email);
  if (error) {
    throw new Error("Couldn't send the password reset email.");
  }

  await logAdminAction({
    adminUserId: admin.id,
    action: "user.reset_password",
    entityType: "USER",
    entityId: userId,
  });
}
