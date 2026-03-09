import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

declare global {
  var prisma: PrismaClient | undefined;
}

function asFilePath(databaseUrl: string) {
  return databaseUrl.replace(/^file:/, "");
}

function resolveSqlitePath() {
  const configuredUrl = process.env.DATABASE_URL?.trim() || "file:./dev.db";
  const configuredPath = asFilePath(configuredUrl);

  if (!process.env.VERCEL) {
    return configuredPath;
  }

  const writablePath = path.join("/tmp", "sevencars-crm.db");
  if (existsSync(writablePath)) {
    return writablePath;
  }

  const sourcePath = path.isAbsolute(configuredPath) ? configuredPath : path.join(process.cwd(), configuredPath);
  mkdirSync(path.dirname(writablePath), { recursive: true });
  if (existsSync(sourcePath)) {
    copyFileSync(sourcePath, writablePath);
  }

  return writablePath;
}

const adapter = new PrismaBetterSqlite3({ url: resolveSqlitePath() });
export const prisma = global.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
