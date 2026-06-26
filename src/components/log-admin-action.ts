import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type LogAdminActionInput = {
  adminUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  reason?: string;
  metadata?: Prisma.InputJsonValue;
};

// audit_log is append-only by design (brief: "no admin, including Super
// Admin, may update or delete rows") — RLS on this table has a SELECT
// policy gated to admin.view_audit_log, but deliberately NO UPDATE/DELETE
// policy at all, so the only way data ever leaves this table is if
// someone bypasses RLS entirely at the database level. Every admin action
// worth remembering (warn/suspend/ban/delete a user, etc.) should call
// this once it completes successfully.
export async function logAdminAction(input: LogAdminActionInput) {
  await prisma.auditLog.create({
    data: {
      adminUserId: input.adminUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      reason: input.reason,
      metadata: input.metadata,
    },
  });
}
