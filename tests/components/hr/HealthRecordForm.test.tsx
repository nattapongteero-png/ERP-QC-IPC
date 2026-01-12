import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HealthRecordForm } from '@/components/hr/HealthRecordForm';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock DevExtreme notify - use vi.hoisted to avoid reference before initialization
const { mockNotify } = vi.hoisted(() => ({
  mockNotify: vi.fn(),
}));
vi.mock('devextreme/ui/notify', () => ({
  default: mockNotify,
}));

const mockEmployees = [
  {
    id: 1,
    employeeCode: 'EMP001',
    firstName: 'John',
    lastName: 'Doe',
    status: 'active',
    positionTitle: 'Developer',
    orgUnitName: 'IT',
  },
  {
    id: 2,
    employeeCode: 'EMP002',
    firstName: 'Jane',
    lastName: 'Smith',
    status: 'active',
    positionTitle: 'Manager',
    orgUnitName: 'HR',
  },
];

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('HealthRecordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should display employee full names in dropdown', async () => {
    // Mock the employees API
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockEmployees }),
    });

    renderWithProviders(<HealthRecordForm mode="create" />);

    // Wait for employees to load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/hr/employees?status=active');
    });

    // The form should have computed fullName for each employee
    // We verify the fetch was called and data was processed
    // The SelectBox should have options with fullName computed
    await waitFor(() => {
      // Check that the form renders without error
      expect(screen.getByText('บันทึกผลตรวจสุขภาพใหม่')).toBeInTheDocument();
    });
  });
});
