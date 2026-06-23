"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteBusinessPage } from "./actions";

type DeleteBusinessButtonProps = {
  businessPageId: string;
  businessName: string;
};

export default function DeleteBusinessButton({ businessPageId, businessName }: DeleteBusinessButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteBusinessPage(businessPageId);
        // deleteBusinessPage redirects on success — this only runs if it
        // somehow returns instead (it won't, but keeps types happy and
        // gives a fallback path if that ever changes).
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't delete this business page.");
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 text-sm font-medium text-danger hover:underline"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete business page
      </button>
    );
  }

  return (
    <div className="rounded-md border border-red-100 bg-white p-4">
      <p className="text-sm text-ink-700">
        Permanently delete <span className="font-semibold">{businessName}</span>? This can&apos;t be undone.
      </p>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-md bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? "Deleting…" : "Yes, permanently delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-sm font-medium text-ink-500 hover:text-ink-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
