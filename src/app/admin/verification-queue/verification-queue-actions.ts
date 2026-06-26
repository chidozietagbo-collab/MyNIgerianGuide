"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/components/require-permission";

export async function getPendingVerifications() {
  await requirePermission("business.verify");

  const requests = await prisma.verificationRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      cacNumber: true,
      documentUrls: true,
      createdAt: true,
      businessPage: { select: { id: true, name: true, slug: true } },
    },
  });

  return requests.map((r) => ({
    id: r.id,
    cacNumber: r.cacNumber,
    documentPaths: r.documentUrls,
    createdAt: r.createdAt.toISOString(),
    businessId: r.businessPage.id,
    businessName: r.businessPage.name,
    businessSlug: r.businessPage.slug,
  }));
}

// Documents live in a PRIVATE bucket — there's no public URL. This
// generates a short-lived signed URL on demand so a verifier can actually
// view a document, without making the bucket itself public.
export async function getDocumentSignedUrl(path: string) {
  await requirePermission("business.verify");

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("verification-documents")
    .createSignedUrl(path, 300); // 5 minutes — long enough to view, short enough to limit exposure

  if (error || !data) {
    throw new Error("Couldn't generate a link for this document.");
  }

  return data.signedUrl;
}

export async function approveVerification(requestId: string) {
  await requirePermission("business.verify");

  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: { cacNumber: true, businessPageId: true, businessPage: { select: { slug: true } } },
  });
  if (!request) {
    throw new Error("Request not found.");
  }

  // CAC uniqueness, enforced at approval time per the agreed design: a
  // CAC number already verified on a DIFFERENT business blocks this
  // approval, rather than blocking submission upfront (which would wrongly
  // stop legitimate resubmissions or two people briefly both pending).
  const duplicateVerified = await prisma.verificationRequest.findFirst({
    where: {
      cacNumber: request.cacNumber,
      status: "VERIFIED",
      businessPageId: { not: request.businessPageId },
    },
  });
  if (duplicateVerified) {
    throw new Error("This CAC number is already verified on a different business page.");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  await prisma.verificationRequest.update({
    where: { id: requestId },
    data: { status: "VERIFIED", reviewedById: user?.id, reviewNotes: null },
  });

  await prisma.businessPage.update({
    where: { id: request.businessPageId },
    data: { verificationStatus: "VERIFIED" },
  });

  revalidatePath(`/b/${request.businessPage.slug}`);
  revalidatePath("/admin/verification-queue");
}

export async function rejectVerification(requestId: string, reason: string) {
  await requirePermission("business.verify");

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Please provide a reason for rejecting this request.");
  }

  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: { businessPageId: true, businessPage: { select: { slug: true } } },
  });
  if (!request) {
    throw new Error("Request not found.");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  await prisma.verificationRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", reviewedById: user?.id, reviewNotes: trimmedReason },
  });

  await prisma.businessPage.update({
    where: { id: request.businessPageId },
    data: { verificationStatus: "REJECTED" },
  });

  revalidatePath(`/b/${request.businessPage.slug}`);
  revalidatePath("/admin/verification-queue");
}
