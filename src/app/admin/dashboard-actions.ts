"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// Returns the signed-in admin's basic identity plus their full permission
// set, computed once here so the dashboard page and its tool links can
// decide what to show without re-deriving permissions in multiple places.
// Throws if the caller isn't an active admin at all — unlike the
// individual tool actions, the dashboard itself has no single permission
// gate, since per brief 5.1 every RBAC role (including Support Agent)
// gets some admin access.
export async function getAdminDashboardContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: user.id },
    select: {
      isActive: true,
      user: { select: { name: true, email: true } },
      userRoles: {
        select: {
          role: {
            select: {
              name: true,
              rolePermissions: { select: { permission: { select: { key: true } } } },
            },
          },
        },
      },
    },
  });

  if (!adminUser || !adminUser.isActive) {
    throw new Error("Admin access required.");
  }

  const permissionKeys = Array.from(
    new Set(
      adminUser.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.key))
    )
  );
  const roleNames = adminUser.userRoles.map((ur) => ur.role.name);

  return {
    name: adminUser.user.name || adminUser.user.email.split("@")[0],
    roleNames,
    permissionKeys,
  };
}

// The 5 stats named explicitly in brief Section 5.5's Overview row: total
// users, business pages, new signups today, pending verifications, open
// reports. Run as one Promise.all rather than sequential queries since
// none of these depend on each other.
export async function getDashboardStats() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalUsers, totalBusinessPages, newSignupsToday, pendingVerifications, openReports] =
    await Promise.all([
      prisma.user.count(),
      prisma.businessPage.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.verificationRequest.count({ where: { status: "PENDING" } }),
      prisma.report.count({ where: { status: "OPEN" } }),
    ]);

  return { totalUsers, totalBusinessPages, newSignupsToday, pendingVerifications, openReports };
}

// Recent activity feed for the dashboard — the most recent entries across
// the whole platform, not filtered to one entity type. This deliberately
// reuses the same shape as the full /admin/audit-log page's entries, just
// capped to a small count and without the filter controls, so the
// dashboard gives a quick pulse rather than duplicating the full log UI.
export async function getRecentActivity(limit = 8) {
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      entityType: true,
      reason: true,
      createdAt: true,
      adminUser: { select: { name: true, email: true } },
    },
  });

  return entries.map((e) => ({
    id: e.id,
    action: e.action,
    entityType: e.entityType,
    reason: e.reason,
    createdAt: e.createdAt.toISOString(),
    adminName: e.adminUser.name || e.adminUser.email.split("@")[0],
  }));
}
