/**
 * Tests for IPC Criteria Form — Target + Spec Tolerance → auto-calculated Min/Max.
 *
 * Covers:
 *  - New Target (Specification) input renders
 *  - New ±% Tolerance (Spec Range) input renders (distinct from Sample Failure Tolerance)
 *  - When initial data has specTarget + specTolerancePercent, the auto-calculated
 *    Min/Max preview shows the correct formula result.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

// Provide a fake edit-mode record so we can seed specTarget + specTolerancePercent
const FAKE_RECORD = {
  id: 42,
  code: 'IPC-TEST',
  name: 'Weight Variation',
  nameTh: 'ความแปรผันของน้ำหนัก',
  testMethod: null,
  specification: null,
  minValue: null,
  maxValue: null,
  unit: 'mg',
  sampleSize: 10,
  checkIntervalMinutes: 30,
  isCritical: false,
  isActive: true,
  dosageForm: 'tablet',
  criteriaType: 'numeric',
  tolerancePercent: 0,
  specTarget: 300,
  specTolerancePercent: 5,
};

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: FAKE_RECORD, isLoading: false }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, ...props }: any) => <button {...props}>{text}</button>,
}));
vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: ({ value, placeholder }: any) => (
    <input value={value || ''} placeholder={placeholder} readOnly />
  ),
}));
vi.mock('@/components/ui/dx-number-box', () => ({
  DxNumberBox: ({ value, placeholder }: any) => (
    <input type="number" value={value ?? ''} placeholder={placeholder} readOnly />
  ),
}));
vi.mock('@/components/ui/dx-switch', () => ({
  DxSwitch: ({ value }: any) => <input type="checkbox" checked={value} readOnly />,
}));
vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: ({ value, placeholder }: any) => (
    <select value={value || ''}>
      <option>{placeholder || value}</option>
    </select>
  ),
}));
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title }: any) => <h1>{title}</h1>,
}));

import { IPCCriteriaForm } from '@/components/master-data/IPCCriteriaForm';

describe('IPCCriteriaForm — Spec Target + Tolerance', () => {
  it('renders Target (Specification) field', () => {
    render(<IPCCriteriaForm mode="edit" id={42} />);
    expect(screen.getByText(/Target \(Specification\)/i)).toBeDefined();
  });

  it('renders Spec Tolerance field distinct from Sample Failure Tolerance', () => {
    render(<IPCCriteriaForm mode="edit" id={42} />);
    // Spec tolerance (drives Min/Max)
    expect(screen.getByText(/Tolerance \(Spec Range\)/i)).toBeDefined();
    // Sample failure tolerance (batch acceptance)
    expect(screen.getByText(/Sample Failure Tolerance/i)).toBeDefined();
  });

  it('shows auto-calculated Min/Max from Target 300 and 5% tolerance', () => {
    render(<IPCCriteriaForm mode="edit" id={42} />);
    // 300 ± 5% → Min = 285, Max = 315
    const calcPreview = screen.getByText(/Auto-calculated/i);
    expect(calcPreview).toBeDefined();
    expect(calcPreview.textContent).toContain('285');
    expect(calcPreview.textContent).toContain('315');
  });

  it('marks Min/Max fields as auto-calculated when Target is set', () => {
    render(<IPCCriteriaForm mode="edit" id={42} />);
    // The "คำนวณอัตโนมัติ" (auto-calculated) label appears next to Min/Max
    const labels = screen.getAllByText(/คำนวณอัตโนมัติ/);
    expect(labels.length).toBeGreaterThanOrEqual(2); // one for Min, one for Max
  });
});
