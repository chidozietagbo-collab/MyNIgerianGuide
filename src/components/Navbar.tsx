"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, X, ShieldCheck, Building2 } from "lucide-react";
import Logo from "./Logo";
import NotificationBell from "./NotificationBell";
import { createClient } from "@/lib/supabase/client";

const navLinks = [
  { href: "/search", label: "Find a business" },
  { href: "/feed", label: "Feed" },
  { href: "/business/new", label: "List your business" },
];

type NavbarProps = {
  user: { email: string; name: string | null; avatarUrl: string | null } | null;
  isAdmin?: boolean;
  ownedBusinessPages?: { name: string; slug: string }[];
};

export default function Navbar({ user, isAdmin = false, ownedBusinessPages = [] }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-ink-100 bg-white">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" aria-label="MyNigerianGuide home">
          <Logo />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-700 transition hover:text-green-600"
            >
              {link.label}
            </Link>
          ))}

          {/* Single link to the dashboard regardless of how many pages
              are owned — the dashboard itself has a page switcher for
              owners with more than one, so the navbar doesn't need its
              own dropdown anymore. */}
          {user && ownedBusinessPages.length > 0 && (
            <Link
              href="/business/dashboard"
              className="flex items-center gap-1.5 text-sm font-medium text-ink-700 transition hover:text-green-600"
            >
              <Building2 className="h-4 w-4" />
              {ownedBusinessPages.length === 1 ? "My business" : "My businesses"}
            </Link>
          )}

          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-sm font-medium text-ink-700 transition hover:text-green-600"
            >
              <ShieldCheck className="h-4 w-4" />
              Admin
            </Link>
          )}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <NotificationBell />
              <Link
                href="/account"
                className="flex items-center gap-2 text-sm font-medium text-ink-700 transition hover:text-green-600"
              >
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">
                    {(user.name ?? user.email).charAt(0).toUpperCase()}
                  </span>
                )}
                <span>{user.name ?? user.email}</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md border border-ink-100 px-4 py-2 text-sm font-semibold text-ink-700 transition hover:border-ink-300"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-ink-700 transition hover:text-green-600"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 md:hidden">
          {user && <NotificationBell />}
          <button
            type="button"
            className="text-ink-700"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-ink-100 bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-ink-700"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            {user && ownedBusinessPages.length > 0 && (
              <>
                <hr className="border-ink-100" />
                <Link
                  href="/business/dashboard"
                  className="flex items-center gap-1.5 text-sm font-medium text-ink-700"
                  onClick={() => setOpen(false)}
                >
                  <Building2 className="h-4 w-4" />
                  {ownedBusinessPages.length === 1 ? "My business" : "My businesses"}
                </Link>
              </>
            )}

            {isAdmin && (
              <>
                <hr className="border-ink-100" />
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 text-sm font-medium text-ink-700"
                  onClick={() => setOpen(false)}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Admin
                </Link>
              </>
            )}

            <hr className="border-ink-100" />
            {user ? (
              <>
                <Link
                  href="/account"
                  className="flex items-center gap-2 text-sm font-medium text-ink-700"
                  onClick={() => setOpen(false)}
                >
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">
                      {(user.name ?? user.email).charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span>{user.name ?? user.email}</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-md border border-ink-100 px-4 py-2 text-center text-sm font-semibold text-ink-700"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-ink-700" onClick={() => setOpen(false)}>
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-green-600 px-4 py-2 text-center text-sm font-semibold text-white"
                  onClick={() => setOpen(false)}
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
