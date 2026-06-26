import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheck, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";

const SITE_URL = "https://my-n-igerian-guide.vercel.app";

type PageProps = {
  params: Promise<{ citySlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { citySlug } = await params;
  const state = await prisma.state.findUnique({
    where: { slug: citySlug },
    select: { name: true },
  });

  if (!state) {
    return { title: "Location not found" };
  }

  const title = `Businesses in ${state.name}`;
  const description = `Discover trusted businesses and services in ${state.name}. Browse by category, read reviews, and connect directly on MyNigerianGuide.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/cities/${citySlug}` },
    openGraph: { title, description, url: `${SITE_URL}/cities/${citySlug}` },
  };
}

export default async function CityPage({ params }: PageProps) {
  const { citySlug } = await params;

  const state = await prisma.state.findUnique({
    where: { slug: citySlug },
    select: { id: true, name: true },
  });

  if (!state) {
    notFound();
  }

  const [businesses, categoryCounts] = await Promise.all([
    prisma.businessPage.findMany({
      where: { stateId: state.id, isPublished: true },
      orderBy: [{ verificationStatus: "desc" }, { averageRating: "desc" }],
      take: 50,
      select: {
        id: true,
        name: true,
        slug: true,
        verificationStatus: true,
        category: { select: { name: true } },
        localGovernment: { select: { name: true } },
        town: { select: { name: true } },
      },
    }),
    prisma.businessPage.groupBy({
      by: ["categoryId"],
      where: { stateId: state.id, isPublished: true },
      _count: { _all: true },
    }),
  ]);

  // Resolve category names for the counts — groupBy only returns IDs.
  const categoryIds = categoryCounts.map((c) => c.categoryId);
  const categoryNames =
    categoryIds.length > 0
      ? await prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true, slug: true },
        })
      : [];
  const categoriesWithCounts = categoryCounts.map((c) => ({
    ...categoryNames.find((cat) => cat.id === c.categoryId),
    count: c._count._all,
  }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-ink-900">Businesses in {state.name}</h1>
      <p className="mt-1 text-sm text-ink-500">
        {businesses.length} business{businesses.length === 1 ? "" : "es"} listed.
      </p>

      {categoriesWithCounts.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {categoriesWithCounts.map((c) =>
            c.slug ? (
              <Link
                key={c.id}
                href={`/categories/${c.slug}`}
                className="rounded-full border border-ink-100 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-green-500 hover:text-green-600"
              >
                {c.name} ({c.count})
              </Link>
            ) : null
          )}
        </div>
      )}

      {businesses.length === 0 ? (
        <div className="mt-8 rounded-lg border border-ink-100 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-ink-700">No businesses in {state.name} yet.</p>
          <p className="mt-1 text-sm text-ink-500">Be the first to list one.</p>
          <Link
            href="/business/new"
            className="mt-4 inline-block rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500"
          >
            List your business
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/b/${b.slug}`}
              className="block rounded-lg border border-ink-100 bg-white p-5 shadow-sm transition hover:border-green-500 hover:shadow-md"
            >
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-semibold text-ink-900">{b.name}</h2>
                {b.verificationStatus === "VERIFIED" && <BadgeCheck className="h-4 w-4 text-green-600" />}
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-500">
                <MapPin className="h-3.5 w-3.5" />
                {[b.town?.name, b.localGovernment.name].filter(Boolean).join(", ")} · {b.category.name}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
