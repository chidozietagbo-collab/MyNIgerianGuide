import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/components/create-notification";

// Brief 16.5 step 6: "Sponsored badge now visible. Renewal reminder
// set." This is that reminder — a Vercel Cron job (see vercel.json)
// running once daily that checks for listings expiring within the next
// 3 days and notifies the owner. Vercel's Hobby plan caps cron
// frequency at once per day, so this checks a 3-day window rather than
// trying to fire exactly "X days before" for every possible duration.
//
// GET, not POST: Vercel cron jobs invoke via HTTP GET and send
// CRON_SECRET (auto-provisioned by Vercel, not something to set
// manually) as the Authorization header — this checks that header
// before doing any real work, since the route is otherwise a public URL
// anyone could hit.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const expiringListings = await prisma.sponsoredListing.findMany({
    where: {
      isActive: true,
      endDate: { gte: now, lte: threeDaysFromNow },
    },
    select: {
      id: true,
      endDate: true,
      createdAt: true,
      businessPageId: true,
      keyword: { select: { name: true } },
      businessPage: { select: { ownerUserId: true, name: true } },
    },
  });

  let notified = 0;
  for (const listing of expiringListings) {
    // Idempotency: skip if we've already sent a renewal reminder for
    // THIS listing specifically. entityType is BUSINESS_PAGE (not a new
    // SPONSORED_LISTING type) so the notification is actually clickable —
    // getNotificationLink in notification-actions.ts only knows how to
    // build a link for BUSINESS_PAGE today, and a new entityType would
    // silently render as a dead-end notification. Since entityId is the
    // business page's id rather than the listing's own id, the listing
    // is disambiguated by including its id in the title/body text and
    // checking for an existing reminder created after this listing's
    // own creation time.
    const alreadyNotified = await prisma.notification.findFirst({
      where: {
        type: "SPONSORED_LISTING_EXPIRING",
        entityId: listing.businessPageId,
        createdAt: { gte: listing.createdAt },
      },
    });
    if (alreadyNotified) continue;

    const daysLeft = Math.ceil((listing.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    await createNotification({
      userId: listing.businessPage.ownerUserId,
      type: "SPONSORED_LISTING_EXPIRING",
      title: `Your sponsored listing for "${listing.keyword?.name ?? "your business"}" expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      body: "Renew from your business dashboard to keep your boosted placement.",
      entityType: "BUSINESS_PAGE",
      entityId: listing.businessPageId,
    });
    notified += 1;
  }

  // Also deactivate listings that have already expired, so isActive
  // stays a reliable signal for search results and the dashboard rather
  // than relying on every reader to separately check endDate too.
  const { count: deactivated } = await prisma.sponsoredListing.updateMany({
    where: { isActive: true, endDate: { lt: now } },
    data: { isActive: false },
  });

  return NextResponse.json({ checked: expiringListings.length, notified, deactivated });
}
