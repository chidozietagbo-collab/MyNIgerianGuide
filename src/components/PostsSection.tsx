"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Loader2, Pencil, Trash2, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createPost, updatePost, deletePost } from "./post-actions";

const inputClass =
  "w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Post = {
  id: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
};

type PostsSectionProps = {
  businessPageId: string;
  initialPosts: Post[];
  isOwner: boolean;
};

export default function PostsSection({ businessPageId, initialPosts, isOwner }: PostsSectionProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [composing, setComposing] = useState(false);

  function handleCreated(post: Post) {
    setPosts((prev) => [post, ...prev]);
    setComposing(false);
  }

  function handleUpdated(updated: Post) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handleDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  if (posts.length === 0 && !isOwner) {
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
          onCreated={handleCreated}
          onCancel={() => setComposing(false)}
        />
      )}

      {posts.length === 0 ? (
        <p className="mt-3 text-sm text-ink-300">No updates yet.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {posts.map((post) => (
            <PostItem
              key={post.id}
              post={post}
              businessPageId={businessPageId}
              isOwner={isOwner}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PostComposer({
  businessPageId,
  onCreated,
  onCancel,
  initialContent = "",
  initialMediaUrls = [],
  editingPostId,
}: {
  businessPageId: string;
  onCreated: (post: Post) => void;
  onCancel: () => void;
  initialContent?: string;
  initialMediaUrls?: string[];
  editingPostId?: string;
}) {
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
          onCreated({ id: editingPostId, content: content.trim(), mediaUrls, createdAt: new Date().toISOString() });
        } else {
          await createPost(businessPageId, content, mediaUrls);
          // The real id/createdAt come from the server; this optimistic
          // placeholder is replaced on next page refresh/revalidate. Using
          // a temporary id here is fine since revalidatePath triggers a
          // server refetch that will reconcile it.
          onCreated({ id: `temp-${Date.now()}`, content: content.trim(), mediaUrls, createdAt: new Date().toISOString() });
        }
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
  onUpdated,
  onDeleted,
}: {
  post: Post;
  businessPageId: string;
  isOwner: boolean;
  onUpdated: (post: Post) => void;
  onDeleted: (postId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deletePost(post.id);
        onDeleted(post.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't delete this post.");
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
        onCreated={(updated) => {
          onUpdated(updated);
          setEditing(false);
        }}
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
    </div>
  );
}
