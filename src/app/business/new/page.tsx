import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import BusinessWizard from "@/components/BusinessWizard";
import {
  createBusinessPage,
  getLocalGovernments,
  getTowns,
  submitNewTown,
  searchKeywords,
} from "./actions";

export default async function NewBusinessPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // The wizard creates a BusinessPage owned by the current user — there's
  // no sensible anonymous path, so this mirrors the /account guard.
  if (!user) {
    redirect("/login");
  }

  const [states, categories] = await Promise.all([
    prisma.state.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <BusinessWizard
      states={states}
      categories={categories}
      getLocalGovernments={getLocalGovernments}
      getTowns={getTowns}
      submitNewTown={submitNewTown}
      searchKeywords={searchKeywords}
      createBusinessPage={createBusinessPage}
    />
  );
}
