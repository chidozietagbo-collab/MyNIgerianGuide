"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { updateBusinessKeywords, searchKeywordsForEdit, submitNewKeywordForEdit } from "./actions";

const inputClass =
  "w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

type KeywordOption = { id: string; name: string };

type EditableKeywordsProps = {
  businessPageId: string;
  categoryId: string;
  currentKeywords: KeywordOption[];
};

export default function EditableKeywords({ businessPageId, categoryId, currentKeywords }: EditableKeywordsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<KeywordOption[]>(currentKeywords);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KeywordOption[]>([]);
  const [addingKeyword, setAddingKeyword] = useState(false);

  async function handleSearch(value: string) {
    setQuery(value);
    setResults(value.trim() ? await searchKeywordsForEdit(value, categoryId) : []);
  }

  function addKeyword(kw: KeywordOption) {
    if (selected.some((k) => k.id === kw.id)) return;
    setSelected((prev) => [...prev, kw]);
    setQuery("");
    setResults([]);
  }

  function removeKeyword(id: string) {
    setSelected((prev) => prev.filter((k) => k.id !== id));
  }

  async function handleAddNewKeyword() {
    if (!query.trim()) return;
    setAddingKeyword(true);
    try {
      const kw = await submitNewKeywordForEdit(categoryId, query.trim());
      addKeyword(kw);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that service.");
    } finally {
      setAddingKeyword(false);
    }
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await updateBusinessKeywords(businessPageId, selected.map((k) => k.id));
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
        aria-label="Edit services"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-3 rounded-md border border-ink-100 bg-ink-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-300">Edit services</span>
        <button type="button" onClick={() => setEditing(false)} aria-label="Cancel">
          <X className="h-4 w-4 text-ink-300" />
        </button>
      </div>

      <div>
        <input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className={inputClass}
          placeholder="Search e.g. plumbing, generator repair…"
        />
        {results.length > 0 && (
          <ul className="mt-1 rounded-md border border-ink-100 bg-white shadow-sm">
            {results.map((kw) => (
              <li key={kw.id}>
                <button
                  type="button"
                  onClick={() => addKeyword(kw)}
                  className="block w-full px-3 py-2 text-left text-sm text-ink-700 hover:bg-green-50"
                >
                  {kw.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim() && results.length === 0 && (
          <button
            type="button"
            onClick={handleAddNewKeyword}
            disabled={addingKeyword}
            className="mt-1 flex w-full items-center gap-2 rounded-md border border-dashed border-ink-100 px-3 py-2 text-left text-sm text-green-600 transition hover:border-green-500 disabled:opacity-60"
          >
            {addingKeyword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add &ldquo;{query.trim()}&rdquo; as a new service
          </button>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((kw) => (
            <span
              key={kw.id}
              className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-600"
            >
              {kw.name}
              <button type="button" onClick={() => removeKeyword(kw.id)} aria-label={`Remove ${kw.name}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

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
