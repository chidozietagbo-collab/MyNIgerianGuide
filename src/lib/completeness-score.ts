// Computes the business page "Profile completeness score" shown in
// brief Section 11 ("Percentage score with specific actions to improve")
// and mocked in the design system at 62% with a specific improvement tip.
//
// The completenessScore column on BusinessPage has existed since early
// in the build but was never actually calculated anywhere — every real
// page in the database currently sits at the default value of 0. This
// is the first real implementation of the formula, not a re-use of
// existing logic.
//
// Weights below are a first pass, chosen by how much each field matters
// to someone deciding whether to contact/visit the business — photos and
// a description carry the most weight since they're what differentiates
// a real, trustworthy-looking listing from an empty shell. Easy to
// rebalance later; nothing about the rest of the app depends on the
// exact numbers, only the 0-100 result.
const WEIGHTS = {
  description: 20,
  photo: 20,
  phone: 12,
  address: 12,
  hours: 12,
  keyword: 12,
  email: 6,
  website: 6,
} as const;

const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((sum, w) => sum + w, 0);

export type CompletenessInput = {
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  hours: unknown;
  hasPhoto: boolean;
  hasKeyword: boolean;
};

export type CompletenessResult = {
  score: number;
  missing: { field: string; label: string; weight: number }[];
};

export function calculateCompletenessScore(input: CompletenessInput): CompletenessResult {
  const checks: { field: string; label: string; weight: number; done: boolean }[] = [
    { field: "description", label: "Add a description of your business", weight: WEIGHTS.description, done: !!input.description?.trim() },
    { field: "photo", label: "Add at least one photo", weight: WEIGHTS.photo, done: input.hasPhoto },
    { field: "phone", label: "Add a phone number", weight: WEIGHTS.phone, done: !!input.phone?.trim() },
    { field: "address", label: "Add your address", weight: WEIGHTS.address, done: !!input.address?.trim() },
    { field: "hours", label: "Add your opening hours", weight: WEIGHTS.hours, done: !!input.hours },
    { field: "keyword", label: "Add at least one service or keyword", weight: WEIGHTS.keyword, done: input.hasKeyword },
    { field: "email", label: "Add a contact email", weight: WEIGHTS.email, done: !!input.email?.trim() },
    { field: "website", label: "Add your website", weight: WEIGHTS.website, done: !!input.website?.trim() },
  ];

  const earned = checks.filter((c) => c.done).reduce((sum, c) => sum + c.weight, 0);
  const score = Math.round((earned / TOTAL_WEIGHT) * 100);
  const missing = checks
    .filter((c) => !c.done)
    .sort((a, b) => b.weight - a.weight)
    .map((c) => ({ field: c.field, label: c.label, weight: c.weight }));

  return { score, missing };
}
