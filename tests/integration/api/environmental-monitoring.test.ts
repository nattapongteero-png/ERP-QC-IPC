/**
 * F023 — API integration tests
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSession = vi.fn();
vi.mock('@/lib/auth', () => ({
  getSession: () => mockSession(),
  isAdminRole: (role: string) => role === 'admin',
}));

const mockGetPerms = vi.fn();
vi.mock('@/lib/auth/permission-resolver', () => ({
  getRolePermissionSet: (role: string) => mockGetPerms(role),
}));

const mockListSchedules = vi.fn();
const mockRecordInspection = vi.fn();
const mockScanDue = vi.fn();
vi.mock('@/lib/services/environmental-inspection.service', () => ({
  listSchedules: () => mockListSchedules(),
  recordInspection: (input: unknown, uid: number) => mockRecordInspection(input, uid),
  scanDueInspections: () => mockScanDue(),
  createSchedule: vi.fn(),
  listTemplates: vi.fn(),
  createTemplate: vi.fn(),
}));

const mockRecordWaterTest = vi.fn();
const mockListWaterSystems = vi.fn();
const mockCreateWaterSystem = vi.fn();
vi.mock('@/lib/services/water-quality.service', () => ({
  recordWaterTest: (input: unknown, uid: number) => mockRecordWaterTest(input, uid),
  listWaterSystems: () => mockListWaterSystems(),
  createWaterSystem: (input: unknown) => mockCreateWaterSystem(input),
  listSamplePoints: vi.fn(),
  createSamplePoint: vi.fn(),
  listSpecs: vi.fn(),
  createSpec: vi.fn(),
}));

import { GET as GET_INSPECTIONS, POST as POST_INSPECTION } from '@/app/api/environmental/inspections/route';
import { POST as POST_SCAN } from '@/app/api/environmental/inspections/scan/route';
import { POST as POST_WATER_TEST } from '@/app/api/environmental/water-tests/route';
import {
  EnvMonitorError,
  ENV_MONITOR_ERROR_CODES,
} from '@/types/environmental-monitoring';

function req(path: string, body: unknown, method = 'POST'): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    body: JSON.stringify(body),
  });
}

describe('F023 API — inspections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ userId: 5, role: 'qc' });
    mockGetPerms.mockResolvedValue(new Set(['environmental:inspect']));
  });

  describe('GET /inspections', () => {
    it('401 unauthenticated', async () => {
      mockSession.mockResolvedValue(null);
      const res = await GET_INSPECTIONS();
      expect(res.status).toBe(401);
    });

    it('returns schedules', async () => {
      mockListSchedules.mockResolvedValue([{ id: 1, targetName: 'Room A' }]);
      const res = await GET_INSPECTIONS();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
    });
  });

  describe('POST /inspections', () => {
    it('401 unauthenticated', async () => {
      mockSession.mockResolvedValue(null);
      const res = await POST_INSPECTION(
        req('/api/environmental/inspections', {}),
      );
      expect(res.status).toBe(401);
    });

    it('403 no permission', async () => {
      mockGetPerms.mockResolvedValue(new Set());
      const res = await POST_INSPECTION(
        req('/api/environmental/inspections', {
          templateId: 1,
          targetType: 'room',
          targetId: 1,
          results: [{ templateItemId: 1, parameter: 'temperature', numericValue: 22 }],
          signature: { password: 'pw' },
        }),
      );
      expect(res.status).toBe(403);
    });

    it('400 invalid body', async () => {
      const res = await POST_INSPECTION(
        req('/api/environmental/inspections', {}),
      );
      expect(res.status).toBe(400);
    });

    it('404 template not found', async () => {
      mockRecordInspection.mockRejectedValue(
        new EnvMonitorError(ENV_MONITOR_ERROR_CODES.TEMPLATE_NOT_FOUND, 'gone'),
      );
      const res = await POST_INSPECTION(
        req('/api/environmental/inspections', {
          templateId: 1,
          targetType: 'room',
          targetId: 1,
          results: [{ templateItemId: 1, parameter: 'temperature', numericValue: 22 }],
          signature: { password: 'pw' },
        }),
      );
      expect(res.status).toBe(404);
    });

    it('409 template incomplete', async () => {
      mockRecordInspection.mockRejectedValue(
        new EnvMonitorError(ENV_MONITOR_ERROR_CODES.TEMPLATE_INCOMPLETE, 'missing'),
      );
      const res = await POST_INSPECTION(
        req('/api/environmental/inspections', {
          templateId: 1,
          targetType: 'room',
          targetId: 1,
          results: [{ templateItemId: 1, parameter: 'temperature', numericValue: 22 }],
          signature: { password: 'pw' },
        }),
      );
      expect(res.status).toBe(409);
    });

    it('201 on success', async () => {
      mockRecordInspection.mockResolvedValue({
        inspectionId: 1,
        overallResult: 'in_spec',
        outOfSpecCount: 0,
        deviationId: null,
      });
      const res = await POST_INSPECTION(
        req('/api/environmental/inspections', {
          templateId: 1,
          targetType: 'room',
          targetId: 1,
          results: [{ templateItemId: 1, parameter: 'temperature', numericValue: 22 }],
          signature: { password: 'pw' },
        }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.overallResult).toBe('in_spec');
    });

    it('201 with deviationId on out-of-spec', async () => {
      mockRecordInspection.mockResolvedValue({
        inspectionId: 1,
        overallResult: 'out_of_spec',
        outOfSpecCount: 1,
        deviationId: 99,
      });
      const res = await POST_INSPECTION(
        req('/api/environmental/inspections', {
          templateId: 1,
          targetType: 'room',
          targetId: 1,
          results: [{ templateItemId: 1, parameter: 'temperature', numericValue: 35 }],
          signature: { password: 'pw' },
        }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.overallResult).toBe('out_of_spec');
      expect(body.deviationId).toBe(99);
    });
  });

  describe('POST /scan', () => {
    it('returns scan counts', async () => {
      mockScanDue.mockResolvedValue({ scanned: 10, created: 3, skipped: 7 });
      const res = await POST_SCAN();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.created).toBe(3);
    });
  });
});

describe('F023 API — water tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ userId: 5, role: 'qc' });
    mockGetPerms.mockResolvedValue(new Set(['environmental:inspect']));
  });

  it('201 on water test success', async () => {
    mockRecordWaterTest.mockResolvedValue({
      testId: 1,
      overallResult: 'in_spec',
      outOfSpecCount: 0,
      deviationId: null,
    });
    const res = await POST_WATER_TEST(
      req('/api/environmental/water-tests', {
        samplePointId: 1,
        waterSystemId: 1,
        results: [{ parameter: 'ph', numericValue: 6.5, unit: '' }],
        signature: { password: 'pw' },
      }),
    );
    expect(res.status).toBe(201);
  });

  it('201 + deviation on out-of-spec water', async () => {
    mockRecordWaterTest.mockResolvedValue({
      testId: 1,
      overallResult: 'out_of_spec',
      outOfSpecCount: 1,
      deviationId: 42,
    });
    const res = await POST_WATER_TEST(
      req('/api/environmental/water-tests', {
        samplePointId: 1,
        waterSystemId: 1,
        results: [{ parameter: 'conductivity', numericValue: 5.0, unit: 'uS/cm' }],
        signature: { password: 'pw' },
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.deviationId).toBe(42);
  });

  it('400 invalid body', async () => {
    const res = await POST_WATER_TEST(
      req('/api/environmental/water-tests', {}),
    );
    expect(res.status).toBe(400);
  });

  it('403 no permission', async () => {
    mockGetPerms.mockResolvedValue(new Set());
    const res = await POST_WATER_TEST(
      req('/api/environmental/water-tests', {
        samplePointId: 1,
        waterSystemId: 1,
        results: [{ parameter: 'ph', numericValue: 6.5, unit: '' }],
        signature: { password: 'pw' },
      }),
    );
    expect(res.status).toBe(403);
  });
});
