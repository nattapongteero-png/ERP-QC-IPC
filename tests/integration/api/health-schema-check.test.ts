/**
 * /api/health must report schema completeness from the DATABASE, not from an
 * in-memory flag.
 *
 * The flag version (`isSchemaSynced()`) is a module-level boolean set by the
 * instrumentation hook at boot. Next.js loads instrumentation and route
 * handlers as separate module instances, so the route never saw it — UAT had
 * all 241 tables and a clean sync yet reported `schemaSynced: false` and
 * status "degraded". A false alarm is as harmful as the false "healthy" this
 * endpoint exists to prevent.
 */
import { describe, it, expect, beforeAll } from 'vitest';

process.env.DB_TYPE = 'sqlite';

describe('/api/health schema completeness', () => {
  beforeAll(async () => {
    const { syncDatabaseSchema } = await import('../../../src/lib/db/schema-sync');
    await syncDatabaseSchema();
  });

  it('reports healthy with 0 missing tables after a full sync', async () => {
    const { GET } = await import('../../../src/app/api/health/route');
    const res = await GET();
    const body = await res.json();

    expect(body.database.status).toBe('connected');
    expect(body.database.missingTables).toBe(0);
    expect(body.database.schemaSynced).toBe(true);
    expect(body.status).toBe('healthy');
  });

  it('still exposes the build marker so a deploy can be proven live', async () => {
    const { GET } = await import('../../../src/app/api/health/route');
    const body = await (await GET()).json();
    expect(typeof body.buildMarker).toBe('string');
    expect(body.buildMarker.length).toBeGreaterThan(0);
  });
});
