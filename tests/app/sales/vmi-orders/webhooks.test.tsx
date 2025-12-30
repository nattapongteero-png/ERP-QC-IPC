// VMI Webhook Management UI Tests
// Ensures webhook pages and components render without runtime errors
// Feature: 012-vmi-webhook

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
  usePathname: () => '/sales/vmi-orders/portals/1/webhooks',
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

// Mock portal data
const mockPortal = {
  id: 1,
  name: 'Test Portal',
  portalUrl: 'https://test-portal.example.com',
  connectionStatus: 'connected' as const,
};

// Mock webhooks data
const mockWebhooks = [
  {
    id: 1,
    portalId: 1,
    vmiWebhookId: null,
    name: 'Production Webhook',
    description: 'Main production webhook',
    url: 'https://example.com/api/sales/vmi-orders/webhooks/1',
    events: ['order.created', 'order.cancelled'] as const,
    isActive: true,
    isDisabledByFailures: false,
    consecutiveFailures: 0,
    lastSuccessAt: '2024-01-15T10:30:00Z',
    lastFailureAt: null,
    lastErrorMessage: null,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    portalId: 1,
    vmiWebhookId: null,
    name: 'Test Webhook',
    description: 'Testing webhook with issues',
    url: 'https://example.com/api/sales/vmi-orders/webhooks/1',
    events: ['order.created'] as const,
    isActive: true,
    isDisabledByFailures: false,
    consecutiveFailures: 5,
    lastSuccessAt: '2024-01-10T10:00:00Z',
    lastFailureAt: '2024-01-15T12:00:00Z',
    lastErrorMessage: 'Connection timeout',
    createdAt: '2024-01-05T00:00:00Z',
  },
];

// Mock deliveries data
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
];

// Note: Page-level tests for the webhook management page are skipped
// because they require complex async params handling in Next.js 15+.
// The component-level tests below verify the individual UI components work correctly.
// Integration testing should be done via E2E tests using Playwright.

describe('Webhook Management Page', () => {
  it.skip('page tests skipped - use E2E tests for full page testing', () => {
    // Page tests are skipped because:
    // 1. Next.js 15+ uses async params with use() hook
    // 2. Testing Library has issues with React.use() and Suspense boundaries
    // 3. Components are tested individually below
    //
    // For full page testing, use Playwright E2E tests instead.
  });
});

