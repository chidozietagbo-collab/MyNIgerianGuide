"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag, X } from "lucide-react";
import { fileReport } from "./report-actions";

const inputClass =
  "w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

const REASONS = [
  "Spam or scam",
  "Fake or misleading information",
  "Inappropriate or offensive content",
  "Harassment or hate speech",
  "Fraudulent business or fake review",
  "Something else",
];

type EntityType = "POST" | "REVIEW" | "BUSINESS_PAGE" | "USER";

type ReportButtonProps = {
  entityType: EntityType;
  entityId: string;
  isSignedIn: boolean;
  // Small/text variant for compact contexts (under a post), default is a
  // slightly more visible style for page-level reporting (business page,
  // profile).
  variant?: "text" | "icon";
};

export default function ReportButton({ entityType, entityId, isSignedIn, variant = "text" }: ReportButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    if (!isSignedIn) {
      router.push("/login");
      return;
    }
    setOpen(true);
  }

  function handleSubmit() {
    setError(null);
    const reason = selectedReason === "Something else" ? details.trim() : selectedReason;
    if (!reason) {
      setError("Please choose a reason.");
      return;
    }

    startTransition(async () => {
      try {
        await fileReport(entityType, entityId, reason);
        setSubmitted(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't submit your report.");
      }
    });
  }

  function handleClose() {
    setOpen(false);
    setSelectedReason("");
    setDetails("");
    setSubmitted(false);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={
          variant === "icon"
            ? "text-ink-300 transition hover:text-danger"
            : "flex items-center gap-1.5 text-xs font-medium text-ink-400 transition hover:text-danger"
        }
        aria-label="Report"
      >
        <Flag className={variant === "icon" ? "h-3.5 w-3.5" : "h-3 w-3"} />
        {variant === "text" && "Report"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-ink-900">
                {submitted ? "Report submitted" : "Report this"}
              </h2>
              <button type="button" onClick={handleClose} aria-label="Close">
                <X className="h-4 w-4 text-ink-300" />
              </button>
            </div>

            {submitted ? (
              <div className="mt-4">
                <p className="text-sm text-ink-700">
                  Thanks for letting us know — our team will review this.
                </p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-4 w-full rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-ink-500">Why are you reporting this?</p>
                {REASONS.map((reason) => (
                  <label key={reason} className="flex items-center gap-2 text-sm text-ink-700">
                    <input
                      type="radio"
                      name="report-reason"
                      checked={selectedReason === reason}
                      onChange={() => setSelectedReason(reason)}
                    />
                    {reason}
                  </label>
                ))}
                {selectedReason === "Something else" && (
                  <textarea
                    rows={2}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Tell us more…"
                    className={inputClass}
                  />
                )}
                {error && <p className="text-sm text-danger">{error}</p>}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500 disabled:opacity-60"
                >
                  {isPending ? "Submitting…" : "Submit report"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
