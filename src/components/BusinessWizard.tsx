"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";

const inputClass =
  "w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type Day = (typeof DAYS)[number];
type DayHours = { open: string; close: string; closed: boolean };
type HoursState = Record<Day, DayHours>;

const defaultHours: HoursState = DAYS.reduce((acc, day) => {
  acc[day] = { open: "09:00", close: "18:00", closed: day === "Sun" };
  return acc;
}, {} as HoursState);

type Option = { id: string; name: string };
type KeywordOption = { id: string; name: string; categoryId: string };

type BusinessWizardProps = {
  states: Option[];
  categories: Option[];
  getLocalGovernments: (stateId: string) => Promise<Option[]>;
  getTowns: (localGovernmentId: string) => Promise<Option[]>;
  submitNewTown: (localGovernmentId: string, name: string) => Promise<Option>;
  submitNewCategory: (name: string) => Promise<Option>;
  searchKeywords: (query: string, categoryId: string) => Promise<KeywordOption[]>;
  submitNewKeyword: (categoryId: string, name: string) => Promise<KeywordOption>;
  createBusinessPage: (input: {
    name: string;
    categoryId: string;
    description?: string;
    address?: string;
    stateId: string;
    localGovernmentId: string;
    townId?: string;
    phone?: string;
    email?: string;
    website?: string;
    whatsapp?: string;
    hours?: HoursState;
    keywordIds: string[];
  }) => Promise<void>;
};

const STEP_LABELS = ["Name & category", "Location", "Contact", "Hours", "Keywords", "Review"];

