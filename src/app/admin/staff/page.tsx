import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getAdminUsers, getRoleTemplates } from "./staff-actions";
import StaffManagementClient from "./StaffManagementClient";

export default async function StaffManagementPage() {
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

  if (!permissions.has("admin.manage_staff")) {
    redirect("/admin");
  }

  const [admins, roleTemplates] = await Promise.all([getAdminUsers(), getRoleTemplates()]);

  return <StaffManagementClient initialAdmins={admins} roleTemplates={roleTemplates} />;
}
