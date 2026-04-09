import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Turbo/dev ortamında task env filtrelenirse LISTING_DATABASE_URL düşebiliyor.
// Prisma şeması LISTING_DATABASE_URL beklediği için sıralı fallback ver.
if (!process.env.LISTING_DATABASE_URL) {
  process.env.LISTING_DATABASE_URL =
    process.env.DATABASE_URL || "postgresql://agromarket:agromarket@localhost:5432/agromarket_listing";
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
