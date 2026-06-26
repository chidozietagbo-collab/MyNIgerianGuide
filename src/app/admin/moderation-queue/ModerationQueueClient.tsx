"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  dismissReport,
  takeActionOnPost,
  takeActionOnReview,
  takeActionOnBusiness,
} from "./moderation-actions";

type ReportContext = {
  label: string;
  detail: string;
  businessSlug?: string;
} | null;

type Report = {
  id: string;
  entityType: string;
  entityId: string;
  reason: string;
  createdAt: string;
  reporterEmail: string;
  context: ReportContext;
};

type ModerationQueueClientProps = {
  initialReports: Report[];
};

export default function ModerationQueueClient({ initialReports }: ModerationQueueClientProps) {
  const [reports, setReports] = useState(initialReports);

  function removeFromList(reportId: string) {
    setReports((prev) => prev.filter((r) => r.id !== reportId));
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-ink-900">Moderation queue</h1>
      <p className="mt-1 text-sm text-ink-500">
        Reports waiting for review. Dismiss if no action is needed, or take action to
        hide/remove the content and close the report.
      </p>

      {reports.length === 0 ? (
        <p className="mt-8 text-sm text-ink-300">No open reports — you&apos;re all caught up.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} onResolved={() => removeFromList(report.id)} />
          ))}
        </div>
      )}
    </main>
  );
}

function ReportCard({ report, onResolved }: { report: Report; onResolved: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);

  function handleDismiss() {
    setError(null);
    startTransition(async () => {
      try {
        await dismissReport(report.id);
        onResolved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't dismiss this report.");
      }
    });
  }

  function handleTakeAction(actionKey: string) {
    setError(null);
    startTransition(async () => {
      try {
        if (report.entityType === "POST" && actionKey === "hide") {
          await takeActionOnPost(report.id, report.entityId, "hide");
        } else if (report.entityType === "POST" && actionKey === "delete") {
          await takeActionOnPost(report.id, report.entityId, "delete");
        } else if (report.entityType === "REVIEW") {
          await takeActionOnReview(report.id, report.entityId);
        } else if (report.entityType === "BUSINESS_PAGE") {
          await takeActionOnBusiness(report.id, report.entityId);
        }
        onResolved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't complete that action.");
      } finally {
        setConfirmingAction(null);
      }
    });
  }

  const entityTypeLabel =
    report.entityType === "POST" ? "Post" : report.entityType === "REVIEW" ? "Review" : "Business page";

  return (
    <div className="rounded-lg border border-ink-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-700">
            {entityTypeLabel}
          </span>
          <p className="mt-1 text-sm font-semibold text-ink-900">
            {report.context?.label ?? "(content no longer exists)"}
          </p>
        </div>
        <p className="text-xs text-ink-300">
          {new Date(report.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>

      {report.context && (
        <p className="mt-2 line-clamp-2 text-sm text-ink-500">{report.context.detail}</p>
      )}

      <div className="mt-3 rounded-md bg-ink-50 p-3 text-sm">
        <p className="text-ink-700">
          <span className="font-medium">Reason:</span> {report.reason}
        </p>
        <p className="mt-1 text-xs text-ink-300">Reported by {report.reporterEmail}</p>
      </div>

      {report.context?.businessSlug && (
        <Link
          href={`/b/${report.context.businessSlug}`}
          target="_blank"
          className="mt-2 inline-block text-xs font-medium text-green-600 hover:underline"
        >
          View on site →
        </Link>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isPending}
          className="rounded-md border border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:border-ink-300 disabled:opacity-60"
        >
          Dismiss
        </button>

        {report.entityType === "POST" && (
          <>
            <ActionButton
              label="Hide post"
              actionKey="hide"
              confirmingAction={confirmingAction}
              setConfirmingAction={setConfirmingAction}
              onConfirm={handleTakeAction}
              isPending={isPending}
            />
            <ActionButton
              label="Delete post"
              actionKey="delete"
              confirmingAction={confirmingAction}
              setConfirmingAction={setConfirmingAction}
              onConfirm={handleTakeAction}
              isPending={isPending}
              danger
            />
          </>
        )}

        {report.entityType === "REVIEW" && (
          <ActionButton
            label="Delete review"
            actionKey="delete-review"
            confirmingAction={confirmingAction}
            setConfirmingAction={setConfirmingAction}
            onConfirm={handleTakeAction}
            isPending={isPending}
            danger
          />
        )}

        {report.entityType === "BUSINESS_PAGE" && (
          <ActionButton
            label="Unpublish business"
            actionKey="unpublish"
            confirmingAction={confirmingAction}
            setConfirmingAction={setConfirmingAction}
            onConfirm={handleTakeAction}
            isPending={isPending}
            danger
          />
        )}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  actionKey,
  confirmingAction,
  setConfirmingAction,
  onConfirm,
  isPending,
  danger = false,
}: {
  label: string;
  actionKey: string;
  confirmingAction: string | null;
  setConfirmingAction: (key: string | null) => void;
  onConfirm: (key: string) => void;
  isPending: boolean;
  danger?: boolean;
}) {
  const isConfirming = confirmingAction === actionKey;

  if (isConfirming) {
    return (
      <span className="flex items-center gap-2 text-xs">
        <span className="text-ink-700">Are you sure?</span>
        <button
          type="button"
          onClick={() => onConfirm(actionKey)}
          disabled={isPending}
          className="font-semibold text-danger"
        >
          Yes, confirm
        </button>
        <button type="button" onClick={() => setConfirmingAction(null)} className="text-ink-500">
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmingAction(actionKey)}
      disabled={isPending}
      className={
        danger
          ? "rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          : "rounded-md bg-ink-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-ink-900 disabled:opacity-60"
      }
    >
      {label}
    </button>
  );
}
