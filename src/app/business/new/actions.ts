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

  // Loop guards against a name that's already taken — appends -2, -3, etc.
  // until a free slug is found. Fine at current scale; revisit if this ever
  // needs to handle high-concurrency creation of identically-named businesses.
  while (await prisma.businessPage.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

// ---------------------------------------------------------------------------
// Location data for the wizard's dropdowns. States are fetched in the page
// Server Component directly (no action needed — it's a plain read with no
// user-specific scoping). These two are actions because they're called
// client-side as the user picks a state, then an LGA.
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

// A user's town isn't in the list yet. Insert it as PENDING/USER_SUBMITTED
// per the towns_insert RLS policy, then return its id so the wizard can use
// it immediately — the business page doesn't need to wait for admin review,
// the same pattern as keyword submission.
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
// Keyword autocomplete — approved keywords only, most-used first, matching
// the index added on keywords.status / keywords.usageCount.
// ---------------------------------------------------------------------------
export async function searchKeywords(query: string) {
  if (!query.trim()) return [];

  return prisma.keyword.findMany({
    where: {
      status: "APPROVED",
      name: { contains: query, mode: "insensitive" },
    },
    orderBy: { usageCount: "desc" },
    take: 10,
    select: { id: true, name: true, categoryId: true },
  });
}

// ---------------------------------------------------------------------------
// Final submit. Creates the BusinessPage row plus its BusinessKeyword join
// rows in one transaction, then redirects to the new public page.
// townId is optional per the schema change — a business can publish with
// just state + LGA if their town isn't listed yet.
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
