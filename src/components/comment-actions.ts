"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

async function requireSignedIn() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }
  return user;
}

async function getPostContext(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { businessPageId: true, businessPage: { select: { slug: true } } },
  });
  return post ? { publicPath: `/b/${post.businessPage.slug}`, businessPageId: post.businessPageId } : null;
}

function revalidatePostPaths(context: { publicPath: string; businessPageId: string } | null) {
  if (!context) return;
  revalidatePath(context.publicPath);
  // Also revalidates the dashboard's per-page route, since PostsSection is
  // reused there too — without this, only the public /b/[slug] page would
  // ever see fresh data after a comment or like.
  revalidatePath(`/business/dashboard/${context.businessPageId}`);
}

// ---------------------------------------------------------------------------
// Comments — any signed-in user can comment on a post.
// ---------------------------------------------------------------------------
export async function addComment(postId: string, content: string) {
  const user = await requireSignedIn();

  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Comment can't be empty.");
  }

  await prisma.comment.create({
    data: { postId, authorUserId: user.id, content: trimmed },
  });

  revalidatePostPaths(await getPostContext(postId));
}

export async function updateComment(commentId: string, content: string) {
  const user = await requireSignedIn();

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { authorUserId: true, postId: true },
  });
  if (!comment || comment.authorUserId !== user.id) {
    throw new Error("You don't own this comment.");
  }

  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Comment can't be empty.");
  }

  await prisma.comment.update({ where: { id: commentId }, data: { content: trimmed } });

  revalidatePostPaths(await getPostContext(comment.postId));
}

// Deletion is allowed for the comment's own author OR the owner of the
// business the post belongs to (basic moderation) — both cases are
// covered by the comments_delete RLS policy, so this action doesn't need
// to duplicate that ownership check itself; it just needs to be a
// signed-in user and let the database enforce who's actually allowed.
export async function deleteComment(commentId: string) {
  await requireSignedIn();

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { postId: true },
  });
  if (!comment) {
    throw new Error("Comment not found.");
  }

  await prisma.comment.delete({ where: { id: commentId } });

  revalidatePostPaths(await getPostContext(comment.postId));
}

// ---------------------------------------------------------------------------
// Likes — simple toggle.
// ---------------------------------------------------------------------------
export async function toggleLike(postId: string) {
  const user = await requireSignedIn();

  const existing = await prisma.postLike.findUnique({
    where: { postId_userId: { postId, userId: user.id } },
  });

  if (existing) {
    await prisma.postLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.postLike.create({ data: { postId, userId: user.id } });
  }

  revalidatePostPaths(await getPostContext(postId));

  return { liked: !existing };
}
