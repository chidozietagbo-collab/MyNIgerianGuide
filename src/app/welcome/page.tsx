import Link from "next/link";
import { Search, Store } from "lucide-react";

// Shown exactly once, right after a new user verifies their email — the
// signup confirmation link is the only place that points here (via
// /auth/callback?next=/welcome). Regular logins never pass through this
// screen. See Brief section 17: "Intent routing after verification."
export default function WelcomePage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-ink-50 px-4 py-16">
      <div className="w-full max-w-2xl text-center">
        <h1 className="font-display text-3xl font-extrabold text-ink-900 sm:text-4xl">
          You&apos;re verified! What would you like to do first?
        </h1>
        <p className="mt-3 text-base text-ink-500">
          You can always do both later — this just helps us point you the
          right way.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            href="/search"
            className="group rounded-lg border border-ink-100 bg-white p-8 text-left shadow-sm transition hover:border-green-500 hover:shadow-md"
          >
            <Search className="h-8 w-8 text-green-600" />
            <h2 className="mt-4 font-display text-lg font-semibold text-ink-900">
              Find businesses
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Search trusted businesses and services near you.
            </p>
          </Link>

          <Link
            href="/business/new"
            className="group rounded-lg border border-ink-100 bg-white p-8 text-left shadow-sm transition hover:border-green-500 hover:shadow-md"
          >
            <Store className="h-8 w-8 text-green-600" />
            <h2 className="mt-4 font-display text-lg font-semibold text-ink-900">
              List my business
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Create a page and start reaching customers.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
