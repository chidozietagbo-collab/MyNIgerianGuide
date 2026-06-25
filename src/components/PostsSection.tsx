"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Heart, Loader2, MessageCircle, Pencil, Trash2, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createPost, updatePost, deletePost } from "./post-actions";
import { addComment, updateComment, deleteComment, toggleLike } from "./comment-actions";

const inputClass =
  "w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type CommentType = {
  id: string;
  authorUserId: string;
  authorName: string;
  content: string;
  createdAt: string;
};

type Post = {
  id: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
  likeCount: number;
  isLiked: boolean;
  comments: CommentType[];
};

type PostsSectionProps = {
  businessPageId: string;
  initialPosts: Post[];
  isOwner: boolean;
  currentUserId: string | null;
  isSignedIn: boolean;
};

// Posts are always rendered from initialPosts (server data). Every create,
// edit, or delete calls router.refresh() afterward, which re-runs the
// parent Server Component and passes fresh initialPosts back down — this
// is simpler and more reliable than juggling a parallel client-side copy
// of server state, which was the source of an earlier bug.
export default function PostsSection({
  businessPageId,
  initialPosts,
  isOwner,
  currentUserId,
  isSignedIn,
}: PostsSectionProps) {
  const [composing, setComposing] = useState(false);

  if (initialPosts.length === 0 && !isOwner) {
    return null;
  }

  return (
    <section className="mt-6 rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">Updates</h2>
        {isOwner && !composing && (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="text-sm font-medium text-green-600 hover:underline"
          >
            New post
          </button>
        )}
      </div>

      {composing && (
        <PostComposer
          businessPageId={businessPageId}
          onDone={() => setComposing(false)}
          onCancel={() => setComposing(false)}
        />
      )}

      {initialPosts.length === 0 ? (
        <p className="mt-3 text-sm text-ink-300">No updates yet.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {initialPosts.map((post) => (
            <PostItem
              key={post.id}
              post={post}
              businessPageId={businessPageId}
              isOwner={isOwner}
              currentUserId={currentUserId}
              isSignedIn={isSignedIn}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PostComposer({
  businessPageId,
  onDone,
  onCancel,
  initialContent = "",
  initialMediaUrls = [],
  editingPostId,
}: {
  businessPageId: string;
  onDone: () => void;
  onCancel: () => void;
  initialContent?: string;
  initialMediaUrls?: string[];
  editingPostId?: string;
}) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [mediaUrls, setMediaUrls] = useState<string[]>(initialMediaUrls);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Image must be smaller than 5MB.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `${businessPageId}/post-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("business-photos")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("business-photos").getPublicUrl(path);
      setMediaUrls((prev) => [...prev, urlData.publicUrl]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeMedia(url: string) {
    setMediaUrls((prev) => prev.filter((u) => u !== url));
  }

  function handleSubmit() {
    setError(null);
    if (!content.trim()) {
      setError("Write something before posting.");
      return;
    }
    startTransition(async () => {
      try {
        if (editingPostId) {
          await updatePost(editingPostId, content, mediaUrls);
        } else {
          await createPost(businessPageId, content, mediaUrls);
        }
        router.refresh();
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save this post.");
      }
    });
  }

  return (
    <div className="mt-3 space-y-3 rounded-md border border-ink-100 bg-ink-50 p-4">
      <textarea
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className={inputClass}
        placeholder="Share an update with your followers…"
      />

      {mediaUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {mediaUrls.map((url) => (
            <div key={url} className="relative h-16 w-16 overflow-hidden rounded-md bg-ink-100">
              <Image src={url} alt="" fill className="object-cover" sizes="64px" />
              <button
                type="button"
                onClick={() => removeMedia(url)}
                aria-label="Remove image"
                className="absolute right-0.5 top-0.5 rounded-full bg-ink-900/70 p-0.5 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-sm font-medium text-ink-700 hover:text-green-600 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Add photo"}
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel} className="text-sm font-medium text-ink-500 hover:text-ink-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500 disabled:opacity-60"
          >
            {isPending ? "Posting…" : editingPostId ? "Save changes" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PostItem({
  post,
  businessPageId,
  isOwner,
  currentUserId,
  isSignedIn,
}: {
  post: Post;
  businessPageId: string;
  isOwner: boolean;
  currentUserId: string | null;
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Like button: optimistic toggle on the button's own appearance only —
  // the actual count still comes from the server on next refresh, this
  // just avoids a visible delay on the click itself.
  const [liking, startLikeTransition] = useTransition();
  const [optimisticLiked, setOptimisticLiked] = useState(post.isLiked);
  const [optimisticCount, setOptimisticCount] = useState(post.likeCount);

  const [showComments, setShowComments] = useState(false);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deletePost(post.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't delete this post.");
      }
    });
  }

  function handleLikeClick() {
    if (!isSignedIn) {
      router.push("/login");
      return;
    }
    const nextLiked = !optimisticLiked;
    setOptimisticLiked(nextLiked);
    setOptimisticCount((c) => (nextLiked ? c + 1 : Math.max(0, c - 1)));
    startLikeTransition(async () => {
      try {
        await toggleLike(post.id);
        router.refresh();
      } catch {
        // Revert optimistic state on failure.
        setOptimisticLiked(!nextLiked);
        setOptimisticCount(post.likeCount);
      }
    });
  }

  if (editing) {
    return (
      <PostComposer
        businessPageId={businessPageId}
        editingPostId={post.id}
        initialContent={post.content}
        initialMediaUrls={post.mediaUrls}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-md border border-ink-100 p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs text-ink-300">
          {new Date(post.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
        </p>
        {isOwner && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEditing(true)} aria-label="Edit post" className="text-ink-300 hover:text-green-600">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                aria-label="Delete post"
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

      <p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">{post.content}</p>

      {post.mediaUrls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.mediaUrls.map((url) => (
            <div key={url} className="relative h-24 w-24 overflow-hidden rounded-md bg-ink-100">
              <Image src={url} alt="" fill className="object-cover" sizes="96px" />
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {/* Like / comment toggle row */}
      <div className="mt-3 flex items-center gap-4 border-t border-ink-100 pt-3">
        <button
          type="button"
          onClick={handleLikeClick}
          disabled={liking}
          className={`flex items-center gap-1.5 text-sm font-medium transition disabled:opacity-60 ${
            optimisticLiked ? "text-danger" : "text-ink-500 hover:text-danger"
          }`}
        >
          <Heart className={`h-4 w-4 ${optimisticLiked ? "fill-danger" : ""}`} />
          {optimisticCount > 0 ? optimisticCount : ""} {optimisticCount === 1 ? "Like" : "Likes"}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-green-600"
        >
          <MessageCircle className="h-4 w-4" />
          {post.comments.length > 0 ? post.comments.length : ""}{" "}
          {post.comments.length === 1 ? "Comment" : "Comments"}
        </button>
      </div>

      {showComments && (
        <CommentsBlock
          postId={post.id}
          comments={post.comments}
          isOwner={isOwner}
          currentUserId={currentUserId}
          isSignedIn={isSignedIn}
        />
      )}
    </div>
  );
}

function CommentsBlock({
  postId,
  comments,
  isOwner,
  currentUserId,
  isSignedIn,
}: {
  postId: string;
  comments: CommentType[];
  isOwner: boolean;
  currentUserId: string | null;
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const [newComment, setNewComment] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    if (!isSignedIn) {
      router.push("/login");
      return;
    }
    if (!newComment.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addComment(postId, newComment);
        setNewComment("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't post your comment.");
      }
    });
  }

  return (
    <div className="mt-3 space-y-3 border-t border-ink-100 pt-3">
      {comments.length === 0 ? (
        <p className="text-sm text-ink-300">No comments yet.</p>
      ) : (
        comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            canDelete={isOwner || comment.authorUserId === currentUserId}
            canEdit={comment.authorUserId === currentUserId}
          />
        ))
      )}

      <div className="flex items-center gap-2">
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={isSignedIn ? "Write a comment…" : "Sign in to comment"}
          className={inputClass}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending}
          className="shrink-0 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500 disabled:opacity-60"
        >
          Post
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function CommentItem({
  comment,
  canDelete,
  canEdit,
}: {
  comment: CommentType;
  canDelete: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(comment.content);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!content.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateComment(comment.id, content);
        setEditing(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save your comment.");
      }
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteComment(comment.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't delete this comment.");
      }
    });
  }

  return (
    <div className="rounded-md bg-ink-50 p-3">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold text-ink-700">{comment.authorName}</p>
        <div className="flex items-center gap-2">
          {canEdit && !editing && (
            <button type="button" onClick={() => setEditing(true)} aria-label="Edit comment" className="text-ink-300 hover:text-green-600">
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={handleDelete} disabled={isPending} aria-label="Delete comment" className="text-ink-300 hover:text-danger">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      {editing ? (
        <div className="mt-1 space-y-2">
          <input value={content} onChange={(e) => setContent(e.target.value)} className={inputClass} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white"
            >
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-ink-500">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-sm text-ink-700">{comment.content}</p>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
