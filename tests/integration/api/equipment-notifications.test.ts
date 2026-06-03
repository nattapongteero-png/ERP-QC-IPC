/**
 * Equipment Notifications API integration tests
 * Feature: 022-equipment-notifications
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSession = vi.fn();
vi.mock('@/lib/auth', () => ({
  getSession: () => mockSession(),
  isAdminRole: (role: string) => role === 'admin' || role === 'ADMIN',
}));

const mockGetPerms = vi.fn();
vi.mock('@/lib/auth/permission-resolver', () => ({
  getRolePermissionSet: (role: string) => mockGetPerms(role),
}));

const mockList = vi.fn();
const mockAck = vi.fn();
const mockSnooze = vi.fn();
const mockScan = vi.fn();
const mockCount = vi.fn();
vi.mock('@/lib/services/equipment-notification.service', () => ({
  listNotifications: (opts: unknown) => mockList(opts),
  acknowledgeNotification: (id: number, uid: number, note?: string | null) => mockAck(id, uid, note),
  snoozeNotification: (id: number, days: number, uid: number, note?: string | null) =>
    mockSnooze(id, days, uid, note),
  scanMaintenanceSchedules: () => mockScan(),
  getUnreadCount: () => mockCount(),
  getCalendarItems: vi.fn(),
}));

import { GET as LIST } from '@/app/api/notifications/route';
import { GET as COUNT } from '@/app/api/notifications/unread-count/route';
import { POST as ACK } from '@/app/api/notifications/[id]/acknowledge/route';
import { POST as SNOOZE } from '@/app/api/notifications/[id]/snooze/route';
import { POST as SCAN } from '@/app/api/notifications/scan/route';
import {
  EquipmentNotificationError,
  NOTIFICATION_ERROR_CODES,
} from '@/types/equipment-notifications';

function req(path: string, body?: unknown, method: string = 'POST'): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Equipment Notifications API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ userId: 7, role: 'production' });
    mockGetPerms.mockResolvedValue(new Set(['equipment:notifications:acknowledge']));
  });

  describe('GET /notifications', () => {
    it('returns 401 unauthenticated', async () => {
      mockSession.mockResolvedValue(null);
      const res = await LIST(req('/api/notifications', undefined, 'GET'));
      expect(res.status).toBe(401);
    });

    it('returns paged list', async () => {
      mockList.mockResolvedValue({
        items: [{ id: 1, title: 'Calibration due' }],
        total: 1,
        unreadCount: 1,
      });
      const res = await LIST(req('/api/notifications', undefined, 'GET'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(body.unreadCount).toBe(1);
    });

    it('passes severity filter to service', async () => {
      mockList.mockResolvedValue({ items: [], total: 0, unreadCount: 0 });
      await LIST(req('/api/notifications?severity=overdue', undefined, 'GET'));
      expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ severity: 'overdue' }));
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('returns count', async () => {
      mockCount.mockResolvedValue(5);
      const res = await COUNT();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.count).toBe(5);
    });

    it('returns 0 + 401 when no session', async () => {
      mockSession.mockResolvedValue(null);
      const res = await COUNT();
      expect(res.status).toBe(401);
    });
  });

  describe('POST /notifications/[id]/acknowledge', () => {
    it('returns 401 unauthenticated', async () => {
      mockSession.mockResolvedValue(null);
      const res = await ACK(req('/api/notifications/1/acknowledge', {}), {
        params: Promise.resolve({ id: '1' }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 403 no permission', async () => {
      mockGetPerms.mockResolvedValue(new Set());
      const res = await ACK(req('/api/notifications/1/acknowledge', {}), {
        params: Promise.resolve({ id: '1' }),
      });
      expect(res.status).toBe(403);
    });

    it('returns 404 not found', async () => {
      mockAck.mockRejectedValue(
        new EquipmentNotificationError(NOTIFICATION_ERROR_CODES.NOT_FOUND, 'gone'),
      );
      const res = await ACK(req('/api/notifications/1/acknowledge', { note: 'ok' }), {
        params: Promise.resolve({ id: '1' }),
      });
      expect(res.status).toBe(404);
    });

    it('returns 409 already acknowledged', async () => {
      mockAck.mockRejectedValue(
        new EquipmentNotificationError(
          NOTIFICATION_ERROR_CODES.ALREADY_ACKNOWLEDGED,
          'done',
        ),
      );
      const res = await ACK(req('/api/notifications/1/acknowledge', { note: 'ok' }), {
        params: Promise.resolve({ id: '1' }),
      });
      expect(res.status).toBe(409);
    });

    it('returns updated notification on success', async () => {
      mockAck.mockResolvedValue({ id: 1, status: 'acknowledged', acknowledgeNote: 'noted' });
      const res = await ACK(req('/api/notifications/1/acknowledge', { note: 'noted' }), {
        params: Promise.resolve({ id: '1' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('acknowledged');
    });
  });

  describe('POST /notifications/[id]/snooze', () => {
    it('rejects body without snoozeDays', async () => {
      const res = await SNOOZE(req('/api/notifications/1/snooze', {}), {
        params: Promise.resolve({ id: '1' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects out-of-range snooze', async () => {
      const res = await SNOOZE(req('/api/notifications/1/snooze', { snoozeDays: 100 }), {
        params: Promise.resolve({ id: '1' }),
      });
      expect(res.status).toBe(400);
    });

    it('accepts a valid snooze', async () => {
      mockSnooze.mockResolvedValue({ id: 1, status: 'snoozed' });
      const res = await SNOOZE(req('/api/notifications/1/snooze', { snoozeDays: 7 }), {
        params: Promise.resolve({ id: '1' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('snoozed');
    });
  });

  describe('POST /notifications/scan', () => {
    it('returns 401 unauthenticated', async () => {
      mockSession.mockResolvedValue(null);
      const res = await SCAN();
      expect(res.status).toBe(401);
    });

    it('returns scan summary', async () => {
      mockScan.mockResolvedValue({ scanned: 10, created: 3, skipped: 7 });
      const res = await SCAN();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.created).toBe(3);
    });
  });
});
