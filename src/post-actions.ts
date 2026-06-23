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
    select: { ownerUserId: true, slug: true },
  });
  if (!business || business.ownerUserId !== user.id) {
    throw new Error("You don't own this business page.");
  }

  return { user, business };
}

export async function createPost(businessPageId: string, content: string, mediaUrls: string[]) {
  const { user, business } = await requireOwnership(businessPageId);

  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Post content is required.");
  }

  await prisma.post.create({
    data: {
      businessPageId,
      authorUserId: user.id,
      content: trimmed,
      mediaUrls,
    },
  });

  revalidatePath(`/b/${business.slug}`);
}

export async function updatePost(postId: string, content: string, mediaUrls: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorUserId: true, businessPage: { select: { slug: true } } },
  });
  if (!post || post.authorUserId !== user.id) {
    throw new Error("You don't own this post.");
  }

  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Post content is required.");
  }

  await prisma.post.update({
    where: { id: postId },
    data: { content: trimmed, mediaUrls },
  });

  revalidatePath(`/b/${post.businessPage.slug}`);
}

export async function deletePost(postId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorUserId: true, businessPage: { select: { slug: true } } },
  });
  if (!post || post.authorUserId !== user.id) {
    throw new Error("You don't own this post.");
  }

  await prisma.post.delete({ where: { id: postId } });
  revalidatePath(`/b/${post.businessPage.slug}`);
}
