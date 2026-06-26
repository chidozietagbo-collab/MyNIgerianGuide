import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheck, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";

const SITE_URL = "https://my-n-igerian-guide.vercel.app";

type PageProps = {
  params: Promise<{ categorySlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug: categorySlug },
    select: { name: true },
  });

  if (!category) {
    return { title: "Category not found | MyNigerianGuide" };
  }

  const title = `${category.name} Businesses in Nigeria | MyNigerianGuide`;
  const description = `Find trusted ${category.name.toLowerCase()} businesses across Nigeria. Browse listings, read reviews, and connect directly on MyNigerianGuide.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/categories/${categorySlug}` },
    openGraph: { title, description, url: `${SITE_URL}/categories/${categorySlug}` },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { categorySlug } = await params;

  const category = await prisma.category.findUnique({
    where: { slug: categorySlug, isActive: true, status: "APPROVED" },
    select: { id: true, name: true },
  });

  if (!category) {
    notFound();
  }

  const businesses = await prisma.businessPage.findMany({
    where: { categoryId: category.id, isPublished: true },
    orderBy: [{ verificationStatus: "desc" }, { averageRating: "desc" }],
    take: 50,
    select: {
      id: true,
      name: true,
      slug: true,
      verificationStatus: true,
      averageRating: true,
      state: { select: { name: true } },
      localGovernment: { select: { name: true } },
      town: { select: { name: true } },
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-ink-900">{category.name} businesses in Nigeria</h1>
      <p className="mt-1 text-sm text-ink-500">
        {businesses.length} business{businesses.length === 1 ? "" : "es"} listed.
      </p>

      {businesses.length === 0 ? (
        <div className="mt-8 rounded-lg border border-ink-100 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-ink-700">No businesses in this category yet.</p>
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
                {[b.town?.name, b.localGovernment.name, b.state.name].filter(Boolean).join(", ")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
