/**
 * Unit Tests for AuditLogViewerDialog Component
 *
 * Tests the audit log viewer dialog with filtering functionality.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock DevExtreme components
vi.mock('devextreme-react/popup', () => ({
  default: vi.fn(({ visible, children, title }) =>
    visible ? (
      <div data-testid="popup" data-title={title}>
        {children}
      </div>
    ) : null
  ),
}));

vi.mock('devextreme-react/select-box', () => ({
  default: vi.fn(({ value, onValueChanged, placeholder, dataSource }) => (
    <select
      data-testid="select-box"
      value={value || ''}
      onChange={(e) => onValueChanged?.({ value: e.target.value || null })}
    >
      <option value="">{placeholder}</option>
      {dataSource?.map((item: { id: string | number; name: string }) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  )),
}));

vi.mock('devextreme-react/date-box', () => ({
  default: vi.fn(({ value, onValueChanged, placeholder }) => (
    <input
      data-testid="date-box"
      type="date"
      value={value ? new Date(value).toISOString().split('T')[0] : ''}
      onChange={(e) => onValueChanged?.({ value: e.target.value ? new Date(e.target.value) : null })}
      placeholder={placeholder}
    />
  )),
}));

vi.mock('devextreme-react/text-box', () => ({
  default: vi.fn(({ value, onValueChanged, placeholder }) => (
    <input
      data-testid="text-box"
      type="text"
      value={value || ''}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
      placeholder={placeholder}
    />
  )),
}));

vi.mock('devextreme-react/load-indicator', () => ({
  default: vi.fn(() => <div data-testid="load-indicator">Loading...</div>),
}));

vi.mock('devextreme-react/button', () => ({
  default: vi.fn(({ text, onClick, disabled, icon, hint }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={`dx-button-${text || icon || 'default'}`}
      title={hint}
    >
      {text || icon}
    </button>
  )),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useMobile: () => ({ isMobile: false, isTablet: false }),
}));

// Import after mocks
import { AuditLogViewerDialog } from '@/components/shared/AuditLogViewerDialog';
import { parseFieldChanges } from '@/lib/services/audit-log.service';

// Sample test data
const mockAuditLogs = [
  {
    id: 1,
    userId: 1,
    userName: 'Admin User',
    userRole: 'admin',
    action: 'CREATE',
    tableName: 'template_items',
    recordId: 100,
    oldValue: null,
    newValue: { name: 'Test Item', code: 'TI-001' },
    ipAddress: '192.168.1.1',
    createdAt: '2024-12-20T10:30:00Z',
  },
  {
    id: 2,
    userId: 2,
    userName: 'Staff User',
    userRole: 'staff',
    action: 'UPDATE',
    tableName: 'template_items',
    recordId: 100,
    oldValue: { name: 'Test Item', status: 'draft' },
    newValue: { name: 'Updated Item', status: 'active' },
    ipAddress: '192.168.1.2',
    createdAt: '2024-12-21T14:00:00Z',
  },
];

const mockModifiers = [
  { userId: 1, userName: 'Admin User', lastModified: '2024-12-21T14:00:00Z' },
  { userId: 2, userName: 'Staff User', lastModified: '2024-12-21T14:00:00Z' },
];

const mockActions = ['CREATE', 'UPDATE'];

describe('AuditLogViewerDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default fetch responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('getModifiers=true')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockModifiers }),
        });
      }
      if (url.includes('getActions=true')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockActions }),
        });
      }
      // Default: return audit logs
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockAuditLogs, total: 2 }),
      });
    });
  });

  it('renders nothing when not visible', () => {
    render(
      <AuditLogViewerDialog
        entityType="template_items"
        entityId={100}
        visible={false}
        onClose={() => {}}
      />
    );

    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
  });

  it('renders dialog when visible', async () => {
    render(
      <AuditLogViewerDialog
        entityType="template_items"
        entityId={100}
        visible={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeInTheDocument();
    });
  });

  it('shows loading indicator while fetching', async () => {
    // Delay the fetch response
    mockFetch.mockImplementation(() =>
      new Promise((resolve) =>
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [], total: 0 }),
        }), 100)
      )
    );

    render(
      <AuditLogViewerDialog
        entityType="template_items"
        entityId={100}
        visible={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByTestId('load-indicator')).toBeInTheDocument();
  });

  it('displays audit logs after fetching', async () => {
    render(
      <AuditLogViewerDialog
        entityType="template_items"
        entityId={100}
        visible={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('Staff User')).toBeInTheDocument();
    });
  });

  it('shows empty state when no logs', async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [], total: 0 }),
      })
    );

    render(
      <AuditLogViewerDialog
        entityType="template_items"
        entityId={100}
        visible={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('ยังไม่มีประวัติ')).toBeInTheDocument();
    });
  });

  it('shows error state on fetch failure', async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ success: false, error: 'Server error' }),
      })
    );

    render(
      <AuditLogViewerDialog
        entityType="template_items"
        entityId={100}
        visible={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();

    render(
      <AuditLogViewerDialog
        entityType="template_items"
        entityId={100}
        visible={true}
        onClose={onClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeInTheDocument();
    });

    const closeButton = screen.getByTestId('dx-button-ปิด');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('fetches data with correct entity parameters', async () => {
    render(
      <AuditLogViewerDialog
        entityType="accounting_invoices"
        entityId={999}
        visible={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('tableName=accounting_invoices')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('recordId=999')
      );
    });
  });

  it('displays total count', async () => {
    render(
      <AuditLogViewerDialog
        entityType="template_items"
        entityId={100}
        visible={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('2 รายการ')).toBeInTheDocument();
    });
  });

  it('uses custom title when provided', async () => {
    render(
      <AuditLogViewerDialog
        entityType="template_items"
        entityId={100}
        visible={true}
        onClose={() => {}}
        title="Custom History Title"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveAttribute('data-title', 'Custom History Title');
    });
  });

  it('displays action labels in Thai', async () => {
    render(
      <AuditLogViewerDialog
        entityType="template_items"
        entityId={100}
        visible={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      // CREATE = สร้าง, UPDATE = แก้ไข
      expect(screen.getByText('สร้าง')).toBeInTheDocument();
      expect(screen.getByText('แก้ไข')).toBeInTheDocument();
    });
  });
});

describe('parseFieldChanges', () => {
  it('returns empty array for null values', () => {
    const result = parseFieldChanges(null, null, {});
    expect(result).toEqual([]);
  });

  it('handles CREATE action (no oldValue)', () => {
    const result = parseFieldChanges(null, { name: 'Test', code: 'T01' }, {});
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      fieldName: 'name',
      oldValue: null,
      newValue: 'Test',
    });
  });

  it('handles DELETE action (no newValue)', () => {
    const result = parseFieldChanges({ name: 'Test', code: 'T01' }, null, {});
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      fieldName: 'name',
      oldValue: 'Test',
      newValue: null,
    });
  });

  it('handles UPDATE action (both values)', () => {
    const result = parseFieldChanges(
      { name: 'Old Name', status: 'draft' },
      { name: 'New Name', status: 'active' },
      {}
    );
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(
      expect.objectContaining({
        fieldName: 'name',
        oldValue: 'Old Name',
        newValue: 'New Name',
      })
    );
  });

  it('skips unchanged fields', () => {
    const result = parseFieldChanges(
      { name: 'Same', code: 'T01' },
      { name: 'Same', code: 'T02' },
      {}
    );
    expect(result).toHaveLength(1);
    expect(result[0].fieldName).toBe('code');
  });

  it('skips internal fields like id, createdAt', () => {
    const result = parseFieldChanges(
      { id: 1, name: 'Test', createdAt: 'old', updatedAt: 'old' },
      { id: 2, name: 'Test2', createdAt: 'new', updatedAt: 'new' },
      {}
    );
    // Should only include name change
    expect(result).toHaveLength(1);
    expect(result[0].fieldName).toBe('name');
  });

  it('applies custom field labels', () => {
    const result = parseFieldChanges(
      null,
      { productName: 'Widget' },
      { productName: 'ชื่อสินค้า' }
    );
    expect(result[0].fieldLabel).toBe('ชื่อสินค้า');
  });

  it('formats camelCase field names to Title Case', () => {
    const result = parseFieldChanges(null, { customerName: 'John' }, {});
    expect(result[0].fieldLabel).toBe('Customer Name');
  });
});
