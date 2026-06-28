import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/components/create-notification";

// Brief 16.5 step 6: "Sponsored badge now visible. Renewal reminder
// set." This is that reminder — a Vercel Cron job (see vercel.json)
// running once daily that checks for campaigns expiring within the next
// 3 days and notifies the owner. Vercel's Hobby plan caps cron
// frequency at once per day, so this checks a 3-day window rather than
// trying to fire exactly "X days before" for every possible duration.
//
// Processes BOTH the new AdCampaign table (everything purchased going
// forward) AND the legacy SponsoredListing table (the one historical
// row migrated when the campaign system replaced the original
// single-target boost flow) — new purchases never write to
// SponsoredListing anymore, but the one migrated row still lives there
// and deserves the same reminder treatment until it expires naturally.
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

  let notified = 0;

  // --- New campaigns ---
  const expiringCampaigns = await prisma.adCampaign.findMany({
    where: {
      isActive: true,
      isPaused: false,
      endDate: { gte: now, lte: threeDaysFromNow },
    },
    select: {
      id: true,
      name: true,
      endDate: true,
      createdAt: true,
      businessPageId: true,
      businessPage: { select: { ownerUserId: true } },
    },
  });

  for (const campaign of expiringCampaigns) {
    const alreadyNotified = await prisma.notification.findFirst({
      where: {
        type: "AD_CAMPAIGN_EXPIRING",
        entityId: campaign.businessPageId,
        createdAt: { gte: campaign.createdAt },
      },
    });
    if (alreadyNotified) continue;

    const daysLeft = Math.ceil((campaign.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    await createNotification({
      userId: campaign.businessPage.ownerUserId,
      type: "AD_CAMPAIGN_EXPIRING",
      title: `Your campaign "${campaign.name}" expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      body: "Start a new campaign from your business dashboard to keep your boosted placement going.",
      entityType: "BUSINESS_PAGE",
      entityId: campaign.businessPageId,
    });
    notified += 1;
  }

  const { count: deactivatedCampaigns } = await prisma.adCampaign.updateMany({
    where: { isActive: true, endDate: { lt: now } },
    data: { isActive: false },
  });

  // --- Legacy listings (the one migrated historical row, kept working
  // until it naturally expires; no new rows are ever created here) ---
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

  for (const listing of expiringListings) {
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

  const { count: deactivatedListings } = await prisma.sponsoredListing.updateMany({
    where: { isActive: true, endDate: { lt: now } },
    data: { isActive: false },
  });

  return NextResponse.json({
    checkedCampaigns: expiringCampaigns.length,
    checkedLegacyListings: expiringListings.length,
    notified,
    deactivatedCampaigns,
    deactivatedListings,
  });
}
