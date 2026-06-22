import Link from "next/link";
import { prisma } from "@/lib/prisma";
import HeroSearch from "@/components/HeroSearch";

export default async function Home() {
  const [businessCount, stateCount, keywordCount, categories] = await Promise.all([
    prisma.businessPage.count({ where: { isPublished: true } }),
    prisma.state.count(),
    prisma.keyword.count({ where: { status: "APPROVED" } }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: 8,
      select: { name: true, slug: true },
    }),
  ]);

  return (
    <main className="min-h-screen bg-ink-50">
      <section className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center">
        <span className="mb-4 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-green-600">
          Nigeria&apos;s Business Directory
        </span>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
          Find the right business.
          <br />
          <span className="text-green-600">Anywhere in Nigeria.</span>
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-500">
          Search businesses and services — from Lagos to Kano. Discover, follow, and connect.
        </p>

        <HeroSearch />

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          <div>
            <div className="font-display text-2xl font-extrabold text-ink-900">
              {businessCount.toLocaleString()}+
            </div>
            <div className="text-sm text-ink-500">Businesses listed</div>
          </div>
          <div>
            <div className="font-display text-2xl font-extrabold text-ink-900">{stateCount}</div>
            <div className="text-sm text-ink-500">States &amp; territories</div>
          </div>
          <div>
            <div className="font-display text-2xl font-extrabold text-ink-900">
              {keywordCount.toLocaleString()}+
            </div>
            <div className="text-sm text-ink-500">Service categories</div>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-4xl px-4 pb-20">
          <h2 className="text-center font-display text-lg font-semibold text-ink-900">
            Browse by category
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/search?keyword=${encodeURIComponent(c.name)}`}
                className="rounded-full border border-ink-100 bg-white px-4 py-2 text-sm font-medium text-ink-700 shadow-sm transition hover:border-green-500 hover:text-green-600"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
