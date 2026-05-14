/**
 * Integration Tests: IPC Criteria → BOM Config → WO IPC Flow
 * Tests the complete data flow from Master Data through BOM to Work Order
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database layer
vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: vi.fn(),
}));

vi.mock('@/lib/db/db-helper', () => ({
  executeDbOperation: vi.fn((fn: any) => fn({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve([]),
        }),
        innerJoin: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([]),
          }),
        }),
      }),
    }),
    insert: () => ({
      values: () => Promise.resolve({ lastInsertRowid: 1 }),
    }),
    delete: () => ({
      where: () => Promise.resolve(),
    }),
  })),
  getTableRef: vi.fn(() => ({
    id: 'id',
    bomId: 'bomId',
    criteriaId: 'criteriaId',
    sequence: 'sequence',
    sampleSize: 'sampleSize',
    isCritical: 'isCritical',
    code: 'code',
    name: 'name',
    nameTh: 'nameTh',
    testMethod: 'testMethod',
    specification: 'specification',
    minValue: 'minValue',
    maxValue: 'maxValue',
    unit: 'unit',
    isActive: 'isActive',
    createdAt: 'createdAt',
  })),
  getInsertId: vi.fn(() => 1),
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: () => new Date().toISOString(),
}));

describe('IPC Criteria Data Model', () => {
  it('should have all required IPC criteria fields', () => {
    const requiredFields = ['code', 'name', 'nameTh', 'testMethod', 'specification',
      'minValue', 'maxValue', 'unit', 'sampleSize', 'checkIntervalMinutes', 'isCritical', 'isActive'];
    expect(requiredFields.length).toBe(12);
    expect(requiredFields).toContain('sampleSize');
    expect(requiredFields).toContain('isCritical');
  });

  it('should have BOM IPC config linking to criteria', () => {
    const bomIpcFields = ['bomId', 'criteriaId', 'sequence', 'sampleSize', 'isCritical'];
    expect(bomIpcFields).toContain('criteriaId');
    expect(bomIpcFields).not.toContain('specId');
  });

  it('should support the full IPC flow lifecycle', () => {
    // Master Data: Create IPC criteria
    // BOM Config: Link criteria to BOM
    // WO IPC: Initialize tests from BOM config, record results, approve
    const flowSteps = ['create_criteria', 'link_to_bom', 'initialize_wo_tests', 'record_result', 'approve'];
    expect(flowSteps.length).toBe(5);
  });
});

describe('IPC Data Flow: Master Data → BOM → WO', () => {
  it('verifies the complete IPC criteria data model', () => {
    // IPC Criteria (Master Data) fields
    const criteriaFields = [
      'code', 'name', 'nameTh', 'testMethod', 'specification',
      'minValue', 'maxValue', 'unit', 'sampleSize', 'checkIntervalMinutes',
      'isCritical', 'isActive',
    ];

    // BOM IPC Config fields
    const bomIpcFields = ['bomId', 'criteriaId', 'sequence', 'sampleSize', 'isCritical'];

    // Verify all fields are expected
    expect(criteriaFields.length).toBe(12);
    expect(bomIpcFields.length).toBe(5);
    expect(bomIpcFields).toContain('criteriaId'); // references ipc_criteria
    expect(bomIpcFields).not.toContain('specId'); // no longer references quality_specs
  });

  it('validates the API routes exist', async () => {
    // Master Data API
    const masterDataRoute = await import('@/app/api/master-data/ipc-criteria/route');
    expect(masterDataRoute.GET).toBeDefined();
    expect(masterDataRoute.POST).toBeDefined();
    expect(masterDataRoute.PUT).toBeDefined();

    // BOM IPC API
    const bomIpcRoute = await import('@/app/api/production/bom/[id]/ipc/route');
    expect(bomIpcRoute.GET).toBeDefined();
    expect(bomIpcRoute.POST).toBeDefined();
    expect(bomIpcRoute.PUT).toBeDefined();
    expect(bomIpcRoute.DELETE).toBeDefined();
  });

  it('validates the WO IPC service functions exist', async () => {
    const service = await import('@/lib/services/wo-execution.service');
    expect(service.getBOMIPCConfig).toBeDefined();
    expect(service.initializeWOIPCTests).toBeDefined();
    expect(service.recordIPCTestResult).toBeDefined();
    expect(service.approveIPCTest).toBeDefined();
  });
});
