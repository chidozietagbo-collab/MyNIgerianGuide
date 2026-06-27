"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

async function requireOwnership(businessPageId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const business = await prisma.businessPage.findUnique({
    where: { id: businessPageId },
    select: { ownerUserId: true, slug: true, verificationStatus: true },
  });
  if (!business || business.ownerUserId !== user.id) {
    throw new Error("You don't own this business page.");
  }

  return business;
}

export async function getVerificationStatus(businessPageId: string) {
  await requireOwnership(businessPageId);

  // Most recent request first — a business may have resubmitted after a
  // rejection, and we only want to show the latest one's status/notes.
  return prisma.verificationRequest.findFirst({
    where: { businessPageId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      cacNumber: true,
      documentUrls: true,
      status: true,
      reviewNotes: true,
      createdAt: true,
    },
  });
}

export async function submitVerificationRequest(
  businessPageId: string,
  cacNumber: string,
  documentUrls: string[]
) {
  const business = await requireOwnership(businessPageId);

  const trimmedCac = cacNumber.trim();
  if (!trimmedCac) {
    throw new Error("CAC registration number is required.");
  }
  if (documentUrls.length === 0) {
    throw new Error("Please upload at least one supporting document.");
  }

  // A business already mid-review shouldn't be able to submit a second,
  // overlapping request — they can resubmit only after a REJECTED outcome.
  const existing = await prisma.verificationRequest.findFirst({
    where: { businessPageId },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });
  if (existing && existing.status === "PENDING") {
    throw new Error("You already have a verification request pending review.");
  }
  if (existing && existing.status === "VERIFIED") {
    throw new Error("This business is already verified.");
  }

  await prisma.verificationRequest.create({
    data: {
      businessPageId,
      cacNumber: trimmedCac,
      documentUrls,
      status: "PENDING",
    },
  });

  await prisma.businessPage.update({
    where: { id: businessPageId },
    data: { verificationStatus: "PENDING" },
  });

  revalidatePath(`/b/${business.slug}`);
  revalidatePath(`/business/dashboard/${businessPageId}`);
}