describe('WebhookConfigForm Component', () => {
  it('renders create mode form correctly', async () => {
    const { WebhookConfigForm } = await import('@/components/vmi/WebhookConfigForm');

    const mockSubmit = vi.fn();
    const mockCancel = vi.fn();

    render(
      <TestWrapper>
        <WebhookConfigForm
          portalId={1}
          portalName="Test Portal"
          mode="create"
          webhookUrl="https://example.com/api/webhooks/1"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      </TestWrapper>
    );

    // Check form title
    expect(screen.getByText('Create New Webhook')).toBeInTheDocument();

    // Check form sections
    expect(screen.getByText('Basic Information')).toBeInTheDocument();
    expect(screen.getByText('Event Subscriptions')).toBeInTheDocument();
    expect(screen.getByText('Webhook URL')).toBeInTheDocument();

    // Check event options are displayed
    expect(screen.getByText('สร้างคำสั่งซื้อ')).toBeInTheDocument();
    expect(screen.getByText('ยกเลิกคำสั่งซื้อ')).toBeInTheDocument();
    expect(screen.getByText('สร้างใบรับสินค้า')).toBeInTheDocument();
    expect(screen.getByText('รับสินค้าครบ')).toBeInTheDocument();

    // Check action buttons
    expect(screen.getByText('Create Webhook')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders edit mode form correctly', async () => {
    const { WebhookConfigForm } = await import('@/components/vmi/WebhookConfigForm');

    const mockSubmit = vi.fn();
    const mockCancel = vi.fn();
    const mockRegenerateSecret = vi.fn();

    render(
      <TestWrapper>
        <WebhookConfigForm
          portalId={1}
          portalName="Test Portal"
          mode="edit"
          webhookUrl="https://example.com/api/webhooks/1"
          initialValues={{
            id: 1,
            name: 'Production Webhook',
            description: 'Main production webhook',
            events: ['order.created', 'order.cancelled'],
            isActive: true,
          }}
          onSubmit={mockSubmit}
          onCancel={mockCancel}
          onRegenerateSecret={mockRegenerateSecret}
        />
      </TestWrapper>
    );

    // Check form title
    expect(screen.getByText('Edit Webhook')).toBeInTheDocument();

    // Check that secret management section is displayed in edit mode
    expect(screen.getByText('Webhook Secret')).toBeInTheDocument();
    expect(screen.getByText('Regenerate Secret')).toBeInTheDocument();

    // Check action buttons
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('displays secret after create', async () => {
    const { WebhookConfigForm } = await import('@/components/vmi/WebhookConfigForm');

    const mockSubmit = vi.fn();
    const mockCancel = vi.fn();
    const testSecret = 'whsec_test_secret_12345';

    render(
      <TestWrapper>
        <WebhookConfigForm
          portalId={1}
          portalName="Test Portal"
          mode="create"
          webhookUrl="https://example.com/api/webhooks/1"
          secret={testSecret}
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      </TestWrapper>
    );

    // Check secret warning is displayed
    expect(screen.getByText('Save this secret now!')).toBeInTheDocument();
    expect(
      screen.getByText(/This secret will only be shown once/)
    ).toBeInTheDocument();
  });

  it('shows validation warning when no events selected', async () => {
    const { WebhookConfigForm } = await import('@/components/vmi/WebhookConfigForm');

    const mockSubmit = vi.fn();
    const mockCancel = vi.fn();

    render(
      <TestWrapper>
        <WebhookConfigForm
          portalId={1}
          portalName="Test Portal"
          mode="create"
          webhookUrl="https://example.com/api/webhooks/1"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      </TestWrapper>
    );

    // Check validation warning for no events
    expect(
      screen.getByText('Please select at least one event to subscribe to')
    ).toBeInTheDocument();
  });
});

describe('WebhookHealthBadge Component', () => {
  it('renders active status correctly', async () => {
    const { WebhookHealthBadge } = await import('@/components/vmi/WebhookHealthBadge');

    render(
      <TestWrapper>
        <WebhookHealthBadge status="active" />
      </TestWrapper>
    );

    expect(screen.getByText('ทำงานปกติ')).toBeInTheDocument();
  });

  it('renders warning status correctly', async () => {
    const { WebhookHealthBadge } = await import('@/components/vmi/WebhookHealthBadge');

    render(
      <TestWrapper>
        <WebhookHealthBadge status="warning" consecutiveFailures={5} />
      </TestWrapper>
    );

    expect(screen.getByText('มีปัญหา')).toBeInTheDocument();
  });

  it('renders disabled by failures status correctly', async () => {
    const { WebhookHealthBadge } = await import('@/components/vmi/WebhookHealthBadge');

    render(
      <TestWrapper>
        <WebhookHealthBadge status="disabled_by_failures" />
      </TestWrapper>
    );

    expect(screen.getByText('ปิดอัตโนมัติ')).toBeInTheDocument();
  });

  it('renders manual disabled status correctly', async () => {
    const { WebhookHealthBadge } = await import('@/components/vmi/WebhookHealthBadge');

    render(
      <TestWrapper>
        <WebhookHealthBadge status="disabled_manual" />
      </TestWrapper>
    );

    expect(screen.getByText('ปิดใช้งาน')).toBeInTheDocument();
  });
});

describe('WebhookHealthCard Component', () => {
  it('renders health card with stats', async () => {
    const { WebhookHealthCard } = await import('@/components/vmi/WebhookHealthBadge');

    render(
      <TestWrapper>
        <WebhookHealthCard
          status="active"
          consecutiveFailures={0}
          lastSuccessAt="2024-01-15T10:30:00Z"
          lastFailureAt={null}
        />
      </TestWrapper>
    );

    expect(screen.getByText('ทำงานปกติ')).toBeInTheDocument();
    expect(screen.getByText('Last Success')).toBeInTheDocument();
    expect(screen.getByText('Last Failure')).toBeInTheDocument();
  });

  it('shows re-enable button for auto-disabled webhooks', async () => {
    const { WebhookHealthCard } = await import('@/components/vmi/WebhookHealthBadge');
    const mockReEnable = vi.fn();

    render(
      <TestWrapper>
        <WebhookHealthCard
          status="disabled_by_failures"
          consecutiveFailures={10}
          lastSuccessAt="2024-01-10T10:00:00Z"
          lastFailureAt="2024-01-15T12:00:00Z"
          lastErrorMessage="Connection timeout"
          onReEnable={mockReEnable}
        />
      </TestWrapper>
    );

    expect(screen.getByText('ปิดอัตโนมัติ')).toBeInTheDocument();
    expect(screen.getByText('Re-enable Webhook')).toBeInTheDocument();
    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
  });

  it('shows warning message for warning status', async () => {
    const { WebhookHealthCard } = await import('@/components/vmi/WebhookHealthBadge');

    render(
      <TestWrapper>
        <WebhookHealthCard
          status="warning"
          consecutiveFailures={5}
          lastSuccessAt="2024-01-10T10:00:00Z"
          lastFailureAt="2024-01-15T12:00:00Z"
        />
      </TestWrapper>
    );

    expect(
      screen.getByText(/This webhook has experienced 5 consecutive failures/)
    ).toBeInTheDocument();
  });
});

describe('WebhookStatusIndicator Component', () => {
  it('renders status indicator with correct styling', async () => {
    const { WebhookStatusIndicator } = await import('@/components/vmi/WebhookHealthBadge');

    render(
      <TestWrapper>
        <WebhookStatusIndicator status="active" />
      </TestWrapper>
    );

    expect(screen.getByText('ทำงานปกติ')).toBeInTheDocument();
  });
});
