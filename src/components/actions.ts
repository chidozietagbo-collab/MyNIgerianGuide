"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// The browser uploads the file bytes directly to Supabase Storage (via the
// browser client, using the business_photos_insert RLS policy to enforce
// ownership) — this action only ever receives the resulting public URL and
// records it as a Media row. No file bytes pass through the server.
export async function addBusinessPhoto(businessPageId: string, url: string) {
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

  await prisma.media.create({
    data: {
      entityType: "BUSINESS_PAGE",
      businessPageId,
      url,
      mediaType: "image",
    },
  });

  revalidatePath(`/b/${business.slug}`);
}

export async function deleteBusinessPhoto(mediaId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { url: true, businessPage: { select: { ownerUserId: true, slug: true } } },
  });
  if (!media || !media.businessPage || media.businessPage.ownerUserId !== user.id) {
    throw new Error("You don't own this photo.");
  }

  // Pull the storage object path out of the public URL so the file itself
  // gets removed too, not just the Media row. Public URLs follow the
  // pattern https://PROJECT_REF.supabase.co/storage/v1/object/public/business-photos/PATH
  const marker = "/business-photos/";
  const idx = media.url.indexOf(marker);
  if (idx !== -1) {
    const objectPath = media.url.slice(idx + marker.length);
    // Deleting storage objects needs elevated access here because this
    // server action runs as the app, not as the originally uploading
    // browser session — the admin client bypasses storage RLS for this
    // one well-defined, ownership-checked operation.
    const admin = createAdminClient();
    await admin.storage.from("business-photos").remove([objectPath]);
  }

  await prisma.media.delete({ where: { id: mediaId } });
  revalidatePath(`/b/${media.businessPage.slug}`);
}
