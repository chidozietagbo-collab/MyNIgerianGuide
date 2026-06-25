import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Rss, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Feed only makes sense for a signed-in person (it shows updates from
  // THEIR follows) — send a signed-out visitor to log in first, then
  // straight back here, same redirect pattern used for Follow.
  if (!user) {
    redirect("/login?redirect=%2Ffeed");
  }

  const follows = await prisma.follow.findMany({
    where: { followerUserId: user.id },
    select: { businessPageId: true },
  });
  const followedIds = follows.map((f) => f.businessPageId);

  const posts =
    followedIds.length > 0
      ? await prisma.post.findMany({
          where: { businessPageId: { in: followedIds }, isHidden: false },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            content: true,
            mediaUrls: true,
            createdAt: true,
            businessPage: { select: { name: true, slug: true } },
          },
        })
      : [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center gap-2">
        <Rss className="h-5 w-5 text-green-600" />
        <h1 className="font-display text-2xl font-bold text-ink-900">Your feed</h1>
      </div>
      <p className="mt-1 text-sm text-ink-500">Updates from businesses you follow.</p>

      {followedIds.length === 0 ? (
        <div className="mt-8 rounded-lg border border-ink-100 bg-white p-8 text-center shadow-sm">
          <Store className="mx-auto h-8 w-8 text-ink-300" />
          <p className="mt-3 text-sm font-medium text-ink-700">You&apos;re not following any businesses yet.</p>
          <p className="mt-1 text-sm text-ink-500">
            Follow a business from its page to see their updates here.
          </p>
          <Link
            href="/search"
            className="mt-4 inline-block rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500"
          >
            Find businesses to follow
          </Link>
        </div>
      ) : posts.length === 0 ? (
        <div className="mt-8 rounded-lg border border-ink-100 bg-white p-8 text-center shadow-sm">
          <Rss className="mx-auto h-8 w-8 text-ink-300" />
          <p className="mt-3 text-sm font-medium text-ink-700">No updates yet.</p>
          <p className="mt-1 text-sm text-ink-500">
            The businesses you follow haven&apos;t posted anything yet — check back soon.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {posts.map((post) => {
            const initial = post.businessPage.name.trim().charAt(0).toUpperCase() || "?";
            return (
              <div key={post.id} className="rounded-lg border border-ink-100 bg-white p-5 shadow-sm">
                <Link href={`/b/${post.businessPage.slug}`} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-600 font-display text-sm font-bold text-white">
                    {initial}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink-900 hover:text-green-600">
                      {post.businessPage.name}
                    </p>
                    <p className="text-xs text-ink-300">
                      {new Date(post.createdAt).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </Link>

                <p className="mt-3 whitespace-pre-wrap text-sm text-ink-700">{post.content}</p>

                {post.mediaUrls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {post.mediaUrls.map((url) => (
                      <div key={url} className="relative h-32 w-32 overflow-hidden rounded-md bg-ink-100">
                        <Image src={url} alt="" fill className="object-cover" sizes="128px" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
