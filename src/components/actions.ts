"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireOwnership(businessPageId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const business = await prisma.businessPage.findUnique({
    where: { id: businessPageId },
    select: { ownerUserId: true, slug: true },
  });
  if (!business || business.ownerUserId !== user.id) {
    throw new Error("You don't own this business page.");
  }

  return business;
}

// Same slugify logic as the wizard's actions.ts — kept duplicated rather
// than shared, since extracting a shared lib/slug.ts is a small refactor
// of its own and not needed to ship this feature correctly.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// ===========================================================================
// PHOTOS
// ===========================================================================

// The browser uploads the file bytes directly to Supabase Storage (via the
// browser client, using the business_photos_insert RLS policy to enforce
// ownership) — this action only ever receives the resulting public URL and
// records it as a Media row. No file bytes pass through the server.
export async function addBusinessPhoto(businessPageId: string, url: string) {
  const business = await requireOwnership(businessPageId);

  await prisma.media.create({
    data: {
      entityType: "BUSINESS_PAGE",
      businessPageId,
      url,
      mediaType: "image",
    },
  });

  revalidatePath(`/b/${business.slug}`);
  revalidatePath(`/business/dashboard/${businessPageId}`);
}

export async function deleteBusinessPhoto(mediaId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { url: true, businessPageId: true, businessPage: { select: { ownerUserId: true, slug: true } } },
  });
  if (!media || !media.businessPage || media.businessPage.ownerUserId !== user.id) {
    throw new Error("You don't own this photo.");
  }

  // Pull the storage object path out of the public URL so the file itself
  // gets removed too, not just the Media row. Public URLs follow the
  // pattern https://PROJECT_REF.supabase.co/storage/v1/object/public/business-photos/PATH
  const marker = "/business-photos/";
  const idx = media.url.indexOf(marker);
  if (idx !== -1) {
    const objectPath = media.url.slice(idx + marker.length);
    const admin = createAdminClient();
    await admin.storage.from("business-photos").remove([objectPath]);
  }

  await prisma.media.delete({ where: { id: mediaId } });
  revalidatePath(`/b/${media.businessPage.slug}`);
  if (media.businessPageId) {
    revalidatePath(`/business/dashboard/${media.businessPageId}`);
  }
}

// ===========================================================================
// EDIT — HEADER (name, category, location)
// ===========================================================================
type UpdateHeaderInput = {
  businessPageId: string;
  name: string;
  categoryId: string;
  stateId: string;
  localGovernmentId: string;
  townId?: string;
};

export async function updateBusinessHeader(input: UpdateHeaderInput) {
  const business = await requireOwnership(input.businessPageId);

  if (!input.name.trim()) {
    throw new Error("Business name is required.");
  }
  if (!input.categoryId || !input.stateId || !input.localGovernmentId) {
    throw new Error("Category, state, and local government are required.");
  }

  const current = await prisma.businessPage.findUnique({
    where: { id: input.businessPageId },
    select: { name: true, slug: true, categoryId: true },
  });

  let slug = current!.slug;
  if (current!.name !== input.name.trim()) {
    const base = slugify(input.name);
    let candidate = base;
    let suffix = 2;
    while (
      candidate !== current!.slug &&
      (await prisma.businessPage.findUnique({ where: { slug: candidate } }))
    ) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    slug = candidate;
  }

  const categoryChanged = current!.categoryId !== input.categoryId;

  await prisma.$transaction([
    ...(categoryChanged
      ? [prisma.businessKeyword.deleteMany({ where: { businessPageId: input.businessPageId } })]
      : []),
    prisma.businessPage.update({
      where: { id: input.businessPageId },
      data: {
        name: input.name.trim(),
        slug,
        categoryId: input.categoryId,
        stateId: input.stateId,
        localGovernmentId: input.localGovernmentId,
        townId: input.townId || undefined,
      },
    }),
  ]);

  revalidatePath(`/b/${business.slug}`);
  if (slug !== business.slug) {
    revalidatePath(`/b/${slug}`);
  }
  revalidatePath(`/business/dashboard/${input.businessPageId}`);
  return { slug, categoryChanged };
}

// ===========================================================================
// EDIT — ABOUT
// ===========================================================================
export async function updateBusinessAbout(
  businessPageId: string,
  description: string,
  address: string
) {
  const business = await requireOwnership(businessPageId);

  await prisma.businessPage.update({
    where: { id: businessPageId },
    data: {
      description: description.trim() || null,
      address: address.trim() || null,
    },
  });

  revalidatePath(`/b/${business.slug}`);
  revalidatePath(`/business/dashboard/${businessPageId}`);
}

// ===========================================================================
// EDIT — CONTACT
// ===========================================================================
type UpdateContactInput = {
  businessPageId: string;
  phone: string;
  email: string;
  website: string;
  whatsapp: string;
};

export async function updateBusinessContact(input: UpdateContactInput) {
  const business = await requireOwnership(input.businessPageId);

  await prisma.businessPage.update({
    where: { id: input.businessPageId },
    data: {
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      website: input.website.trim() || null,
      whatsapp: input.whatsapp.trim() || null,
    },
  });

  revalidatePath(`/b/${business.slug}`);
  revalidatePath(`/business/dashboard/${input.businessPageId}`);
}

// ===========================================================================
// EDIT — HOURS
// ===========================================================================
type HoursState = Record<string, { open: string; close: string; closed: boolean }>;

export async function updateBusinessHours(businessPageId: string, hours: HoursState) {
  const business = await requireOwnership(businessPageId);

  await prisma.businessPage.update({
    where: { id: businessPageId },
    data: { hours },
  });

  revalidatePath(`/b/${business.slug}`);
  revalidatePath(`/business/dashboard/${businessPageId}`);
}

