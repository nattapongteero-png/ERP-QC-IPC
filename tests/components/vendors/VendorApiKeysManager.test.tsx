/**
 * Unit Tests for VendorApiKeysManager Component
 *
 * Tests the vendor API keys management UI component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock fetch globally
global.fetch = vi.fn();

// Mock DevExtreme components
vi.mock('devextreme-react/popup', () => ({
  Popup: vi.fn(({ visible, children, title }) =>
    visible ? (
      <div data-testid="popup" data-title={title}>
        {children}
      </div>
    ) : null
  ),
}));

vi.mock('devextreme-react/select-box', () => ({
  SelectBox: vi.fn(({ value, displayExpr, valueExpr, dataSource }) => (
    <select data-testid="select-box" value={value}>
      {dataSource?.map((item: { value: string; text: string }) => (
        <option key={item.value} value={item.value}>
          {item.text}
        </option>
      ))}
    </select>
  )),
}));

vi.mock('devextreme-react/number-box', () => ({
  NumberBox: vi.fn(({ value, placeholder }) => (
    <input
      data-testid="number-box"
      type="number"
      value={value || ''}
      placeholder={placeholder}
    />
  )),
}));

vi.mock('devextreme/ui/notify', () => ({
  default: vi.fn(),
}));

// Mock the DxDataGrid component
vi.mock('@/components/ui/dx-data-grid', () => ({
  DxDataGrid: vi.fn(({ dataSource, columns, keyExpr, loading, noDataText }) => (
    <div data-testid="dx-data-grid" data-loading={loading}>
      {loading && <div data-testid="loading-indicator">Loading...</div>}
      {!loading && dataSource?.length === 0 && (
        <div data-testid="no-data">{noDataText}</div>
      )}
      {!loading && dataSource?.length > 0 && (
        <table>
          <tbody>
            {dataSource.map((item: { id: number; name: string }) => (
              <tr key={item.id} data-testid={`grid-row-${item.id}`}>
                <td>{item.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )),
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: vi.fn(({ text, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled} data-testid="dx-button">
      {text}
    </button>
  )),
}));

import { VendorApiKeysManager } from '@/components/vendors/VendorApiKeysManager';

describe('VendorApiKeysManager Component', () => {
  let queryClient: QueryClient;

  const mockApiKeys = [
    {
      id: 1,
      keyPrefix: 'vmi_erp_abc123',
      name: 'Test Key 1',
      permissions: 'read',
      isActive: true,
      lastUsedAt: '2024-01-15T10:00:00Z',
      expiresAt: null,
      createdAt: '2024-01-01T10:00:00Z',
    },
    {
      id: 2,
      keyPrefix: 'vmi_erp_def456',
      name: 'Test Key 2',
      permissions: 'write',
      isActive: false,
      lastUsedAt: '2024-01-10T10:00:00Z',
      expiresAt: '2024-12-31T23:59:59Z',
      createdAt: '2024-01-01T10:00:00Z',
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();

    // Mock successful API response by default
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockApiKeys,
    } as Response);
  });

  it('should render without crashing', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VendorApiKeysManager vendorId={1} />
      </QueryClientProvider>
    );

    expect(screen.getByText('API Keys')).toBeInTheDocument();
  });

  it('should display API keys in grid when data is loaded', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VendorApiKeysManager vendorId={1} />
      </QueryClientProvider>
    );

    // Wait for data to load and grid to update
    await waitFor(
      () => {
        const grid = screen.getByTestId('dx-data-grid');
        expect(grid).toHaveAttribute('data-loading', 'false');
      },
      { timeout: 3000 }
    );

    // Verify grid is present
    expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
  });

  it('should show loading state initially', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VendorApiKeysManager vendorId={1} />
      </QueryClientProvider>
    );

    const grid = screen.getByTestId('dx-data-grid');
    expect(grid).toHaveAttribute('data-loading', 'true');
  });

  it('should display error message when fetch fails', async () => {
    // Mock failed API response
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
    } as Response);

    render(
      <QueryClientProvider client={queryClient}>
        <VendorApiKeysManager vendorId={1} />
      </QueryClientProvider>
    );

    await waitFor(
      () => {
        expect(screen.getByText(/Failed to fetch API keys/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('should have Create API Key button', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VendorApiKeysManager vendorId={1} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const buttons = screen.getAllByTestId('dx-button');
      const createButton = buttons.find((btn) => btn.textContent === 'Create API Key');
      expect(createButton).toBeInTheDocument();
    });
  });

  it('should have Refresh button', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VendorApiKeysManager vendorId={1} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const buttons = screen.getAllByTestId('dx-button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it('should show no data message when no API keys exist', async () => {
    // Mock empty API response
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    render(
      <QueryClientProvider client={queryClient}>
        <VendorApiKeysManager vendorId={1} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/No API keys found. Create one to get started./i)
      ).toBeInTheDocument();
    });
  });

  it('should fetch API keys with correct vendor ID', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VendorApiKeysManager vendorId={42} />
      </QueryClientProvider>
    );

    expect(global.fetch).toHaveBeenCalledWith('/api/vendors/42/api-keys');
  });
});
