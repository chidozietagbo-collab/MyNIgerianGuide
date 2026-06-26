import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const SITE_URL = "https://my-n-igerian-guide.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [businesses, states, categories] = await Promise.all([
    prisma.businessPage.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.state.findMany({ select: { slug: true } }),
    prisma.category.findMany({
      where: { isActive: true, status: "APPROVED" },
      select: { slug: true },
    }),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/search`, changeFrequency: "daily", priority: 0.8 },
  ];

  const businessPages: MetadataRoute.Sitemap = businesses.map((b) => ({
    url: `${SITE_URL}/b/${b.slug}`,
    lastModified: b.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // City pages use the state's slug as the city identifier for now —
  // there's no separate, finer-grained "city" entity in the schema today
  // (only State -> LocalGovernment -> Town), so /cities/:slug maps to a
  // State per the brief's own example (/cities/abuja). This can be
  // revisited if a true city-level page is ever needed below state level.
  const cityPages: MetadataRoute.Sitemap = states.map((s) => ({
    url: `${SITE_URL}/cities/${s.slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const categoryPages: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/categories/${c.slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticPages, ...businessPages, ...cityPages, ...categoryPages];
}
