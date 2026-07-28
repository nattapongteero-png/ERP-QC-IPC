import { NextResponse } from 'next/server';
import { isSchemaSynced } from '@/lib/db';
import { isSqlite, executeDbOperation } from '@/lib/db/db-helper';

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

  // schemaSynced is now only true when every ORM table really exists (see
  // schema-sync.ts). Reflect that in the top-level status: a server whose
  // schema is incomplete is serving 500s on some pages and should not report
  // itself as plainly "healthy" — that is how 37 missing tables went unnoticed
  // in UAT while every health check passed.
  const schemaSynced = isSchemaSynced();
  const healthy = dbStatus === 'connected' && schemaSynced;

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
      },
    },
    // Keep 200 so container health checks and load balancers don't cycle the
    // app: the process is up and mostly serving. The body carries the truth.
    { status: 200 },
  );
}
