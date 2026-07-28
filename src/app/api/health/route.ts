import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { isSqlite, executeDbOperation } from '@/lib/db/db-helper';

/**
 * Count ORM tables that are missing from the live database.
 *
 * Deliberately NOT using the in-memory `isSchemaSynced()` flag: that is a
 * module-level boolean set by instrumentation at boot, and Next.js loads the
 * instrumentation hook and route handlers in separate module instances, so the
 * route never observes the flag instrumentation set. It read false on a
 * perfectly healthy server (UAT had all 241 tables and a clean sync) and made
 * the app report itself "degraded" — a false alarm, which is exactly as bad as
 * the false "healthy" this endpoint was meant to fix.
 *
 * Asking the database is stateless, survives module boundaries, and reflects
 * reality at the moment of the request.
 */
async function countMissingTables(): Promise<number | null> {
  try {
    const schema = await import('@/lib/db/schema');
    const { getTableName } = await import('drizzle-orm');
    const { MySqlTable } = await import('drizzle-orm/mysql-core');
    const { SQLiteTable } = await import('drizzle-orm/sqlite-core');

    const usingSqlite = isSqlite();
    const expected = new Set<string>();
    for (const value of Object.values(schema as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null) continue;
      const isMatch = usingSqlite
        ? value instanceof SQLiteTable
        : value instanceof MySqlTable;
      if (isMatch) expected.add(getTableName(value as never));
    }
    if (expected.size === 0) return null;

    const existing = new Set<string>();
    await executeDbOperation(async (db) => {
      const rows = usingSqlite
        ? await (db as never as { all: (q: unknown) => Promise<{ name: string }[]> }).all(
            sql`SELECT name FROM sqlite_master WHERE type='table'`,
          )
        : ((await (db as never as { execute: (q: unknown) => Promise<unknown> }).execute(
            sql`SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()`,
          )) as [{ name: string }[]])[0];
      for (const r of rows as { name: string }[]) existing.add(r.name);
      return true;
    });

    let missing = 0;
    for (const t of expected) if (!existing.has(t)) missing++;
    return missing;
  } catch {
    // Can't determine — report unknown rather than claiming either state.
    return null;
  }
}

export async function GET() {
  let dbStatus = 'unknown';
  const dbType = isSqlite() ? 'sqlite' : 'mysql';

  try {
    // Try to get database connection
    await executeDbOperation(async () => {
      // Simple operation to test connection
      return true;
    });
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  // A server whose schema is incomplete is serving 500s on some pages and
  // should not report itself as plainly "healthy". But it must only say
  // "degraded" when tables are genuinely absent — never on a bookkeeping flag.
  const missingTables = dbStatus === 'connected' ? await countMissingTables() : null;
  const schemaSynced = missingTables === 0;
  const healthy = dbStatus === 'connected' && missingTables !== null && missingTables === 0;

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: {
        type: dbType,
        status: dbStatus,
        schemaSynced,
        // Names the actual problem when there is one, instead of a bare false.
        missingTables: missingTables ?? 'unknown',
      },
      // Build marker — lets a deploy be PROVEN live by curling /api/health,
      // rather than inferred from "container is healthy" (which stays true
      // when a stale image is running).
      buildMarker: 'HERBAL-BUILD-59a9528eb-cogs-recall-part11-wht',
    },
    // Keep 200 so container health checks and load balancers don't cycle the
    // app: the process is up and mostly serving. The body carries the truth.
    { status: 200 },
  );
}
