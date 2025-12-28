/**
 * Unit Tests for Audit Wrapper
 *
 * Tests the centralized audit logging wrapper functionality.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create a mock db with properly chainable methods
const createMockDb = (records: Record<string, unknown>[] = [{ id: 1, name: 'Test', status: 'active' }]) => {
  const mockDb: any = {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
  };

  // Insert chain: insert().values()
  mockDb.insert.mockReturnValue({
    values: vi.fn().mockResolvedValue({ lastInsertRowid: 1 }),
  });

  // Update chain: update().set().where()
  const updateSetMock = {
    where: vi.fn().mockResolvedValue(undefined),
  };
  mockDb.update.mockReturnValue({
    set: vi.fn().mockReturnValue(updateSetMock),
  });

  // Delete chain: delete().where()
  mockDb.delete.mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });

  // Select chain: select().from().where().limit()
  const selectLimitMock = vi.fn().mockResolvedValue(records);
  const selectWhereMock = {
    limit: selectLimitMock,
  };
  const selectFromMock = {
    where: vi.fn().mockReturnValue(selectWhereMock),
  };
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnValue(selectFromMock),
  });

  return mockDb;
};

let mockDbInstance = createMockDb();

// Mock the dependencies before imports
vi.mock('@/lib/db/index', () => ({
  getDb: vi.fn(() => Promise.resolve(mockDbInstance)),
  isSqlite: vi.fn(() => true),
}));

vi.mock('@/lib/db/db-helper', () => ({
  getTableRef: vi.fn((table: string) => ({
    id: { name: 'id' },
    name: { name: 'name' },
  })),
  getInsertId: vi.fn((result: any) => result.lastInsertRowid || 1),
  executeDbOperation: vi.fn(async (operation: any) => {
    const mockDb = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue({ lastInsertRowid: 1 }),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 1, name: 'Test', status: 'active' }]),
    };
    return operation(mockDb);
  }),
}));

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  getClientIP: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: vi.fn(() => new Date('2024-12-26T10:00:00Z')),
}));

// Import after mocks
import {
  auditedInsert,
  auditedUpdate,
  auditedDelete,
  withAuditLog,
  auditedBatchInsert,
  createAuditContext,
} from '@/lib/db/audit-wrapper';
import { createAuditLog } from '@/lib/audit';
import { executeDbOperation } from '@/lib/db/db-helper';

describe('Audit Wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock db to default state
    mockDbInstance = createMockDb();
  });

  describe('auditedInsert', () => {
    it('inserts record and creates audit log', async () => {
      const id = await auditedInsert({
        table: 'templateItems',
        data: { name: 'Test Item', code: 'TI-001' },
        userId: 1,
        ipAddress: '192.168.1.1',
      });

      expect(id).toBe(1);
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          action: 'CREATE',
          tableName: 'templateItems',
          recordId: 1,
          ipAddress: '192.168.1.1',
        })
      );
    });

    it('includes newValue in audit log', async () => {
      await auditedInsert({
        table: 'templateItems',
        data: { name: 'Test', code: 'T1' },
        userId: 1,
      });

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          newValue: expect.objectContaining({
            name: 'Test',
            code: 'T1',
          }),
          oldValue: undefined,
        })
      );
    });

    it('adds timestamps if not provided', async () => {
      await auditedInsert({
        table: 'templateItems',
        data: { name: 'Test' },
        userId: 1,
      });

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          newValue: expect.objectContaining({
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          }),
        })
      );
    });

    it('redacts sensitive fields', async () => {
      await auditedInsert({
        table: 'users',
        data: { name: 'John', password: 'secret123', email: 'john@example.com' },
        userId: 1,
      });

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          newValue: expect.objectContaining({
            name: 'John',
            password: '[REDACTED]',
            email: 'john@example.com',
          }),
        })
      );
    });
  });

  describe('auditedUpdate', () => {
    it('fetches old value and creates audit log', async () => {
      // Set up mock db with existing record
      mockDbInstance = createMockDb([{ id: 1, name: 'Old Name', status: 'draft' }]);

      await auditedUpdate({
        table: 'templateItems',
        id: 1,
        data: { name: 'New Name', status: 'active' },
        userId: 2,
      });

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 2,
          action: 'UPDATE',
          tableName: 'templateItems',
          recordId: 1,
        })
      );
    });

    it('throws error if record not found', async () => {
      // Set up mock db with no records
      mockDbInstance = createMockDb([]);

      await expect(
        auditedUpdate({
          table: 'templateItems',
          id: 999,
          data: { name: 'Test' },
        })
      ).rejects.toThrow('Record not found: templateItems:999');
    });
  });

  describe('auditedDelete', () => {
    it('fetches record before deletion and logs it', async () => {
      // Ensure record exists
      mockDbInstance = createMockDb([{ id: 1, name: 'Test Item', status: 'active' }]);

      await auditedDelete({
        table: 'templateItems',
        id: 1,
        userId: 3,
      });

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 3,
          action: 'DELETE',
          tableName: 'templateItems',
          recordId: 1,
          newValue: undefined,
        })
      );
    });

    it('supports soft delete', async () => {
      // Set up mock db with existing record
      mockDbInstance = createMockDb([{ id: 1, name: 'Test', isActive: true }]);

      await auditedDelete({
        table: 'templateItems',
        id: 1,
        softDelete: true,
        userId: 1,
      });

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE',
        })
      );
    });
  });

  describe('withAuditLog', () => {
    it('executes operation and logs with custom action', async () => {
      // Ensure record exists for auto-fetch
      mockDbInstance = createMockDb([{ id: 1, name: 'Test', status: 'pending' }]);

      const result = await withAuditLog({
        action: 'APPROVE',
        table: 'templateItems',
        id: 1,
        userId: 1,
        operation: async () => {
          return { success: true };
        },
      });

      expect(result).toEqual({ success: true });
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'APPROVE',
          tableName: 'templateItems',
          recordId: 1,
        })
      );
    });

    it('auto-fetches old value for non-CREATE actions', async () => {
      // Set up mock db with record to be fetched
      mockDbInstance = createMockDb([{ id: 1, name: 'Test', status: 'draft' }]);

      await withAuditLog({
        action: 'REJECT',
        table: 'templateItems',
        id: 1,
        userId: 1,
        operation: async () => undefined,
      });

      // Should have fetched the record
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          oldValue: expect.objectContaining({
            id: 1,
            name: 'Test',
          }),
        })
      );
    });

    it('skips auto-fetch when skipAutoFetch is true', async () => {
      await withAuditLog({
        action: 'SYNC',
        table: 'templateItems',
        id: 1,
        userId: 1,
        skipAutoFetch: true,
        operation: async () => undefined,
      });

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          oldValue: null,
          newValue: null,
        })
      );
    });

    it('uses provided oldValue and newValue', async () => {
      await withAuditLog({
        action: 'UPDATE',
        table: 'templateItems',
        id: 1,
        userId: 1,
        oldValue: { status: 'draft' },
        newValue: { status: 'published' },
        skipAutoFetch: true,
        operation: async () => undefined,
      });

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          oldValue: { status: 'draft' },
          newValue: { status: 'published' },
        })
      );
    });
  });

  describe('auditedBatchInsert', () => {
    it('inserts multiple records and logs each', async () => {
      const ids = await auditedBatchInsert({
        table: 'templateItems',
        data: [
          { name: 'Item 1', code: 'I1' },
          { name: 'Item 2', code: 'I2' },
          { name: 'Item 3', code: 'I3' },
        ],
        userId: 1,
      });

      expect(ids).toHaveLength(3);
      expect(createAuditLog).toHaveBeenCalledTimes(3);
    });
  });

  describe('createAuditContext', () => {
    it('extracts IP from x-forwarded-for header', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '10.0.0.1, 10.0.0.2',
        },
      });

      const context = createAuditContext(request, 1);

      expect(context).toEqual({
        userId: 1,
        ipAddress: '10.0.0.1',
      });
    });

    it('extracts IP from x-real-ip header', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-real-ip': '192.168.1.100',
        },
      });

      const context = createAuditContext(request, 2);

      expect(context).toEqual({
        userId: 2,
        ipAddress: '192.168.1.100',
      });
    });

    it('returns unknown when no IP headers', () => {
      const request = new Request('http://localhost');

      const context = createAuditContext(request);

      expect(context.ipAddress).toBe('unknown');
    });
  });
});

describe('Sensitive Field Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redacts password field', async () => {
    await auditedInsert({
      table: 'users',
      data: { username: 'admin', password: 'secret' },
      userId: 1,
    });

    const logCall = vi.mocked(createAuditLog).mock.calls[0][0];
    expect(logCall.newValue?.password).toBe('[REDACTED]');
    expect(logCall.newValue?.username).toBe('admin');
  });

  it('redacts apiKey field', async () => {
    await auditedInsert({
      table: 'vendorApiKeys',
      data: { vendorId: 1, apiKey: 'sk_live_abc123' },
      userId: 1,
    });

    const logCall = vi.mocked(createAuditLog).mock.calls[0][0];
    expect(logCall.newValue?.apiKey).toBe('[REDACTED]');
  });

  it('redacts multiple sensitive fields', async () => {
    await auditedInsert({
      table: 'integrations',
      data: {
        name: 'API Integration',
        apiKey: 'key123',
        secretKey: 'secret456',
        token: 'token789',
      },
      userId: 1,
    });

    const logCall = vi.mocked(createAuditLog).mock.calls[0][0];
    expect(logCall.newValue?.name).toBe('API Integration');
    expect(logCall.newValue?.apiKey).toBe('[REDACTED]');
    expect(logCall.newValue?.secretKey).toBe('[REDACTED]');
    expect(logCall.newValue?.token).toBe('[REDACTED]');
  });
});