// ===========================================================================
// EDIT — KEYWORDS/SERVICES
// ===========================================================================
export async function updateBusinessKeywords(businessPageId: string, keywordIds: string[]) {
  const business = await requireOwnership(businessPageId);

  await prisma.$transaction([
    prisma.businessKeyword.deleteMany({ where: { businessPageId } }),
    prisma.businessKeyword.createMany({
      data: keywordIds.map((keywordId) => ({ businessPageId, keywordId })),
    }),
  ]);

  revalidatePath(`/b/${business.slug}`);
  revalidatePath(`/business/dashboard/${businessPageId}`);
}

export async function searchKeywordsForEdit(query: string, categoryId: string) {
  if (!query.trim() || !categoryId) return [];

  return prisma.keyword.findMany({
    where: {
      status: "APPROVED",
      categoryId,
      name: { contains: query, mode: "insensitive" },
    },
    orderBy: { usageCount: "desc" },
    take: 10,
    select: { id: true, name: true },
  });
}

// Returns a result object rather than throwing, because Next.js
// redacts thrown Server Action errors to a generic, unhelpful message
// in production builds (confirmed: this is documented, intentional
// behavior — Next.js can't tell an intentional user-facing error apart
// from one that might leak something sensitive, so it strips the
// message either way). Returning { success, error } instead of
// throwing is the standard, documented workaround, and is what
// actually lets a real message like "already exists and is approved"
// reach the person using the form instead of a blank digest.
export async function submitNewKeywordForEdit(
  categoryId: string,
  name: string
): Promise<{ success: true; keyword: { id: string; name: string } } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not signed in." };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, error: "Service name is required." };
  }

  const base = trimmed
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  const existing = await prisma.keyword.findUnique({
    where: { slug: base },
    select: { id: true, name: true, status: true },
  });
  if (existing) {
    if (existing.status === "APPROVED") {
      return {
        success: false,
        error: `"${existing.name}" already exists and is approved — you can search for it directly.`,
      };
    }
    return {
      success: false,
      error: `"${existing.name}" has already been suggested and is awaiting admin review.`,
    };
  }

  const keyword = await prisma.keyword.create({
    data: {
      name: trimmed,
      slug: base,
      categoryId,
      status: "PENDING",
      source: "USER_SUBMITTED",
      submittedByUserId: user.id,
    },
    select: { id: true, name: true },
  });

  return { success: true, keyword };
}

// ===========================================================================
// CATEGORY SUBMISSION (edit flow — same pattern as the wizard's submitNewCategory)
// ===========================================================================
// Returns a result object rather than throwing — same reasoning as
// submitNewKeywordForEdit above (thrown Server Action errors are
// redacted to a generic message in production builds).
export async function submitNewCategoryForEdit(
  name: string
): Promise<{ success: true; category: { id: string; name: string } } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not signed in." };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, error: "Category name is required." };
  }

  const base = trimmed
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  const existingCategory = await prisma.category.findUnique({
    where: { slug: base },
    select: { id: true, name: true, status: true },
  });
  if (existingCategory) {
    if (existingCategory.status === "APPROVED") {
      return {
        success: false,
        error: `"${existingCategory.name}" already exists and is approved — you can select it directly.`,
      };
    }
    return {
      success: false,
      error: `"${existingCategory.name}" has already been suggested and is awaiting admin review.`,
    };
  }

  const category = await prisma.category.create({
    data: {
      name: trimmed,
      slug: base,
      status: "PENDING",
      source: "USER_SUBMITTED",
      submittedByUserId: user.id,
    },
    select: { id: true, name: true },
  });

  return { success: true, category };
}

// ===========================================================================
// LOCATION DROPDOWN HELPERS (shared with header edit)
// ===========================================================================
export async function getLocalGovernmentsForEdit(stateId: string) {
  return prisma.localGovernment.findMany({
    where: { stateId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getTownsForEdit(localGovernmentId: string) {
  return prisma.town.findMany({
    where: { localGovernmentId, status: "APPROVED" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

// ===========================================================================
// DELETE
// ===========================================================================
// Posts/Follows/Reviews/VerificationRequests/SponsoredListings/PageViews all
// have a REQUIRED (non-nullable) businessPageId — even though all of these
// are empty today (M3+ features not yet built), deleting a business without
// clearing these first would start failing the moment any of them gets real
// rows. Clearing them defensively now means this keeps working correctly
// once M3 ships, without needing to revisit this action later. media's
// businessPageId is nullable, so those rows just lose their link rather
// than blocking deletion.
export async function deleteBusinessPage(businessPageId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const business = await prisma.businessPage.findUnique({
    where: { id: businessPageId },
    select: { ownerUserId: true },
  });
  if (!business || business.ownerUserId !== user.id) {
    throw new Error("You don't own this business page.");
  }

  await prisma.$transaction([
    prisma.businessKeyword.deleteMany({ where: { businessPageId } }),
    prisma.post.deleteMany({ where: { businessPageId } }),
    prisma.follow.deleteMany({ where: { businessPageId } }),
    prisma.review.deleteMany({ where: { businessPageId } }),
    prisma.verificationRequest.deleteMany({ where: { businessPageId } }),
    prisma.sponsoredListing.deleteMany({ where: { businessPageId } }),
    prisma.pageView.deleteMany({ where: { businessPageId } }),
    prisma.businessPage.delete({ where: { id: businessPageId } }),
  ]);

  redirect("/");
}
