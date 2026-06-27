import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MyNigerianGuide — Find trusted Nigerian businesses",
    template: "%s | MyNigerianGuide",
  },
  description:
    "Nigeria's business directory and social platform. Discover, connect with, and follow trusted local businesses across Nigeria.",
  metadataBase: new URL("https://mynigerianguide.com"),
};

export const viewport: Viewport = {
  themeColor: "#0E7A4F",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Two lightweight checks, only run when someone is signed in, deciding
  // whether the navbar offers an "Admin" and/or business page link.
  //
  // isAdmin uses AdminUser.isActive, the same real authority every admin
  // page.tsx already checks — NOT the separate User.role enum, which
  // exists in the schema but is never read anywhere in the app and isn't
  // kept in sync with the actual AdminUser/RBAC system.
  //
  // There's no separate "business dashboard" route in this app — per
  // src/app/b/[slug]/page.tsx, the public business page itself IS the
  // owner's control centre (isOwner gates inline edit controls there).
  // So this fetches the owner's actual page(s) — name + slug — rather
  // than just a boolean, since the navbar needs a real link to point at,
  // and an owner can have more than one page.
  let isAdmin = false;
  let ownedBusinessPages: { name: string; slug: string }[] = [];

  if (user) {
    const [adminUser, businessPages] = await Promise.all([
      prisma.adminUser.findUnique({
        where: { userId: user.id },
        select: { isActive: true },
      }),
      prisma.businessPage.findMany({
        where: { ownerUserId: user.id },
        select: { name: true, slug: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    isAdmin = !!adminUser?.isActive;
    ownedBusinessPages = businessPages;
  }

  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} font-body antialiased bg-ink-50 text-ink-700`}>
        <Navbar
          user={user ? { email: user.email ?? "" } : null}
          isAdmin={isAdmin}
          ownedBusinessPages={ownedBusinessPages}
        />
        {children}
      </body>
    </html>
  );
}
