/**
 * IPC (In-Process Control) Page Tests
 *
 * Verifies that:
 * 1. Page renders without crashing
 * 2. Shows "no BOM config" message when no config exists
 * 3. Shows progress card and test checklist when tests exist
 * 4. Shows initialize button when BOM config exists but no tests
 *
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ id: '71' }),
}));

// Control test data per test
let mockIPCTests: any[] = [];
let mockBOMConfig: any[] = [];
let mockWorkOrder: any = {
  id: 71, woNumber: 'WO2603301137', batchNumber: 'B2603001', productName: 'Test Product', status: 'in_progress',
};

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'work-order') {
      return { data: mockWorkOrder, isLoading: false };
    }
    if (queryKey[0] === 'wo-ipc-bom-config') {
      return { data: mockBOMConfig, isLoading: false };
    }
    if (queryKey[0] === 'wo-ipc-tests') {
      return { data: mockIPCTests, isLoading: false };
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

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'execution.ipc': 'In-Process Control (IPC)',
      'execution.title': 'Work Order Execution',
      'execution.ipcProgress': 'IPC Progress',
      'execution.testsCompleted': 'tests completed',
      'execution.approved': 'Approved',
      'execution.initializeIPCTests': 'Initialize IPC Tests',
      'execution.noIPCConfig': 'No IPC configuration found in BOM',
      'execution.noIPCConfigHint': 'Please configure IPC tests in the BOM first',
      'execution.ipcReadyToInit': 'Ready to initialize IPC tests',
      'execution.testsFromBOM': 'tests from BOM',
      'execution.record': 'Record',
      'execution.approve': 'Approve',
      'execution.range': 'Range',
      'execution.spec': 'Spec',
      'execution.samples': 'samples',
      'execution.sampleResults': 'Sample Results',
      'execution.notes': 'Notes',
      'execution.recordResult': 'Record Test Result',
      'execution.specRequirement': 'Spec Requirement',
      'execution.measuredValue': 'Measured Value',
      'execution.withinSpec': 'Within spec',
      'execution.outOfSpec': 'Out of spec',
      'execution.sampleValues': 'Sample Values',
      'execution.samplesPass': 'pass',
      'execution.notesPlaceholder': 'Additional notes (optional)',
      'execution.testedAt': 'Tested at',
      'execution.approvedAt': 'Approved at',
      'actions.edit': 'Edit',
      'actions.cancel': 'Cancel',
      'actions.save': 'Save',
    };
    return translations[key] || key;
  },
}));

// Mock DevExtreme components
vi.mock('devextreme/ui/notify', () => ({ default: vi.fn() }));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid={`btn-${text?.toLowerCase().replace(/\s+/g, '-')}`}>
      {text}
    </button>
  ),
}));

vi.mock('@/components/ui/dx-popup', () => ({
  DxPopup: ({ visible, children, title }: any) =>
    visible ? <div data-testid="popup" data-title={title}>{children}</div> : null,
}));

vi.mock('@/components/ui/dx-number-box', () => ({
  DxNumberBox: ({ value, onValueChanged }: any) => (
    <input type="number" value={value || ''} onChange={(e) => onValueChanged?.({ value: Number(e.target.value) })} />
  ),
}));

vi.mock('@/components/ui/dx-text-area', () => ({
  DxTextArea: ({ value, onValueChanged }: any) => (
    <textarea value={value || ''} onChange={(e) => onValueChanged?.({ value: e.target.value })} />
  ),
}));

vi.mock('@/components/ui/dx-load-indicator', () => ({
  DxLoadIndicator: () => <div data-testid="loading">Loading...</div>,
}));

vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title, subtitle }: any) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import IPCPage from '@/app/production/work-orders/[id]/ipc/page';

describe('IPC Page', () => {
  beforeEach(() => {
    mockIPCTests = [];
    mockBOMConfig = [];
    mockWorkOrder = {
      id: 71, woNumber: 'WO2603301137', batchNumber: 'B2603001', productName: 'Test Product', status: 'in_progress',
    };
  });

  it('renders page header', () => {
    render(<IPCPage />);
    expect(screen.getByTestId('page-header')).toBeDefined();
    expect(screen.getByText('In-Process Control (IPC)')).toBeDefined();
  });

  it('shows no BOM config message when no config exists', () => {
    mockBOMConfig = [];
    mockIPCTests = [];
    render(<IPCPage />);
    expect(screen.getByText('No IPC configuration found in BOM')).toBeDefined();
  });

  it('shows initialize button when BOM config exists but no tests', () => {
    mockBOMConfig = [
      { id: 1, bomId: 10, specId: 1, sequence: 1, sampleSize: 1, isCritical: false, testName: 'Blend Uniformity', testMethod: 'USP', specification: null, minValue: 95, maxValue: 105, unit: '%' },
    ];
    mockIPCTests = [];
    render(<IPCPage />);
    expect(screen.getByText('Initialize IPC Tests')).toBeDefined();
    expect(screen.getByText('Ready to initialize IPC tests')).toBeDefined();
  });

  it('shows test checklist when tests exist', () => {
    mockBOMConfig = [
      { id: 1, bomId: 10, specId: 1, sequence: 1, sampleSize: 1, isCritical: false, testName: 'Blend Uniformity', testMethod: 'USP', specification: null, minValue: 95, maxValue: 105, unit: '%' },
    ];
    mockIPCTests = [
      {
        id: 1, lotId: 100, specId: 1, testType: 'in_process', sampleNumber: null, sampleSize: 1,
        testDate: null, result: null, numericResult: null, status: 'pending',
        testedBy: null, approvedBy: null, approvedAt: null, notes: null,
        specMinValue: 95, specMaxValue: 105, specSpecification: null, specUnit: '%',
        disposition: null, testName: 'Blend Uniformity', testMethod: 'USP', samples: [],
      },
    ];
    render(<IPCPage />);
    expect(screen.getByText('Blend Uniformity')).toBeDefined();
    expect(screen.getByText('Pending')).toBeDefined();
    expect(screen.getByText('Record')).toBeDefined();
  });

  it('shows progress bar with correct count', () => {
    mockIPCTests = [
      {
        id: 1, lotId: 100, specId: 1, testType: 'in_process', sampleNumber: null, sampleSize: 1,
        testDate: '2026-04-01', result: 'pass', numericResult: 100, status: 'pass',
        testedBy: 1, approvedBy: null, approvedAt: null, notes: null,
        specMinValue: 95, specMaxValue: 105, specSpecification: null, specUnit: '%',
        disposition: null, testName: 'Blend Uniformity', testMethod: 'USP', samples: [],
      },
      {
        id: 2, lotId: 100, specId: 2, testType: 'in_process', sampleNumber: null, sampleSize: 3,
        testDate: null, result: null, numericResult: null, status: 'pending',
        testedBy: null, approvedBy: null, approvedAt: null, notes: null,
        specMinValue: 475, specMaxValue: 525, specSpecification: null, specUnit: 'mg',
        disposition: null, testName: 'Capsule Weight', testMethod: null, samples: [],
      },
    ];
    render(<IPCPage />);
    expect(screen.getByText('1/2 tests completed')).toBeDefined();
  });

  it('shows approve button for recorded tests', () => {
    mockIPCTests = [
      {
        id: 1, lotId: 100, specId: 1, testType: 'in_process', sampleNumber: null, sampleSize: 1,
        testDate: '2026-04-01', result: 'pass', numericResult: 100, status: 'pass',
        testedBy: 1, approvedBy: null, approvedAt: null, notes: null,
        specMinValue: 95, specMaxValue: 105, specSpecification: null, specUnit: '%',
        disposition: null, testName: 'Blend Uniformity', testMethod: 'USP', samples: [],
      },
    ];
    render(<IPCPage />);
    expect(screen.getByText('Approve')).toBeDefined();
  });

  it('shows approved badge for approved tests', () => {
    mockIPCTests = [
      {
        id: 1, lotId: 100, specId: 1, testType: 'in_process', sampleNumber: null, sampleSize: 1,
        testDate: '2026-04-01', result: 'pass', numericResult: 100, status: 'pass',
        testedBy: 1, approvedBy: 5, approvedAt: '2026-04-01', notes: null,
        specMinValue: 95, specMaxValue: 105, specSpecification: null, specUnit: '%',
        disposition: 'accept', testName: 'Blend Uniformity', testMethod: 'USP', samples: [],
      },
    ];
    render(<IPCPage />);
    // Should show "Approved" badge and NOT show approve/edit buttons
    const approvedBadges = screen.getAllByText('Approved');
    expect(approvedBadges.length).toBeGreaterThanOrEqual(1);
  });
});
