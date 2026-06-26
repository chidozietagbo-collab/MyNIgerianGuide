"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, ShieldAlert, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitVerificationRequest } from "./verification-submit-actions";

const inputClass =
  "w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

type ExistingRequest = {
  cacNumber: string;
  status: string;
  reviewNotes: string | null;
  createdAt: string;
} | null;

type VerificationSectionProps = {
  businessPageId: string;
  existingRequest: ExistingRequest;
  verificationStatus: string;
};

export default function VerificationSection({
  businessPageId,
  existingRequest,
  verificationStatus,
}: VerificationSectionProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [cacNumber, setCacNumber] = useState("");
  const [documentUrls, setDocumentUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please upload a JPEG, PNG, or PDF file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File must be smaller than 10MB.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `${businessPageId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("verification-documents")
        .upload(path, file);
      if (uploadError) throw uploadError;

      // This is a PRIVATE bucket — there's no public URL to store. We
      // store the storage path itself; whoever reviews this later (with
      // business.verify) generates a signed URL on demand to view it.
      setDocumentUrls((prev) => [...prev, path]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeDocument(path: string) {
    setDocumentUrls((prev) => prev.filter((p) => p !== path));
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await submitVerificationRequest(businessPageId, cacNumber, documentUrls);
        setShowForm(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't submit your request.");
      }
    });
  }

  if (verificationStatus === "VERIFIED") {
    return (
      <section className="mt-6 rounded-lg border border-green-100 bg-green-50 p-5">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-green-600" />
          <p className="text-sm font-semibold text-ink-900">Verified business</p>
        </div>
        <p className="mt-1 text-sm text-ink-500">
          Your CAC registration has been confirmed. This badge is visible to everyone.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">Verification</h2>

      {existingRequest?.status === "PENDING" && (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-ink-50 p-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
          <div>
            <p className="text-sm font-medium text-ink-900">Verification under review</p>
            <p className="text-xs text-ink-500">
              Submitted {new Date(existingRequest.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}.
              We&apos;ll notify you once it&apos;s reviewed.
            </p>
          </div>
        </div>
      )}

      {existingRequest?.status === "REJECTED" && (
        <div className="mt-2 rounded-md bg-red-50 p-3">
          <p className="text-sm font-medium text-danger">Verification request rejected</p>
          {existingRequest.reviewNotes && (
            <p className="mt-1 text-xs text-ink-700">{existingRequest.reviewNotes}</p>
          )}
          <p className="mt-1 text-xs text-ink-500">You can submit a new request with corrected details below.</p>
        </div>
      )}

      {(!existingRequest || existingRequest.status === "REJECTED") && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-3 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500"
        >
          {existingRequest?.status === "REJECTED" ? "Submit new request" : "Get verified"}
        </button>
      )}

      {showForm && (
        <div className="mt-3 space-y-3 rounded-md border border-ink-100 bg-ink-50 p-4">
          <div>
            <label htmlFor="cac-number" className="mb-1 block text-sm font-medium text-ink-700">
              CAC registration number
            </label>
            <input
              id="cac-number"
              value={cacNumber}
              onChange={(e) => setCacNumber(e.target.value)}
              className={inputClass}
              placeholder="RC1234567"
            />
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-ink-700">Supporting documents</p>
            <p className="mb-2 text-xs text-ink-300">
              Upload your CAC certificate, proof of address, or director ID (JPEG, PNG, or PDF).
            </p>
            {documentUrls.length > 0 && (
              <ul className="mb-2 space-y-1">
                {documentUrls.map((path) => (
                  <li key={path} className="flex items-center justify-between rounded-md bg-white px-3 py-1.5 text-xs text-ink-700">
                    {path.split("/").pop()}
                    <button type="button" onClick={() => removeDocument(path)} aria-label="Remove document">
                      <X className="h-3.5 w-3.5 text-ink-300" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-sm font-medium text-ink-700 hover:text-green-600 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Add document"}
            </button>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500 disabled:opacity-60"
            >
              {isPending ? "Submitting…" : "Submit for review"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm font-medium text-ink-500 hover:text-ink-700">
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
