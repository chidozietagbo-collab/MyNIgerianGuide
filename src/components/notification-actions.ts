"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

async function requireSignedIn() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }
  return user;
}

export async function getNotifications() {
  const user = await requireSignedIn();

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        isRead: true,
        entityType: true,
        entityId: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);

  return { notifications, unreadCount };
}

export async function markNotificationRead(notificationId: string) {
  const user = await requireSignedIn();

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id },
    data: { isRead: true },
  });

  revalidatePath("/");
}

export async function markAllNotificationsRead() {
  const user = await requireSignedIn();

  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/");
}

// Resolves a notification's entityType/entityId into a real link to
// navigate to when clicked. Only BUSINESS_PAGE is wired up today since
// that's the only entity type any current trigger points to — extend
// this if a future trigger links elsewhere (e.g. a specific post).
export async function getNotificationLink(entityType: string | null, entityId: string | null) {
  if (entityType === "BUSINESS_PAGE" && entityId) {
    const business = await prisma.businessPage.findUnique({
      where: { id: entityId },
      select: { slug: true },
    });
    return business ? `/b/${business.slug}` : null;
  }
  return null;
}
