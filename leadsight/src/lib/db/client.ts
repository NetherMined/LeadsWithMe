import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Reuse one pool across dev hot reloads instead of opening a new one per module reload.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

const pgClient = globalForDb.pgClient ?? postgres(connectionString, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = pgClient;

export const db = drizzle(pgClient, { schema });
export type Db = typeof db;
