/**
 * Runtime-agnostic in-memory SQLite for tests.
 *
 * The suite is run with `bunx vitest` (these machines have no Node install),
 * but `better-sqlite3` is a native Node addon that Bun cannot load
 * (oven-sh/bun#4290) — every test that opened one died in `beforeAll`, so no
 * DB-backed test could actually run. Bun ships its own `bun:sqlite` with a
 * near-identical API and Drizzle has an adapter for it, so pick the driver that
 * matches the runtime and keep one calling convention for tests.
 *
 * Usage:
 *   const { sqlite, db, close } = await createTestSqlite();
 *   sqlite.exec(generateCreateTableSql(schema.sqliteItems));
 */

/** The subset of the better-sqlite3 / bun:sqlite surface tests rely on. */
export interface TestSqliteClient {
  exec(sql: string): unknown;
  prepare(sql: string): {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): unknown;
  };
  close(): void;
}

export interface TestSqlite {
  /** Raw client — use for seeding and for asserting on stored rows. */
  sqlite: TestSqliteClient;
  /** Drizzle instance to hand to services under test. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  close(): void;
}

const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined';

export async function createTestSqlite(filename = ':memory:'): Promise<TestSqlite> {
  if (isBun) {
    // Computed specifier so vite leaves the `bun:` builtin alone.
    const bunSqlite = 'bun:sqlite';
    const { Database } = (await import(/* @vite-ignore */ bunSqlite)) as {
      new (path: string): TestSqliteClient;
      Database: new (path: string) => TestSqliteClient;
    };
    const { drizzle } = await import('drizzle-orm/bun-sqlite');
    const sqlite = new Database(filename);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { sqlite, db: drizzle(sqlite as any), close: () => sqlite.close() };
  }

  const { default: Database } = await import('better-sqlite3');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const sqlite = new Database(filename);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { sqlite: sqlite as unknown as TestSqliteClient, db: drizzle(sqlite as any), close: () => sqlite.close() };
}
