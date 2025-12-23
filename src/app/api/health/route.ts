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

  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: {
      type: dbType,
      status: dbStatus,
      schemaSynced: isSchemaSynced(),
    },
  });
}
