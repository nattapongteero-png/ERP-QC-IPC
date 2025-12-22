import { NextResponse } from 'next/server';
import { isSchemaSynced, isSqlite, getDb } from '@/lib/db';

export async function GET() {
  let dbStatus = 'unknown';
  let dbType = isSqlite() ? 'sqlite' : 'mysql';

  try {
    // Try to get database connection
    await getDb();
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
