"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export default function HeroSearch() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) params.set("keyword", keyword.trim());
    if (location.trim()) params.set("location", location.trim());
    router.push(`/search${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 flex w-full max-w-2xl flex-col gap-3 rounded-xl border border-ink-100 bg-white p-3 shadow-md sm:flex-row sm:items-center"
    >
      <input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="Plumbers, hotels, lawyers…"
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
  );
}
