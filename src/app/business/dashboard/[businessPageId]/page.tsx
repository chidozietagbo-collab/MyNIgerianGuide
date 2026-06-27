import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnedBusinessPages } from "./dashboard-overview-actions";

// This route only ever redirects into /business/dashboard/[businessPageId]
// — the active business page now lives in the URL rather than purely in
// client state. That's what lets PostsSection/ReviewsSection's existing
// router.refresh() calls work correctly here: refresh re-runs the Server
// Component for the CURRENT route, and with the page id in the URL, that
// Server Component already knows which page's data to re-fetch. A purely
// client-side page switcher had no server route to refresh against.
export default async function BusinessDashboardRootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const ownedPages = await getOwnedBusinessPages();

  if (ownedPages.length === 0) {
    redirect("/business/new");
  }

  redirect(`/business/dashboard/${ownedPages[0].id}`);
}
