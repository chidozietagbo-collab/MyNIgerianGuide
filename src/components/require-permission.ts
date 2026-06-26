import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// Throws if the signed-in user is not an active admin holding the given
// permission key. This is the application-level mirror of the database's
// has_permission() SQL function — used by every Server Action that needs
// a specific capability, rather than just "is this person any admin at all".
export async function requirePermission(permissionKey: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
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

  if (!adminUser || !adminUser.isActive) {
    throw new Error("Admin access required.");
  }

  const hasPermission = adminUser.userRoles.some((ur) =>
    ur.role.rolePermissions.some((rp) => rp.permission.key === permissionKey)
  );

  if (!hasPermission) {
    throw new Error(`You don't have the "${permissionKey}" permission.`);
  }

  return user;
}
