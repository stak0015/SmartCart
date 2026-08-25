import "server-only";

import { Pool } from "pg";
import { AppError } from "./errors";

const globalForDatabase = globalThis as typeof globalThis & {
  smartCartPool?: Pool;
};

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new AppError(
      "DATABASE_NOT_CONFIGURED",
      "The SmartCart database connection has not been configured.",
      503,
    );
  }

  if (!globalForDatabase.smartCartPool) {
    globalForDatabase.smartCartPool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    });
  }

  return globalForDatabase.smartCartPool;
}
