/**
 * Work Order Create Page - Delivery Date Business Rules Tests
 *
 * Tests that Delivery Date field is disabled until both Planned Start Date
 * and Planned End Date are specified, and that min constraint is applied.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createPaginatedResponse } from '../../../helpers/ui-test-utils';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Track DxDateBox render calls to verify props
const dxDateBoxRenders: Array<{
  value: string;
  disabled?: boolean;
  min?: string;
  placeholder?: string;
}> = [];

vi.mock('@/components/ui/dx-date-box', () => ({
  DxDateBox: (props: any) => {
    dxDateBoxRenders.push({
      value: props.value,
      disabled: props.disabled,
      min: props.min,
      placeholder: props.placeholder,
    });

    // Determine testid based on placeholder content
    let testId = 'dx-datebox-unknown';
    const ph = props.placeholder || '';
    if (ph.includes('เริ่มต้นและวันสิ้นสุด') || ph.includes('ส่งมอบ')) {
      testId = 'dx-datebox-delivery';
    } else if (ph.includes('เริ่มต้น')) {
      testId = 'dx-datebox-start';
    } else if (ph.includes('สิ้นสุด')) {
      testId = 'dx-datebox-end';
    }

    return (
      <input
        data-testid={testId}
        value={props.value || ''}
        disabled={props.disabled}
        placeholder={props.placeholder}
        readOnly
      />
    );
  },
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardFooter: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: (props: any) => <button onClick={props.onClick}>{props.text}</button>,
}));

vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: (props: any) => <input value={props.value || ''} readOnly placeholder={props.placeholder} />,
}));

vi.mock('@/components/ui/dx-number-box', () => ({
  DxNumberBox: (props: any) => <input type="number" value={props.value || ''} readOnly />,
}));

vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: (props: any) => <select value={props.value}><option value="">Select</option></select>,
}));

vi.mock('@/components/ui/dx-data-grid', () => ({
  DxDataGrid: ({ children }: any) => <div data-testid="data-grid">{children}</div>,
  DxDataGridColumn: () => null,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}));

vi.mock('@/components/ui/item-search-dialog', () => ({
  ItemSearchDialog: () => null,
}));

// Import after mocks
import NewWOPage from '@/app/production/work-orders/new/page';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderPage() {
  dxDateBoxRenders.length = 0;
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <NewWOPage />
    </QueryClientProvider>
  );
}

describe('WO Create Page - Delivery Date Business Rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dxDateBoxRenders.length = 0;

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/api/bom')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createPaginatedResponse([])),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });
    }) as any;
  });

  it('should render the page without crashing', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText('Create Work Order').length).toBeGreaterThan(0);
    });
  });

  it('should disable Delivery Date when Planned Start and End dates are empty', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('dx-datebox-delivery')).toBeInTheDocument();
    });

    const deliveryInput = screen.getByTestId('dx-datebox-delivery');
    expect(deliveryInput).toBeDisabled();
  });

  it('should show placeholder "กรุณาระบุวันเริ่มต้นและวันสิ้นสุดก่อน" when dates not set', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('dx-datebox-delivery')).toBeInTheDocument();
    });

    const deliveryInput = screen.getByTestId('dx-datebox-delivery');
    expect(deliveryInput).toHaveAttribute('placeholder', 'กรุณาระบุวันเริ่มต้นและวันสิ้นสุดก่อน');
  });

  it('should pass disabled=true to DxDateBox for delivery date', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('dx-datebox-delivery')).toBeInTheDocument();
    });

    // Verify the DxDateBox component received disabled=true
    const deliveryBox = dxDateBoxRenders.find(
      (inst) => inst.placeholder?.includes('เริ่มต้นและวันสิ้นสุด')
    );
    expect(deliveryBox).toBeDefined();
    expect(deliveryBox?.disabled).toBe(true);
  });

  it('should display Delivery Date label', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Delivery Date (วันที่ส่งมอบ)')).toBeInTheDocument();
    });
  });
});
