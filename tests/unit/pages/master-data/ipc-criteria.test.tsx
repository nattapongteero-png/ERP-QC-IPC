/**
 * Unit Tests: IPC Criteria Master Data
 * Tests the IPC Criteria list page and form rendering
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock next modules
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useParams: () => ({ id: '1' }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'th',
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import { useQuery } from '@tanstack/react-query';
const mockUseQuery = useQuery as any;

describe('IPC Criteria API Route', () => {
  it('validates API route exports for master data', async () => {
    const route = await import('@/app/api/master-data/ipc-criteria/route');
    expect(route.GET).toBeDefined();
    expect(route.POST).toBeDefined();
    expect(route.PUT).toBeDefined();
  });

  it('validates the IPC criteria form component exists', async () => {
    const mod = await import('@/components/master-data/IPCCriteriaForm');
    expect(mod.IPCCriteriaForm).toBeDefined();
  });
});

describe('IPC Criteria Form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders the create form', async () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any);

    const { IPCCriteriaForm } = await import('@/components/master-data/IPCCriteriaForm');
    render(<IPCCriteriaForm mode="create" />);

    expect(screen.getByText('New IPC Criteria')).toBeDefined();
    expect(screen.getByText('Code *')).toBeDefined();
    expect(screen.getByText('Name (EN) *')).toBeDefined();
    expect(screen.getByText('Min Value')).toBeDefined();
    expect(screen.getByText('Max Value')).toBeDefined();
    expect(screen.getByText('Sample Size')).toBeDefined();
  });

  it('renders the edit form with data', async () => {
    const mockData = {
      id: 1, code: 'IPC-WV-001', name: 'Weight Variation', nameTh: 'น้ำหนักแคปซูล',
      testMethod: 'USP', specification: '200 ± 10 mg', minValue: 190, maxValue: 210,
      unit: 'mg', sampleSize: 20, checkIntervalMinutes: 30, isCritical: true, isActive: true,
    };

    mockUseQuery.mockReturnValue({
      data: mockData,
      isLoading: false,
    } as any);

    const { IPCCriteriaForm } = await import('@/components/master-data/IPCCriteriaForm');
    render(<IPCCriteriaForm mode="edit" id={1} />);

    expect(screen.getByText('Edit IPC Criteria')).toBeDefined();
  });
});
