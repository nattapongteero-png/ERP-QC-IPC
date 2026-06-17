/**
 * Settings Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import SettingsPage from '@/app/settings/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
} from '../../../helpers/ui-test-utils';
import { SETTINGS_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock lucide-react icons
// Auto-stub EVERY lucide-react icon so the test never breaks when the page
// imports an icon the mock didn't list (the cause of widespread suite failures).
vi.mock('lucide-react', () => {
  const React = require('react');
  const make = (name: string) => Object.assign(
    (props: Record<string, unknown>) =>
      React.createElement('span', { 'data-testid': `icon-${name}`, ...props }),
    { displayName: name }
  );
  return new Proxy({}, {
    get: (_t: unknown, prop: string | symbol) => {
      if (prop === '__esModule') return true;
      if (prop === 'default') return make('default');
      return make(String(prop));
    },
  });
});

// Mock MainLayout
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
}));

// Mock Card components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <h3 data-testid="card-title">{children}</h3>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

// Mock PageHeader
vi.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{description}</p>
      {actions && <div data-testid="header-actions">{actions}</div>}
    </div>
  ),
}));

// Mock DxButton
vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick }: { text?: string; onClick?: () => void }) => (
    <button onClick={onClick} data-testid={`dx-button-${text?.replace(/\s+/g, '-')?.toLowerCase() || 'unnamed'}`}>{text}</button>
  ),
}));

// Mock DxTextBox
vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: ({ value }: { value?: string }) => <input data-testid="dx-text-box" defaultValue={value} />,
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('should render page description', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('System settings and configuration')).toBeInTheDocument();
      });
    });

    it('should render page header component', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<SettingsPage />);

      await waitFor(() => {
        // Page uses ResponsivePageHeader (from @/components/shared) which renders
        // the title inside an <h1> heading element.
        expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
      });
    });

    it('should render Save Settings button', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-button-save-settings')).toBeInTheDocument();
      });
    });
  });

  describe('Settings Sections', () => {
    it('should render Company Information section', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Company Information')).toBeInTheDocument();
      });
    });

    it('should render Regulatory Information section', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Regulatory Information')).toBeInTheDocument();
      });
    });

    it('should render Document Prefixes section', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Document Prefixes')).toBeInTheDocument();
      });
    });

    it('should render Integrations section', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Integrations')).toBeInTheDocument();
      });
    });
  });

  describe('Form Fields', () => {
    it('should render Company Name field labels', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Company Name (English)')).toBeInTheDocument();
        expect(screen.getByText('Company Name (Thai)')).toBeInTheDocument();
      });
    });

    it('should render Address field label', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Address')).toBeInTheDocument();
      });
    });

    it('should render Tax ID field label', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Tax ID')).toBeInTheDocument();
      });
    });

    it('should render FDA License field label', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('FDA License Number')).toBeInTheDocument();
      });
    });

    it('should render GMP Certificate field label', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('GMP Certificate Number')).toBeInTheDocument();
      });
    });
  });

  describe('Integration Links', () => {
    it('should render VMI Portal link', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('VMI Portal Connections')).toBeInTheDocument();
      });
    });

    it('should have correct href for VMI Portal link', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<SettingsPage />);

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /vmi portal connections/i });
        expect(link).toHaveAttribute('href', '/settings/vmi');
      });
    });
  });
});
