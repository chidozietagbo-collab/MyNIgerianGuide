import type { ReactNode } from "react";
import Link from "next/link";
import Logo from "./Logo";

type AuthCardProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

export default function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-ink-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <div className="rounded-lg border border-ink-100 bg-white p-8 shadow-sm">
          <h1 className="font-display text-2xl font-bold text-ink-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
