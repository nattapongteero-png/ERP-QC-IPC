import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EquipmentPage from '@/app/accounting/equipment/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/accounting/equipment',
}));

// Mock fetch
global.fetch = vi.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
};

describe('EquipmentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetch).mockImplementation((url) => {
      const urlString = url.toString();

      // Equipment summary
      if (urlString.includes('summary=true')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              totalEquipment: 10,
              availableEquipment: 7,
              unavailableEquipment: 3,
              overdueMaintenanceCount: 2,
              upcomingMaintenanceCount: 5,
            },
          }),
        } as Response);
      }

      // Overdue maintenance
      if (urlString.includes('/maintenance/overdue')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ count: 2 }),
        } as Response);
      }

      // Upcoming maintenance
      if (urlString.includes('/maintenance/due')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              {
                schedule: {
                  id: 1,
                  maintenanceType: 'Oil Change',
                  description: 'Regular oil change',
                  nextDue: '2024-12-28',
                },
                equipment: { id: 1 },
                daysUntilDue: 2,
              },
            ],
          }),
        } as Response);
      }

      // Equipment list
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);
    });
  });

  it('renders professional page header', async () => {
    render(<EquipmentPage />, { wrapper: createWrapper() });
    expect((await screen.findAllByText('Accounting')).length).toBeGreaterThan(0);
    expect(screen.getByText('Track equipment, maintenance schedules, and MTBF analysis')).toBeInTheDocument();
  });

  it('renders KPI cards with equipment stats', async () => {
    render(<EquipmentPage />, { wrapper: createWrapper() });
    expect(await screen.findByText('Total Equipment')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('In Use')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Due (7 days)')).toBeInTheDocument();
  });

  it('renders page structure with proper testid', async () => {
    render(<EquipmentPage />, { wrapper: createWrapper() });
    expect(await screen.findByTestId('equipment-page')).toBeInTheDocument();
  });

  it('displays overdue maintenance alert when there are overdue items', async () => {
    render(<EquipmentPage />, { wrapper: createWrapper() });
    // Wait for the alert to appear (it shows when overdue count > 0)
    expect(await screen.findByText('Overdue Maintenance Alert')).toBeInTheDocument();
  });

  it('shows add equipment button in header', async () => {
    render(<EquipmentPage />, { wrapper: createWrapper() });
    expect(await screen.findByText('Add Equipment')).toBeInTheDocument();
  });
});
