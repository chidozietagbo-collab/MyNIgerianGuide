"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { approveCategory, rejectCategory, approveKeyword, rejectKeyword } from "./actions";

type PendingCategory = { id: string; name: string; submittedByEmail: string };
type PendingKeyword = { id: string; name: string; categoryName: string; submittedByEmail: string };

type TaxonomyReviewClientProps = {
  initialCategories: PendingCategory[];
  initialKeywords: PendingKeyword[];
};

export default function TaxonomyReviewClient({
  initialCategories,
  initialKeywords,
}: TaxonomyReviewClientProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [keywords, setKeywords] = useState(initialKeywords);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCategoryAction(id: string, action: "approve" | "reject") {
    setError(null);
    startTransition(async () => {
      try {
        if (action === "approve") {
          await approveCategory(id);
        } else {
          await rejectCategory(id);
        }
        setCategories((prev) => prev.filter((c) => c.id !== id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      }
    });
  }

  function handleKeywordAction(id: string, action: "approve" | "reject") {
    setError(null);
    startTransition(async () => {
      try {
        if (action === "approve") {
          await approveKeyword(id);
        } else {
          await rejectKeyword(id);
        }
        setKeywords((prev) => prev.filter((k) => k.id !== id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      }
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-ink-900">Taxonomy review</h1>
      <p className="mt-1 text-sm text-ink-500">
        Pending categories and services submitted by business owners. Approving makes them
        available to everyone going forward — they&apos;re already usable by the business that
        submitted them.
      </p>

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}

      <section className="mt-8">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">
          Pending categories ({categories.length})
        </h2>
        {categories.length === 0 ? (
          <p className="mt-2 text-sm text-ink-300">Nothing pending.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-ink-100 bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="text-sm font-semibold text-ink-900">{c.name}</p>
                  <p className="text-xs text-ink-500">Submitted by {c.submittedByEmail}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCategoryAction(c.id, "approve")}
                    disabled={isPending}
                    className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCategoryAction(c.id, "reject")}
                    disabled={isPending}
                    className="flex items-center gap-1 rounded-md border border-ink-100 px-3 py-1.5 text-sm font-semibold text-danger transition hover:bg-red-50 disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">
          Pending services/keywords ({keywords.length})
        </h2>
        {keywords.length === 0 ? (
          <p className="mt-2 text-sm text-ink-300">Nothing pending.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {keywords.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between rounded-lg border border-ink-100 bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="text-sm font-semibold text-ink-900">{k.name}</p>
                  <p className="text-xs text-ink-500">
                    {k.categoryName} · Submitted by {k.submittedByEmail}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleKeywordAction(k.id, "approve")}
                    disabled={isPending}
                    className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeywordAction(k.id, "reject")}
                    disabled={isPending}
                    className="flex items-center gap-1 rounded-md border border-ink-100 px-3 py-1.5 text-sm font-semibold text-danger transition hover:bg-red-50 disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
