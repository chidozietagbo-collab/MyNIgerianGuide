import { notFound } from "next/navigation";
import { BadgeCheck, Clock, Globe, Mail, MapPin, Phone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import PhotoGallery from "@/components/PhotoGallery";
import PostsSection from "@/components/PostsSection";
import EditableHeader from "@/components/EditableHeader";
import EditableAbout from "@/components/EditableAbout";
import EditableContact from "@/components/EditableContact";
import EditableHours from "@/components/EditableHours";
import EditableKeywords from "@/components/EditableKeywords";
import DeleteBusinessButton from "@/components/DeleteBusinessButton";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function BusinessPage({ params }: PageProps) {
  const { slug } = await params;

  const business = await prisma.businessPage.findUnique({
    where: { slug },
    include: {
      category: { select: { name: true } },
      state: { select: { name: true } },
      localGovernment: { select: { name: true } },
      town: { select: { name: true } },
      businessKeywords: { include: { keyword: { select: { id: true, name: true } } } },
      media: { orderBy: { createdAt: "asc" }, select: { id: true, url: true } },
      posts: {
        orderBy: { createdAt: "desc" },
        select: { id: true, content: true, mediaUrls: true, createdAt: true, isHidden: true },
      },
    },
  });

  if (!business || !business.isPublished) {
    notFound();
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user?.id === business.ownerUserId;

  // Owner-only data needed for the inline edit forms — fetched only when
  // it'll actually be used, so a non-owner visiting the page doesn't pay
  // for these extra queries.
  const [categories, states, initialLocalGovernments, initialTowns] = isOwner
    ? await Promise.all([
        prisma.category.findMany({
          where: { isActive: true, status: "APPROVED" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
        prisma.state.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
        prisma.localGovernment.findMany({
          where: { stateId: business.stateId },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
        prisma.town.findMany({
          where: { localGovernmentId: business.localGovernmentId, status: "APPROVED" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
      ])
    : [[], [], [], []];

  const initial = business.name.trim().charAt(0).toUpperCase() || "?";
  const locationParts = [business.town?.name, business.localGovernment.name, business.state.name].filter(
    Boolean
  );
  // Cast is safe: hours are always written by the wizard/edit forms using
  // exactly these day-abbreviation keys, but Prisma's Json field type is
  // necessarily the broader Record<string, ...> shape.
  const hours = business.hours as
    | Partial<Record<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun", { open: string; close: string; closed: boolean }>>
    | null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      {/* Header */}
      <div className="flex items-start gap-4 rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-green-600 font-display text-xl font-bold text-white">
          {initial}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold text-ink-900">{business.name}</h1>
            {business.verificationStatus === "VERIFIED" && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600" title="Verified">
                <BadgeCheck className="h-3.5 w-3.5 text-white" />
              </span>
            )}
            {isOwner && (
              <EditableHeader
                businessPageId={business.id}
                currentName={business.name}
                currentCategoryId={business.categoryId}
                currentStateId={business.stateId}
                currentLocalGovernmentId={business.localGovernmentId}
                currentTownId={business.townId}
                categories={categories}
                states={states}
                initialLocalGovernments={initialLocalGovernments}
                initialTowns={initialTowns}
              />
            )}
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {locationParts.join(", ")} · {business.category.name}
          </p>
          {!business.isClaimed && (
            <span className="mt-2 inline-block rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-500">
              Unclaimed listing
            </span>
          )}
        </div>
      </div>

      {/* About */}
      {(business.description || isOwner) && (
        <section className="mt-6 rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">About</h2>
            {isOwner && <EditableAbout businessPageId={business.id} currentDescription={business.description} currentAddress={business.address} />}
          </div>
          {business.description && <p className="mt-2 text-sm leading-relaxed text-ink-700">{business.description}</p>}
        </section>
      )}

      {/* Photos */}
      <PhotoGallery
        businessPageId={business.id}
        initialPhotos={business.media.map((m) => ({ id: m.id, url: m.url }))}
        isOwner={isOwner}
      />

      {/* Keywords */}
      {(business.businessKeywords.length > 0 || isOwner) && (
        <section className="mt-6 rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">Services</h2>
            {isOwner && (
              <EditableKeywords
                businessPageId={business.id}
                categoryId={business.categoryId}
                currentKeywords={business.businessKeywords.map((bk) => bk.keyword)}
              />
            )}
          </div>
          {business.businessKeywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {business.businessKeywords.map(({ keyword }) => (
                <span key={keyword.id} className="rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-700">
                  {keyword.name}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Contact */}
      <section className="mt-6 rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">Contact</h2>
          {isOwner && (
            <EditableContact
              businessPageId={business.id}
              currentPhone={business.phone}
              currentEmail={business.email}
              currentWebsite={business.website}
              currentWhatsapp={business.whatsapp}
            />
          )}
        </div>
        <div className="mt-3 space-y-2 text-sm text-ink-700">
          {business.address && (
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-ink-300" />
              {business.address}
            </p>
          )}
          {business.phone && (
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-ink-300" />
              <a href={`tel:${business.phone}`} className="hover:text-green-600">{business.phone}</a>
            </p>
          )}
          {business.whatsapp && (
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-ink-300" />
              <a
                href={`https://wa.me/${business.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-green-600"
              >
                WhatsApp: {business.whatsapp}
              </a>
            </p>
          )}
          {business.email && (
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-ink-300" />
              <a href={`mailto:${business.email}`} className="hover:text-green-600">{business.email}</a>
            </p>
          )}
          {business.website && (
            <p className="flex items-center gap-2">
              <Globe className="h-4 w-4 shrink-0 text-ink-300" />
              <a href={business.website} target="_blank" rel="noopener noreferrer" className="hover:text-green-600">
                {business.website}
              </a>
            </p>
          )}
          {!business.address && !business.phone && !business.whatsapp && !business.email && !business.website && (
            <p className="text-ink-300">No contact details added yet.</p>
          )}
        </div>
      </section>

      {/* Hours */}
      <section className="mt-6 rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-ink-300">
            <Clock className="h-4 w-4" /> Opening hours
          </h2>
          {isOwner && <EditableHours businessPageId={business.id} currentHours={hours} />}
        </div>
        {hours ? (
          <div className="mt-3 space-y-1 text-sm">
            {DAY_ORDER.map((day) => {
              const dayHours = hours[day];
              if (!dayHours) return null;
              return (
                <div key={day} className="flex justify-between text-ink-700">
                  <span className="font-medium">{day}</span>
                  <span className="text-ink-500">
                    {dayHours.closed ? "Closed" : `${dayHours.open} – ${dayHours.close}`}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          isOwner && <p className="mt-2 text-sm text-ink-300">No hours set yet.</p>
        )}
      </section>

      {/* Updates / Posts */}
      <PostsSection
        businessPageId={business.id}
        initialPosts={business.posts
          .filter((p) => isOwner || !p.isHidden)
          .map((p) => ({
            id: p.id,
            content: p.content,
            mediaUrls: p.mediaUrls,
            createdAt: p.createdAt.toISOString(),
          }))}
        isOwner={isOwner}
      />

      {/* Reviews / Follow land here next in Milestone 3 */}

      {isOwner && (
        <div className="mt-10 border-t border-ink-100 pt-6">
          <DeleteBusinessButton businessPageId={business.id} businessName={business.name} />
        </div>
      )}
    </main>
  );
}
