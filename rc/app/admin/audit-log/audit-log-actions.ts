"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/components/require-permission";

export type AuditLogFilters = {
  adminUserId?: string;
  entityType?: string;
};

export async function getAuditLog(filters: AuditLogFilters = {}) {
  await requirePermission("admin.view_audit_log");

  const entries = await prisma.auditLog.findMany({
    where: {
      ...(filters.adminUserId ? { adminUserId: filters.adminUserId } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      reason: true,
      metadata: true,
      createdAt: true,
      adminUser: { select: { id: true, name: true, email: true } },
    },
  });

  // For USER and BUSINESS_PAGE entities, resolve a friendly link target —
  // a user's own page doesn't exist yet, so USER entries link to the
  // admin Users search instead; BUSINESS_PAGE entries link to the real
  // public page once we know its slug. POST/REVIEW entries deliberately
  // aren't resolved further in this v1 — see design note in this file's
  // history for why (the per-entity-type resolution logic already built
  // for the moderation queue is non-trivial, and duplicating it here for
  // every entity type would be real scope creep for a first version).
  const businessIds = entries.filter((e) => e.entityType === "BUSINESS_PAGE").map((e) => e.entityId);
  const businesses =
    businessIds.length > 0
      ? await prisma.businessPage.findMany({
          where: { id: { in: businessIds } },
          select: { id: true, name: true, slug: true },
        })
      : [];
  const businessMap = new Map(businesses.map((b) => [b.id, b]));

  return entries.map((e) => ({
    id: e.id,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    reason: e.reason,
    metadata: e.metadata,
    createdAt: e.createdAt.toISOString(),
    adminName: e.adminUser.name || e.adminUser.email.split("@")[0],
    adminEmail: e.adminUser.email,
    businessName: businessMap.get(e.entityId)?.name ?? null,
    businessSlug: businessMap.get(e.entityId)?.slug ?? null,
  }));
}

// Populates the "filter by admin" dropdown — only admins who have
// actually logged at least one action, rather than every admin account
// that exists, since most won't have done anything yet.
export async function getAdminsWithAuditEntries() {
  await requirePermission("admin.view_audit_log");

  const distinctAdminIds = await prisma.auditLog.findMany({
    distinct: ["adminUserId"],
    select: { adminUserId: true, adminUser: { select: { name: true, email: true } } },
  });

  return distinctAdminIds.map((a) => ({
    id: a.adminUserId,
    label: a.adminUser.name || a.adminUser.email.split("@")[0],
  }));
}
