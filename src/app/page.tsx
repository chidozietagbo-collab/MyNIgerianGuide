import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <main className="min-h-screen bg-ink-50">
      <Navbar />

      <section className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center">
        <span className="mb-4 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-green-600">
          Foundation in progress
        </span>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
          Nigeria&apos;s directory, built from the ground up.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-500">
          MyNigerianGuide is under active construction. This is Milestone 1 —
          the foundation: project scaffold, authentication, and core
          architecture. The directory, search, and social features come next.
        </p>
      </section>
    </main>
  );
}
