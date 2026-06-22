"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Loader2, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addBusinessPhoto, deleteBusinessPhoto } from "./actions";

type Photo = { id: string; url: string };

type PhotoGalleryProps = {
  businessPageId: string;
  initialPhotos: Photo[];
  isOwner: boolean;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB, matches the bucket's file_size_limit
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function PhotoGallery({ businessPageId, initialPhotos, isOwner }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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
      const path = `${businessPageId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("business-photos")
        .upload(path, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage.from("business-photos").getPublicUrl(path);

      await addBusinessPhoto(businessPageId, urlData.publicUrl);
      setPhotos((prev) => [...prev, { id: path, url: urlData.publicUrl }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDelete(photoId: string) {
    startTransition(async () => {
      try {
        await deleteBusinessPhoto(photoId);
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete that photo.");
      }
    });
  }

  if (photos.length === 0 && !isOwner) {
    return null;
  }

  return (
    <section className="mt-6 rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">
          Photos
        </h2>
        {isOwner && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-sm font-medium text-green-600 hover:underline disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Uploading…" : "Add photo"}
          </button>
        )}
      </div>

      {isOwner && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {photos.length === 0 ? (
        <p className="mt-3 text-sm text-ink-300">
          {isOwner ? "No photos yet — add your first one." : "No photos added yet."}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-md bg-ink-100">
              <Image
                src={photo.url}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, 33vw"
              />
              {isOwner && (
                <button
                  type="button"
                  onClick={() => handleDelete(photo.id)}
                  disabled={isPending}
                  aria-label="Delete photo"
                  className="absolute right-1.5 top-1.5 rounded-full bg-ink-900/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
