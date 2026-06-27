import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getAuditLog, getAdminsWithAuditEntries } from "./audit-log-actions";
import AuditLogClient from "./AuditLogClient";

export default async function AuditLogPage() {
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

  if (!permissions.has("admin.view_audit_log")) {
    redirect("/");
  }

  const [initialEntries, admins] = await Promise.all([
    getAuditLog(),
    getAdminsWithAuditEntries(),
  ]);

  return <AuditLogClient initialEntries={initialEntries} admins={admins} />;
}
