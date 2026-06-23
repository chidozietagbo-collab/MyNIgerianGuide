import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import TaxonomyReviewClient from "./TaxonomyReviewClient";

export default async function TaxonomyReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: user.id },
    select: { isActive: true },
  });

  // No dedicated "not authorized" page exists yet — redirecting home is a
  // reasonable placeholder until M5 builds proper admin routing/guards.
  if (!adminUser || !adminUser.isActive) {
    redirect("/");
  }

  const [categories, keywords] = await Promise.all([
    prisma.category.findMany({
      where: { status: "PENDING" },
      orderBy: { id: "asc" },
      select: { id: true, name: true, submittedBy: { select: { email: true } } },
    }),
    prisma.keyword.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        category: { select: { name: true } },
        submittedBy: { select: { email: true } },
      },
    }),
  ]);

  return (
    <TaxonomyReviewClient
      initialCategories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        submittedByEmail: c.submittedBy?.email ?? "Unknown",
      }))}
      initialKeywords={keywords.map((k) => ({
        id: k.id,
        name: k.name,
        categoryName: k.category.name,
        submittedByEmail: k.submittedBy?.email ?? "Unknown",
      }))}
    />
  );
}
