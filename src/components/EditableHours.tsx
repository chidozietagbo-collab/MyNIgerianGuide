"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { updateBusinessHours } from "./actions";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type Day = (typeof DAYS)[number];
type DayHours = { open: string; close: string; closed: boolean };
type HoursState = Record<Day, DayHours>;

const defaultHours: HoursState = DAYS.reduce((acc, day) => {
  acc[day] = { open: "09:00", close: "18:00", closed: day === "Sun" };
  return acc;
}, {} as HoursState);

type EditableHoursProps = {
  businessPageId: string;
  currentHours: Partial<HoursState> | null;
};

export default function EditableHours({ businessPageId, currentHours }: EditableHoursProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState<HoursState>({ ...defaultHours, ...currentHours });

  function updateDayHours(day: Day, patch: Partial<DayHours>) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await updateBusinessHours(businessPageId, hours);
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
        aria-label="Edit opening hours"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-3 rounded-md border border-ink-100 bg-ink-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-300">Edit hours</span>
        <button type="button" onClick={() => setEditing(false)} aria-label="Cancel">
          <X className="h-4 w-4 text-ink-300" />
        </button>
      </div>

      {DAYS.map((day) => (
        <div key={day} className="flex items-center gap-3">
          <span className="w-12 text-sm font-medium text-ink-700">{day}</span>
          <label className="flex items-center gap-1.5 text-xs text-ink-500">
            <input
              type="checkbox"
              checked={hours[day].closed}
              onChange={(e) => updateDayHours(day, { closed: e.target.checked })}
            />
            Closed
          </label>
          {!hours[day].closed && (
            <>
              <input
                type="time"
                value={hours[day].open}
                onChange={(e) => updateDayHours(day, { open: e.target.value })}
                className="rounded-md border border-ink-100 px-2 py-1 text-sm text-ink-900"
              />
              <span className="text-ink-300">–</span>
              <input
                type="time"
                value={hours[day].close}
                onChange={(e) => updateDayHours(day, { close: e.target.value })}
                className="rounded-md border border-ink-100 px-2 py-1 text-sm text-ink-900"
              />
            </>
          )}
        </div>
      ))}

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
