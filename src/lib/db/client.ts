import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;
/** A database handle or an open transaction — repositories accept either. */
export type DbExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

const globalForDb = globalThis as unknown as { __zekeSql?: postgres.Sql; __zekeDb?: Database };

export function createDatabase(url: string): { db: Database; sql: postgres.Sql } {
  const sql = postgres(url, { max: 10, prepare: false, onnotice: () => {} });
  return { db: drizzle(sql, { schema, casing: "snake_case" }), sql };
}

function getDatabase(): Database {
  if (!globalForDb.__zekeDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const { db, sql } = createDatabase(url);
    globalForDb.__zekeDb = db;
    globalForDb.__zekeSql = sql;
  }
  return globalForDb.__zekeDb;
}

/** Lazily-initialised shared database (reused across hot reloads in development). */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDatabase(), prop, receiver);
  },
});

export async function closeDatabase(): Promise<void> {
  await globalForDb.__zekeSql?.end();
  globalForDb.__zekeSql = undefined;
  globalForDb.__zekeDb = undefined;
}
