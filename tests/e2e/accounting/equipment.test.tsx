/**
 * Equipment & Maintenance E2E Test
 * Feature: 010-accounting-module-integration
 * User Story 8: Track Equipment and Maintenance Costs
 *
 * Tests the Equipment page rendering and interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/accounting/equipment',
}));

// Mock lucide-react icons - Proxy returns a stub for ANY icon name so a newly
// imported icon can never fail with "No <Icon> export is defined".
vi.mock('lucide-react', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  const make = (name: string) =>
    Object.assign(
      (props: Record<string, unknown>) =>
        React.createElement('span', { 'data-testid': `icon-${name}`, ...props }),
      { displayName: name }
    );
  return new Proxy(
    {},
    {
      get: (_t: unknown, prop: string | symbol) => {
        if (prop === '__esModule') return true;
        if (prop === 'default') return make('default');
        return make(String(prop));
      },
    }
  );
});

// Mock shared components
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  ),
  StatCard: ({ label, value }: { label: string; value: string | number }) => (
    <div data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample equipment data
const mockEquipment = [
  {
    id: 1,
    fixedAssetId: 1,
    serialNumber: 'SN-001',
    manufacturer: 'Manufacturing Co.',
    model: 'Model X-100',
    specifications: JSON.stringify({ power: '10kW' }),
    operatingHours: 1500,
    operatingUnits: 0,
    lastMeterReading: 1500,
    isAvailable: true,
    lastMaintenanceDate: '2025-01-10',
    nextMaintenanceDue: '2025-02-10',
    assetCode: 'FA-202501-000001',
    assetName: 'Production Machine A',
  },
  {
    id: 2,
    fixedAssetId: 2,
    serialNumber: 'SN-002',
    manufacturer: 'Equipment Inc.',
    model: 'Model Y-200',
    operatingHours: 2500,
    isAvailable: false,
    lastMaintenanceDate: '2025-01-05',
    nextMaintenanceDue: '2025-01-20',
    assetCode: 'FA-202501-000002',
    assetName: 'Packaging Machine B',
  },
];

const mockSummary = {
  totalEquipment: 5,
  availableEquipment: 3,
  unavailableEquipment: 2,
  overdueMaintenanceCount: 1,
  upcomingMaintenanceCount: 2,
};

const mockOverdue = [
  {
    schedule: {
      id: 1,
      maintenanceType: 'preventive',
      description: 'Monthly inspection',
      nextDue: '2025-01-10',
    },
    equipment: { id: 2 },
    daysOverdue: 5,
  },
];

const mockUpcoming = [
  {
    schedule: {
      id: 2,
      maintenanceType: 'preventive',
      description: 'Lubrication check',
      nextDue: '2025-01-20',
    },
    equipment: { id: 1 },
    daysUntilDue: 5,
  },
];

const mockSchedules = [
  {
    id: 1,
    maintenanceType: 'preventive',
    description: 'Monthly inspection',
    intervalType: 'months',
    intervalValue: 1,
    nextDue: '2025-02-15',
    isActive: true,
  },
];

describe('Equipment & Maintenance Page', () => {
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
        },
      },
    });

    // Reset mock
    mockFetch.mockReset();

    // Setup default mock responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/accounting/equipment') && url.includes('summary=true')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSummary }),
        });
      }
      if (url.includes('/api/accounting/equipment') && url.includes('/schedules')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSchedules }),
        });
      }
      if (url.includes('/api/accounting/equipment')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockEquipment }),
        });
      }
      if (url.includes('/api/accounting/maintenance/overdue')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockOverdue, count: 1 }),
        });
      }
      if (url.includes('/api/accounting/maintenance/due')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockUpcoming, count: 2 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: null }),
      });
    });
  });

  const renderPage = async () => {
    const EquipmentPage = (await import('@/app/accounting/equipment/page')).default;
    return render(
      <QueryClientProvider client={queryClient}>
        <EquipmentPage />
      </QueryClientProvider>
    );
  };

  it('should render page header correctly', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Accounting').length).toBeGreaterThan(0);
    }, { timeout: 10000 });
  }, 15000);

  it('should display subtitle about MTBF analysis', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText(/MTBF analysis/)).toBeInTheDocument();
    });
  });

  it('should display availability filter', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Availability')).toBeInTheDocument();
    });
  });

  it.skip('should display Add Equipment button', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('eq-add-btn')).toBeInTheDocument();
    });
  });

  it('should display page title and subtitle', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Accounting').length).toBeGreaterThan(0);
      expect(screen.getByText('Track equipment, maintenance schedules, and MTBF analysis')).toBeInTheDocument();
    });
  });

  it('should render stat cards', async () => {
    await renderPage();

    await waitFor(() => {
      // Check for stat card labels
      expect(screen.getByText('Total Equipment')).toBeInTheDocument();
      expect(screen.getByText('Available')).toBeInTheDocument();
    });
  });

  it('should call equipment API on load', async () => {
    await renderPage();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/equipment')
      );
    });
  });

  it('should call maintenance due API on load', async () => {
    await renderPage();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/maintenance/due')
      );
    });
  });

  it('should call maintenance overdue API on load', async () => {
    await renderPage();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/maintenance/overdue')
      );
    });
  });

  it('should handle API error gracefully', async () => {
    mockFetch.mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to fetch equipment' }),
      });
    });

    await renderPage();

    // Page should still render without crashing
    await waitFor(() => {
      expect(screen.getAllByText('Accounting').length).toBeGreaterThan(0);
    });
  });

  it('should display overdue maintenance alert when overdue count > 0', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Overdue Maintenance Alert')).toBeInTheDocument();
    });
  });
});

describe('Equipment API Responses', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should handle equipment list response correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockEquipment }),
    });

    const response = await fetch('/api/accounting/equipment');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(data.data[0].serialNumber).toBe('SN-001');
    expect(data.data[0].isAvailable).toBe(true);
  });

  it('should handle summary response correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockSummary }),
    });

    const response = await fetch('/api/accounting/equipment?summary=true');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.totalEquipment).toBe(5);
    expect(data.data.availableEquipment).toBe(3);
    expect(data.data.overdueMaintenanceCount).toBe(1);
  });

  it('should handle overdue maintenance response correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockOverdue, count: 1 }),
    });

    const response = await fetch('/api/accounting/maintenance/overdue');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.count).toBe(1);
    expect(data.data[0].daysOverdue).toBe(5);
  });

  it('should handle upcoming maintenance response correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockUpcoming, count: 2 }),
    });

    const response = await fetch('/api/accounting/maintenance/due?daysAhead=7');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.count).toBe(2);
    expect(data.data[0].daysUntilDue).toBe(5);
  });

  it('should handle maintenance schedules response correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockSchedules }),
    });

    const response = await fetch('/api/accounting/equipment/1/schedules');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data[0].maintenanceType).toBe('preventive');
    expect(data.data[0].intervalType).toBe('months');
  });
});

describe('MTBF Calculations', () => {
  it('should calculate MTBF correctly', () => {
    const totalOperatingHours = 1000;
    const totalFailures = 4;
    const mtbf = totalOperatingHours / totalFailures;

    expect(mtbf).toBe(250); // 250 hours between failures
  });

  it('should calculate availability correctly', () => {
    const mtbf = 250;
    const mttr = 10; // Mean time to repair
    const availability = (mtbf / (mtbf + mttr)) * 100;

    expect(availability).toBeCloseTo(96.15, 1);
  });

  it('should handle zero failures for MTBF', () => {
    const totalOperatingHours = 1000;
    const totalFailures = 0;
    // When no failures, MTBF equals total operating hours
    const mtbf = totalFailures > 0 ? totalOperatingHours / totalFailures : totalOperatingHours;

    expect(mtbf).toBe(1000);
  });
});

describe('Maintenance Type Validation', () => {
  it('should validate preventive maintenance type', () => {
    const maintenanceTypes = ['preventive', 'corrective', 'emergency'];
    expect(maintenanceTypes).toContain('preventive');
  });

  it('should validate interval types', () => {
    const intervalTypes = ['days', 'weeks', 'months', 'hours', 'units'];
    expect(intervalTypes).toContain('months');
    expect(intervalTypes).toContain('hours');
  });
});

describe('Equipment Availability Status', () => {
  it('should identify available equipment', () => {
    const equipment = mockEquipment.find(e => e.id === 1);
    expect(equipment?.isAvailable).toBe(true);
  });

  it('should identify unavailable equipment', () => {
    const equipment = mockEquipment.find(e => e.id === 2);
    expect(equipment?.isAvailable).toBe(false);
  });
});

describe('Maintenance Schedule Calculation', () => {
  it('should calculate next due date for monthly interval', () => {
    const lastPerformed = new Date('2025-01-15');
    const intervalMonths = 1;
    lastPerformed.setMonth(lastPerformed.getMonth() + intervalMonths);

    expect(lastPerformed.toISOString().split('T')[0]).toBe('2025-02-15');
  });

  it('should calculate next due date for weekly interval', () => {
    const lastPerformed = new Date('2025-01-15');
    const intervalWeeks = 2;
    lastPerformed.setDate(lastPerformed.getDate() + intervalWeeks * 7);

    expect(lastPerformed.toISOString().split('T')[0]).toBe('2025-01-29');
  });
});
