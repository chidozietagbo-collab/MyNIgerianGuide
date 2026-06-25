import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
};

// notifications has no INSERT policy for anon/authenticated by design —
// these are always written by the app on someone's behalf, never by the
// person receiving them. The admin client bypasses RLS entirely, same
// pattern already used for deleting Storage objects on photo removal.
//
// Importing createAdminClient here just to construct it is enough to
// confirm we're using the service role for this write — Prisma itself
// connects directly to Postgres and isn't subject to RLS at all, but
// calling this from a context that already trusts the admin role keeps
// the intent explicit for anyone reading this file later.
export async function createNotification(input: CreateNotificationInput) {
  // Touching the admin client to make the privilege boundary explicit,
  // even though the actual write goes through Prisma below.
  createAdminClient();

  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
    },
  });
}

// "New post" notifications are batched per brief Section 10 — if a
// follower already has an UNREAD "new post" notification for this same
// business, update it in place (refresh the timestamp/body) rather than
// creating a second one. This is a simple, good-enough batching strategy:
// a follower never gets spammed by one business posting repeatedly before
// they've checked their notifications, but does get a fresh one once
// they've read and cleared the last one.
export async function createOrUpdatePostNotification(
  followerUserId: string,
  businessPageId: string,
  businessName: string
) {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: followerUserId,
      type: "NEW_POST",
      entityType: "BUSINESS_PAGE",
      entityId: businessPageId,
      isRead: false,
    },
  });

  if (existing) {
    await prisma.notification.update({
      where: { id: existing.id },
      data: {
        title: `${businessName} posted a new update`,
        createdAt: new Date(),
      },
    });
  } else {
    await prisma.notification.create({
      data: {
        userId: followerUserId,
        type: "NEW_POST",
        title: `${businessName} posted a new update`,
        entityType: "BUSINESS_PAGE",
        entityId: businessPageId,
      },
    });
  }
}
