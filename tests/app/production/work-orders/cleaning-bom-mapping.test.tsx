/**
 * Cleaning Page — BOM Room/Equipment Data Mapping Tests
 * Verifies that BOM-configured rooms and equipment for each phase
 * are shown as a cleaning checklist with status and operator info.
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock next-intl with locale switching
let mockLocale = 'en';
vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => {
      const translations: Record<string, string> = {
        'execution.cleaning': 'Cleaning Checklist',
        'execution.room': 'Room',
        'execution.equipment': 'Equipment',
      };
      return translations[key] || key;
    };
    return t;
  },
  useLocale: () => mockLocale,
}));

// Test data
const mockWorkOrder = {
  id: 1,
  woNumber: 'WO-001',
  batchNumber: 'BATCH-001',
  productName: 'Product A',
  status: 'in_progress',
};

// Pre-production cleaning requirements (from BOM config)
const mockPreProductionRequirements = [
  {
    type: 'room',
    id: 1,
    code: 'Pre-0002',
    name: 'Raw Material Warehouse',
    nameTh: 'คลังวัตถุดิบ',
    isRequired: true,
    cleaningLog: undefined,
  },
  {
    type: 'room',
    id: 2,
    code: 'Pre-0003',
    name: 'Weighing Room',
    nameTh: 'ห้องชั่ง',
    isRequired: true,
    cleaningLog: {
      id: 10,
      workOrderId: 1,
      phase: 'pre_production',
      itemType: 'room',
      roomId: 2,
      isClean: true,
      operatorId: 1,
      operatorName: 'Operator A',
      performedAt: '2026-03-25T08:00:00',
      verifierId: undefined,
      verifierName: undefined,
      verifiedAt: undefined,
      notes: undefined,
    },
  },
  {
    type: 'equipment',
    id: 101,
    code: 'SCL-01',
    name: 'Digital Scale',
    nameTh: 'เครื่องชั่งดิจิตอล',
    isRequired: true,
    cleaningLog: {
      id: 11,
      workOrderId: 1,
      phase: 'pre_production',
      itemType: 'equipment',
      equipmentId: 101,
      isClean: true,
      operatorId: 1,
      operatorName: 'Operator A',
      performedAt: '2026-03-25T08:30:00',
      verifierId: 2,
      verifierName: 'Supervisor B',
      verifiedAt: '2026-03-25T09:00:00',
      notes: undefined,
    },
  },
];

const emptyRequirements: any[] = [];

// Mutable test state
let currentRequirements: any[] = mockPreProductionRequirements;

// Mock TanStack Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: any) => {
    if (queryKey[0] === 'work-order') {
      return { data: mockWorkOrder, isLoading: false };
    }
    if (queryKey[0] === 'wo-cleaning-requirements') {
      return { data: currentRequirements, isLoading: false };
    }
    return { data: null, isLoading: false };
  },
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

// Import after mocks
import CleaningPage from '@/app/production/work-orders/[id]/cleaning/page';

describe('Cleaning Page — BOM Data Mapping', () => {
  beforeEach(() => {
    mockLocale = 'en';
    currentRequirements = mockPreProductionRequirements;
    vi.clearAllMocks();
  });

  it('renders room and equipment items from BOM config', () => {
    render(<CleaningPage />);
    expect(screen.getByText('Pre-0002')).toBeInTheDocument();
    expect(screen.getByText('Raw Material Warehouse')).toBeInTheDocument();
    expect(screen.getByText('SCL-01')).toBeInTheDocument();
    expect(screen.getByText('Digital Scale')).toBeInTheDocument();
  });

  it('shows Required badge for required items', () => {
    render(<CleaningPage />);
    const requiredBadges = screen.getAllByText('Required');
    expect(requiredBadges.length).toBe(3); // All 3 items are required
  });

  it('shows Room/Equipment type badges', () => {
    render(<CleaningPage />);
    const roomBadges = screen.getAllByText('Room');
    const equipBadges = screen.getAllByText('Equipment');
    expect(roomBadges.length).toBe(2); // 2 rooms
    expect(equipBadges.length).toBe(1); // 1 equipment
  });

  it('shows Thai names as secondary text in EN locale', () => {
    render(<CleaningPage />);
    expect(screen.getByText('คลังวัตถุดิบ')).toBeInTheDocument();
    expect(screen.getByText('ห้องชั่ง')).toBeInTheDocument();
    expect(screen.getByText('เครื่องชั่งดิจิตอล')).toBeInTheDocument();
  });

  it('shows Thai names as primary text in TH locale', () => {
    mockLocale = 'th';
    render(<CleaningPage />);
    // Thai names shown as primary
    expect(screen.getByText('คลังวัตถุดิบ')).toBeInTheDocument();
    // English names shown as secondary
    expect(screen.getByText('Raw Material Warehouse')).toBeInTheDocument();
  });

  it('shows cleaning status correctly', () => {
    render(<CleaningPage />);
    // Room 1 (Pre-0002): no cleaning log → Not Started
    expect(screen.getByText('Not Started')).toBeInTheDocument();
    // Room 2 (Pre-0003): cleaned but not verified → Cleaned
    expect(screen.getByText('Cleaned')).toBeInTheDocument();
    // Equipment (SCL-01): cleaned and verified → Verified
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('shows operator and verifier names', () => {
    render(<CleaningPage />);
    expect(screen.getAllByText(/Operator A/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Supervisor B/)).toBeInTheDocument();
  });

  it('shows Mark Clean button for uncleaned items', () => {
    render(<CleaningPage />);
    expect(screen.getByText('Mark Clean')).toBeInTheDocument();
  });

  it('shows Verify button for cleaned but unverified items', () => {
    render(<CleaningPage />);
    expect(screen.getByText('Verify')).toBeInTheDocument();
  });

  it('shows progress card with correct counts', () => {
    render(<CleaningPage />);
    // 3 total, 2 cleaned (room 2 + equipment), 1 verified (equipment)
    expect(screen.getByText(/\/3 Cleaned/)).toBeInTheDocument();
    expect(screen.getByText(/\/3 Verified/)).toBeInTheDocument();
  });

  it('shows empty state when no BOM rooms or equipment configured', () => {
    currentRequirements = emptyRequirements;
    render(<CleaningPage />);
    expect(screen.getByText(/No rooms or equipment configured/)).toBeInTheDocument();
  });
});
