"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { updateBusinessContact } from "./actions";

const inputClass =
  "w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

type EditableContactProps = {
  businessPageId: string;
  currentPhone: string | null;
  currentEmail: string | null;
  currentWebsite: string | null;
  currentWhatsapp: string | null;
};

export default function EditableContact({
  businessPageId,
  currentPhone,
  currentEmail,
  currentWebsite,
  currentWhatsapp,
}: EditableContactProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState(currentPhone ?? "");
  const [email, setEmail] = useState(currentEmail ?? "");
  const [website, setWebsite] = useState(currentWebsite ?? "");
  const [whatsapp, setWhatsapp] = useState(currentWhatsapp ?? "");

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await updateBusinessContact({ businessPageId, phone, email, website, whatsapp });
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
        aria-label="Edit contact details"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-3 rounded-md border border-ink-100 bg-ink-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-300">Edit contact</span>
        <button type="button" onClick={() => setEditing(false)} aria-label="Cancel">
          <X className="h-4 w-4 text-ink-300" />
        </button>
      </div>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="Phone" />
      <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputClass} placeholder="WhatsApp" />
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputClass} placeholder="Email" />
      <input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} placeholder="Website" />
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
