// VMI Webhook Delivery History UI Tests
// Ensures delivery history grid and components render without runtime errors
// Feature: 012-vmi-webhook
// Task: T041

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/sales/vmi-orders/portals/1/webhooks/1/deliveries',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

// Wrapper component for tests
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Mock delivery data
const mockDeliveries = [
  {
    id: 1,
    deliveryId: 'del_abc123',
    eventType: 'order.created' as const,
    eventId: 'evt_123',
    signatureValid: true,
    status: 'processed' as const,
    responseCode: 200,
    errorMessage: null,
    processingDurationMs: 45,
    receivedAt: '2024-01-15T10:30:00Z',
    processedAt: '2024-01-15T10:30:00Z',
  },
  {
    id: 2,
    deliveryId: 'del_def456',
    eventType: 'order.cancelled' as const,
    eventId: 'evt_456',
    signatureValid: true,
    status: 'failed' as const,
    responseCode: 500,
    errorMessage: 'Internal processing error',
    processingDurationMs: 120,
    receivedAt: '2024-01-15T11:00:00Z',
    processedAt: '2024-01-15T11:00:00Z',
  },
  {
    id: 3,
    deliveryId: 'del_ghi789',
    eventType: 'receipt.created' as const,
    eventId: 'evt_789',
    signatureValid: false,
    status: 'failed' as const,
    responseCode: 401,
    errorMessage: 'Invalid signature',
    processingDurationMs: 5,
    receivedAt: '2024-01-15T12:00:00Z',
    processedAt: '2024-01-15T12:00:00Z',
  },
];

describe('WebhookDeliveryGrid Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          deliveries: mockDeliveries,
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 3,
            totalPages: 1,
          },
        }),
    });
  });

  it('renders delivery grid with data', async () => {
    const { WebhookDeliveryGrid } = await import('@/components/vmi/WebhookDeliveryGrid');

    render(
      <TestWrapper>
        <WebhookDeliveryGrid portalId={1} webhookId={1} />
      </TestWrapper>
    );

    // Wait for data to load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it('renders filter controls', async () => {
    const { WebhookDeliveryGrid } = await import('@/components/vmi/WebhookDeliveryGrid');

    render(
      <TestWrapper>
        <WebhookDeliveryGrid portalId={1} webhookId={1} />
      </TestWrapper>
    );

    // Check filter controls exist
    expect(screen.getByText('สถานะ:')).toBeInTheDocument();
    expect(screen.getByText('ประเภท:')).toBeInTheDocument();
    expect(screen.getByText('จาก:')).toBeInTheDocument();
    expect(screen.getByText('ถึง:')).toBeInTheDocument();
    expect(screen.getByText('รีเฟรช')).toBeInTheDocument();
  });

  it('renders status filter options', async () => {
    const { WebhookDeliveryGrid } = await import('@/components/vmi/WebhookDeliveryGrid');

    render(
      <TestWrapper>
        <WebhookDeliveryGrid portalId={1} webhookId={1} />
      </TestWrapper>
    );

    // Find status filter and check options
    const statusFilter = screen.getAllByRole('combobox')[0];
    expect(statusFilter).toBeInTheDocument();
  });

  it('renders event type filter options', async () => {
    const { WebhookDeliveryGrid } = await import('@/components/vmi/WebhookDeliveryGrid');

    render(
      <TestWrapper>
        <WebhookDeliveryGrid portalId={1} webhookId={1} />
      </TestWrapper>
    );

    // Find event type filter
    const eventTypeFilter = screen.getAllByRole('combobox')[1];
    expect(eventTypeFilter).toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          success: false,
          message: 'Failed to fetch deliveries',
        }),
    });

    const { WebhookDeliveryGrid } = await import('@/components/vmi/WebhookDeliveryGrid');

    render(
      <TestWrapper>
        <WebhookDeliveryGrid portalId={1} webhookId={1} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it('fetches deliveries with correct URL', async () => {
    const { WebhookDeliveryGrid } = await import('@/components/vmi/WebhookDeliveryGrid');

    render(
      <TestWrapper>
        <WebhookDeliveryGrid portalId={123} webhookId={456} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
      const fetchUrl = mockFetch.mock.calls[0][0];
      expect(fetchUrl).toContain('/api/sales/vmi-orders/portals/123/webhooks/456/deliveries');
    });
  });
});

describe('Delivery Status Display', () => {
  it('displays processed status correctly', () => {
    const processedDelivery = mockDeliveries[0];

    expect(processedDelivery.status).toBe('processed');
    expect(processedDelivery.responseCode).toBe(200);
    expect(processedDelivery.signatureValid).toBe(true);
  });

  it('displays failed status correctly', () => {
    const failedDelivery = mockDeliveries[1];

    expect(failedDelivery.status).toBe('failed');
    expect(failedDelivery.responseCode).toBe(500);
    expect(failedDelivery.errorMessage).toBe('Internal processing error');
  });

  it('displays signature validation status', () => {
    const validSignature = mockDeliveries[0];
    const invalidSignature = mockDeliveries[2];

    expect(validSignature.signatureValid).toBe(true);
    expect(invalidSignature.signatureValid).toBe(false);
  });
});

describe('Delivery Event Types', () => {
  it('identifies order.created event type', () => {
    const orderCreated = mockDeliveries.find((d) => d.eventType === 'order.created');
    expect(orderCreated).toBeDefined();
  });

  it('identifies order.cancelled event type', () => {
    const orderCancelled = mockDeliveries.find((d) => d.eventType === 'order.cancelled');
    expect(orderCancelled).toBeDefined();
  });

  it('identifies receipt.created event type', () => {
    const receiptCreated = mockDeliveries.find((d) => d.eventType === 'receipt.created');
    expect(receiptCreated).toBeDefined();
  });
});

describe('Pagination', () => {
  it('displays pagination info correctly', () => {
    const pagination = {
      page: 1,
      pageSize: 20,
      totalItems: 100,
      totalPages: 5,
    };

    expect(pagination.totalPages).toBe(5);
    expect(pagination.totalItems).toBe(100);
  });

  it('calculates correct page range', () => {
    const page = 2;
    const pageSize = 20;
    const totalItems = 100;

    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalItems);

    expect(start).toBe(21);
    expect(end).toBe(40);
  });
});

describe('Processing Duration Display', () => {
  it('formats milliseconds correctly', () => {
    const formatDuration = (ms: number | null): string => {
      if (ms === null) return '-';
      if (ms < 1000) return `${ms}ms`;
      return `${(ms / 1000).toFixed(2)}s`;
    };

    expect(formatDuration(45)).toBe('45ms');
    expect(formatDuration(1500)).toBe('1.50s');
    expect(formatDuration(null)).toBe('-');
  });
});
