"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

type EntityType = "POST" | "REVIEW" | "BUSINESS_PAGE" | "USER";

export async function fileReport(entityType: EntityType, entityId: string, reason: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Please select or describe a reason.");
  }

  await prisma.report.create({
    data: {
      reporterUserId: user.id,
      entityType,
      entityId,
      reason: trimmedReason,
    },
  });

  // No revalidatePath here — filing a report doesn't change anything
  // visible on the page the reporter is looking at. The moderation queue
  // (admin-side, not yet built) is what will eventually show this.
}
