"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import { toggleFollow } from "./follow-actions";

type FollowButtonProps = {
  businessPageId: string;
  businessSlug: string;
  initialIsFollowing: boolean;
  followerCount: number;
  isSignedIn: boolean;
};

export default function FollowButton({
  businessPageId,
  businessSlug,
  initialIsFollowing,
  followerCount,
  isSignedIn,
}: FollowButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!isSignedIn) {
      // Carry the current page along so login/signup can send the person
      // right back here afterward, instead of always landing on the
      // homepage or the generic "what would you like to do" screen.
      const returnTo = encodeURIComponent(`/b/${businessSlug}`);
      router.push(`/login?redirect=${returnTo}`);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await toggleFollow(businessPageId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't update follow status.");
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={
          initialIsFollowing
            ? "flex items-center gap-1.5 rounded-md border border-ink-100 px-4 py-2 text-sm font-semibold text-ink-700 transition hover:border-ink-300 disabled:opacity-60"
            : "flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500 disabled:opacity-60"
        }
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : initialIsFollowing ? (
          <Check className="h-4 w-4" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        {initialIsFollowing ? "Following" : "Follow"}
      </button>
      <p className="mt-1 text-xs text-ink-300">
        {followerCount} {followerCount === 1 ? "follower" : "followers"}
      </p>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
