import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getAllCampaignsForAdmin } from "./ad-campaigns-admin-actions";
import AdCampaignsClient from "./AdCampaignsClient";

export default async function AdCampaignsAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: user.id },
    select: {
      isActive: true,
      userRoles: {
        select: {
          role: {
            select: {
              rolePermissions: {
                select: { permission: { select: { key: true } } },
              },
            },
          },
        },
      },
    },
  });

  const permissionKeys = new Set(
    adminUser?.isActive
      ? adminUser.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.key))
      : []
  );

  if (!permissionKeys.has("ad.view")) {
    redirect("/");
  }

  // getAllCampaignsForAdmin() itself also calls requirePermission("ad.view")
  // — intentionally redundant with the check above, same pattern as every
  // other admin page in this app: the page gate decides whether to render
  // at all, the action's own check protects the data regardless of where
  // it's called from.
  const initialCampaigns = await getAllCampaignsForAdmin();

  return (
    <AdCampaignsClient
      initialCampaigns={initialCampaigns}
      canReviewCreative={permissionKeys.has("ad.review_creative")}
      canSetPricing={permissionKeys.has("ad.set_pricing")}
      canDelete={permissionKeys.has("ad.delete")}
    />
  );
}
