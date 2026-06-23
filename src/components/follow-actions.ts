"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function toggleFollow(businessPageId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const business = await prisma.businessPage.findUnique({
    where: { id: businessPageId },
    select: { slug: true, ownerUserId: true },
  });
  if (!business) {
    throw new Error("Business not found.");
  }

  // A business owner following their own page doesn't make sense — guard
  // against it here rather than relying on the UI to never offer it,
  // since this is a server action and should be safe on its own.
  if (business.ownerUserId === user.id) {
    throw new Error("You can't follow your own business page.");
  }

  const existing = await prisma.follow.findUnique({
    where: { followerUserId_businessPageId: { followerUserId: user.id, businessPageId } },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
  } else {
    await prisma.follow.create({
      data: { followerUserId: user.id, businessPageId },
    });
  }

  revalidatePath(`/b/${business.slug}`);
  return { following: !existing };
}
