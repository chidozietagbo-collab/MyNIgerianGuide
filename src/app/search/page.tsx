"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BadgeCheck, MapPin, Search as SearchIcon } from "lucide-react";
import { searchBusinesses, type SearchResult } from "./actions";

const inputClass =
  "w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

export default function SearchPage() {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function runSearch() {
    startTransition(async () => {
      const data = await searchBusinesses({ keyword, location, verifiedOnly });
      setResults(data);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-ink-900">Find a business</h1>
      <p className="mt-1 text-sm text-ink-500">Search by what you need and where you need it.</p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 flex flex-col gap-3 rounded-lg border border-ink-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
      >
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Plumbers, hotels, lawyers…"
          className={`${inputClass} sm:flex-1`}
        />
        <div className="hidden h-6 w-px bg-ink-100 sm:block" />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Lagos"
          className={`${inputClass} sm:flex-1`}
        />
        <button
          type="submit"
          disabled={isPending}
          className="flex shrink-0 items-center justify-center gap-2 rounded-md bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500 disabled:opacity-60"
        >
          <SearchIcon className="h-4 w-4" />
          {isPending ? "Searching…" : "Search"}
        </button>
      </form>

      <label className="mt-3 flex items-center gap-2 text-sm text-ink-700">
        <input
          type="checkbox"
          checked={verifiedOnly}
          onChange={(e) => {
            setVerifiedOnly(e.target.checked);
            if (results !== null) {
              startTransition(async () => {
                const data = await searchBusinesses({
                  keyword,
                  location,
                  verifiedOnly: e.target.checked,
                });
                setResults(data);
              });
            }
          }}
        />
        Verified only
      </label>

      <div className="mt-8 space-y-4">
        {results === null && !isPending && (
          <p className="text-sm text-ink-300">Search above to see businesses.</p>
        )}

        {isPending && <p className="text-sm text-ink-300">Searching…</p>}

        {results !== null && !isPending && results.length === 0 && (
          <div className="rounded-lg border border-ink-100 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-medium text-ink-700">No businesses found.</p>
            <p className="mt-1 text-sm text-ink-500">
              Try a different keyword or location, or check back soon — new businesses join MyNigerianGuide every day.
            </p>
          </div>
        )}

        {results?.map((b) => (
          <Link
            key={b.id}
            href={`/b/${b.slug}`}
            className="block rounded-lg border border-ink-100 bg-white p-5 shadow-sm transition hover:border-green-500 hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-600 font-display text-base font-bold text-white">
                {b.name.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-display text-base font-semibold text-ink-900">{b.name}</h2>
                  {b.verificationStatus === "VERIFIED" && (
                    <BadgeCheck className="h-4 w-4 text-green-600" />
                  )}
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-500">
                  <MapPin className="h-3.5 w-3.5" />
                  {[b.townName, b.lgaName, b.stateName].filter(Boolean).join(", ")} · {b.categoryName}
                </p>
                {b.keywordNames.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {b.keywordNames.map((k) => (
                      <span
                        key={k}
                        className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-700"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
