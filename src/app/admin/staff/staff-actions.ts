"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/components/require-permission";
import { logAdminAction } from "@/components/log-admin-action";

export async function getRoleTemplates() {
  await requirePermission("admin.manage_staff");

  return prisma.adminRoleTemplate.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true, isSystemRole: true },
  });
}

export async function getAdminUsers() {
  await requirePermission("admin.manage_staff");

  const admins = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      isActive: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
      userRoles: { select: { role: { select: { id: true, name: true } } } },
    },
  });

  return admins.map((a) => ({
    id: a.id,
    isActive: a.isActive,
    createdAt: a.createdAt.toISOString(),
    userId: a.user.id,
    name: a.user.name,
    email: a.user.email,
    roles: a.userRoles.map((ur) => ur.role),
  }));
}

// Searches REGULAR users (people who already have an MNG account) who are
// not already an AdminUser — used for the "promote an existing user"
// path. Someone already in admin_users is excluded so the UI doesn't
// offer to "create" an admin that already exists; use role management
// on the existing admin instead.
export async function searchPromotableUsers(query: string) {
  await requirePermission("admin.manage_staff");

  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  return prisma.user.findMany({
    where: {
      AND: [
        { adminUser: null },
        {
          OR: [
            { email: { contains: trimmed, mode: "insensitive" } },
            { name: { contains: trimmed, mode: "insensitive" } },
          ],
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, name: true, email: true },
  });
}

// Path 1: turn an EXISTING regular user into an admin, with one or more
// role templates assigned immediately. The user keeps their existing
// login — this only adds an AdminUser row plus UserRole rows on top of
// the account they already have, same relationship as a User who also
// owns a BusinessPage.
export async function promoteUserToAdmin(userId: string, roleIds: string[]) {
  const admin = await requirePermission("admin.manage_staff");

  if (roleIds.length === 0) {
    throw new Error("Select at least one role for this admin.");
  }

  const existing = await prisma.adminUser.findUnique({ where: { userId } });
  if (existing) {
    throw new Error("This person is already an admin.");
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!targetUser) {
    throw new Error("User not found.");
  }

  const newAdminUser = await prisma.adminUser.create({
    data: {
      userId,
      createdById: admin.id,
      userRoles: {
        create: roleIds.map((roleId) => ({ roleId, assignedById: admin.id })),
      },
    },
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: "admin.promote_user",
    entityType: "USER",
    entityId: userId,
    metadata: { roleIds, targetEmail: targetUser.email },
  });

  revalidatePath("/admin/staff");
  return newAdminUser.id;
}

// Path 2: invite someone who does NOT have an MNG account yet. Uses
// Supabase's own invite flow (creates the auth.users row and emails them
// a sign-in link) rather than this app rolling its own invite email —
// the existing handle_new_user trigger on auth.users fires regardless of
// how the row was created, so the matching public.users row is created
// automatically with no extra application code needed here.
export async function inviteNewAdmin(email: string, roleIds: string[]) {
  const admin = await requirePermission("admin.manage_staff");

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) {
    throw new Error("Please enter an email address.");
  }
  if (roleIds.length === 0) {
    throw new Error("Select at least one role for this admin.");
  }

  const existingUser = await prisma.user.findUnique({ where: { email: trimmedEmail } });
  if (existingUser) {
    throw new Error("Someone with this email already has an account. Search for them and promote them instead.");
  }

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(trimmedEmail);
  if (error || !data.user) {
    throw new Error(error?.message ?? "Couldn't send the invite.");
  }

  // The handle_new_user trigger fires synchronously on the auth.users
  // insert above, so the public.users row should already exist by now —
  // but confirm rather than assume, since AdminUser.userId has a foreign
  // key to it.
  const newUser = await prisma.user.findUnique({ where: { id: data.user.id } });
  if (!newUser) {
    throw new Error("The invite was sent, but the account record didn't sync in time. Try refreshing in a moment.");
  }

  const newAdminUser = await prisma.adminUser.create({
    data: {
      userId: newUser.id,
      createdById: admin.id,
      userRoles: {
        create: roleIds.map((roleId) => ({ roleId, assignedById: admin.id })),
      },
    },
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: "admin.invite_new",
    entityType: "USER",
    entityId: newUser.id,
    metadata: { roleIds, invitedEmail: trimmedEmail },
  });

  revalidatePath("/admin/staff");
  return newAdminUser.id;
}

export async function updateAdminRoles(adminUserId: string, roleIds: string[]) {
  const admin = await requirePermission("admin.manage_staff");

  if (roleIds.length === 0) {
    throw new Error("An admin must hold at least one role.");
  }

  const target = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
    select: { user: { select: { email: true } } },
  });
  if (!target) {
    throw new Error("Admin not found.");
  }

  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { adminUserId } }),
    prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({ adminUserId, roleId, assignedById: admin.id })),
    }),
  ]);

  await logAdminAction({
    adminUserId: admin.id,
    action: "admin.update_roles",
    entityType: "USER",
    entityId: adminUserId,
    metadata: { roleIds, targetEmail: target.user.email },
  });

  revalidatePath("/admin/staff");
}

// Deactivates rather than deletes — isActive: false is already the
// authority every requirePermission() check reads (see require-permission.ts),
// so this immediately revokes all admin access without losing the
// historical record of who held what role and when, which the audit log
// and account history views depend on.
export async function deactivateAdmin(adminUserId: string, reason: string) {
  const admin = await requirePermission("admin.manage_staff");

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Please provide a reason for removing this admin's access.");
  }

  const target = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
    select: { user: { select: { email: true } } },
  });
  if (!target) {
    throw new Error("Admin not found.");
  }

  await prisma.adminUser.update({
    where: { id: adminUserId },
    data: { isActive: false },
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: "admin.deactivate",
    entityType: "USER",
    entityId: adminUserId,
    reason: trimmedReason,
    metadata: { targetEmail: target.user.email },
  });

  revalidatePath("/admin/staff");
}

export async function reactivateAdmin(adminUserId: string, reason: string) {
  const admin = await requirePermission("admin.manage_staff");

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Please provide a reason for restoring this admin's access.");
  }

  const target = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
    select: { user: { select: { email: true } } },
  });
  if (!target) {
    throw new Error("Admin not found.");
  }

  await prisma.adminUser.update({
    where: { id: adminUserId },
    data: { isActive: true },
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: "admin.reactivate",
    entityType: "USER",
    entityId: adminUserId,
    reason: trimmedReason,
    metadata: { targetEmail: target.user.email },
  });

  revalidatePath("/admin/staff");
}
