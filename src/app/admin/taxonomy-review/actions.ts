"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: user.id },
    select: { isActive: true },
  });
  if (!adminUser || !adminUser.isActive) {
    throw new Error("Admin access required.");
  }
}

export async function getPendingTaxonomy() {
  await requireAdmin();

  const [categories, keywords] = await Promise.all([
    prisma.category.findMany({
      where: { status: "PENDING" },
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        submittedBy: { select: { email: true } },
      },
    }),
    prisma.keyword.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        category: { select: { name: true } },
        submittedBy: { select: { email: true } },
      },
    }),
  ]);

  return { categories, keywords };
}

export async function approveCategory(categoryId: string) {
  await requireAdmin();
  await prisma.category.update({ where: { id: categoryId }, data: { status: "APPROVED" } });
  revalidatePath("/admin/taxonomy-review");
}

export async function rejectCategory(categoryId: string) {
  await requireAdmin();
  // A rejected category may already be referenced by a business page
  // (submissions are usable immediately by their own creator) — rejecting
  // marks it REJECTED rather than deleting it outright, so existing
  // references don't break. isActive=false also hides it from the
  // approved-categories dropdown going forward.
  await prisma.category.update({
    where: { id: categoryId },
    data: { status: "REJECTED", isActive: false },
  });
  revalidatePath("/admin/taxonomy-review");
}

export async function approveKeyword(keywordId: string) {
  await requireAdmin();
  await prisma.keyword.update({ where: { id: keywordId }, data: { status: "APPROVED" } });
  revalidatePath("/admin/taxonomy-review");
}

export async function rejectKeyword(keywordId: string) {
  await requireAdmin();
  // Same reasoning as rejectCategory — mark REJECTED, don't delete, since
  // a business may already be tagged with it.
  await prisma.keyword.update({ where: { id: keywordId }, data: { status: "REJECTED" } });
  revalidatePath("/admin/taxonomy-review");
}
