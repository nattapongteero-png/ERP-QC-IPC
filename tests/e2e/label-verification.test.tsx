/**
 * UI Tests for Label Verification Workflow
 * Feature: 009-gmp-compliance-gap-analysis Phase 6 (US14 - T085)
 *
 * Tests the Label Verification workflow with dual sign-off:
 * - FR-064: Label Image Attachment to batch record
 * - FR-065: Dual Label Verification (operator + witness)
 * - FR-071-074: Electronic Signatures for operator and witness
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Next.js navigation
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

// Mock work orders for label verification
const mockWorkOrders = [
  {
    id: 1,
    workOrderNumber: 'WO-2024-001',
    itemName: 'Herbal Capsule A',
    status: 'in_progress',
  },
  {
    id: 2,
    workOrderNumber: 'WO-2024-002',
    itemName: 'Herbal Tablet B',
    status: 'released',
  },
];

// Mock labels data
const mockLabels = [
  {
    label: {
      id: 1,
      workOrderId: 1,
      batchRecordId: null,
      labelType: 'product_label',
      imageAttachmentId: null,
      productName: 'Herbal Capsule A',
      batchNumber: 'BATCH-001',
      expiryDate: '2025-12-31',
      isCorrect: null,
      status: 'pending',
      rejectionReason: null,
    },
    operatorName: undefined,
    witnessName: undefined,
    signatures: [],
  },
  {
    label: {
      id: 2,
      workOrderId: 1,
      batchRecordId: null,
      labelType: 'batch_label',
      imageAttachmentId: null,
      productName: 'Herbal Capsule A',
      batchNumber: 'BATCH-001',
      expiryDate: '2025-12-31',
      isCorrect: true,
      status: 'verified',
      rejectionReason: null,
    },
    operatorName: 'John Operator',
    witnessName: undefined,
    signatures: [
      {
        id: 1,
        action: 'verify_approve',
        fullName: 'John Operator',
        signedAt: '2024-12-20T10:00:00Z',
        meaning: 'Label content verified as correct',
      },
    ],
  },
  {
    label: {
      id: 3,
      workOrderId: 1,
      batchRecordId: null,
      labelType: 'carton_label',
      imageAttachmentId: null,
      productName: 'Herbal Capsule A',
      batchNumber: 'BATCH-001',
      expiryDate: '2025-12-31',
      isCorrect: true,
      status: 'witnessed',
      rejectionReason: null,
    },
    operatorName: 'John Operator',
    witnessName: 'Jane Supervisor',
    signatures: [
      {
        id: 1,
        action: 'verify_approve',
        fullName: 'John Operator',
        signedAt: '2024-12-20T10:00:00Z',
        meaning: 'Label content verified as correct',
      },
      {
        id: 2,
        action: 'witness',
        fullName: 'Jane Supervisor',
        signedAt: '2024-12-20T11:00:00Z',
        meaning: 'Label verification witnessed and confirmed',
      },
    ],
  },
];

// Mock label data for different scenarios
const mockPendingLabel = {
  label: {
    id: 1,
    workOrderId: 1,
    batchRecordId: null,
    labelType: 'product_label' as const,
    imageAttachmentId: null,
    productName: 'Herbal Capsule A',
    batchNumber: 'BATCH-001',
    expiryDate: '2025-12-31',
    isCorrect: null,
    status: 'pending' as const,
    rejectionReason: null,
  },
  operatorName: undefined,
  witnessName: undefined,
  signatures: [],
};

const mockVerifiedLabel = {
  label: {
    id: 2,
    workOrderId: 1,
    batchRecordId: null,
    labelType: 'batch_label' as const,
    imageAttachmentId: null,
    productName: 'Herbal Capsule A',
    batchNumber: 'BATCH-001',
    expiryDate: '2025-12-31',
    isCorrect: true,
    status: 'verified' as const,
    rejectionReason: null,
  },
  operatorName: 'John Operator',
  witnessName: undefined,
  signatures: [],
};

const mockWitnessedLabel = {
  label: {
    id: 3,
    workOrderId: 1,
    batchRecordId: null,
    labelType: 'carton_label' as const,
    imageAttachmentId: null,
    productName: 'Herbal Capsule A',
    batchNumber: 'BATCH-001',
    expiryDate: '2025-12-31',
    isCorrect: true,
    status: 'witnessed' as const,
    rejectionReason: null,
  },
  operatorName: 'John Operator',
  witnessName: 'Jane Supervisor',
  signatures: [],
};

const mockRejectedLabel = {
  label: {
    id: 4,
    workOrderId: 1,
    batchRecordId: null,
    labelType: 'shipper_label' as const,
    imageAttachmentId: null,
    productName: 'Herbal Capsule A',
    batchNumber: 'BATCH-001',
    expiryDate: '2025-12-31',
    isCorrect: false,
    status: 'rejected' as const,
    rejectionReason: 'Incorrect batch number printed',
  },
  operatorName: 'John Operator',
  witnessName: undefined,
  signatures: [],
};

let currentLabelData: typeof mockPendingLabel | null = null;

// Mock TanStack Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey }) => {
    if (queryKey.includes('work-orders-for-labels')) {
      return {
        data: mockWorkOrders,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    if (queryKey.includes('labels-for-work-order')) {
      return {
        data: mockLabels,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    if (queryKey.includes('label-details')) {
      return {
        data: currentLabelData,
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
    mutateAsync: vi.fn().mockResolvedValue({ success: true, data: { label: { id: 1 } } }),
    isPending: false,
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}));

// Mock lucide-react icons — Proxy returns a stub for ANY icon name so a newly
// imported icon can never fail the mock.
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

// Mock useToast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
    dismiss: vi.fn(),
    toasts: [],
  }),
}));

// Mock DevExtreme components
vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick, disabled }: { text: string; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled} data-testid={`dx-button-${text.toLowerCase().replace(/\s+/g, '-')}`}>
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
  SelectBox: ({ dataSource, value, onValueChange, disabled, displayExpr, valueExpr }: { dataSource: Array<{value: string; label: string}>; value?: string; onValueChange?: (v: string) => void; disabled?: boolean; displayExpr?: string; valueExpr?: string }) => (
    <select
      value={value ?? ''}
      onChange={(e) => onValueChange?.(e.target.value)}
      disabled={disabled}
      data-testid="dx-select-box-label-type"
    >
      <option value="">Select...</option>
      {dataSource.map((item) => (
        <option key={(item as Record<string, string>)[valueExpr || 'value']} value={(item as Record<string, string>)[valueExpr || 'value']}>
          {(item as Record<string, string>)[displayExpr || 'label']}
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

vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: ({ items, value, onValueChange, placeholder, disabled }: { items: Array<{value: number; label: string}>; value?: number; onValueChange?: (v: number) => void; placeholder?: string; disabled?: boolean }) => (
    <select
      value={value ?? ''}
      onChange={(e) => onValueChange?.(Number(e.target.value))}
      disabled={disabled}
      data-testid="dx-select-box"
    >
      <option value="">{placeholder}</option>
      {items.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
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

// Mock DocumentAttachment component
vi.mock('@/components/ui/document-attachment', () => ({
  DocumentAttachment: ({ title, readOnly }: { moduleName: string; entityId: number; title: string; readOnly?: boolean }) => (
    <div data-testid="document-attachment">
      <span>{title}</span>
      {readOnly && <span>Read Only</span>}
    </div>
  ),
}));

// Import components after mocks
import LabelVerificationPage from '@/app/production/label-verification/page';
import { LabelVerificationForm } from '@/components/production/label-verification-form';
import { ElectronicSignatureDialog } from '@/components/shared/ElectronicSignatureDialog';

describe('Label Verification Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    currentLabelData = null;
  });

  describe('Page Rendering', () => {
    it('should render the page header with correct title', async () => {
      render(<LabelVerificationPage />);

      await waitFor(() => {
        expect(screen.getByText('Label Verification')).toBeInTheDocument();
      });
    });

    it('should render the FR-064/FR-065 description', async () => {
      render(<LabelVerificationPage />);

      await waitFor(() => {
        expect(screen.getByText(/Verify and witness label content with dual electronic signatures/)).toBeInTheDocument();
      });
    });

    it('should render back to work orders button', async () => {
      render(<LabelVerificationPage />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-btn-back-to-work-orders')).toBeInTheDocument();
      });
    });
  });

  describe('Work Order Selector', () => {
    it('should render work order selector section', async () => {
      render(<LabelVerificationPage />);

      await waitFor(() => {
        expect(screen.getByText('Select Work Order')).toBeInTheDocument();
      });
    });

    it('should render work order select box', async () => {
      render(<LabelVerificationPage />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-select-box')).toBeInTheDocument();
      });
    });

    it('should display work order options', async () => {
      render(<LabelVerificationPage />);

      await waitFor(() => {
        const selectBox = screen.getByTestId('dx-select-box');
        expect(selectBox).toBeInTheDocument();
        expect(screen.getByText('WO-2024-001 - Herbal Capsule A')).toBeInTheDocument();
        expect(screen.getByText('WO-2024-002 - Herbal Tablet B')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no work order is selected', async () => {
      render(<LabelVerificationPage />);

      await waitFor(() => {
        expect(screen.getByText('Select a Work Order')).toBeInTheDocument();
        expect(screen.getByText(/Choose a work order from the dropdown/)).toBeInTheDocument();
      });
    });
  });
});

describe('Label Verification Form Component', () => {
  const defaultProps = {
    workOrderId: 1,
    workOrderNumber: 'WO-2024-001',
    productName: 'Herbal Capsule A',
    status: 'pending' as const,
    onVerify: vi.fn().mockResolvedValue({ success: true }),
    onWitness: vi.fn().mockResolvedValue({ success: true }),
    onCreate: vi.fn().mockResolvedValue({ success: true, labelId: 1 }),
    isOperator: true,
    isWitness: false,
    readOnly: false,
    labelId: 1,
    labelType: 'product_label' as const,
    onLabelTypeChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Header', () => {
    it('should render form header with title', async () => {
      render(<LabelVerificationForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Label Verification')).toBeInTheDocument();
      });
    });

    it('should display work order number', async () => {
      render(<LabelVerificationForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('WO-2024-001')).toBeInTheDocument();
      });
    });

    it('should display product name', async () => {
      render(<LabelVerificationForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Herbal Capsule A/)).toBeInTheDocument();
      });
    });
  });

  describe('Status Badges', () => {
    it('should show "Pending Verification" badge for pending status', async () => {
      render(<LabelVerificationForm {...defaultProps} status="pending" />);

      await waitFor(() => {
        expect(screen.getByText('Pending Verification')).toBeInTheDocument();
      });
    });

    it('should show "Awaiting Witness" badge for verified status', async () => {
      render(<LabelVerificationForm {...defaultProps} status="verified" isOperator={false} isWitness={true} />);

      await waitFor(() => {
        expect(screen.getByText('Awaiting Witness')).toBeInTheDocument();
      });
    });

    it('should show "Verified & Witnessed" badge for witnessed status', async () => {
      render(<LabelVerificationForm {...defaultProps} status="witnessed" readOnly={true} />);

      await waitFor(() => {
        expect(screen.getByText('Verified & Witnessed')).toBeInTheDocument();
      });
    });

    it('should show "Rejected" badge for rejected status', async () => {
      render(
        <LabelVerificationForm
          {...defaultProps}
          status="rejected"
          initialData={{ ...mockRejectedLabel.label }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Rejected')).toBeInTheDocument();
      });
    });
  });

  describe('Label Type Selection', () => {
    it('should render label type selector when no label exists', async () => {
      render(<LabelVerificationForm {...defaultProps} labelId={undefined} />);

      await waitFor(() => {
        expect(screen.getByText('Select Label Type')).toBeInTheDocument();
      });
    });

    it('should render Create Label Record button when onCreate is provided', async () => {
      render(<LabelVerificationForm {...defaultProps} labelId={undefined} />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-button-create-label-record')).toBeInTheDocument();
      });
    });
  });

  describe('Document Attachment', () => {
    it('should render document attachment component for label images', async () => {
      render(<LabelVerificationForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('document-attachment')).toBeInTheDocument();
        expect(screen.getByText('Label Images')).toBeInTheDocument();
      });
    });
  });

  describe('Rejection Reason Input', () => {
    it('should render rejection reason textarea for operator', async () => {
      render(<LabelVerificationForm {...defaultProps} status="pending" isOperator={true} />);

      await waitFor(() => {
        expect(screen.getByText('Rejection Reason (if label is incorrect)')).toBeInTheDocument();
        expect(screen.getByTestId('dx-textarea')).toBeInTheDocument();
      });
    });

    it('should not render rejection reason textarea when not operator', async () => {
      render(<LabelVerificationForm {...defaultProps} status="verified" isOperator={false} isWitness={true} />);

      await waitFor(() => {
        expect(screen.queryByText('Rejection Reason (if label is incorrect)')).not.toBeInTheDocument();
      });
    });
  });

  describe('Rejection Display', () => {
    it('should display rejection reason for rejected labels', async () => {
      render(
        <LabelVerificationForm
          {...defaultProps}
          status="rejected"
          initialData={{ ...mockRejectedLabel.label }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Rejection Reason')).toBeInTheDocument();
        expect(screen.getByText('Incorrect batch number printed')).toBeInTheDocument();
      });
    });
  });

  describe('Operator Actions', () => {
    it('should render Verify Correct button for operator', async () => {
      render(<LabelVerificationForm {...defaultProps} status="pending" isOperator={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-button-verify-correct')).toBeInTheDocument();
      });
    });

    it('should render Reject button for operator', async () => {
      render(<LabelVerificationForm {...defaultProps} status="pending" isOperator={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-button-reject')).toBeInTheDocument();
      });
    });

    it('should have Reject button disabled when no rejection reason', async () => {
      render(<LabelVerificationForm {...defaultProps} status="pending" isOperator={true} />);

      await waitFor(() => {
        const rejectButton = screen.getByTestId('dx-button-reject');
        expect(rejectButton).toBeDisabled();
      });
    });
  });

  describe('Witness Actions', () => {
    it('should render Witness & Confirm button for witness', async () => {
      render(
        <LabelVerificationForm
          {...defaultProps}
          status="verified"
          isOperator={false}
          isWitness={true}
          operatorName="John Operator"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('dx-button-witness-&-confirm')).toBeInTheDocument();
      });
    });

    it('should display dual sign-off message for witness', async () => {
      render(
        <LabelVerificationForm
          {...defaultProps}
          status="verified"
          isOperator={false}
          isWitness={true}
          operatorName="John Operator"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Review and witness the verification/)).toBeInTheDocument();
      });
    });
  });

  describe('Read-Only Mode', () => {
    it('should not render action buttons in read-only mode', async () => {
      render(<LabelVerificationForm {...defaultProps} status="witnessed" readOnly={true} />);

      await waitFor(() => {
        expect(screen.queryByTestId('dx-button-verify-correct')).not.toBeInTheDocument();
        expect(screen.queryByTestId('dx-button-reject')).not.toBeInTheDocument();
        expect(screen.queryByTestId('dx-button-witness-&-confirm')).not.toBeInTheDocument();
      });
    });
  });

  describe('Electronic Signature Info', () => {
    it('should display operator signature when available', async () => {
      render(
        <LabelVerificationForm
          {...defaultProps}
          status="verified"
          operatorName="John Operator"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Electronic Signatures')).toBeInTheDocument();
        expect(screen.getByText('Verified by:')).toBeInTheDocument();
        expect(screen.getByText('John Operator')).toBeInTheDocument();
      });
    });

    it('should display witness signature when available', async () => {
      render(
        <LabelVerificationForm
          {...defaultProps}
          status="witnessed"
          operatorName="John Operator"
          witnessName="Jane Supervisor"
          readOnly={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Witnessed by:')).toBeInTheDocument();
        expect(screen.getByText('Jane Supervisor')).toBeInTheDocument();
      });
    });
  });
});

describe('Electronic Signature Dialog for Label Verification', () => {
  const defaultProps = {
    visible: true,
    title: 'Verify Label - Correct',
    action: 'verify_approve',
    meaning: 'I verify that the label content is correct and matches the product specifications.',
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

    it('should display label verification signature meaning', async () => {
      render(<ElectronicSignatureDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Signature Meaning:')).toBeInTheDocument();
        expect(screen.getByText(/I verify that the label content is correct/)).toBeInTheDocument();
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
});

describe('Label Verification Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('FR-064: Label Image Attachment', () => {
    it('should display document attachment for label images', async () => {
      render(
        <LabelVerificationForm
          workOrderId={1}
          workOrderNumber="WO-2024-001"
          status="pending"
          onVerify={vi.fn()}
          onWitness={vi.fn()}
          isOperator={true}
          isWitness={false}
          labelId={1}
          labelType="product_label"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('document-attachment')).toBeInTheDocument();
        expect(screen.getByText('Label Images')).toBeInTheDocument();
      });
    });
  });

  describe('FR-065: Dual Label Verification', () => {
    it('should support operator role (initial verification)', async () => {
      const verifyFn = vi.fn().mockResolvedValue({ success: true });
      render(
        <LabelVerificationForm
          workOrderId={1}
          workOrderNumber="WO-2024-001"
          status="pending"
          onVerify={verifyFn}
          onWitness={vi.fn()}
          isOperator={true}
          isWitness={false}
          labelId={1}
          labelType="product_label"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Pending Verification')).toBeInTheDocument();
        expect(screen.getByTestId('dx-button-verify-correct')).toBeInTheDocument();
        expect(screen.getByTestId('dx-button-reject')).toBeInTheDocument();
      });
    });

    it('should support witness role (dual sign-off)', async () => {
      const witnessFn = vi.fn().mockResolvedValue({ success: true });
      render(
        <LabelVerificationForm
          workOrderId={1}
          workOrderNumber="WO-2024-001"
          status="verified"
          operatorName="John Operator"
          onVerify={vi.fn()}
          onWitness={witnessFn}
          isOperator={false}
          isWitness={true}
          labelId={1}
          labelType="product_label"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Awaiting Witness')).toBeInTheDocument();
        expect(screen.getByTestId('dx-button-witness-&-confirm')).toBeInTheDocument();
      });
    });

    it('should display complete verification when witnessed', async () => {
      render(
        <LabelVerificationForm
          workOrderId={1}
          workOrderNumber="WO-2024-001"
          status="witnessed"
          operatorName="John Operator"
          witnessName="Jane Supervisor"
          onVerify={vi.fn()}
          onWitness={vi.fn()}
          isOperator={false}
          isWitness={false}
          readOnly={true}
          labelId={1}
          labelType="product_label"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Verified & Witnessed')).toBeInTheDocument();
        expect(screen.getByText('John Operator')).toBeInTheDocument();
        expect(screen.getByText('Jane Supervisor')).toBeInTheDocument();
      });
    });
  });

  describe('Label Types Support', () => {
    it('should render all four label types in selector', async () => {
      render(
        <LabelVerificationForm
          workOrderId={1}
          workOrderNumber="WO-2024-001"
          status="pending"
          onVerify={vi.fn()}
          onWitness={vi.fn()}
          onCreate={vi.fn()}
          isOperator={true}
          isWitness={false}
          labelId={undefined}
          labelType="product_label"
          onLabelTypeChange={vi.fn()}
        />
      );

      await waitFor(() => {
        const selectBox = screen.getByTestId('dx-select-box-label-type');
        expect(selectBox).toBeInTheDocument();
        expect(screen.getByText('Product Label')).toBeInTheDocument();
        expect(screen.getByText('Batch Label')).toBeInTheDocument();
        expect(screen.getByText('Carton Label')).toBeInTheDocument();
        expect(screen.getByText('Shipper Label')).toBeInTheDocument();
      });
    });
  });

  describe('Rejection Workflow', () => {
    it('should support label rejection with reason', async () => {
      const verifyFn = vi.fn().mockResolvedValue({ success: true });
      render(
        <LabelVerificationForm
          workOrderId={1}
          workOrderNumber="WO-2024-001"
          status="pending"
          onVerify={verifyFn}
          onWitness={vi.fn()}
          isOperator={true}
          isWitness={false}
          labelId={1}
          labelType="product_label"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Rejection Reason (if label is incorrect)')).toBeInTheDocument();

        // Reject button should be disabled initially
        const rejectButton = screen.getByTestId('dx-button-reject');
        expect(rejectButton).toBeDisabled();
      });

      // Enter a rejection reason
      const textarea = screen.getByTestId('dx-textarea');
      fireEvent.change(textarea, { target: { value: 'Incorrect batch number' } });

      await waitFor(() => {
        // Reject button should now be enabled
        const rejectButton = screen.getByTestId('dx-button-reject');
        expect(rejectButton).not.toBeDisabled();
      });
    });

    it('should display rejection reason for rejected labels', async () => {
      render(
        <LabelVerificationForm
          workOrderId={1}
          workOrderNumber="WO-2024-001"
          status="rejected"
          onVerify={vi.fn()}
          onWitness={vi.fn()}
          isOperator={false}
          isWitness={false}
          readOnly={true}
          labelId={1}
          labelType="shipper_label"
          initialData={mockRejectedLabel.label}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Rejected')).toBeInTheDocument();
        expect(screen.getByText('Rejection Reason')).toBeInTheDocument();
        expect(screen.getByText('Incorrect batch number printed')).toBeInTheDocument();
      });
    });
  });
});
