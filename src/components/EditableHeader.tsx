"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import {
  updateBusinessHeader,
  getLocalGovernmentsForEdit,
  getTownsForEdit,
  submitNewCategoryForEdit,
} from "./actions";

const inputClass =
  "w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

type Option = { id: string; name: string };

type EditableHeaderProps = {
  businessPageId: string;
  currentName: string;
  currentCategoryId: string;
  currentStateId: string;
  currentLocalGovernmentId: string;
  currentTownId: string | null;
  categories: Option[];
  states: Option[];
  initialLocalGovernments: Option[];
  initialTowns: Option[];
};

export default function EditableHeader({
  businessPageId,
  currentName,
  currentCategoryId,
  currentStateId,
  currentLocalGovernmentId,
  currentTownId,
  categories: initialCategories,
  states,
  initialLocalGovernments,
  initialTowns,
}: EditableHeaderProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(currentName);
  const [categories, setCategories] = useState(initialCategories);
  const [categoryId, setCategoryId] = useState(currentCategoryId);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [stateId, setStateId] = useState(currentStateId);
  const [localGovernmentId, setLocalGovernmentId] = useState(currentLocalGovernmentId);
  const [townId, setTownId] = useState(currentTownId ?? "");
  const [localGovernments, setLocalGovernments] = useState(initialLocalGovernments);
  const [towns, setTowns] = useState(initialTowns);

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    setError(null);
    try {
      const result = await submitNewCategoryForEdit(newCategoryName.trim());
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCategories((prev) => [...prev, result.category]);
      setCategoryId(result.category.id);
      setNewCategoryName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that category.");
    } finally {
      setAddingCategory(false);
    }
  }

  async function handleStateChange(newStateId: string) {
    setStateId(newStateId);
    setLocalGovernmentId("");
    setTownId("");
    setLocalGovernments(newStateId ? await getLocalGovernmentsForEdit(newStateId) : []);
    setTowns([]);
  }

  async function handleLgaChange(newLgaId: string) {
    setLocalGovernmentId(newLgaId);
    setTownId("");
    setTowns(newLgaId ? await getTownsForEdit(newLgaId) : []);
  }

  async function handleSave() {
    setError(null);
    if (!name.trim() || !categoryId || !stateId || !localGovernmentId) {
      setError("Name, category, state, and local government are required.");
      return;
    }
    if (categoryId !== currentCategoryId) {
      const confirmed = window.confirm(
        "Changing category will clear your current services/keywords, since they're specific to the old category. Continue?"
      );
      if (!confirmed) return;
    }
    setSaving(true);
    try {
      const result = await updateBusinessHeader({
        businessPageId,
        name,
        categoryId,
        stateId,
        localGovernmentId,
        townId: townId || undefined,
      });
      setEditing(false);
      router.refresh();
      if (result.slug) {
        router.push(`/b/${result.slug}`);
      }
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
        className="ml-2 inline-flex items-center text-ink-300 transition hover:text-green-600"
        aria-label="Edit name, category, and location"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="mt-3 w-full space-y-3 rounded-md border border-ink-100 bg-ink-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-300">
          Edit name, category &amp; location
        </span>
        <button type="button" onClick={() => setEditing(false)} aria-label="Cancel">
          <X className="h-4 w-4 text-ink-300" />
        </button>
      </div>

      <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Business name" />

      <div>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="mt-2 flex gap-2">
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Don't see your category? Add it"
            className={inputClass}
          />
          <button
            type="button"
            onClick={handleAddCategory}
            disabled={addingCategory || !newCategoryName.trim()}
            className="shrink-0 rounded-md border border-ink-100 px-3 py-2 text-sm font-semibold text-ink-700 transition hover:border-ink-300 disabled:opacity-60"
          >
            {addingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <select value={stateId} onChange={(e) => handleStateChange(e.target.value)} className={inputClass}>
          <option value="">Select a state</option>
          {states.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={localGovernmentId}
          onChange={(e) => handleLgaChange(e.target.value)}
          disabled={!stateId}
          className={`${inputClass} disabled:opacity-60`}
        >
          <option value="">Select an LGA</option>
          {localGovernments.map((lga) => (
            <option key={lga.id} value={lga.id}>{lga.name}</option>
          ))}
        </select>
      </div>

      <select
        value={townId}
        onChange={(e) => setTownId(e.target.value)}
        disabled={!localGovernmentId}
        className={`${inputClass} disabled:opacity-60`}
      >
        <option value="">No specific town</option>
        {towns.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

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
