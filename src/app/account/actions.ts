"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const name = (formData.get("name") as string)?.trim() || null;
  const username = (formData.get("username") as string)?.trim() || null;
  const bio = (formData.get("bio") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const state = (formData.get("state") as string)?.trim() || null;

  await prisma.user.update({
    where: { id: user.id },
    data: { name, username, bio, city, state },
  });

  revalidatePath("/account");
  return { success: true };
}

export async function deleteAccount() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  // Remove the public profile row first, then the Supabase Auth record.
  // Note: this is a simple self-service delete for an account with no
  // related data yet (no business pages, posts, reviews). Once those
  // exist, this will need a full cascade/anonymisation strategy — that's
  // Trust & Safety scope (Milestone 5), not Foundation.
  await prisma.user.delete({ where: { id: user.id } });

  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(user.id);

  await supabase.auth.signOut();
  redirect("/");
}
