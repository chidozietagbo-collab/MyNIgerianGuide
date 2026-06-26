import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getOpenReports } from "./moderation-actions";
import ModerationQueueClient from "./ModerationQueueClient";

export default async function ModerationQueuePage() {
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

  const hasReportViewPermission =
    !!adminUser?.isActive &&
    adminUser.userRoles.some((ur) =>
      ur.role.rolePermissions.some((rp) => rp.permission.key === "report.view")
    );

  if (!hasReportViewPermission) {
    redirect("/");
  }

  // getOpenReports() itself also calls requirePermission("report.view") —
  // a second check, intentionally redundant with the one above. The page
  // gate decides whether to render this page AT ALL; the action's own
  // check is what actually protects the data if this function is ever
  // called from anywhere else (e.g. a future refresh action), so the two
  // checks aren't duplicating effort for no reason.
  const initialReports = await getOpenReports();

  return <ModerationQueueClient initialReports={initialReports} />;
}

