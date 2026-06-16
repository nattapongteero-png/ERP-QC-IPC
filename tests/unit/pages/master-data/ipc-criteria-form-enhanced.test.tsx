/**
 * Tests for enhanced IPC Criteria Form with dosageForm, criteriaType, tolerancePercent
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock next modules
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null, isLoading: false }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

// Mock DevExtreme components
vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, ...props }: any) => <button {...props}>{text}</button>,
}));
vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: ({ value, placeholder, ...props }: any) => <input value={value || ''} placeholder={placeholder} readOnly />,
}));
vi.mock('@/components/ui/dx-number-box', () => ({
  DxNumberBox: ({ value, placeholder, ...props }: any) => <input type="number" value={value ?? ''} placeholder={placeholder} readOnly />,
}));
vi.mock('@/components/ui/dx-switch', () => ({
  DxSwitch: ({ value, ...props }: any) => <input type="checkbox" checked={value} readOnly />,
}));
vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: ({ value, placeholder, ...props }: any) => <select value={value || ''}><option>{placeholder || value}</option></select>,
}));
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title }: any) => <h1>{title}</h1>,
}));

import { IPCCriteriaForm } from '@/components/master-data/IPCCriteriaForm';

describe('IPCCriteriaForm Enhanced', () => {
  it('renders without crashing in create mode', () => {
    render(<IPCCriteriaForm mode="create" />);
    expect(screen.getByText('New QC & IPC Criteria')).toBeDefined();
  });

  it('renders dosage form field', () => {
    render(<IPCCriteriaForm mode="create" />);
    // Use the full, unique label text — the short "รูปแบบยา" fragment also
    // appears inside SearchableSelect option labels, matching multiple nodes.
    expect(screen.getByText('รูปแบบยา (Dosage Form)')).toBeDefined();
  });

  it('renders criteria type field', () => {
    render(<IPCCriteriaForm mode="create" />);
    expect(screen.getByText(/ประเภทเกณฑ์/)).toBeDefined();
  });

  it('renders tolerance percent field', () => {
    render(<IPCCriteriaForm mode="create" />);
    expect(screen.getByText(/Tolerance ±%/)).toBeDefined();
  });

  it('renders Min/Max fields by default (numeric mode)', () => {
    render(<IPCCriteriaForm mode="create" />);
    expect(screen.getByText('Min Value')).toBeDefined();
    expect(screen.getByText('Max Value')).toBeDefined();
  });
});
