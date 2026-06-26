import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { searchUsers } from "./user-management-actions";
import UserManagementClient from "./UserManagementClient";

export default async function UserManagementPage() {
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

  if (!permissions.has("user.view")) {
    redirect("/");
  }

  const initialUsers = await searchUsers("");

  return (
    <UserManagementClient
      initialUsers={initialUsers.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
      canWarn={permissions.has("user.warn")}
      canSuspend={permissions.has("user.suspend")}
      canBan={permissions.has("user.ban")}
      canDelete={permissions.has("user.delete")}
      canResetPassword={permissions.has("user.reset_password")}
    />
  );
}
