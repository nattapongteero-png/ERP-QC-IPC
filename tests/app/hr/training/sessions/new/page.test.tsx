// HR Training Sessions New Page UI Tests
// Tests for new training session page
// Feature: 007-hr-personnel-management - Training Sessions

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/toast';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/hr/training/sessions/new',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock DevExtreme components
vi.mock('devextreme-react/form', () => ({
  __esModule: true,
  default: React.forwardRef(({ children }: { children?: React.ReactNode }, _ref) => (
    <form data-testid="mock-form">{children}</form>
  )),
  SimpleItem: () => null,
  GroupItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  RequiredRule: () => null,
  FormRef: null,
}));

vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick, elementAttr, disabled }: {
    text?: string;
    onClick?: () => void;
    elementAttr?: Record<string, string>;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={elementAttr?.['data-testid']}
    >
      {text}
    </button>
  ),
}));

vi.mock('devextreme-react/load-indicator', () => ({
  LoadIndicator: () => <div data-testid="load-indicator">Loading...</div>,
}));

vi.mock('devextreme/ui/notify', () => ({
  default: vi.fn(),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
}

// Wrapper component for tests
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );
}

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock data for courses and employees dropdowns
const mockCourses = [
  { id: 1, code: 'GMP-001', name: 'GMP พื้นฐาน', isActive: true },
  { id: 2, code: 'SAFETY-001', name: 'ความปลอดภัย', isActive: true },
];

const mockEmployees = [
  { id: 1, employeeCode: 'EMP-001', firstName: 'สมชาย', lastName: 'ใจดี', isActive: true },
  { id: 2, employeeCode: 'EMP-002', firstName: 'สมหญิง', lastName: 'ใจงาม', isActive: true },
];

describe('NewSessionPage', () => {
  beforeEach(() => {
    mockFetch.mockReset();

    // Setup API mock responses for form dropdowns
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/hr/training/courses')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockCourses }),
        });
      }
      if (url.includes('/api/hr/employees')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockEmployees }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });
  });

  it('renders new session page without crashing', async () => {
    const NewSessionPage = (await import('@/app/hr/training/sessions/new/page')).default;

    render(
      <TestWrapper>
        <NewSessionPage />
      </TestWrapper>
    );

    // Check for create mode title "จัดอบรมใหม่"
    expect(screen.getByText(/จัดอบรมใหม่/)).toBeInTheDocument();
  });

  it('renders form title correctly', async () => {
    const NewSessionPage = (await import('@/app/hr/training/sessions/new/page')).default;

    render(
      <TestWrapper>
        <NewSessionPage />
      </TestWrapper>
    );

    // Check for the form card title
    expect(screen.getByText(/ข้อมูลการจัดอบรม/)).toBeInTheDocument();
  });

  it('renders submit button with data-testid', async () => {
    const NewSessionPage = (await import('@/app/hr/training/sessions/new/page')).default;

    render(
      <TestWrapper>
        <NewSessionPage />
      </TestWrapper>
    );

    // Check for submit button with data-testid
    const submitBtn = screen.getByTestId('session-submit-btn');
    expect(submitBtn).toBeInTheDocument();
  });

  it('renders cancel button', async () => {
    const NewSessionPage = (await import('@/app/hr/training/sessions/new/page')).default;

    render(
      <TestWrapper>
        <NewSessionPage />
      </TestWrapper>
    );

    // Check for cancel button
    expect(screen.getByText(/ยกเลิก/)).toBeInTheDocument();
  });

  it('renders save button text', async () => {
    const NewSessionPage = (await import('@/app/hr/training/sessions/new/page')).default;

    render(
      <TestWrapper>
        <NewSessionPage />
      </TestWrapper>
    );

    // Check for save button text
    expect(screen.getByText(/บันทึก/)).toBeInTheDocument();
  });
});

describe('TrainingSessionForm Component - Create Mode', () => {
  beforeEach(() => {
    mockFetch.mockReset();

    // Setup API mock responses for form dropdowns
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/hr/training/courses')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockCourses }),
        });
      }
      if (url.includes('/api/hr/employees')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockEmployees }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });
  });

  it('renders create mode form with correct title', async () => {
    const { TrainingSessionForm } = await import('@/components/hr/TrainingSessionForm');

    render(
      <TestWrapper>
        <TrainingSessionForm mode="create" />
      </TestWrapper>
    );

    // Check for create mode title
    expect(screen.getByText(/จัดอบรมใหม่/)).toBeInTheDocument();
  });

  it('renders form card section', async () => {
    const { TrainingSessionForm } = await import('@/components/hr/TrainingSessionForm');

    render(
      <TestWrapper>
        <TrainingSessionForm mode="create" />
      </TestWrapper>
    );

    // Check for form section header
    expect(screen.getByText(/ข้อมูลการจัดอบรม/)).toBeInTheDocument();
  });
});
