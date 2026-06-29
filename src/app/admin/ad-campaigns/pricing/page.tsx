import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getAdPriceOverrides } from "../ad-campaigns-admin-actions";
import PricingOverridesClient from "./PricingOverridesClient";

export default async function AdPricingOverridesPage() {
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

  const hasPricingPermission =
    !!adminUser?.isActive &&
    adminUser.userRoles.some((ur) =>
      ur.role.rolePermissions.some((rp) => rp.permission.key === "ad.set_pricing")
    );

  if (!hasPricingPermission) {
    redirect("/admin/ad-campaigns");
  }

  const initialOverrides = await getAdPriceOverrides();

  return <PricingOverridesClient initialOverrides={initialOverrides} />;
}
