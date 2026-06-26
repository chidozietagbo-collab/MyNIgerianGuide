import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getPendingVerifications } from "./verification-queue-actions";
import VerificationQueueClient from "./VerificationQueueClient";

export default async function VerificationQueuePage() {
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

  const hasVerifyPermission =
    !!adminUser?.isActive &&
    adminUser.userRoles.some((ur) =>
      ur.role.rolePermissions.some((rp) => rp.permission.key === "business.verify")
    );

  if (!hasVerifyPermission) {
    redirect("/");
  }

  const initialRequests = await getPendingVerifications();

  return <VerificationQueueClient initialRequests={initialRequests} />;
}
