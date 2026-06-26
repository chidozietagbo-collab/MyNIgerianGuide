"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/components/require-permission";
import { createNotification } from "@/components/create-notification";

export async function getPendingTaxonomy() {
  await requirePermission("keyword.review");

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
  await requirePermission("keyword.review");

  const category = await prisma.category.update({
    where: { id: categoryId },
    data: { status: "APPROVED" },
    select: { name: true, submittedByUserId: true },
  });

  if (category.submittedByUserId) {
    await createNotification({
      userId: category.submittedByUserId,
      type: "CATEGORY_APPROVED",
      title: `Your category "${category.name}" was approved`,
    });
  }

  revalidatePath("/admin/taxonomy-review");
}

export async function rejectCategory(categoryId: string) {
  await requirePermission("keyword.review");

  // A rejected category may already be referenced by a business page
  // (submissions are usable immediately by their own creator) — rejecting
  // marks it REJECTED rather than deleting it outright, so existing
  // references don't break. isActive=false also hides it from the
  // approved-categories dropdown going forward.
  const category = await prisma.category.update({
    where: { id: categoryId },
    data: { status: "REJECTED", isActive: false },
    select: { name: true, submittedByUserId: true },
  });

  if (category.submittedByUserId) {
    await createNotification({
      userId: category.submittedByUserId,
      type: "CATEGORY_REJECTED",
      title: `Your category "${category.name}" wasn't approved`,
    });
  }

  revalidatePath("/admin/taxonomy-review");
}

export async function approveKeyword(keywordId: string) {
  await requirePermission("keyword.review");

  const keyword = await prisma.keyword.update({
    where: { id: keywordId },
    data: { status: "APPROVED" },
    select: { name: true, submittedByUserId: true },
  });

  if (keyword.submittedByUserId) {
    await createNotification({
      userId: keyword.submittedByUserId,
      type: "KEYWORD_APPROVED",
      title: `Your service "${keyword.name}" was approved`,
    });
  }

  revalidatePath("/admin/taxonomy-review");
}

export async function rejectKeyword(keywordId: string) {
  await requirePermission("keyword.review");

  // Same reasoning as rejectCategory — mark REJECTED, don't delete, since
  // a business may already be tagged with it.
  const keyword = await prisma.keyword.update({
    where: { id: keywordId },
    data: { status: "REJECTED" },
    select: { name: true, submittedByUserId: true },
  });

  if (keyword.submittedByUserId) {
    await createNotification({
      userId: keyword.submittedByUserId,
      type: "KEYWORD_REJECTED",
      title: `Your service "${keyword.name}" wasn't approved`,
    });
  }

  revalidatePath("/admin/taxonomy-review");
}
