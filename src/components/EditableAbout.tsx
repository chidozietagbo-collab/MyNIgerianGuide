"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { updateBusinessAbout } from "./actions";

const inputClass =
  "w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

type EditableAboutProps = {
  businessPageId: string;
  currentDescription: string | null;
  currentAddress: string | null;
};

export default function EditableAbout({
  businessPageId,
  currentDescription,
  currentAddress,
}: EditableAboutProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState(currentDescription ?? "");
  const [address, setAddress] = useState(currentAddress ?? "");

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await updateBusinessAbout(businessPageId, description, address);
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-ink-300 transition hover:text-green-600"
        aria-label="Edit about and address"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-3 rounded-md border border-ink-100 bg-ink-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-300">Edit about</span>
        <button type="button" onClick={() => setEditing(false)} aria-label="Cancel">
          <X className="h-4 w-4 text-ink-300" />
        </button>
      </div>
      <textarea
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className={inputClass}
        placeholder="What do you do, and who do you do it for?"
      />
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        className={inputClass}
        placeholder="Street address"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
