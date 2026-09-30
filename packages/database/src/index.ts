import { PrismaClient } from "@prisma/client";

// A single shared PrismaClient instance per process. NestJS wraps this in a
// module (apps/api/src/prisma) that hooks into the app lifecycle for clean
// connect/disconnect; scripts (seed, tests) can import `prisma` directly.
declare global {
  // eslint-disable-next-line no-var
  var __clientosPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__clientosPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__clientosPrisma = prisma;
}

export * from "@prisma/client";
