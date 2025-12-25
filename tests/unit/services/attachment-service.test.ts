/**
 * Attachment Service Unit Tests
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
  isSqlite: vi.fn(() => true),
}));

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(),
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: vi.fn(() => new Date('2024-12-23T10:00:00Z')),
}));

import { getDb, isSqlite } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

describe('Attachment Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAttachments', () => {
    it('should return empty array when no attachments exist', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const { getAttachments } = await import('@/lib/services/attachment-service');
      const result = await getAttachments('capa', 1);

      expect(result).toEqual([]);
    });

    it('should return attachments with proper formatting', async () => {
      const mockRow = {
        id: 1,
        moduleName: 'capa',
        entityId: 1,
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        description: 'Test file',
        category: 'evidence',
        uploadedBy: 1,
        uploadedByName: 'Test User',
        uploadedAt: new Date('2024-12-23T10:00:00Z'),
        updatedAt: new Date('2024-12-23T10:00:00Z'),
      };

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([mockRow]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const { getAttachments } = await import('@/lib/services/attachment-service');
      const result = await getAttachments('capa', 1);

      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('test.pdf');
      expect(result[0].category).toBe('evidence');
    });
  });

  describe('createAttachment', () => {
    it('should create attachment and return result', async () => {
      const mockInsertResult = { lastInsertRowid: 1 };
      const mockCreatedRow = {
        id: 1,
        moduleName: 'capa',
        entityId: 1,
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        description: null,
        category: null,
        uploadedBy: 1,
        uploadedByName: 'Test User',
        uploadedAt: '2024-12-23T10:00:00Z',
        updatedAt: '2024-12-23T10:00:00Z',
      };

      const mockDb = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(mockInsertResult),
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockCreatedRow]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);
      vi.mocked(isSqlite).mockReturnValue(true);

      const { createAttachment } = await import('@/lib/services/attachment-service');
      const result = await createAttachment(
        {
          moduleName: 'capa',
          entityId: 1,
          fileName: 'test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          fileData: Buffer.from('test'),
        },
        1
      );

      expect(result.fileName).toBe('test.pdf');
      expect(createAuditLog).toHaveBeenCalled();
    });
  });

  describe('deleteAttachment', () => {
    it('should throw error when attachment not found', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const { deleteAttachment } = await import('@/lib/services/attachment-service');

      await expect(deleteAttachment(999, 1)).rejects.toThrow('Attachment not found');
    });
  });
});
