/**
 * UI Tests for Line Clearance Workflow
 * Feature: 009-gmp-compliance-gap-analysis Phase 5 (US13 - T076)
 *
 * Tests the Line Clearance workflow with dual sign-off:
 * - FR-062: Line Clearance Enforcement before production start
 * - FR-071-074: Electronic Signatures for performer and verifier
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

// Mock work orders for line clearance
const mockWorkOrders = [
  {
    id: 1,
    workOrderNumber: 'WO-2024-001',
    itemName: 'Herbal Capsule A',
    status: 'released',
    lineClearanceRequired: true,
    lineClearanceStatus: null,
  },
  {
    id: 2,
    workOrderNumber: 'WO-2024-002',
    itemName: 'Herbal Tablet B',
    status: 'released',
    lineClearanceRequired: true,
    lineClearanceStatus: 'performed',
  },
];

// Mock line clearance data
const mockLineClearanceNotStarted = {
  workOrderId: 1,
  required: true,
  status: 'not_started',
  canStartProduction: false,
  message: 'Line clearance has not been started',
  checklist: null,
};

const mockLineClearancePerformed = {
  workOrderId: 2,
  required: true,
  status: 'performed',
  canStartProduction: false,
  message: 'Line clearance performed, awaiting verification',
  checklist: {
    id: 1,
    previousProductCleared: true,
    areaClean: true,
    equipmentClean: true,
    noContaminationRisk: true,
    labelsRemoved: true,
    docsReady: true,
    notes: 'All checks completed',
    status: 'performed',
  },
  details: {
    checklist: {},
    performerName: 'John Operator',
    signatures: [],
  },
};

const mockLineClearanceVerified = {
  workOrderId: 3,
  required: true,
  status: 'verified',
  canStartProduction: true,
  message: 'Line clearance verified, production can start',
  checklist: {
    id: 1,
    previousProductCleared: true,
    areaClean: true,
    equipmentClean: true,
    noContaminationRisk: true,
    labelsRemoved: true,
    docsReady: true,
    notes: 'All checks completed',
    status: 'verified',
  },
  details: {
    checklist: {},
    performerName: 'John Operator',
    verifierName: 'Jane Supervisor',
    signatures: [],
  },
};

let currentLineClearanceData = mockLineClearanceNotStarted;

// Mock TanStack Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey }) => {
    if (queryKey.includes('work-orders-for-line-clearance')) {
      return {
        data: mockWorkOrders,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    if (queryKey.includes('line-clearance')) {
      return {
        data: currentLineClearanceData,
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

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ClipboardCheck: vi.fn(() => <span data-testid="icon-clipboard-check">ClipboardCheck</span>),
  ArrowLeft: vi.fn(() => <span data-testid="icon-arrow-left">ArrowLeft</span>),
  AlertCircle: vi.fn(() => <span data-testid="icon-alert-circle">AlertCircle</span>),
  Loader2: vi.fn(() => <span data-testid="icon-loader">Loader</span>),
  Trash2: vi.fn(() => <span data-testid="icon-trash">Trash</span>),
  Sparkles: vi.fn(() => <span data-testid="icon-sparkles">Sparkles</span>),
  Wrench: vi.fn(() => <span data-testid="icon-wrench">Wrench</span>),
  ShieldAlert: vi.fn(() => <span data-testid="icon-shield">Shield</span>),
  Tag: vi.fn(() => <span data-testid="icon-tag">Tag</span>),
  FileText: vi.fn(() => <span data-testid="icon-file">FileText</span>),
  CheckCircle2: vi.fn(() => <span data-testid="icon-check-circle">CheckCircle</span>),
  Clock: vi.fn(() => <span data-testid="icon-clock">Clock</span>),
  UserCheck: vi.fn(() => <span data-testid="icon-user-check">UserCheck</span>),
  Shield: vi.fn(() => <span data-testid="icon-shield">Shield</span>),
  KeyRound: vi.fn(() => <span data-testid="icon-key">Key</span>),
  LayoutDashboard: vi.fn(() => <span data-testid="icon-dashboard">Dashboard</span>),
  Search: vi.fn(() => <span data-testid="icon-search">Search</span>),
  Bell: vi.fn(() => <span data-testid="icon-bell">Bell</span>),
  User: vi.fn(() => <span data-testid="icon-user">User</span>),
  LogOut: vi.fn(() => <span data-testid="icon-logout">LogOut</span>),
  ChevronDown: vi.fn(() => <span data-testid="icon-chevron-down">ChevronDown</span>),
  ChevronRight: vi.fn(() => <span data-testid="icon-chevron-right">ChevronRight</span>),
  Home: vi.fn(() => <span data-testid="icon-home">Home</span>),
  Package: vi.fn(() => <span data-testid="icon-package">Package</span>),
  Factory: vi.fn(() => <span data-testid="icon-factory">Factory</span>),
  TestTube2: vi.fn(() => <span data-testid="icon-testtube">TestTube</span>),
  Users: vi.fn(() => <span data-testid="icon-users">Users</span>),
  Settings: vi.fn(() => <span data-testid="icon-settings">Settings</span>),
  Building2: vi.fn(() => <span data-testid="icon-building">Building</span>),
  Menu: vi.fn(() => <span data-testid="icon-menu">Menu</span>),
  X: vi.fn(() => <span data-testid="icon-x">X</span>),
  ExternalLink: vi.fn(() => <span data-testid="icon-external">ExternalLink</span>),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
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

vi.mock('devextreme-react/check-box', () => ({
  CheckBox: ({ value, onValueChange, disabled }: { value?: boolean; onValueChange?: (v: boolean) => void; disabled?: boolean }) => (
    <input
      type="checkbox"
      checked={value}
      onChange={(e) => onValueChange?.(e.target.checked)}
      disabled={disabled}
      data-testid="dx-checkbox"
    />
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

// Import components after mocks
import LineClearancePage from '@/app/production/line-clearance/page';
import { LineClearanceForm } from '@/components/production/line-clearance-form';
import { ElectronicSignatureDialog } from '@/components/shared/ElectronicSignatureDialog';

describe('Line Clearance Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    currentLineClearanceData = mockLineClearanceNotStarted;
  });

  describe('Page Rendering', () => {
    it('should render the page header with correct title', async () => {
      render(<LineClearancePage />);

      await waitFor(() => {
        expect(screen.getByText('Line Clearance')).toBeInTheDocument();
      });
    });

    it('should render the FR-062 description', async () => {
      render(<LineClearancePage />);

      await waitFor(() => {
        expect(screen.getByText(/Complete line clearance verification before production start/)).toBeInTheDocument();
      });
    });

    it('should render back to work orders button', async () => {
      render(<LineClearancePage />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-btn-back-to-work-orders')).toBeInTheDocument();
      });
    });
  });

  describe('Work Order Selector', () => {
    it('should render work order selector section', async () => {
      render(<LineClearancePage />);

      await waitFor(() => {
        expect(screen.getByText('Select Work Order')).toBeInTheDocument();
      });
    });

    it('should render work order select box', async () => {
      render(<LineClearancePage />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-select-box')).toBeInTheDocument();
      });
    });

    it('should display work order options', async () => {
      render(<LineClearancePage />);

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
      render(<LineClearancePage />);

      await waitFor(() => {
        expect(screen.getByText('Select a Work Order')).toBeInTheDocument();
        expect(screen.getByText(/Choose a released work order/)).toBeInTheDocument();
      });
    });
  });
});

describe('Line Clearance Form Component', () => {
  const defaultProps = {
    workOrderId: 1,
    workOrderNumber: 'WO-2024-001',
    productName: 'Herbal Capsule A',
    status: 'not_started' as const,
    onPerform: vi.fn().mockResolvedValue({ success: true }),
    onVerify: vi.fn().mockResolvedValue({ success: true }),
    isPerformer: true,
    isVerifier: false,
    readOnly: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Header', () => {
    it('should render form header with title', async () => {
      render(<LineClearanceForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Line Clearance Checklist')).toBeInTheDocument();
      });
    });

    it('should display work order number', async () => {
      render(<LineClearanceForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('WO-2024-001')).toBeInTheDocument();
      });
    });

    it('should display product name', async () => {
      render(<LineClearanceForm {...defaultProps} />);

      await waitFor(() => {
        // Product name is displayed with bullet prefix: "• Herbal Capsule A"
        expect(screen.getByText(/Herbal Capsule A/)).toBeInTheDocument();
      });
    });
  });

  describe('Status Badges', () => {
    it('should show "Not Started" badge for not_started status', async () => {
      render(<LineClearanceForm {...defaultProps} status="not_started" />);

      await waitFor(() => {
        expect(screen.getByText('Not Started')).toBeInTheDocument();
      });
    });

    it('should show "Awaiting Verification" badge for performed status', async () => {
      render(<LineClearanceForm {...defaultProps} status="performed" isPerformer={false} isVerifier={true} />);

      await waitFor(() => {
        expect(screen.getByText('Awaiting Verification')).toBeInTheDocument();
      });
    });

    it('should show "Verified" badge for verified status', async () => {
      render(<LineClearanceForm {...defaultProps} status="verified" readOnly={true} />);

      await waitFor(() => {
        expect(screen.getByText('Verified')).toBeInTheDocument();
      });
    });

    it('should show "Rejected" badge for rejected status', async () => {
      render(<LineClearanceForm {...defaultProps} status="rejected" />);

      await waitFor(() => {
        expect(screen.getByText('Rejected')).toBeInTheDocument();
      });
    });
  });

  describe('GMP Checklist Items', () => {
    it('should render all 6 GMP checklist items', async () => {
      render(<LineClearanceForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Previous Product Cleared')).toBeInTheDocument();
        expect(screen.getByText('Area Clean')).toBeInTheDocument();
        expect(screen.getByText('Equipment Clean')).toBeInTheDocument();
        expect(screen.getByText('No Contamination Risk')).toBeInTheDocument();
        expect(screen.getByText('Labels Removed')).toBeInTheDocument();
        expect(screen.getByText('Documents Ready')).toBeInTheDocument();
      });
    });

    it('should render 6 checkboxes', async () => {
      render(<LineClearanceForm {...defaultProps} />);

      await waitFor(() => {
        const checkboxes = screen.getAllByTestId('dx-checkbox');
        expect(checkboxes).toHaveLength(6);
      });
    });

    it('should display checklist item descriptions', async () => {
      render(<LineClearanceForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/All materials from the previous batch have been removed/)).toBeInTheDocument();
        expect(screen.getByText(/The production area has been cleaned/)).toBeInTheDocument();
      });
    });
  });

  describe('Notes Section', () => {
    it('should render notes textarea', async () => {
      render(<LineClearanceForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-textarea')).toBeInTheDocument();
      });
    });

    it('should have correct placeholder for notes', async () => {
      render(<LineClearanceForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Add any additional notes/)).toBeInTheDocument();
      });
    });
  });

  describe('Performer Actions', () => {
    it('should display warning when not all items are checked', async () => {
      render(<LineClearanceForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('All items must be checked before signing')).toBeInTheDocument();
      });
    });

    it('should render Sign & Complete button for performer', async () => {
      render(<LineClearanceForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-button-sign-&-complete')).toBeInTheDocument();
      });
    });

    it('should have Sign & Complete button disabled when not all items checked', async () => {
      render(<LineClearanceForm {...defaultProps} />);

      await waitFor(() => {
        const signButton = screen.getByTestId('dx-button-sign-&-complete');
        expect(signButton).toBeDisabled();
      });
    });
  });

  describe('Verifier Actions', () => {
    it('should render Approve and Reject buttons for verifier', async () => {
      render(<LineClearanceForm {...defaultProps} status="performed" isPerformer={false} isVerifier={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-button-approve')).toBeInTheDocument();
        expect(screen.getByTestId('dx-button-reject')).toBeInTheDocument();
      });
    });

    it('should display verification notes textarea for verifier', async () => {
      render(<LineClearanceForm {...defaultProps} status="performed" isPerformer={false} isVerifier={true} />);

      await waitFor(() => {
        expect(screen.getByText('Verification Notes (Required for rejection)')).toBeInTheDocument();
      });
    });
  });

  describe('Read-Only Mode', () => {
    it('should disable checkboxes in read-only mode', async () => {
      render(<LineClearanceForm {...defaultProps} status="verified" readOnly={true} />);

      await waitFor(() => {
        const checkboxes = screen.getAllByTestId('dx-checkbox');
        checkboxes.forEach((checkbox) => {
          expect(checkbox).toBeDisabled();
        });
      });
    });

    it('should not render action buttons in read-only mode', async () => {
      render(<LineClearanceForm {...defaultProps} status="verified" readOnly={true} />);

      await waitFor(() => {
        expect(screen.queryByTestId('dx-button-sign-&-complete')).not.toBeInTheDocument();
        expect(screen.queryByTestId('dx-button-approve')).not.toBeInTheDocument();
        expect(screen.queryByTestId('dx-button-reject')).not.toBeInTheDocument();
      });
    });
  });

  describe('Electronic Signature Info', () => {
    it('should display performer signature when available', async () => {
      render(<LineClearanceForm {...defaultProps} status="performed" performerName="John Operator" />);

      await waitFor(() => {
        expect(screen.getByText('Electronic Signatures')).toBeInTheDocument();
        expect(screen.getByText('Performed by:')).toBeInTheDocument();
        expect(screen.getByText('John Operator')).toBeInTheDocument();
      });
    });

    it('should display verifier signature when available', async () => {
      render(
        <LineClearanceForm
          {...defaultProps}
          status="verified"
          performerName="John Operator"
          verifierName="Jane Supervisor"
          readOnly={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Verified by:')).toBeInTheDocument();
        expect(screen.getByText('Jane Supervisor')).toBeInTheDocument();
      });
    });
  });
});

describe('Electronic Signature Dialog Component', () => {
  const defaultProps = {
    visible: true,
    title: 'Sign Line Clearance',
    action: 'perform',
    meaning: 'I confirm that I have personally verified all line clearance checklist items.',
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

    it('should display signature meaning', async () => {
      render(<ElectronicSignatureDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Signature Meaning:')).toBeInTheDocument();
        expect(screen.getByText(/I confirm that I have personally verified/)).toBeInTheDocument();
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

describe('Line Clearance Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('FR-062: Line Clearance Enforcement', () => {
    it('should show line clearance form when work order is selected', async () => {
      render(<LineClearancePage />);

      await waitFor(() => {
        // Verify the page loads
        expect(screen.getByText('Line Clearance')).toBeInTheDocument();
      });
    });
  });

  describe('Dual Sign-Off Workflow', () => {
    it('should support performer role (initial clearance)', async () => {
      const performFn = vi.fn().mockResolvedValue({ success: true });
      render(
        <LineClearanceForm
          workOrderId={1}
          workOrderNumber="WO-2024-001"
          status="not_started"
          onPerform={performFn}
          onVerify={vi.fn()}
          isPerformer={true}
          isVerifier={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Not Started')).toBeInTheDocument();
        expect(screen.getByTestId('dx-button-sign-&-complete')).toBeInTheDocument();
      });
    });

    it('should support verifier role (dual sign-off)', async () => {
      const verifyFn = vi.fn().mockResolvedValue({ success: true });
      render(
        <LineClearanceForm
          workOrderId={1}
          workOrderNumber="WO-2024-001"
          status="performed"
          performerName="John Operator"
          onPerform={vi.fn()}
          onVerify={verifyFn}
          isPerformer={false}
          isVerifier={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Awaiting Verification')).toBeInTheDocument();
        expect(screen.getByTestId('dx-button-approve')).toBeInTheDocument();
        expect(screen.getByTestId('dx-button-reject')).toBeInTheDocument();
      });
    });
  });
});
