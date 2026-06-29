import { redirect } from "next/navigation";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  Users,
  Building2,
  UserPlus,
  ShieldCheck,
  Flag,
  History,
  Tag,
  FileSearch,
  UserCog,
  Rocket,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getAdminDashboardContext, getDashboardStats, getRecentActivity } from "./dashboard-actions";

const ACTION_LABELS: Record<string, string> = {
  "user.warn": "Sent a warning",
  "user.suspend": "Suspended an account",
  "user.unsuspend": "Lifted a suspension",
  "user.ban": "Banned an account",
  "user.delete": "Deleted an account",
  "user.reset_password": "Sent a password reset",
  "business.unpublish": "Unpublished a business page",
  "business.republish": "Republished a business page",
  "business.verify_override": "Verified a business (override)",
  "business.verify_revoke": "Revoked a business's verification",
  "business.delete": "Deleted a business page",
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  USER: "User",
  BUSINESS_PAGE: "Business page",
  POST: "Post",
  REVIEW: "Review",
};

// Each tool on the dashboard is gated to the permission an admin actually
// needs to do anything useful there — matching the permission each tool's
// own page.tsx checks at the door, so the dashboard never shows a link an
// admin would immediately be redirected away from.
type ToolTile = {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  requiredPermission: string;
  statValue?: number;
  statLabel?: string;
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: user.id },
    select: { isActive: true },
  });

  if (!adminUser || !adminUser.isActive) {
    redirect("/login");
  }

  const [context, stats, recentActivity] = await Promise.all([
    getAdminDashboardContext(),
    getDashboardStats(),
    getRecentActivity(),
  ]);

  const permissions = new Set(context.permissionKeys);
  const hasAuditAccess = permissions.has("admin.view_audit_log");

  const tools: ToolTile[] = [
    {
      href: "/admin/users",
      label: "User management",
      description: "Search accounts, view activity, warn, suspend, ban, or delete.",
      icon: Users,
      requiredPermission: "user.view",
    },
    {
      href: "/admin/business-pages",
      label: "Business page management",
      description: "Search pages, view details, unpublish, verify, or delete.",
      icon: Building2,
      requiredPermission: "business.view",
    },
    {
      href: "/admin/verification-queue",
      label: "Verification queue",
      description: "Pending CAC requests awaiting review.",
      icon: ShieldCheck,
      requiredPermission: "business.verify",
      statValue: stats.pendingVerifications,
      statLabel: "pending",
    },
    {
      href: "/admin/moderation-queue",
      label: "Moderation queue",
      description: "Reported posts, reviews, and pages awaiting action.",
      icon: Flag,
      requiredPermission: "report.view",
      statValue: stats.openReports,
      statLabel: "open",
    },
    {
      href: "/admin/taxonomy-review",
      label: "Keyword review",
      description: "Pending user-submitted keywords and categories.",
      icon: Tag,
      // NOTE: taxonomy-review/page.tsx predates the permission system and
      // only checks isActive, not keyword.review — gating this tile to
      // keyword.review would hide it from admins who can actually open
      // the page today. Matching that page's real (looser) gate here
      // rather than introducing a stricter one the page doesn't enforce.
      // Worth tightening both together later.
      requiredPermission: "__any_active_admin__",
    },
    {
      href: "/admin/audit-log",
      label: "Audit log",
      description: "Immutable record of every admin action, platform-wide.",
      icon: History,
      requiredPermission: "admin.view_audit_log",
    },
    {
      href: "/admin/staff",
      label: "Staff management",
      description: "Add admins and manage their roles.",
      icon: UserCog,
      requiredPermission: "admin.manage_staff",
    },
    {
      href: "/admin/ad-campaigns",
      label: "Ad campaigns",
      description: "Review ad creative, manage pricing, remove campaigns.",
      icon: Rocket,
      requiredPermission: "ad.view",
    },
  ];

  const visibleTools = tools.filter(
    (t) => t.requiredPermission === "__any_active_admin__" || permissions.has(t.requiredPermission)
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Admin dashboard</h1>
        <p className="mt-1 text-sm text-ink-500">
          Welcome back, {context.name}
          {context.roleNames.length > 0 && (
            <span className="text-ink-300"> · {context.roleNames.join(", ")}</span>
          )}
        </p>
      </div>

      {/* Overview stats — exactly the 5 named in brief 5.5: total users,
          business pages, new signups today, pending verifications, open
          reports. Visible to every admin regardless of role, since these
          are read-only counts, not actions. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={Users} value={stats.totalUsers} label="Total users" />
        <StatCard icon={Building2} value={stats.totalBusinessPages} label="Business pages" />
        <StatCard icon={UserPlus} value={stats.newSignupsToday} label="New signups today" />
        <StatCard icon={ShieldCheck} value={stats.pendingVerifications} label="Pending verifications" highlight />
        <StatCard icon={Flag} value={stats.openReports} label="Open reports" highlight />
      </div>

      {/* Tool links — only the ones this admin actually holds permission
          for. A Support Agent (user.view + user.reset_password only, per
          brief 5.1) sees just User management here, not five tools they'd
          be redirected away from. */}
      <div className="mt-8">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">
          Tools
        </h2>
        {visibleTools.length === 0 ? (
          <p className="mt-3 text-sm text-ink-300">
            Your account doesn&apos;t hold any admin tool permissions yet.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {visibleTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="flex items-start gap-3 rounded-lg border border-ink-100 bg-white p-4 shadow-sm transition hover:border-green-500"
                >
                  <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink-900">{tool.label}</p>
                      {typeof tool.statValue === "number" && tool.statValue > 0 && (
                        <span className="flex-shrink-0 rounded-full bg-[#FFFBEB] px-2 py-0.5 text-xs font-medium text-[#B45309]">
                          {tool.statValue} {tool.statLabel}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">{tool.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent activity — only rendered for admins holding
          admin.view_audit_log, same gating pattern used on the user and
          business page detail views, since this is platform-wide audit
          data rather than something scoped to one entity. */}
      {hasAuditAccess && (
        <div className="mt-8 rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-ink-300" />
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-300">
                Recent activity
              </h2>
            </div>
            <Link href="/admin/audit-log" className="text-xs font-medium text-green-600 hover:underline">
              View full log →
            </Link>
          </div>

          {recentActivity.length === 0 ? (
            <p className="mt-3 text-sm text-ink-300">No admin actions on record yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {recentActivity.map((entry) => (
                <div key={entry.id} className="border-l-2 border-ink-100 pl-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-ink-900">
                      <span className="font-medium">{entry.adminName}</span>
                      {" — "}
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </p>
                    <span className="flex-shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700">
                      {ENTITY_TYPE_LABELS[entry.entityType] ?? entry.entityType}
                    </span>
                  </div>
                  {entry.reason && <p className="mt-0.5 text-sm text-ink-500">{entry.reason}</p>}
                  <p className="mt-0.5 text-xs text-ink-300">
                    {new Date(entry.createdAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {" at "}
                    {new Date(entry.createdAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  highlight = false,
}: {
  icon: ComponentType<{ className?: string }>;
  value: number;
  label: string;
  highlight?: boolean;
}) {
  const isAttention = highlight && value > 0;
  return (
    <div className="rounded-lg border border-ink-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${isAttention ? "text-[#B45309]" : "text-ink-300"}`} />
        <p className={`font-display text-2xl font-bold ${isAttention ? "text-[#B45309]" : "text-ink-900"}`}>
          {value}
        </p>
      </div>
      <p className="mt-1 text-xs text-ink-500">{label}</p>
    </div>
  );
}