export default function BusinessWizard({
  states,
  categories: initialCategories,
  getLocalGovernments,
  getTowns,
  submitNewTown,
  submitNewCategory,
  searchKeywords,
  submitNewKeyword,
  createBusinessPage,
}: BusinessWizardProps) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Step 1
  const [name, setName] = useState("");
  const [categories, setCategories] = useState(initialCategories);
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  // Step 2 — location
  const [stateId, setStateId] = useState("");
  const [localGovernments, setLocalGovernments] = useState<Option[]>([]);
  const [localGovernmentId, setLocalGovernmentId] = useState("");
  const [towns, setTowns] = useState<Option[]>([]);
  const [townId, setTownId] = useState("");
  const [newTownName, setNewTownName] = useState("");
  const [addingTown, setAddingTown] = useState(false);
  const [address, setAddress] = useState("");

  // Step 3 — contact
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  // Step 4 — hours
  const [hours, setHours] = useState<HoursState>(defaultHours);

  // Step 5 — keywords, scoped to the chosen category
  const [keywordQuery, setKeywordQuery] = useState("");
  const [keywordResults, setKeywordResults] = useState<KeywordOption[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<KeywordOption[]>([]);
  const [addingKeyword, setAddingKeyword] = useState(false);

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      const category = await submitNewCategory(newCategoryName.trim());
      setCategories((prev) => [...prev, category]);
      setCategoryId(category.id);
      setNewCategoryName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that category.");
    } finally {
      setAddingCategory(false);
    }
  }

  function handleCategoryChange(newCategoryId: string) {
    setCategoryId(newCategoryId);
    // Keywords are tied to a specific category — switching category makes
    // any already-selected keywords invalid for the new one, so clear them
    // rather than silently submitting a mismatched set.
    setSelectedKeywords([]);
    setKeywordQuery("");
    setKeywordResults([]);
  }

  async function handleStateChange(newStateId: string) {
    setStateId(newStateId);
    setLocalGovernmentId("");
    setTowns([]);
    setTownId("");
    setLocalGovernments(newStateId ? await getLocalGovernments(newStateId) : []);
  }

  async function handleLgaChange(newLgaId: string) {
    setLocalGovernmentId(newLgaId);
    setTownId("");
    setTowns(newLgaId ? await getTowns(newLgaId) : []);
  }

  async function handleAddTown() {
    if (!newTownName.trim() || !localGovernmentId) return;
    setAddingTown(true);
    try {
      const town = await submitNewTown(localGovernmentId, newTownName.trim());
      setTowns((prev) => [...prev, town]);
      setTownId(town.id);
      setNewTownName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that town.");
    } finally {
      setAddingTown(false);
    }
  }

  async function handleKeywordSearch(value: string) {
    setKeywordQuery(value);
    setKeywordResults(value.trim() && categoryId ? await searchKeywords(value, categoryId) : []);
  }

  function addKeyword(keyword: KeywordOption) {
    if (selectedKeywords.some((k) => k.id === keyword.id)) return;
    setSelectedKeywords((prev) => [...prev, keyword]);
    setKeywordQuery("");
    setKeywordResults([]);
  }

  function removeKeyword(id: string) {
    setSelectedKeywords((prev) => prev.filter((k) => k.id !== id));
  }

  async function handleAddKeyword() {
    if (!keywordQuery.trim() || !categoryId) return;
    setAddingKeyword(true);
    try {
      const keyword = await submitNewKeyword(categoryId, keywordQuery.trim());
      addKeyword(keyword);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that service.");
    } finally {
      setAddingKeyword(false);
    }
  }

  function updateDayHours(day: Day, patch: Partial<DayHours>) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  function canAdvance(): boolean {
    if (step === 0) return name.trim().length > 0 && categoryId.length > 0;
    if (step === 1) return stateId.length > 0 && localGovernmentId.length > 0;
    return true;
  }

  function handleNext() {
    setError(null);
    if (!canAdvance()) {
      setError("Please fill in the required fields before continuing.");
      return;
    }
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }

  function handleBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await createBusinessPage({
          name,
          categoryId,
          description,
          address,
          stateId,
          localGovernmentId,
          townId: townId || undefined,
          phone,
          email,
          website,
          whatsapp,
          hours,
          keywordIds: selectedKeywords.map((k) => k.id),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    });
  }

  const selectedCategoryName = categories.find((c) => c.id === categoryId)?.name;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-ink-900">List your business</h1>
      <p className="mt-1 text-sm text-ink-500">Free to create — takes about five minutes.</p>

      {/* Step indicator */}
      <ol className="mt-8 flex items-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                i < step
                  ? "bg-green-600 text-white"
                  : i === step
                    ? "border-2 border-green-600 text-green-600"
                    : "border border-ink-100 text-ink-300"
              }`}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </span>
            {i < STEP_LABELS.length - 1 && <span className="h-px w-4 bg-ink-100" />}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs font-medium uppercase tracking-wider text-ink-300">
        {STEP_LABELS[step]}
      </p>

      <div className="mt-6 rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="biz-name" className="mb-1 block text-sm font-medium text-ink-700">
                Business name
              </label>
              <input
                id="biz-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Eko Premium Plumbing Services"
              />
            </div>
            <div>
              <label htmlFor="biz-category" className="mb-1 block text-sm font-medium text-ink-700">
                Category
              </label>
              <select
                id="biz-category"
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className={inputClass}
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
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
              <p className="mt-1 text-xs text-ink-300">
                New categories are reviewed by our team but usable on your page right away.
              </p>
            </div>
            <div>
              <label htmlFor="biz-desc" className="mb-1 block text-sm font-medium text-ink-700">
                Description <span className="text-ink-300">(optional)</span>
              </label>
              <textarea
                id="biz-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
                placeholder="What do you do, and who do you do it for?"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="biz-state" className="mb-1 block text-sm font-medium text-ink-700">
                  State
                </label>
                <select
                  id="biz-state"
                  value={stateId}
                  onChange={(e) => handleStateChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a state</option>
                  {states.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="biz-lga" className="mb-1 block text-sm font-medium text-ink-700">
                  Local government
                </label>
                <select
                  id="biz-lga"
                  value={localGovernmentId}
                  onChange={(e) => handleLgaChange(e.target.value)}
                  disabled={!stateId}
                  className={`${inputClass} disabled:opacity-60`}
                >
                  <option value="">Select an LGA</option>
                  {localGovernments.map((lga) => (
                    <option key={lga.id} value={lga.id}>
                      {lga.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="biz-town" className="mb-1 block text-sm font-medium text-ink-700">
                Town <span className="text-ink-300">(optional)</span>
              </label>
              <select
                id="biz-town"
                value={townId}
                onChange={(e) => setTownId(e.target.value)}
                disabled={!localGovernmentId}
                className={`${inputClass} disabled:opacity-60`}
              >
                <option value="">Don&apos;t see my town / skip</option>
                {towns.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              {localGovernmentId && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={newTownName}
                    onChange={(e) => setNewTownName(e.target.value)}
                    placeholder="Add your town"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={handleAddTown}
                    disabled={addingTown || !newTownName.trim()}
                    className="shrink-0 rounded-md border border-ink-100 px-3 py-2 text-sm font-semibold text-ink-700 transition hover:border-ink-300 disabled:opacity-60"
                  >
                    {addingTown ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </button>
                </div>
              )}
              <p className="mt-1 text-xs text-ink-300">
                Don&apos;t worry if your town isn&apos;t listed yet — you can publish without it, or add it now and we&apos;ll review it.
              </p>
            </div>

            <div>
              <label htmlFor="biz-address" className="mb-1 block text-sm font-medium text-ink-700">
                Street address <span className="text-ink-300">(optional)</span>
              </label>
              <input
                id="biz-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputClass}
                placeholder="e.g. 14 Adeola Odeku Street"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="biz-phone" className="mb-1 block text-sm font-medium text-ink-700">
                Phone <span className="text-ink-300">(optional)</span>
              </label>
              <input
                id="biz-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                placeholder="08012345678"
              />
            </div>
            <div>
              <label htmlFor="biz-whatsapp" className="mb-1 block text-sm font-medium text-ink-700">
                WhatsApp <span className="text-ink-300">(optional)</span>
              </label>
              <input
                id="biz-whatsapp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className={inputClass}
                placeholder="08012345678"
              />
            </div>
            <div>
              <label htmlFor="biz-email" className="mb-1 block text-sm font-medium text-ink-700">
                Email <span className="text-ink-300">(optional)</span>
              </label>
              <input
                id="biz-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="hello@yourbusiness.com"
              />
            </div>
            <div>
              <label htmlFor="biz-website" className="mb-1 block text-sm font-medium text-ink-700">
                Website <span className="text-ink-300">(optional)</span>
              </label>
              <input
                id="biz-website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className={inputClass}
                placeholder="https://yourbusiness.com"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
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
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="biz-keywords" className="mb-1 block text-sm font-medium text-ink-700">
                What do you offer in {selectedCategoryName ?? "your category"}?
              </label>
              <input
                id="biz-keywords"
                value={keywordQuery}
                onChange={(e) => handleKeywordSearch(e.target.value)}
                className={inputClass}
                placeholder="Search e.g. plumbing, generator repair…"
              />
              {keywordResults.length > 0 && (
                <ul className="mt-1 rounded-md border border-ink-100 bg-white shadow-sm">
                  {keywordResults.map((kw) => (
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

              {keywordQuery.trim() && keywordResults.length === 0 && (
                <button
                  type="button"
                  onClick={handleAddKeyword}
                  disabled={addingKeyword}
                  className="mt-1 flex w-full items-center gap-2 rounded-md border border-dashed border-ink-100 px-3 py-2 text-left text-sm text-green-600 transition hover:border-green-500 disabled:opacity-60"
                >
                  {addingKeyword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add &ldquo;{keywordQuery.trim()}&rdquo; as a new service
                </button>
              )}
            </div>

            {selectedKeywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedKeywords.map((kw) => (
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
            {selectedKeywords.length === 0 && (
              <p className="text-xs text-ink-300">
                Add at least a few — this is how people will find you in search.
              </p>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3 text-sm text-ink-700">
            <p>
              <span className="font-semibold">{name || "—"}</span>
            </p>
            <p className="text-ink-500">{description || "No description added."}</p>
            <p>{address ? `${address}, ` : ""}{localGovernments.find((l) => l.id === localGovernmentId)?.name}, {states.find((s) => s.id === stateId)?.name}</p>
            {phone && <p>Phone: {phone}</p>}
            {whatsapp && <p>WhatsApp: {whatsapp}</p>}
            {email && <p>Email: {email}</p>}
            {website && <p>Website: {website}</p>}
            {selectedKeywords.length > 0 && (
              <p className="text-ink-500">
                Keywords: {selectedKeywords.map((k) => k.name).join(", ")}
              </p>
            )}
            <p className="pt-2 text-xs text-ink-300">
              Your page will be published immediately and visible in search.
            </p>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 0 || isPending}
            className="rounded-md border border-ink-100 px-4 py-2 text-sm font-semibold text-ink-700 transition hover:border-ink-300 disabled:opacity-40"
          >
            Back
          </button>

          {step < STEP_LABELS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="rounded-md bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="rounded-md bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500 disabled:opacity-60"
            >
              {isPending ? "Publishing…" : "Publish business page"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
