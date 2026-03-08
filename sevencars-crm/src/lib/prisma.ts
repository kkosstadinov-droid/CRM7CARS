import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

declare global {
  var prisma: PrismaClient | undefined;
}

const sqliteUrl = (process.env.DATABASE_URL || "file:./dev.db").replace(/^file:/, "");
const adapter = new PrismaBetterSqlite3({ url: sqliteUrl });
export const prisma = global.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
