"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Slugify — no shared utility exists yet, so this lives here. Lowercases,
// strips anything that isn't a letter/number/space/hyphen, then collapses
// whitespace to single hyphens. Collision handling (slug already taken)
// happens in createBusinessPage below, where we have DB access to check.
// ---------------------------------------------------------------------------
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;

  while (await prisma.businessPage.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

// ---------------------------------------------------------------------------
// Categories — the seeded list, plus any submission flow.
// ---------------------------------------------------------------------------
export async function getCategories() {
  // isActive distinguishes "shown in the wizard dropdown" from soft-deleted;
  // status distinguishes "admin-reviewed" from a pending user submission.
  // A business's own pending submission should still be usable by THEM
  // immediately (handled by passing it through directly in the wizard
  // state, not by querying it back here) — this list is for the general
  // dropdown, so PENDING items from other users are excluded until approved.
  return prisma.category.findMany({
    where: { isActive: true, status: "APPROVED" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

// A business doesn't see their category in the list. Submit it as PENDING/
// USER_SUBMITTED — same pattern as submitNewTown — and return it so the
// wizard can use it immediately for this business, while it queues for
// admin review at /admin/taxonomy-review.
export async function submitNewCategory(name: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Category name is required.");
  }

  // Same real bug as submitNewKeyword above, same fix: Category.slug
  // is unique platform-wide, check before creating rather than letting
  // a collision crash with an unhandled database error.
  const slug = slugify(trimmed);
  const existingCategory = await prisma.category.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true },
  });
  if (existingCategory) {
    if (existingCategory.status === "APPROVED") {
      throw new Error(`"${existingCategory.name}" already exists and is approved — select it instead of adding it again.`);
    }
    throw new Error(`"${existingCategory.name}" has already been suggested and is awaiting admin review.`);
  }

  const category = await prisma.category.create({
    data: {
      name: trimmed,
      slug,
      status: "PENDING",
      source: "USER_SUBMITTED",
      submittedByUserId: user.id,
    },
    select: { id: true, name: true },
  });

  return category;
}

// ---------------------------------------------------------------------------
// Location data for the wizard's dropdowns.
// ---------------------------------------------------------------------------
export async function getLocalGovernments(stateId: string) {
  return prisma.localGovernment.findMany({
    where: { stateId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getTowns(localGovernmentId: string) {
  return prisma.town.findMany({
    where: { localGovernmentId, status: "APPROVED" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function submitNewTown(localGovernmentId: string, name: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Town name is required.");
  }

  const town = await prisma.town.create({
    data: {
      name: trimmed,
      slug: slugify(trimmed),
      localGovernmentId,
      status: "PENDING",
      source: "USER_SUBMITTED",
      submittedByUserId: user.id,
    },
    select: { id: true, name: true },
  });

  return town;
}

// ---------------------------------------------------------------------------
// Keyword autocomplete — approved keywords only, most-used first, NOW
// SCOPED TO THE BUSINESS'S CHOSEN CATEGORY. Previously this searched all
// approved keywords regardless of category, which let a business in
// "Education & Training" tag itself with "Plumbing" — a real bug, since
// Keyword.categoryId already existed and was simply never applied as a
// filter here.
// ---------------------------------------------------------------------------
export async function searchKeywords(query: string, categoryId: string) {
  if (!query.trim() || !categoryId) return [];

  return prisma.keyword.findMany({
    where: {
      status: "APPROVED",
      categoryId,
      name: { contains: query, mode: "insensitive" },
    },
    orderBy: { usageCount: "desc" },
    take: 10,
    select: { id: true, name: true, categoryId: true },
  });
}

// A business searches within their category and doesn't find their
// service. Submit it as PENDING/USER_SUBMITTED, tied to their category —
// usable immediately on their own business, queued for admin review.
export async function submitNewKeyword(categoryId: string, name: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Service name is required.");
  }
  if (!categoryId) {
    throw new Error("Select a category before adding a new service.");
  }

  // Keyword.slug is unique across the WHOLE platform, not scoped per
  // category — a name that already exists under a different category
  // would otherwise crash here with an unhandled database constraint
  // error (the same real bug found and fixed in submitNewKeywordForEdit,
  // the equivalent function used in the campaign form).
  const slug = slugify(trimmed);
  const existing = await prisma.keyword.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true },
  });
  if (existing) {
    if (existing.status === "APPROVED") {
      throw new Error(`"${existing.name}" already exists and is approved — search for it instead of adding it again.`);
    }
    throw new Error(`"${existing.name}" has already been suggested and is awaiting admin review.`);
  }

  const keyword = await prisma.keyword.create({
    data: {
      name: trimmed,
      slug,
      categoryId,
      status: "PENDING",
      source: "USER_SUBMITTED",
      submittedByUserId: user.id,
    },
    select: { id: true, name: true, categoryId: true },
  });

  return keyword;
}

// ---------------------------------------------------------------------------
// Final submit.
// ---------------------------------------------------------------------------
type CreateBusinessPageInput = {
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
  hours?: Record<string, { open: string; close: string; closed: boolean }>;
  keywordIds: string[];
};

export async function createBusinessPage(input: CreateBusinessPageInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  if (!input.name.trim()) {
    throw new Error("Business name is required.");
  }
  if (!input.categoryId || !input.stateId || !input.localGovernmentId) {
    throw new Error("Category, state, and local government are required.");
  }

  const slug = await uniqueSlug(input.name);

  const businessPage = await prisma.businessPage.create({
    data: {
      ownerUserId: user.id,
      name: input.name.trim(),
      slug,
      categoryId: input.categoryId,
      description: input.description?.trim() || null,
      address: input.address?.trim() || null,
      stateId: input.stateId,
      localGovernmentId: input.localGovernmentId,
      townId: input.townId || undefined,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      website: input.website?.trim() || null,
      whatsapp: input.whatsapp?.trim() || null,
      hours: input.hours ?? undefined,
      isClaimed: true,
      isPublished: true,
      businessKeywords: {
        create: input.keywordIds.map((keywordId) => ({ keywordId })),
      },
    },
    select: { slug: true },
  });

  redirect(`/b/${businessPage.slug}`);
}
