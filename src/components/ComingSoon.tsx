import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type ComingSoonProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  milestone: string;
};

export default function ComingSoon({ icon: Icon, title, description, milestone }: ComingSoonProps) {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-ink-50 px-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
        <Icon className="h-7 w-7 text-green-600" />
      </div>
      <h1 className="mt-6 font-display text-2xl font-bold text-ink-900">{title}</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-500">{description}</p>
      <span className="mt-4 rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-ink-500">
        Coming in {milestone}
      </span>
      <Link href="/" className="mt-8 text-sm font-medium text-green-600 hover:underline">
        Back to homepage
      </Link>
    </main>
  );
}
