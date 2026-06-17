/**
 * UI Tests for QC Disposition Workflow
 * Feature: 009-gmp-compliance-gap-analysis Phase 7 (US15 - T095)
 *
 * Tests the QC Disposition workflow with dual sign-off:
 * - FR-067: Disposition Decision (accept, reject, rework, scrap, return_to_vendor, conditional_release)
 * - FR-068: Disposition Reason (mandatory for non-accept)
 * - FR-069: Auto Lot Status Update after approval
 * - FR-071-074: Electronic Signatures for disposition and approval (dual sign-off)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Next.js navigation
const mockPush = vi.fn();
const mockParams = { id: '1' };
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    prefetch: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => mockParams,
  useSearchParams: () => new URLSearchParams(),
}));

// Mock QC test data
const mockQCTest = {
  id: 1,
  lotId: 100,
  lotNumber: 'LOT-2024-001',
  itemName: 'Herbal Extract A',
  testType: 'identity',
  specification: 'Must pass identity test',
  testMethod: 'HPLC Analysis',
  result: 'fail',
  status: 'completed',
  testedAt: '2024-12-20T10:00:00Z',
  testedByName: 'Lab Analyst',
  notes: 'Identity test failed - unknown compound detected',
};

// Mock disposition data for different scenarios
const mockPendingDisposition = {
  test: mockQCTest,
  disposition: null,
  dispositionReason: null,
  dispositionAt: null,
  dispositionByName: null,
  dispositionApprovedAt: null,
  dispositionApprovedByName: null,
  status: 'pending' as const,
};

const mockDispositionedTest = {
  test: mockQCTest,
  disposition: 'reject' as const,
  dispositionReason: 'Failed identity test - material does not meet specifications',
  dispositionAt: '2024-12-20T14:00:00Z',
  dispositionByName: 'QC Analyst',
  dispositionApprovedAt: null,
  dispositionApprovedByName: null,
  status: 'dispositioned' as const,
};

const mockApprovedDisposition = {
  test: mockQCTest,
  disposition: 'reject' as const,
  dispositionReason: 'Failed identity test - material does not meet specifications',
  dispositionAt: '2024-12-20T14:00:00Z',
  dispositionByName: 'QC Analyst',
  dispositionApprovedAt: '2024-12-20T15:00:00Z',
  dispositionApprovedByName: 'QC Manager',
  status: 'approved' as const,
};

let currentDispositionData: typeof mockPendingDisposition | null = null;

// Mock TanStack Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey }) => {
    if (queryKey.includes('quality-test-details')) {
      return {
        data: mockQCTest,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    if (queryKey.includes('disposition-details')) {
      return {
        data: currentDispositionData,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    return {
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  }),
  useMutation: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}));

// Mock lucide-react icons (Proxy returns a stub for ANY icon name)
vi.mock('lucide-react', () => {
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

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock DevExtreme components
vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick, disabled, type }: { text: string; onClick?: () => void; disabled?: boolean; type?: string }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={`dx-button-${text.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and')}`}
      className={type === 'success' ? 'success-button' : ''}
    >
      {text}
    </button>
  ),
}));

vi.mock('devextreme-react/text-area', () => ({
  TextArea: ({ value, onValueChange, placeholder, disabled }: { value?: string; onValueChange?: (v: string) => void; placeholder?: string; disabled?: boolean }) => (
    <textarea
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      data-testid="dx-textarea"
    />
  ),
}));

vi.mock('devextreme-react/select-box', () => ({
  SelectBox: ({ dataSource, value, onValueChange, disabled }: { dataSource: Array<{value: string; label: string}>; value?: string; onValueChange?: (v: string) => void; disabled?: boolean }) => (
    <select
      value={value ?? ''}
      onChange={(e) => onValueChange?.(e.target.value)}
      disabled={disabled}
      data-testid="dx-select-box"
    >
      <option value="">Select...</option>
      {dataSource?.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('devextreme-react/popup', () => ({
  Popup: ({ visible, title, contentRender }: { visible: boolean; title: string; contentRender: () => React.ReactNode }) => (
    visible ? (
      <div data-testid="dx-popup" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {contentRender()}
      </div>
    ) : null
  ),
}));

vi.mock('devextreme-react/text-box', () => ({
  TextBox: ({ mode, value, onValueChange, placeholder, disabled }: { mode?: string; value?: string; onValueChange?: (v: string) => void; placeholder?: string; disabled?: boolean }) => (
    <input
      type={mode === 'password' ? 'password' : 'text'}
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      data-testid="dx-textbox"
    />
  ),
}));

// Mock custom UI components
vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick, disabled }: { text: string; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled} data-testid={`dx-btn-${text.toLowerCase().replace(/\s+/g, '-')}`}>
      {text}
    </button>
  ),
}));

// Mock layout components
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

vi.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {actions && <div data-testid="page-header-actions">{actions}</div>}
    </div>
  ),
}));

// Import components after mocks
import { DispositionForm, DispositionType } from '@/components/quality/disposition-form';
import { ElectronicSignatureDialog } from '@/components/shared/ElectronicSignatureDialog';

describe('Disposition Form Component', () => {
  const defaultProps = {
    testId: 1,
    testType: 'identity',
    testResult: 'fail',
    lotNumber: 'LOT-2024-001',
    itemName: 'Herbal Extract A',
    status: 'pending' as const,
    onSetDisposition: vi.fn().mockResolvedValue({ success: true }),
    onApprove: vi.fn().mockResolvedValue({ success: true }),
    canDisposition: true,
    canApprove: false,
    readOnly: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    currentDispositionData = null;
  });

  describe('Form Header', () => {
    it('should render form header with title', async () => {
      render(<DispositionForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Disposition Decision')).toBeInTheDocument();
      });
    });

    it('should display test type', async () => {
      render(<DispositionForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('identity')).toBeInTheDocument();
      });
    });

    it('should display lot number', async () => {
      render(<DispositionForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/LOT-2024-001/)).toBeInTheDocument();
      });
    });

    it('should display item name', async () => {
      render(<DispositionForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Herbal Extract A/)).toBeInTheDocument();
      });
    });
  });

  describe('Test Result Display', () => {
    it('should display FAIL badge for failed test', async () => {
      render(<DispositionForm {...defaultProps} testResult="fail" />);

      await waitFor(() => {
        expect(screen.getByText('FAIL')).toBeInTheDocument();
      });
    });

    it('should display PASS badge for passed test', async () => {
      render(<DispositionForm {...defaultProps} testResult="pass" />);

      await waitFor(() => {
        expect(screen.getByText('PASS')).toBeInTheDocument();
      });
    });

    it('should display PENDING badge for pending test', async () => {
      render(<DispositionForm {...defaultProps} testResult={null} />);

      await waitFor(() => {
        expect(screen.getByText('PENDING')).toBeInTheDocument();
      });
    });
  });

  describe('Status Badges', () => {
    it('should show "Pending Disposition" badge for pending status', async () => {
      render(<DispositionForm {...defaultProps} status="pending" />);

      await waitFor(() => {
        expect(screen.getByText('Pending Disposition')).toBeInTheDocument();
      });
    });

    it('should show "Awaiting Approval" badge for dispositioned status', async () => {
      render(
        <DispositionForm
          {...defaultProps}
          status="dispositioned"
          initialData={{ disposition: 'reject', dispositionReason: 'Test reason', dispositionAt: '2024-12-20', dispositionApprovedAt: null }}
          canDisposition={false}
          canApprove={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Awaiting Approval')).toBeInTheDocument();
      });
    });

    it('should show "Approved" badge for approved status', async () => {
      render(
        <DispositionForm
          {...defaultProps}
          status="approved"
          initialData={{ disposition: 'reject', dispositionReason: 'Test reason', dispositionAt: '2024-12-20', dispositionApprovedAt: '2024-12-20' }}
          canDisposition={false}
          canApprove={false}
          readOnly={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Approved')).toBeInTheDocument();
      });
    });
  });

  describe('FR-067: Disposition Type Selection', () => {
    it('should render all six disposition types for pending status', async () => {
      render(<DispositionForm {...defaultProps} status="pending" canDisposition={true} />);

      await waitFor(() => {
        expect(screen.getByText('Accept')).toBeInTheDocument();
        expect(screen.getByText('Reject')).toBeInTheDocument();
        expect(screen.getByText('Rework')).toBeInTheDocument();
        expect(screen.getByText('Scrap')).toBeInTheDocument();
        expect(screen.getByText('Return to Vendor')).toBeInTheDocument();
        expect(screen.getByText('Conditional Release')).toBeInTheDocument();
      });
    });

    it('should show descriptions for disposition types', async () => {
      render(<DispositionForm {...defaultProps} status="pending" canDisposition={true} />);

      await waitFor(() => {
        expect(screen.getByText('Material/product meets specifications and can be released')).toBeInTheDocument();
        expect(screen.getByText('Material/product does not meet specifications and cannot be used')).toBeInTheDocument();
        expect(screen.getByText('Material/product requires reprocessing to meet specifications')).toBeInTheDocument();
        expect(screen.getByText('Material/product must be destroyed')).toBeInTheDocument();
        expect(screen.getByText('Material to be returned to vendor for replacement or credit')).toBeInTheDocument();
        expect(screen.getByText('Release with specific conditions or restrictions attached')).toBeInTheDocument();
      });
    });

    it('should allow selecting a disposition type', async () => {
      render(<DispositionForm {...defaultProps} status="pending" canDisposition={true} />);

      await waitFor(() => {
        const rejectButton = screen.getByText('Reject').closest('button');
        expect(rejectButton).toBeInTheDocument();
        if (rejectButton) {
          fireEvent.click(rejectButton);
        }
      });
    });

    it('should not show disposition selector when already dispositioned', async () => {
      render(
        <DispositionForm
          {...defaultProps}
          status="dispositioned"
          initialData={{ disposition: 'reject', dispositionReason: 'Test reason', dispositionAt: '2024-12-20', dispositionApprovedAt: null }}
          canDisposition={false}
          canApprove={true}
        />
      );

      await waitFor(() => {
        // Should not show "Select Disposition" heading when not in disposition mode
        expect(screen.queryByText('Select Disposition')).not.toBeInTheDocument();
      });
    });
  });

  describe('FR-068: Disposition Reason', () => {
    it('should show reason textarea for non-accept dispositions', async () => {
      render(<DispositionForm {...defaultProps} status="pending" canDisposition={true} />);

      await waitFor(() => {
        expect(screen.getByText('Disposition Reason')).toBeInTheDocument();
        expect(screen.getByTestId('dx-textarea')).toBeInTheDocument();
      });
    });

    it('should show reason as required for reject disposition', async () => {
      render(<DispositionForm {...defaultProps} status="pending" canDisposition={true} />);

      // Select reject
      await waitFor(() => {
        const rejectButton = screen.getByText('Reject').closest('button');
        if (rejectButton) {
          fireEvent.click(rejectButton);
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/Reason is required for Reject disposition/)).toBeInTheDocument();
      });
    });

    it('should display existing disposition reason', async () => {
      render(
        <DispositionForm
          {...defaultProps}
          status="dispositioned"
          initialData={{
            disposition: 'reject',
            dispositionReason: 'Failed identity test - material contaminated',
            dispositionAt: '2024-12-20',
            dispositionApprovedAt: null,
          }}
          canDisposition={false}
          canApprove={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Failed identity test - material contaminated')).toBeInTheDocument();
      });
    });
  });

  describe('FR-071-074: Electronic Signatures', () => {
    it('should render Sign & Submit Disposition button', async () => {
      render(<DispositionForm {...defaultProps} status="pending" canDisposition={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-button-sign-and-submit-disposition')).toBeInTheDocument();
      });
    });

    it('should have submit button disabled when no disposition selected', async () => {
      render(<DispositionForm {...defaultProps} status="pending" canDisposition={true} />);

      await waitFor(() => {
        const submitButton = screen.getByTestId('dx-button-sign-and-submit-disposition');
        expect(submitButton).toBeDisabled();
      });
    });

    it('should render Approve & Sign button for approver', async () => {
      render(
        <DispositionForm
          {...defaultProps}
          status="dispositioned"
          initialData={{ disposition: 'reject', dispositionReason: 'Test', dispositionAt: '2024-12-20', dispositionApprovedAt: null }}
          canDisposition={false}
          canApprove={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('dx-button-approve-and-sign')).toBeInTheDocument();
      });
    });

    it('should display disposition signature info', async () => {
      render(
        <DispositionForm
          {...defaultProps}
          status="dispositioned"
          initialData={{ disposition: 'reject', dispositionReason: 'Test', dispositionAt: '2024-12-20T14:00:00Z', dispositionApprovedAt: null }}
          dispositionByName="QC Analyst John"
          canDisposition={false}
          canApprove={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Electronic Signatures')).toBeInTheDocument();
        expect(screen.getByText('Disposition by:')).toBeInTheDocument();
        expect(screen.getByText('QC Analyst John')).toBeInTheDocument();
      });
    });

    it('should display approval signature info', async () => {
      render(
        <DispositionForm
          {...defaultProps}
          status="approved"
          initialData={{
            disposition: 'reject',
            dispositionReason: 'Test',
            dispositionAt: '2024-12-20T14:00:00Z',
            dispositionApprovedAt: '2024-12-20T15:00:00Z',
          }}
          dispositionByName="QC Analyst"
          approvedByName="QC Manager Jane"
          canDisposition={false}
          canApprove={false}
          readOnly={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Approved by:')).toBeInTheDocument();
        expect(screen.getByText('QC Manager Jane')).toBeInTheDocument();
      });
    });
  });

  describe('Disposition Badges Display', () => {
    const dispositionTypes: DispositionType[] = ['accept', 'reject', 'rework', 'scrap', 'return_to_vendor', 'conditional_release'];
    const expectedLabels = ['Accept', 'Reject', 'Rework', 'Scrap', 'Return to Vendor', 'Conditional Release'];

    dispositionTypes.forEach((disposition, index) => {
      it(`should display ${expectedLabels[index]} badge for ${disposition} disposition`, async () => {
        render(
          <DispositionForm
            {...defaultProps}
            status="approved"
            initialData={{
              disposition,
              dispositionReason: disposition !== 'accept' ? 'Test reason' : null,
              dispositionAt: '2024-12-20',
              dispositionApprovedAt: '2024-12-20',
            }}
            canDisposition={false}
            canApprove={false}
            readOnly={true}
          />
        );

        await waitFor(() => {
          expect(screen.getByText(expectedLabels[index])).toBeInTheDocument();
        });
      });
    });
  });

  describe('Read-Only Mode', () => {
    it('should not render action buttons in read-only mode', async () => {
      render(
        <DispositionForm
          {...defaultProps}
          status="approved"
          initialData={{ disposition: 'reject', dispositionReason: 'Test', dispositionAt: '2024-12-20', dispositionApprovedAt: '2024-12-20' }}
          canDisposition={false}
          canApprove={false}
          readOnly={true}
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('dx-button-sign-and-submit-disposition')).not.toBeInTheDocument();
        expect(screen.queryByTestId('dx-button-approve-and-sign')).not.toBeInTheDocument();
      });
    });

    it('should not render disposition selector in read-only mode', async () => {
      render(
        <DispositionForm
          {...defaultProps}
          status="approved"
          initialData={{ disposition: 'reject', dispositionReason: 'Test', dispositionAt: '2024-12-20', dispositionApprovedAt: '2024-12-20' }}
          readOnly={true}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Select Disposition')).not.toBeInTheDocument();
      });
    });
  });

  describe('Approval Workflow', () => {
    it('should show approval notes textarea for approver', async () => {
      render(
        <DispositionForm
          {...defaultProps}
          status="dispositioned"
          initialData={{ disposition: 'reject', dispositionReason: 'Test', dispositionAt: '2024-12-20', dispositionApprovedAt: null }}
          canDisposition={false}
          canApprove={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Approval Notes (Optional)')).toBeInTheDocument();
      });
    });

    it('should display dual sign-off message for approver', async () => {
      render(
        <DispositionForm
          {...defaultProps}
          status="dispositioned"
          initialData={{ disposition: 'reject', dispositionReason: 'Test', dispositionAt: '2024-12-20', dispositionApprovedAt: null }}
          canDisposition={false}
          canApprove={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Review and approve the disposition/)).toBeInTheDocument();
      });
    });
  });
});

describe('Electronic Signature Dialog for Disposition', () => {
  const defaultProps = {
    visible: true,
    title: 'Disposition: Reject',
    action: 'disposition_decision',
    meaning: 'I have reviewed the QC test results and make the disposition decision: Reject. Reason: Failed identity test',
    onSign: vi.fn().mockResolvedValue({ success: true }),
    onCancel: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dialog Visibility', () => {
    it('should render dialog when visible is true', async () => {
      render(<ElectronicSignatureDialog {...defaultProps} visible={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-popup')).toBeInTheDocument();
      });
    });

    it('should not render dialog when visible is false', async () => {
      render(<ElectronicSignatureDialog {...defaultProps} visible={false} />);

      await waitFor(() => {
        expect(screen.queryByTestId('dx-popup')).not.toBeInTheDocument();
      });
    });
  });

  describe('Dialog Content', () => {
    it('should display 21 CFR Part 11 compliance notice', async () => {
      render(<ElectronicSignatureDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('21 CFR Part 11 Compliant Signature')).toBeInTheDocument();
      });
    });

    it('should display disposition signature meaning', async () => {
      render(<ElectronicSignatureDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Signature Meaning:')).toBeInTheDocument();
        expect(screen.getByText(/I have reviewed the QC test results/)).toBeInTheDocument();
      });
    });

    it('should display password input field', async () => {
      render(<ElectronicSignatureDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Enter Your Password to Sign')).toBeInTheDocument();
        expect(screen.getByTestId('dx-textbox')).toBeInTheDocument();
      });
    });
  });

  describe('Dialog Actions', () => {
    it('should render Cancel button', async () => {
      render(<ElectronicSignatureDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-button-cancel')).toBeInTheDocument();
      });
    });

    it('should render Sign button', async () => {
      render(<ElectronicSignatureDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-button-sign')).toBeInTheDocument();
      });
    });

    it('should have Sign button disabled when no password entered', async () => {
      render(<ElectronicSignatureDialog {...defaultProps} />);

      await waitFor(() => {
        const signButton = screen.getByTestId('dx-button-sign');
        expect(signButton).toBeDisabled();
      });
    });
  });

  describe('Approval Signature', () => {
    it('should display approval signature meaning', async () => {
      render(
        <ElectronicSignatureDialog
          {...defaultProps}
          title="Approve Disposition"
          action="disposition_approval"
          meaning="I approve the disposition decision and authorize the corresponding lot status update"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/I approve the disposition decision/)).toBeInTheDocument();
      });
    });
  });
});

describe('QC Disposition Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('FR-067: Complete Disposition Types', () => {
    it('should support all six disposition types in workflow', async () => {
      render(
        <DispositionForm
          testId={1}
          testType="identity"
          testResult="fail"
          lotNumber="LOT-001"
          itemName="Test Product"
          status="pending"
          onSetDisposition={vi.fn()}
          onApprove={vi.fn()}
          canDisposition={true}
          canApprove={false}
        />
      );

      await waitFor(() => {
        // Verify all disposition options are available
        expect(screen.getByText('Accept')).toBeInTheDocument();
        expect(screen.getByText('Reject')).toBeInTheDocument();
        expect(screen.getByText('Rework')).toBeInTheDocument();
        expect(screen.getByText('Scrap')).toBeInTheDocument();
        expect(screen.getByText('Return to Vendor')).toBeInTheDocument();
        expect(screen.getByText('Conditional Release')).toBeInTheDocument();
      });
    });
  });

  describe('FR-068: Reason Validation', () => {
    it('should require reason for non-accept dispositions', async () => {
      const setDispositionFn = vi.fn().mockResolvedValue({ success: true });
      render(
        <DispositionForm
          testId={1}
          testType="identity"
          testResult="fail"
          status="pending"
          onSetDisposition={setDispositionFn}
          onApprove={vi.fn()}
          canDisposition={true}
          canApprove={false}
        />
      );

      // Select reject without reason
      await waitFor(() => {
        const rejectButton = screen.getByText('Reject').closest('button');
        if (rejectButton) {
          fireEvent.click(rejectButton);
        }
      });

      // Submit button should be disabled (reason required)
      await waitFor(() => {
        const submitButton = screen.getByTestId('dx-button-sign-and-submit-disposition');
        expect(submitButton).toBeDisabled();
      });
    });

    it('should allow accept disposition without reason', async () => {
      render(
        <DispositionForm
          testId={1}
          testType="identity"
          testResult="pass"
          status="pending"
          onSetDisposition={vi.fn()}
          onApprove={vi.fn()}
          canDisposition={true}
          canApprove={false}
        />
      );

      // Select accept
      await waitFor(() => {
        const acceptButton = screen.getByText('Accept').closest('button');
        if (acceptButton) {
          fireEvent.click(acceptButton);
        }
      });

      // Submit button should be enabled (no reason required for accept)
      await waitFor(() => {
        const submitButton = screen.getByTestId('dx-button-sign-and-submit-disposition');
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('FR-069: Auto Lot Status Update Display', () => {
    it('should display disposition decision after setting', async () => {
      render(
        <DispositionForm
          testId={1}
          testType="identity"
          testResult="fail"
          status="dispositioned"
          initialData={{
            disposition: 'reject',
            dispositionReason: 'Material failed identity test - contamination detected',
            dispositionAt: '2024-12-20T14:00:00Z',
            dispositionApprovedAt: null,
          }}
          dispositionByName="QC Analyst"
          onSetDisposition={vi.fn()}
          onApprove={vi.fn()}
          canDisposition={false}
          canApprove={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Reject')).toBeInTheDocument();
        expect(screen.getByText('Material failed identity test - contamination detected')).toBeInTheDocument();
      });
    });
  });

  describe('FR-071-074: Dual Sign-Off Workflow', () => {
    it('should support analyst disposition (first signature)', async () => {
      render(
        <DispositionForm
          testId={1}
          testType="identity"
          testResult="fail"
          status="pending"
          onSetDisposition={vi.fn()}
          onApprove={vi.fn()}
          canDisposition={true}
          canApprove={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Pending Disposition')).toBeInTheDocument();
        expect(screen.getByTestId('dx-button-sign-and-submit-disposition')).toBeInTheDocument();
      });
    });

    it('should support manager approval (second signature)', async () => {
      render(
        <DispositionForm
          testId={1}
          testType="identity"
          testResult="fail"
          status="dispositioned"
          initialData={{
            disposition: 'reject',
            dispositionReason: 'Test reason',
            dispositionAt: '2024-12-20T14:00:00Z',
            dispositionApprovedAt: null,
          }}
          dispositionByName="QC Analyst"
          onSetDisposition={vi.fn()}
          onApprove={vi.fn()}
          canDisposition={false}
          canApprove={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Awaiting Approval')).toBeInTheDocument();
        expect(screen.getByTestId('dx-button-approve-and-sign')).toBeInTheDocument();
      });
    });

    it('should display complete signatures when approved', async () => {
      render(
        <DispositionForm
          testId={1}
          testType="identity"
          testResult="fail"
          status="approved"
          initialData={{
            disposition: 'reject',
            dispositionReason: 'Test reason',
            dispositionAt: '2024-12-20T14:00:00Z',
            dispositionApprovedAt: '2024-12-20T15:00:00Z',
          }}
          dispositionByName="QC Analyst John"
          approvedByName="QC Manager Jane"
          onSetDisposition={vi.fn()}
          onApprove={vi.fn()}
          canDisposition={false}
          canApprove={false}
          readOnly={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Approved')).toBeInTheDocument();
        expect(screen.getByText('QC Analyst John')).toBeInTheDocument();
        expect(screen.getByText('QC Manager Jane')).toBeInTheDocument();
      });
    });
  });

  describe('Complete Workflow Scenarios', () => {
    it('should handle accept disposition workflow', async () => {
      render(
        <DispositionForm
          testId={1}
          testType="identity"
          testResult="pass"
          status="approved"
          initialData={{
            disposition: 'accept',
            dispositionReason: null,
            dispositionAt: '2024-12-20T14:00:00Z',
            dispositionApprovedAt: '2024-12-20T15:00:00Z',
          }}
          dispositionByName="QC Analyst"
          approvedByName="QC Manager"
          onSetDisposition={vi.fn()}
          onApprove={vi.fn()}
          canDisposition={false}
          canApprove={false}
          readOnly={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Accept')).toBeInTheDocument();
        expect(screen.getByText('Approved')).toBeInTheDocument();
      });
    });

    it('should handle rework disposition workflow', async () => {
      render(
        <DispositionForm
          testId={1}
          testType="identity"
          testResult="fail"
          status="approved"
          initialData={{
            disposition: 'rework',
            dispositionReason: 'Material requires additional processing to remove impurities',
            dispositionAt: '2024-12-20T14:00:00Z',
            dispositionApprovedAt: '2024-12-20T15:00:00Z',
          }}
          dispositionByName="QC Analyst"
          approvedByName="QC Manager"
          onSetDisposition={vi.fn()}
          onApprove={vi.fn()}
          canDisposition={false}
          canApprove={false}
          readOnly={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Rework')).toBeInTheDocument();
        expect(screen.getByText('Material requires additional processing to remove impurities')).toBeInTheDocument();
      });
    });

    it('should handle conditional release workflow', async () => {
      render(
        <DispositionForm
          testId={1}
          testType="potency"
          testResult="fail"
          status="approved"
          initialData={{
            disposition: 'conditional_release',
            dispositionReason: 'Released with condition: Must be blended with compliant lot before use',
            dispositionAt: '2024-12-20T14:00:00Z',
            dispositionApprovedAt: '2024-12-20T15:00:00Z',
          }}
          dispositionByName="QC Analyst"
          approvedByName="QC Manager"
          onSetDisposition={vi.fn()}
          onApprove={vi.fn()}
          canDisposition={false}
          canApprove={false}
          readOnly={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Conditional Release')).toBeInTheDocument();
        expect(screen.getByText(/Released with condition/)).toBeInTheDocument();
      });
    });
  });
});
