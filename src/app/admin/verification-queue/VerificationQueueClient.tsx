"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FileText, Loader2 } from "lucide-react";
import { getDocumentSignedUrl, approveVerification, rejectVerification } from "./verification-queue-actions";

const textareaClass =
  "w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

type VerificationRequest = {
  id: string;
  cacNumber: string;
  documentPaths: string[];
  createdAt: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
};

type VerificationQueueClientProps = {
  initialRequests: VerificationRequest[];
};

export default function VerificationQueueClient({ initialRequests }: VerificationQueueClientProps) {
  const [requests, setRequests] = useState(initialRequests);

  function removeFromList(requestId: string) {
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-ink-900">Verification queue</h1>
      <p className="mt-1 text-sm text-ink-500">
        Pending CAC verification requests. Review the documents and cross-reference the CAC
        number before approving.
      </p>

      {requests.length === 0 ? (
        <p className="mt-8 text-sm text-ink-300">No pending requests — you&apos;re all caught up.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} onResolved={() => removeFromList(request.id)} />
          ))}
        </div>
      )}
    </main>
  );
}

function RequestCard({ request, onResolved }: { request: VerificationRequest; onResolved: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [loadingDocPath, setLoadingDocPath] = useState<string | null>(null);

  async function handleViewDocument(path: string) {
    setError(null);
    setLoadingDocPath(path);
    try {
      const url = await getDocumentSignedUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open this document.");
    } finally {
      setLoadingDocPath(null);
    }
  }

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      try {
        await approveVerification(request.id);
        onResolved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't approve this request.");
      }
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      try {
        await rejectVerification(request.id, rejectReason);
        onResolved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't reject this request.");
      }
    });
  }

  return (
    <div className="rounded-lg border border-ink-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-ink-900">{request.businessName}</p>
          <p className="text-xs text-ink-500">CAC: {request.cacNumber}</p>
        </div>
        <p className="text-xs text-ink-300">
          {new Date(request.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>

      <Link
        href={`/b/${request.businessSlug}`}
        target="_blank"
        className="mt-2 inline-block text-xs font-medium text-green-600 hover:underline"
      >
        View business page →
      </Link>

      <div className="mt-3 space-y-1.5">
        {request.documentPaths.map((path) => (
          <button
            key={path}
            type="button"
            onClick={() => handleViewDocument(path)}
            disabled={loadingDocPath === path}
            className="flex items-center gap-1.5 text-sm text-ink-700 hover:text-green-600 disabled:opacity-60"
          >
            {loadingDocPath === path ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            {path.split("/").pop()}
          </button>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {rejecting ? (
        <div className="mt-3 space-y-2">
          <textarea
            rows={2}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className={textareaClass}
            placeholder="Reason for rejection (shown to the business owner)…"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReject}
              disabled={isPending}
              className="rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              Confirm rejection
            </button>
            <button type="button" onClick={() => setRejecting(false)} className="text-xs font-medium text-ink-500">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isPending}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-500 disabled:opacity-60"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => setRejecting(true)}
            disabled={isPending}
            className="rounded-md border border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:border-ink-300 disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
