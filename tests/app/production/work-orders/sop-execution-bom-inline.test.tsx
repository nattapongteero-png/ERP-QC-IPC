/**
 * SOP Execution Page — Inline BOM Data Display Tests
 * Verifies that BOM SOP step config (instructions, equipment, parameters)
 * is shown directly inside each execution step card.
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ push: vi.fn() }),
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
    const t = (key: string, params?: Record<string, any>) => {
      const translations: Record<string, string> = {
        'bomConfiguration.step': `Step ${params?.sequence || ''}`,
        'bomConfiguration.instructions': 'Instructions',
        'bomConfiguration.equipment': 'Equipment',
        'bomConfiguration.parameters': 'Parameters',
        'execution.sopExecution': 'SOP Execution',
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

const mockSOPSteps = [
  {
    id: 1,
    bomStepId: 10,
    sequence: 1,
    stepName: 'Weighing',
    stepNameTh: 'ชั่งน้ำหนัก',
    instructions: 'Weigh all raw materials',
    instructionsTh: 'ชั่งวัตถุดิบทั้งหมด',
    expectedParameters: JSON.stringify({ temperature: 25, humidity: 50 }),
    actualParameters: null,
    equipmentIds: JSON.stringify([101, 102]),
    requiresVerification: true,
    status: 'pending' as const,
    operatorId: null,
    operatorName: null,
    startedAt: null,
    completedAt: null,
    verifierId: null,
    verifierName: null,
    notes: null,
  },
  {
    id: 2,
    bomStepId: 11,
    sequence: 2,
    stepName: 'Mixing',
    stepNameTh: 'ผสม',
    instructions: 'Mix ingredients',
    instructionsTh: 'ผสมส่วนผสม',
    expectedParameters: JSON.stringify({ speed: 200, duration: 60 }),
    actualParameters: JSON.stringify({ speed: 195, duration: 62 }),
    equipmentIds: JSON.stringify([102]),
    requiresVerification: true,
    status: 'completed' as const,
    operatorId: 1,
    operatorName: 'Operator A',
    startedAt: '2026-03-25T08:00:00',
    completedAt: '2026-03-25T09:00:00',
    verifierId: null,
    verifierName: null,
    notes: null,
  },
];

const mockBomConfigWithEquipment = {
  bomId: 1,
  rooms: [],
  equipment: [
    { id: 1, equipmentId: 101, phase: 'production', equipmentCode: 'SCL-01', equipmentName: 'Digital Scale', equipmentNameTh: 'เครื่องชั่งดิจิตอล', sequence: 1 },
    { id: 2, equipmentId: 102, phase: 'production', equipmentCode: 'MIX-01', equipmentName: 'Industrial Mixer', equipmentNameTh: 'เครื่องผสมอุตสาหกรรม', sequence: 2 },
  ],
  environmentalConditions: [],
  sopSteps: [] as any[],
  packagingQC: [],
};

// Mutable test state
let currentSOPSteps: any[] = mockSOPSteps;
let currentBomConfig: any = mockBomConfigWithEquipment;

// Mock TanStack Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: any) => {
    if (queryKey[0] === 'work-order') {
      return { data: mockWorkOrder, isLoading: false };
    }
    if (queryKey[0] === 'wo-sop-execution') {
      return { data: currentSOPSteps, isLoading: false };
    }
    if (queryKey[0] === 'wo-bom-config') {
      return { data: currentBomConfig, isLoading: false };
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
import SOPExecutionPage from '@/app/production/work-orders/[id]/sop-execution/page';

describe('SOP Execution — Inline BOM Data', () => {
  beforeEach(() => {
    mockLocale = 'en';
    currentSOPSteps = mockSOPSteps;
    currentBomConfig = { ...mockBomConfigWithEquipment, sopSteps: [] };
    vi.clearAllMocks();
  });

  it('renders step names from BOM', () => {
    render(<SOPExecutionPage />);
    expect(screen.getByText(/Weighing/)).toBeInTheDocument();
    expect(screen.getByText(/Mixing/)).toBeInTheDocument();
  });

  it('shows BOM instructions in each step card', () => {
    render(<SOPExecutionPage />);
    expect(screen.getByText('Weigh all raw materials')).toBeInTheDocument();
    expect(screen.getByText('Mix ingredients')).toBeInTheDocument();
  });

  it('shows Thai step names as secondary text (in EN locale)', () => {
    render(<SOPExecutionPage />);
    expect(screen.getByText('ชั่งน้ำหนัก')).toBeInTheDocument();
    expect(screen.getByText('ผสม')).toBeInTheDocument();
  });

  it('shows equipment names resolved from BOM config', () => {
    render(<SOPExecutionPage />);
    // Step 1 uses equipment 101 (SCL-01) and 102 (MIX-01)
    expect(screen.getAllByText(/SCL-01/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Digital Scale/).length).toBeGreaterThanOrEqual(1);
    // Step 2 uses equipment 102 (MIX-01)
    expect(screen.getAllByText(/MIX-01/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows expected parameters from BOM', () => {
    render(<SOPExecutionPage />);
    // Step 1: temperature 25, humidity 50
    expect(screen.getByText(/temperature/)).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    // Step 2: speed 200, duration 60 — appears in both expected and actual
    expect(screen.getAllByText(/speed/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/duration/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows actual parameters with deviation highlighting when completed', () => {
    render(<SOPExecutionPage />);
    // Step 2 has actual: speed 195 (expected 200 = deviation), duration 62 (expected 60 = deviation)
    expect(screen.getByText('195')).toBeInTheDocument();
    expect(screen.getByText('62')).toBeInTheDocument();
    // Should show expected value in deviation indicator
    expect(screen.getByText(/exp: 200/)).toBeInTheDocument();
    expect(screen.getByText(/exp: 60/)).toBeInTheDocument();
  });

  it('shows Thai instructions as primary text when locale is th', () => {
    mockLocale = 'th';
    render(<SOPExecutionPage />);
    // Thai instructions should be shown
    expect(screen.getByText('ชั่งวัตถุดิบทั้งหมด')).toBeInTheDocument();
    expect(screen.getByText('ผสมส่วนผสม')).toBeInTheDocument();
  });

  it('shows progress card with correct counts', () => {
    render(<SOPExecutionPage />);
    // 2 total, 1 completed (step 2), 0 verified
    expect(screen.getByText(/\/2 Completed/)).toBeInTheDocument();
    expect(screen.getByText(/\/2 Verified/)).toBeInTheDocument();
  });

  it('shows Initialize button when BOM has SOP steps but execution not initialized', () => {
    currentSOPSteps = []; // No execution records
    currentBomConfig = {
      ...mockBomConfigWithEquipment,
      sopSteps: [
        { id: 1, sequence: 1, stepName: 'Weighing', stepNameTh: '', instructions: '', instructionsTh: '', parameters: null, equipmentIds: null, requiresVerification: true },
      ],
    };
    render(<SOPExecutionPage />);
    expect(screen.getByText(/BOM มีขั้นตอน SOP 1 ขั้นตอน/)).toBeInTheDocument();
    expect(screen.getByText('Initialize SOP Execution')).toBeInTheDocument();
  });

  it('shows "No SOP steps configured" when BOM has no SOP steps at all', () => {
    currentSOPSteps = []; // No execution records
    currentBomConfig = { ...mockBomConfigWithEquipment, sopSteps: [] }; // No BOM steps either
    render(<SOPExecutionPage />);
    expect(screen.getByText(/No SOP steps configured/)).toBeInTheDocument();
    expect(screen.queryByText('Initialize SOP Execution')).not.toBeInTheDocument();
  });
});
