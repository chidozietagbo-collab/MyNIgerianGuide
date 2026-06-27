import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import BusinessDashboardClient from "../BusinessDashboardClient";

type PageProps = {
  params: Promise<{ businessPageId: string }>;
};

export default async function BusinessDashboardPage({ params }: PageProps) {
  const { businessPageId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const ownedPages = await prisma.businessPage.findMany({
    where: { ownerUserId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true },
  });
  if (ownedPages.length === 0) {
    redirect("/business/new");
  }

  const business = await prisma.businessPage.findUnique({
    where: { id: businessPageId },
    include: {
      category: { select: { id: true, name: true } },
      state: { select: { id: true, name: true } },
      localGovernment: { select: { id: true, name: true } },
      town: { select: { id: true, name: true } },
      businessKeywords: { include: { keyword: { select: { id: true, name: true } } } },
      media: { orderBy: { createdAt: "asc" }, select: { id: true, url: true } },
      posts: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          mediaUrls: true,
          createdAt: true,
          isHidden: true,
          comments: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              authorUserId: true,
              content: true,
              createdAt: true,
              author: { select: { name: true, email: true } },
            },
          },
          likes: { select: { userId: true } },
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          rating: true,
          body: true,
          ownerResponse: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!business) {
    notFound();
  }
  // Ownership check happens here at the route level — every individual
  // action also re-checks ownership itself (defense in depth), but this
  // stops a non-owner from even seeing this business's dashboard data in
  // the first place, including draft/unpublished content the public
  // /b/[slug] page would hide anyway.
  if (business.ownerUserId !== user.id) {
    notFound();
  }

  return (
    <BusinessDashboardClient
      ownedPages={ownedPages}
      activeBusinessPageId={businessPageId}
      business={{
        id: business.id,
        name: business.name,
        slug: business.slug,
        categoryId: business.categoryId,
        category: business.category,
        state: business.state,
        localGovernment: business.localGovernment,
        town: business.town,
        description: business.description,
        address: business.address,
        phone: business.phone,
        email: business.email,
        website: business.website,
        whatsapp: business.whatsapp,
        hours: business.hours as
          | Partial<Record<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun", { open: string; close: string; closed: boolean }>>
          | null,
        businessKeywords: business.businessKeywords.map((bk) => bk.keyword),
        media: business.media,
      }}
      currentUserId={user.id}
      posts={business.posts.map((p) => ({
        id: p.id,
        content: p.content,
        mediaUrls: p.mediaUrls,
        createdAt: p.createdAt.toISOString(),
        likeCount: p.likes.length,
        isLiked: p.likes.some((l) => l.userId === user.id),
        comments: p.comments.map((c) => ({
          id: c.id,
          authorUserId: c.authorUserId,
          authorName: c.author.name || c.author.email.split("@")[0],
          content: c.content,
          createdAt: c.createdAt.toISOString(),
        })),
      }))}
      reviews={business.reviews.map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: r.user.name || r.user.email.split("@")[0],
        rating: r.rating,
        body: r.body,
        ownerResponse: r.ownerResponse,
        createdAt: r.createdAt.toISOString(),
      }))}
      averageRating={business.averageRating}
    />
  );
}
