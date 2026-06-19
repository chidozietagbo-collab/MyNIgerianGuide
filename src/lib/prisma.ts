import { PrismaClient } from "@prisma/client";

// Standard Next.js singleton pattern: in dev, the module gets re-evaluated on
// every hot-reload, which would otherwise create a fresh PrismaClient (and a
// fresh connection pool) on every save. Stashing it on globalThis survives
// the reload. In production this branch never matters — each serverless
// invocation gets its own clean module scope.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
