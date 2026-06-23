"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { suggestBusinesses, type BusinessSuggestion } from "@/app/search/actions";

export default function HeroSearch() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [suggestions, setSuggestions] = useState<BusinessSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [, startTransition] = useTransition();

  function handleKeywordChange(value: string) {
    setKeyword(value);
    startTransition(async () => {
      const results = await suggestBusinesses(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    });
  }

  function goToSearch(searchKeyword: string) {
    const params = new URLSearchParams();
    if (searchKeyword.trim()) params.set("keyword", searchKeyword.trim());
    if (location.trim()) params.set("location", location.trim());
    router.push(`/search${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setShowSuggestions(false);
    goToSearch(keyword);
  }

  function handleSuggestionClick(suggestion: BusinessSuggestion) {
    setShowSuggestions(false);
    router.push(`/b/${suggestion.slug}`);
  }

  return (
    <div className="relative mt-8 w-full max-w-2xl">
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-3 rounded-xl border border-ink-100 bg-white p-3 shadow-md sm:flex-row sm:items-center"
      >
        <input
          value={keyword}
          onChange={(e) => handleKeywordChange(e.target.value)}
          onFocus={() => setShowSuggestions(suggestions.length > 0)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Business name, plumbers, hotels…"
          autoComplete="off"
          className="w-full flex-1 border-none px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none sm:border-r sm:border-ink-100"
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Lagos"
          className="w-full flex-1 border-none px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none"
        />
        <button
          type="submit"
          className="flex shrink-0 items-center justify-center gap-2 rounded-md bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500"
        >
          <Search className="h-4 w-4" />
          Search
        </button>
      </form>

      {showSuggestions && (
        <ul className="absolute left-0 top-full z-10 mt-1 w-full rounded-md border border-ink-100 bg-white shadow-lg">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => handleSuggestionClick(s)}
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
  );
}
