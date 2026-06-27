import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnedBusinessPages } from "./dashboard-overview-actions";
import BusinessDashboardClient from "./BusinessDashboardClient";

export default async function BusinessDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const ownedPages = await getOwnedBusinessPages();

  if (ownedPages.length === 0) {
    // Nothing to show a dashboard for yet — send them to start the setup
    // wizard instead of rendering an empty dashboard.
    redirect("/business/new");
  }

  return <BusinessDashboardClient ownedPages={ownedPages} initialPageId={ownedPages[0].id} />;
}
