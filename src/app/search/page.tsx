"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, MapPin, Search as SearchIcon } from "lucide-react";
import { searchBusinesses, suggestBusinesses, recordAdClick, type SearchResult, type BusinessSuggestion } from "./actions";

const inputClass =
  "w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

// useSearchParams() requires a Suspense boundary in the App Router — the
// page default-exports a thin wrapper, and the real component (with all
// the state and the form) lives below as SearchPageInner.
export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialKeyword = searchParams.get("keyword") ?? "";
  const initialLocation = searchParams.get("location") ?? "";
  const arrivedWithSearch = Boolean(initialKeyword || initialLocation);

  const [keyword, setKeyword] = useState(initialKeyword);
  const [location, setLocation] = useState(initialLocation);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<BusinessSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  function runSearch() {
    startTransition(async () => {
      const data = await searchBusinesses({ keyword, location, verifiedOnly });
      setResults(data);
    });
  }

  // Coming from the homepage hero search lands here with ?keyword=&location=
  // already set — auto-run once on mount so results are there immediately,
  // matching Journey 16.2 (search from hero, land directly on results).
  useEffect(() => {
    if (arrivedWithSearch) {
      runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleKeywordChange(value: string) {
    setKeyword(value);
    startTransition(async () => {
      const data = await suggestBusinesses(value);
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setShowSuggestions(false);
    runSearch();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-ink-900">Find a business</h1>
      <p className="mt-1 text-sm text-ink-500">Search by what you need and where you need it.</p>

      <form
        onSubmit={handleSubmit}
        className="relative mt-6 flex flex-col gap-3 rounded-lg border border-ink-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
      >
        <div className="relative sm:flex-1">
          <input
            value={keyword}
            onChange={(e) => handleKeywordChange(e.target.value)}
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Business name, plumbers, hotels…"
            autoComplete="off"
            className={inputClass}
          />
          {showSuggestions && (
            <ul className="absolute left-0 top-full z-10 mt-1 w-full rounded-md border border-ink-100 bg-white shadow-lg">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    // onMouseDown (not onClick/Link navigation) fires
                    // before the input's onBlur, so the dropdown doesn't
                    // vanish before the click registers.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setShowSuggestions(false);
                      router.push(`/b/${s.slug}`);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-ink-700 hover:bg-green-50"
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="ml-1.5 text-ink-300">— {s.stateName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
        {results === null && !isPending && !arrivedWithSearch && (
          <p className="text-sm text-ink-300">Search above to see businesses.</p>
        )}

        {isPending && (
          <p className="text-sm text-ink-300">
            {arrivedWithSearch && results === null ? "Finding businesses for you…" : "Searching…"}
          </p>
        )}

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
            onClick={() => {
              if (b.isSponsored && b.sponsoredTargetId) {
                recordAdClick(b.sponsoredTargetId);
              }
            }}
            className={
              b.isSponsored
                ? "block rounded-lg border border-[#2563EB]/30 bg-white p-5 shadow-sm transition hover:border-[#2563EB] hover:shadow-md"
                : "block rounded-lg border border-ink-100 bg-white p-5 shadow-sm transition hover:border-green-500 hover:shadow-md"
            }
          >
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-600 font-display text-base font-bold text-white">
                {b.name.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-display text-base font-semibold text-ink-900">{b.name}</h2>
                    {b.verificationStatus === "VERIFIED" && (
                      <BadgeCheck className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                  {b.isSponsored && (
                    <span
                      title="This business paid to appear above regular results for this search."
                      className="flex items-center gap-1 rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-xs font-medium text-[#2563EB]"
                    >
                      📌 Sponsored
                    </span>
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
