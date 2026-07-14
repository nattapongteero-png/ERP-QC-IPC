/**
 * Dashboard Service Integration Test
 * Verifies the service works with real database operations
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initializeDatabase } from '@/lib/db';
import {
  getHRKpis,
  getPurchaseKpis,
  getSalesKpis,
  getVMIKpis,
  getGMPKpis,
  getDashboardModuleKpis,
} from '@/lib/services/dashboard.service';

describe('Dashboard Service Integration', () => {
  beforeAll(async () => {
    // Initialize database (will use SQLite for tests based on DB_TYPE env var)
    await initializeDatabase();
  });

  it('should get HR KPIs without errors', async () => {
    const kpis = await getHRKpis();

    expect(kpis).toBeDefined();
    expect(typeof kpis.totalEmployees).toBe('number');
    expect(typeof kpis.activeEmployees).toBe('number');
    expect(typeof kpis.trainingCompliance).toBe('number');
    expect(typeof kpis.healthRecordsDue).toBe('number');
    expect(typeof kpis.gmpAuthorized).toBe('number');
    expect(typeof kpis.pendingNotifications).toBe('number');
  });

  it('should get Purchase KPIs without errors', async () => {
    const kpis = await getPurchaseKpis();

    expect(kpis).toBeDefined();
    expect(typeof kpis.pendingPOs).toBe('number');
    expect(typeof kpis.approvedPOs).toBe('number');
    expect(typeof kpis.poValueMtd).toBe('number');
    expect(typeof kpis.activeVendors).toBe('number');
    // Not measurable from current data — must be null, never a stand-in number.
    expect(kpis.onTimeDeliveryRate).toBeNull();
    expect(typeof kpis.avlCoverage).toBe('number');
  });

  it('should get Sales KPIs without errors', async () => {
    const kpis = await getSalesKpis();

    expect(kpis).toBeDefined();
    expect(typeof kpis.pendingSOs).toBe('number');
    expect(typeof kpis.soValueMtd).toBe('number');
    expect(typeof kpis.ordersFulfilledMtd).toBe('number');
    expect(typeof kpis.atpShortages).toBe('number');
    expect(typeof kpis.fulfillmentRate).toBe('number');
  });

  it('should get VMI KPIs without errors', async () => {
    const kpis = await getVMIKpis();

    expect(kpis).toBeDefined();
    expect(typeof kpis.vmiItems).toBe('number');
    expect(typeof kpis.stockBelowReorder).toBe('number');
    expect(typeof kpis.pendingAsns).toBe('number');
    expect(typeof kpis.outstandingOrderValue).toBe('number');
    // lastSyncTime can be null
    if (kpis.lastSyncTime !== null) {
      expect(typeof kpis.lastSyncTime).toBe('string');
    }
  });

  it('should get GMP KPIs without errors', async () => {
    const kpis = await getGMPKpis();

    expect(kpis).toBeDefined();
    expect(typeof kpis.openIssues).toBe('number');
    expect(typeof kpis.openDeviations).toBe('number');
    expect(typeof kpis.openCapas).toBe('number');
    expect(typeof kpis.openAuditFindings).toBe('number');
    expect(typeof kpis.trainingGaps).toBe('number');

    // openIssues is a real sum of open work, not a synthesised score.
    expect(kpis.openIssues).toBe(
      kpis.openDeviations +
        kpis.openCapas +
        kpis.openAuditFindings +
        kpis.trainingGaps,
    );
  });

  it('should get all dashboard module KPIs', async () => {
    const kpis = await getDashboardModuleKpis();

    expect(kpis).toBeDefined();
    expect(kpis).toHaveProperty('hr');
    expect(kpis).toHaveProperty('purchase');
    expect(kpis).toHaveProperty('sales');
    expect(kpis).toHaveProperty('vmi');
    expect(kpis).toHaveProperty('gmp');
    expect(kpis).toHaveProperty('generatedAt');

    // Verify generatedAt is valid ISO timestamp
    const timestamp = new Date(kpis.generatedAt);
    expect(timestamp.getTime()).not.toBeNaN();

    // Should be recent (within last minute)
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    expect(diff).toBeLessThan(60000);
  });

  it('should handle parallel KPI fetching efficiently', async () => {
    const startTime = Date.now();
    const kpis = await getDashboardModuleKpis();
    const duration = Date.now() - startTime;

    // Should complete in reasonable time (parallel execution)
    expect(duration).toBeLessThan(10000); // 10 seconds max

    // All modules should have returned data
    expect(kpis.hr).toBeDefined();
    expect(kpis.purchase).toBeDefined();
    expect(kpis.sales).toBeDefined();
    expect(kpis.vmi).toBeDefined();
    expect(kpis.gmp).toBeDefined();
  });
});
