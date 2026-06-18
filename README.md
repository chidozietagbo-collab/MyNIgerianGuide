# MyNigerianGuide

Nigeria's business directory and social platform — Yell.com + Facebook Pages
+ LinkedIn Pages, built for Nigeria.

## Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS — design tokens locked in `tailwind.config.ts`
- **Database:** PostgreSQL via Supabase
- **ORM:** Prisma `6.19.3` (pinned — see note below)
- **Auth:** Supabase Auth via `@supabase/ssr`
- **State:** Zustand
- **Icons:** Lucide React

## A note on the Prisma version

`npm install prisma` currently resolves to **Prisma 7**, which shipped only
weeks before this project started and introduces a different architecture:
connection config moves out of `schema.prisma` into a separate
`prisma.config.ts`, and a database driver adapter becomes required. It's a
good direction long-term, but it's new enough that tooling, docs, and
community answers are still catching up — not the right foundation for a
non-technical founder to debug solo.

This project pins **Prisma 6.19.3** instead — the last release on the
familiar, simpler architecture (`DATABASE_URL` directly in
`schema.prisma`, `npx prisma db push` works as documented). Revisit the
v7 upgrade once the platform is stable and there's engineering bandwidth
to handle it deliberately.

## Project structure

```
src/
  app/              Routes (App Router) — pages, layouts
  components/        Shared UI components (Logo, Navbar, ...)
  lib/
    supabase/         Supabase client helpers (browser + server)
  middleware.ts        Session refresh — runs on every request
prisma/
  schema.prisma         Full database schema (17 models)
```

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev
```

## Milestone status

See the Product & Technical Brief for the full roadmap. Currently in
**Milestone 1 — Foundation**.
