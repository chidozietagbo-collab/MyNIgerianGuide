import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { searchBusinessPages } from "./business-page-management-actions";
import BusinessPageManagementClient from "./BusinessPageManagementClient";

export default async function BusinessPageManagementPage() {
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

  const permissions = new Set(
    adminUser?.isActive
      ? adminUser.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.key))
      : []
  );

  if (!permissions.has("business.view")) {
    redirect("/");
  }

  const initialPages = await searchBusinessPages("");

  return (
    <BusinessPageManagementClient
      initialPages={initialPages.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))}
      canUnpublish={permissions.has("business.unpublish")}
      canVerify={permissions.has("business.verify")}
      canDelete={permissions.has("business.delete")}
    />
  );
}
