"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Star, Trash2 } from "lucide-react";
import { createReview, updateReview, deleteReview, replyToReview, deleteReply } from "./review-actions";

const textareaClass =
  "w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

type Review = {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  body: string | null;
  ownerResponse: string | null;
  createdAt: string;
};

type ReviewsSectionProps = {
  businessPageId: string;
  initialReviews: Review[];
  averageRating: number;
  currentUserId: string | null;
  isOwner: boolean;
  isFollowing: boolean;
};

function StarRating({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={onChange ? "cursor-pointer" : "cursor-default"}
        >
          <Star
            className={`h-5 w-5 ${n <= value ? "fill-amber text-amber" : "text-ink-100"}`}
          />
        </button>
      ))}
    </div>
  );
}

export default function ReviewsSection({
  businessPageId,
  initialReviews,
  averageRating,
  currentUserId,
  isOwner,
  isFollowing,
}: ReviewsSectionProps) {
  const router = useRouter();
  const [writing, setWriting] = useState(false);

  const myReview = currentUserId ? initialReviews.find((r) => r.userId === currentUserId) : undefined;
  const canWriteReview = !isOwner && isFollowing && !myReview;

  return (
    <section className="mt-6 rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">Reviews</h2>
          {initialReviews.length > 0 && (
            <div className="mt-1 flex items-center gap-2">
              <StarRating value={Math.round(averageRating)} />
              <span className="text-sm font-medium text-ink-700">{averageRating.toFixed(1)}</span>
              <span className="text-sm text-ink-300">
                ({initialReviews.length} review{initialReviews.length === 1 ? "" : "s"})
              </span>
            </div>
          )}
        </div>
        {canWriteReview && !writing && (
          <button
            type="button"
            onClick={() => setWriting(true)}
            className="text-sm font-medium text-green-600 hover:underline"
          >
            Write a review
          </button>
        )}
        {!isOwner && !isFollowing && !myReview && (
          <p className="text-xs text-ink-300">Follow this business to leave a review.</p>
        )}
      </div>

      {writing && (
        <ReviewForm
          businessPageId={businessPageId}
          onDone={() => {
            setWriting(false);
            router.refresh();
          }}
          onCancel={() => setWriting(false)}
        />
      )}

      {initialReviews.length === 0 ? (
        <p className="mt-3 text-sm text-ink-300">No reviews yet.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {initialReviews.map((review) => (
            <ReviewItem
              key={review.id}
              review={review}
              isMine={review.userId === currentUserId}
              isOwner={isOwner}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewForm({
  businessPageId,
  onDone,
  onCancel,
  editingReviewId,
  initialRating = 0,
  initialBody = "",
}: {
  businessPageId: string;
  onDone: () => void;
  onCancel: () => void;
  editingReviewId?: string;
  initialRating?: number;
  initialBody?: string;
}) {
  const [rating, setRating] = useState(initialRating);
  const [body, setBody] = useState(initialBody);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    if (rating === 0) {
      setError("Please choose a star rating.");
      return;
    }
    startTransition(async () => {
      try {
        if (editingReviewId) {
          await updateReview(editingReviewId, rating, body);
        } else {
          await createReview(businessPageId, rating, body);
        }
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save your review.");
      }
    });
  }

  return (
    <div className="mt-3 space-y-3 rounded-md border border-ink-100 bg-ink-50 p-4">
      <StarRating value={rating} onChange={setRating} />
      <textarea
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className={textareaClass}
        placeholder="Share your experience (optional)…"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500 disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Submit review"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-medium text-ink-500 hover:text-ink-700">
          Cancel
        </button>
      </div>
    </div>
  );
}

function ReviewItem({ review, isMine, isOwner }: { review: Review; isMine: boolean; isOwner: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [replying, setReplying] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteReview(review.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't delete this review.");
      }
    });
  }

  if (editing) {
    return (
      <ReviewForm
        businessPageId=""
        editingReviewId={review.id}
        initialRating={review.rating}
        initialBody={review.body ?? ""}
        onDone={() => {
          setEditing(false);
          router.refresh();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-md border border-ink-100 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-ink-900">{review.userName}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <StarRating value={review.rating} />
            <span className="text-xs text-ink-300">
              {new Date(review.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>
        {isMine && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEditing(true)} aria-label="Edit review" className="text-ink-300 hover:text-green-600">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                aria-label="Delete review"
                className="text-ink-300 hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="flex items-center gap-1 text-xs">
                <button type="button" onClick={handleDelete} disabled={isPending} className="font-semibold text-danger">
                  Confirm
                </button>
                <button type="button" onClick={() => setConfirmingDelete(false)} className="text-ink-500">
                  Cancel
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {review.body && <p className="mt-2 text-sm text-ink-700">{review.body}</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {review.ownerResponse && !replying && (
        <div className="mt-3 rounded-md bg-ink-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">Owner response</p>
            {isOwner && (
              <button type="button" onClick={() => setReplying(true)} aria-label="Edit reply" className="text-ink-300 hover:text-green-600">
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-700">{review.ownerResponse}</p>
        </div>
      )}

      {isOwner && !review.ownerResponse && !replying && (
        <button
          type="button"
          onClick={() => setReplying(true)}
          className="mt-2 text-xs font-medium text-green-600 hover:underline"
        >
          Reply as owner
        </button>
      )}

      {isOwner && replying && (
        <ReplyForm
          reviewId={review.id}
          initialResponse={review.ownerResponse ?? ""}
          onDone={() => {
            setReplying(false);
            router.refresh();
          }}
          onCancel={() => setReplying(false)}
        />
      )}
    </div>
  );
}

function ReplyForm({
  reviewId,
  initialResponse,
  onDone,
  onCancel,
}: {
  reviewId: string;
  initialResponse: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [response, setResponse] = useState(initialResponse);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await replyToReview(reviewId, response);
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save your reply.");
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        await deleteReply(reviewId);
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't remove the reply.");
      }
    });
  }

  return (
    <div className="mt-3 space-y-2 rounded-md bg-ink-50 p-3">
      <textarea
        rows={2}
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        className={textareaClass}
        placeholder="Reply to this review…"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-500 disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save reply"}
        </button>
        {initialResponse && (
          <button type="button" onClick={handleRemove} disabled={isPending} className="text-xs font-medium text-danger">
            Remove reply
          </button>
        )}
        <button type="button" onClick={onCancel} className="text-xs font-medium text-ink-500 hover:text-ink-700">
          Cancel
        </button>
      </div>
    </div>
  );
}
