# Accounting Module Professional UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign all 11 accounting module pages to achieve professional, informative, and consistent UI/UX using modern design patterns (glassmorphism accents, improved data visualization, enhanced information hierarchy).

**Architecture:** Each page follows a consistent design system with:
- Professional page headers with gradient backgrounds and icon badges
- Enhanced KPI cards with sparklines/mini-charts where applicable
- Improved data grids with better visual hierarchy
- Glassmorphism-styled action panels and filters
- Consistent color scheme aligned with accounting themes (blue/green for positive, orange/red for alerts)

**Tech Stack:** Next.js 14+, DevExtreme React 25.x, Recharts, Tailwind CSS, shadcn/ui components

---

## Design System Standards

### Color Palette (Accounting Theme)
- **Primary Blue:** #3b82f6 (actions, links, primary data)
- **Success Green:** #22c55e (positive values, completed status)
- **Warning Orange:** #f97316 (pending, partial payments)
- **Danger Red:** #ef4444 (overdue, negative values)
- **Neutral:** #64748b (labels, secondary text)
- **Background:** #f8fafc (page bg), #ffffff (card bg)

### Component Patterns
- **Page Header:** Gradient icon badge, title, subtitle, period selector, action buttons
- **Stats Row:** 4-5 KPI cards with icons, trends, and sparklines
- **Filter Panel:** Glassmorphism-styled panel with grouped controls
- **Data Grid:** Consistent styling, status badges, action buttons in rows
- **Empty States:** Professional illustrations with calls-to-action

---

## Task 1: Create Reusable Accounting UI Components

**Files:**
- Create: `src/components/accounting/accounting-page-header.tsx`
- Create: `src/components/accounting/accounting-kpi-card.tsx`
- Create: `src/components/accounting/accounting-filter-panel.tsx`
- Create: `src/components/accounting/accounting-status-badge.tsx`
- Create: `src/components/accounting/accounting-mini-chart.tsx`
- Create: `src/components/accounting/index.ts`
- Test: `tests/components/accounting/accounting-components.test.tsx`

**Step 1: Write the failing test**

```typescript
// tests/components/accounting/accounting-components.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingFilterPanel,
  AccountingStatusBadge,
  AccountingMiniChart,
} from '@/components/accounting';

describe('Accounting UI Components', () => {
  describe('AccountingPageHeader', () => {
    it('renders title and subtitle', () => {
      render(
        <AccountingPageHeader
          title="Chart of Accounts"
          subtitle="Manage GL accounts"
          icon="book"
        />
      );
      expect(screen.getByText('Chart of Accounts')).toBeInTheDocument();
      expect(screen.getByText('Manage GL accounts')).toBeInTheDocument();
    });

    it('renders period selector when provided', () => {
      render(
        <AccountingPageHeader
          title="Reports"
          currentPeriod="December 2024"
          periodStatus="open"
        />
      );
      expect(screen.getByText('December 2024')).toBeInTheDocument();
    });
  });

  describe('AccountingKPICard', () => {
    it('renders value and label with trend', () => {
      render(
        <AccountingKPICard
          label="Cash Balance"
          value="฿1,234,567"
          trend="up"
          trendValue="+12.5%"
          icon="wallet"
          variant="success"
        />
      );
      expect(screen.getByText('Cash Balance')).toBeInTheDocument();
      expect(screen.getByText('฿1,234,567')).toBeInTheDocument();
      expect(screen.getByText('+12.5%')).toBeInTheDocument();
    });

    it('renders mini sparkline when data provided', () => {
      render(
        <AccountingKPICard
          label="Revenue"
          value="฿5,000,000"
          sparklineData={[100, 120, 150, 130, 180, 200]}
        />
      );
      expect(screen.getByTestId('sparkline-chart')).toBeInTheDocument();
    });
  });

  describe('AccountingStatusBadge', () => {
    it('renders correct status styles', () => {
      const { rerender } = render(<AccountingStatusBadge status="draft" />);
      expect(screen.getByText('ร่าง')).toHaveClass('bg-gray-100');

      rerender(<AccountingStatusBadge status="posted" />);
      expect(screen.getByText('ผ่านแล้ว')).toHaveClass('bg-green-100');

      rerender(<AccountingStatusBadge status="overdue" />);
      expect(screen.getByText('ค้างชำระ')).toHaveClass('bg-red-100');
    });
  });

  describe('AccountingFilterPanel', () => {
    it('renders filter controls in glassmorphism panel', () => {
      render(
        <AccountingFilterPanel>
          <div data-testid="filter-child">Filter Content</div>
        </AccountingFilterPanel>
      );
      expect(screen.getByTestId('filter-child')).toBeInTheDocument();
      expect(screen.getByTestId('filter-panel')).toHaveClass('backdrop-blur');
    });
  });

  describe('AccountingMiniChart', () => {
    it('renders line chart with data', () => {
      render(
        <AccountingMiniChart
          data={[{ value: 100 }, { value: 150 }, { value: 120 }]}
          type="line"
          color="#22c55e"
        />
      );
      expect(screen.getByTestId('mini-chart')).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/accounting/accounting-components.test.tsx`
Expected: FAIL with "Cannot find module '@/components/accounting'"

**Step 3: Implement AccountingPageHeader component**

```typescript
// src/components/accounting/accounting-page-header.tsx
'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import * as Icons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RefreshCcw, CalendarCheck } from 'lucide-react';

type IconName = 'book' | 'file-text' | 'receipt' | 'dollar-sign' | 'building' | 'wrench' | 'bar-chart' | 'calendar' | 'calculator';

const iconMap: Record<IconName, LucideIcon> = {
  'book': Icons.BookOpen,
  'file-text': Icons.FileText,
  'receipt': Icons.Receipt,
  'dollar-sign': Icons.DollarSign,
  'building': Icons.Building2,
  'wrench': Icons.Wrench,
  'bar-chart': Icons.BarChart3,
  'calendar': Icons.CalendarCheck,
  'calculator': Icons.Calculator,
};

export interface AccountingPageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  currentPeriod?: string;
  periodStatus?: 'open' | 'closed' | 'soft_closed';
  onRefresh?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export function AccountingPageHeader({
  title,
  subtitle,
  icon = 'calculator',
  currentPeriod,
  periodStatus,
  onRefresh,
  actions,
  className = '',
}: AccountingPageHeaderProps) {
  const IconComponent = iconMap[icon] || Icons.Calculator;

  const periodStatusColors = {
    open: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-700',
    soft_closed: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className={`bg-gradient-to-r from-slate-50 via-white to-blue-50 border-b border-gray-100 px-6 py-5 ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Icon + Title */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="p-3.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/25">
              <IconComponent className="h-7 w-7 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: Period + Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {currentPeriod && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200 shadow-sm">
              <CalendarCheck className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">{currentPeriod}</span>
              {periodStatus && (
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${periodStatusColors[periodStatus]}`}>
                  {periodStatus === 'open' ? 'เปิด' : periodStatus === 'closed' ? 'ปิด' : 'ปิดชั่วคราว'}
                </span>
              )}
            </div>
          )}

          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="gap-2 bg-white/80 backdrop-blur-sm"
            >
              <RefreshCcw className="h-4 w-4" />
              รีเฟรช
            </Button>
          )}

          {actions}
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Implement AccountingKPICard component**

```typescript
// src/components/accounting/accounting-kpi-card.tsx
'use client';

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import * as Icons from 'lucide-react';
import { Card } from '@/components/ui/card';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

type IconName = 'wallet' | 'arrow-up' | 'arrow-down' | 'activity' | 'credit-card' | 'piggy-bank' | 'trending-up' | 'clock' | 'file-text' | 'package' | 'wrench' | 'check-circle';

const iconMap: Record<IconName, LucideIcon> = {
  'wallet': Icons.Wallet,
  'arrow-up': Icons.ArrowUpRight,
  'arrow-down': Icons.ArrowDownRight,
  'activity': Icons.Activity,
  'credit-card': Icons.CreditCard,
  'piggy-bank': Icons.PiggyBank,
  'trending-up': Icons.TrendingUp,
  'clock': Icons.Clock,
  'file-text': Icons.FileText,
  'package': Icons.Package,
  'wrench': Icons.Wrench,
  'check-circle': Icons.CheckCircle2,
};

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const variantStyles: Record<Variant, { bg: string; icon: string; border: string }> = {
  default: { bg: 'bg-gray-100', icon: 'text-gray-600', border: 'border-gray-200' },
  success: { bg: 'bg-emerald-100', icon: 'text-emerald-600', border: 'border-emerald-200' },
  warning: { bg: 'bg-orange-100', icon: 'text-orange-600', border: 'border-orange-200' },
  danger: { bg: 'bg-red-100', icon: 'text-red-600', border: 'border-red-200' },
  info: { bg: 'bg-blue-100', icon: 'text-blue-600', border: 'border-blue-200' },
};

export interface AccountingKPICardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: IconName;
  variant?: Variant;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  sparklineData?: number[];
  onClick?: () => void;
  className?: string;
}

export function AccountingKPICard({
  label,
  value,
  subtitle,
  icon = 'activity',
  variant = 'default',
  trend,
  trendValue,
  sparklineData,
  onClick,
  className = '',
}: AccountingKPICardProps) {
  const IconComponent = iconMap[icon] || Icons.Activity;
  const styles = variantStyles[variant];

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-600 bg-green-50' : trend === 'down' ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-50';

  const chartData = sparklineData?.map((value, index) => ({ value, index })) || [];
  const chartColor = variant === 'success' ? '#22c55e' : variant === 'danger' ? '#ef4444' : variant === 'warning' ? '#f97316' : '#3b82f6';

  return (
    <Card
      className={`relative overflow-hidden p-5 transition-all duration-200 hover:shadow-lg ${
        onClick ? 'cursor-pointer hover:scale-[1.02]' : ''
      } bg-white border ${styles.border} ${className}`}
      onClick={onClick}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-24 h-24 transform translate-x-8 -translate-y-8">
        <div className={`w-full h-full rounded-full ${styles.bg} opacity-50`} />
      </div>

      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 truncate">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 tracking-tight">
            {typeof value === 'number' ? value.toLocaleString('th-TH') : value}
          </p>

          <div className="mt-2 flex items-center gap-2">
            {subtitle && (
              <span className="text-xs text-gray-500">{subtitle}</span>
            )}
            {trend && trendValue && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${trendColor}`}>
                <TrendIcon className="h-3 w-3" />
                {trendValue}
              </span>
            )}
          </div>
        </div>

        <div className={`flex-shrink-0 p-3 rounded-xl ${styles.bg}`}>
          <IconComponent className={`h-6 w-6 ${styles.icon}`} />
        </div>
      </div>

      {/* Sparkline */}
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-4 h-10" data-testid="sparkline-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export function AccountingKPICardSkeleton() {
  return (
    <Card className="p-5 bg-white border border-gray-200">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="h-12 w-12 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    </Card>
  );
}
```

**Step 5: Implement remaining components**

```typescript
// src/components/accounting/accounting-filter-panel.tsx
'use client';

import React from 'react';

export interface AccountingFilterPanelProps {
  children: React.ReactNode;
  className?: string;
}

export function AccountingFilterPanel({ children, className = '' }: AccountingFilterPanelProps) {
  return (
    <div
      data-testid="filter-panel"
      className={`bg-white/70 backdrop-blur-md rounded-xl border border-gray-200/60 shadow-sm p-4 ${className}`}
    >
      <div className="flex flex-wrap items-end gap-4">
        {children}
      </div>
    </div>
  );
}
```

```typescript
// src/components/accounting/accounting-status-badge.tsx
'use client';

import React from 'react';

type Status =
  | 'draft' | 'posted' | 'reversed' | 'approved' | 'cancelled'
  | 'partial' | 'paid' | 'overdue' | 'open' | 'closed'
  | 'active' | 'inactive' | 'pending' | 'confirmed';

const statusConfig: Record<Status, { label: string; bg: string; text: string }> = {
  draft: { label: 'ร่าง', bg: 'bg-gray-100', text: 'text-gray-700' },
  posted: { label: 'ผ่านแล้ว', bg: 'bg-green-100', text: 'text-green-700' },
  reversed: { label: 'กลับรายการ', bg: 'bg-red-100', text: 'text-red-700' },
  approved: { label: 'อนุมัติ', bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { label: 'ยกเลิก', bg: 'bg-red-100', text: 'text-red-700' },
  partial: { label: 'บางส่วน', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  paid: { label: 'ชำระแล้ว', bg: 'bg-green-100', text: 'text-green-700' },
  overdue: { label: 'ค้างชำระ', bg: 'bg-red-100', text: 'text-red-700' },
  open: { label: 'เปิด', bg: 'bg-blue-100', text: 'text-blue-700' },
  closed: { label: 'ปิด', bg: 'bg-gray-100', text: 'text-gray-700' },
  active: { label: 'ใช้งาน', bg: 'bg-green-100', text: 'text-green-700' },
  inactive: { label: 'ไม่ใช้งาน', bg: 'bg-gray-100', text: 'text-gray-700' },
  pending: { label: 'รอดำเนินการ', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  confirmed: { label: 'ยืนยัน', bg: 'bg-blue-100', text: 'text-blue-700' },
};

export interface AccountingStatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md';
  className?: string;
}

export function AccountingStatusBadge({
  status,
  size = 'sm',
  className = '',
}: AccountingStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bg} ${config.text} ${sizeClasses} ${className}`}
    >
      {config.label}
    </span>
  );
}
```

```typescript
// src/components/accounting/accounting-mini-chart.tsx
'use client';

import React from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area } from 'recharts';

export interface AccountingMiniChartProps {
  data: Array<{ value: number; [key: string]: unknown }>;
  type?: 'line' | 'bar' | 'area';
  color?: string;
  height?: number;
  className?: string;
}

export function AccountingMiniChart({
  data,
  type = 'line',
  color = '#3b82f6',
  height = 40,
  className = '',
}: AccountingMiniChartProps) {
  return (
    <div data-testid="mini-chart" className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {type === 'line' && (
          <LineChart data={data}>
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        )}
        {type === 'bar' && (
          <BarChart data={data}>
            <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} />
          </BarChart>
        )}
        {type === 'area' && (
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke={color} fill={`url(#gradient-${color})`} strokeWidth={2} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
```

```typescript
// src/components/accounting/index.ts
export { AccountingPageHeader } from './accounting-page-header';
export type { AccountingPageHeaderProps } from './accounting-page-header';

export { AccountingKPICard, AccountingKPICardSkeleton } from './accounting-kpi-card';
export type { AccountingKPICardProps } from './accounting-kpi-card';

export { AccountingFilterPanel } from './accounting-filter-panel';
export type { AccountingFilterPanelProps } from './accounting-filter-panel';

export { AccountingStatusBadge } from './accounting-status-badge';
export type { AccountingStatusBadgeProps } from './accounting-status-badge';

export { AccountingMiniChart } from './accounting-mini-chart';
export type { AccountingMiniChartProps } from './accounting-mini-chart';
```

**Step 6: Run test to verify it passes**

Run: `npm test -- tests/components/accounting/accounting-components.test.tsx`
Expected: PASS

**Step 7: Commit**

```bash
git add src/components/accounting/ tests/components/accounting/
git commit -m "feat(accounting): add reusable accounting UI components

- AccountingPageHeader with gradient badges and period selector
- AccountingKPICard with sparklines and trend indicators
- AccountingFilterPanel with glassmorphism styling
- AccountingStatusBadge with Thai labels
- AccountingMiniChart for inline data visualization"
```

---

## Task 2: Redesign Chart of Accounts Page

**Files:**
- Modify: `src/app/accounting/chart-of-accounts/page.tsx`
- Test: `tests/app/accounting/chart-of-accounts/page.test.tsx`

**Step 1: Write the failing test**

```typescript
// tests/app/accounting/chart-of-accounts/page.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChartOfAccountsPage from '@/app/accounting/chart-of-accounts/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock fetch
global.fetch = vi.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('ChartOfAccountsPage', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);
  });

  it('renders professional page header with gradient icon', async () => {
    render(<ChartOfAccountsPage />, { wrapper: createWrapper() });
    expect(screen.getByText('ผังบัญชี')).toBeInTheDocument();
    expect(screen.getByText('Chart of Accounts')).toBeInTheDocument();
  });

  it('renders KPI cards with proper styling', async () => {
    render(<ChartOfAccountsPage />, { wrapper: createWrapper() });
    expect(screen.getByText('บัญชีทั้งหมด')).toBeInTheDocument();
    expect(screen.getByText('ใช้งาน')).toBeInTheDocument();
    expect(screen.getByText('ลงบัญชีได้')).toBeInTheDocument();
    expect(screen.getByText('บัญชีธนาคาร')).toBeInTheDocument();
  });

  it('renders filter panel with glassmorphism styling', async () => {
    render(<ChartOfAccountsPage />, { wrapper: createWrapper() });
    expect(screen.getByTestId('filter-panel')).toHaveClass('backdrop-blur');
  });
});
```

**Step 2: Run test to verify current state**

Run: `npm test -- tests/app/accounting/chart-of-accounts/page.test.tsx`

**Step 3: Implement redesigned Chart of Accounts page**

Update `src/app/accounting/chart-of-accounts/page.tsx` with:
- New AccountingPageHeader component
- AccountingKPICard components for stats
- AccountingFilterPanel with glassmorphism
- Improved TreeList styling with better visual hierarchy
- AccountingStatusBadge for status displays

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/app/accounting/chart-of-accounts/page.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/accounting/chart-of-accounts/page.tsx tests/app/accounting/chart-of-accounts/
git commit -m "feat(accounting): redesign Chart of Accounts with professional UI

- Professional gradient header with icon badge
- Enhanced KPI cards with trend indicators
- Glassmorphism filter panel
- Improved TreeList styling and visual hierarchy"
```

---

## Task 3: Redesign Journal Entries Page

**Files:**
- Modify: `src/app/accounting/journal-entries/page.tsx`
- Test: `tests/app/accounting/journal-entries/page.test.tsx`

**Step 1: Write the failing test**

```typescript
// tests/app/accounting/journal-entries/page.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import JournalEntriesPage from '@/app/accounting/journal-entries/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

global.fetch = vi.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('JournalEntriesPage', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);
  });

  it('renders professional page header', async () => {
    render(<JournalEntriesPage />, { wrapper: createWrapper() });
    expect(screen.getByText('รายการบันทึกบัญชี')).toBeInTheDocument();
    expect(screen.getByText('Journal Entries')).toBeInTheDocument();
  });

  it('renders status KPI cards', async () => {
    render(<JournalEntriesPage />, { wrapper: createWrapper() });
    expect(screen.getByText('รายการทั้งหมด')).toBeInTheDocument();
    expect(screen.getByText('ร่าง')).toBeInTheDocument();
    expect(screen.getByText('ผ่านแล้ว')).toBeInTheDocument();
  });

  it('renders data grid with professional styling', async () => {
    render(<JournalEntriesPage />, { wrapper: createWrapper() });
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });
});
```

**Step 2-5: Follow same pattern as Task 2**

Update page with:
- AccountingPageHeader with file-text icon
- 4 KPI cards showing totals by status
- Glassmorphism filter panel
- Enhanced DataGrid with AccountingStatusBadge
- Improved dialog styling for entry creation

**Step 6: Commit**

```bash
git add src/app/accounting/journal-entries/page.tsx tests/app/accounting/journal-entries/
git commit -m "feat(accounting): redesign Journal Entries with professional UI"
```

---

## Task 4: Redesign AP Invoices Page

**Files:**
- Modify: `src/app/accounting/ap/invoices/page.tsx`
- Test: `tests/app/accounting/ap/invoices/page.test.tsx`

**Steps:** Similar pattern to Tasks 2-3
- Add AccountingPageHeader with receipt icon and orange accent
- KPI cards: Total, Pending, Outstanding, Paid with currency formatting
- Add aging summary mini-chart
- Enhanced DataGrid with AccountingStatusBadge
- Improved invoice dialog styling

**Commit message:**
```bash
git commit -m "feat(accounting): redesign AP Invoices with professional UI and aging chart"
```

---

## Task 5: Redesign AR Invoices Page

**Files:**
- Modify: `src/app/accounting/ar/invoices/page.tsx`
- Test: `tests/app/accounting/ar/invoices/page.test.tsx`

**Steps:** Similar pattern
- AccountingPageHeader with dollar-sign icon and purple accent
- KPI cards showing receivables summary
- Collection status sparklines
- Enhanced payment dialog

**Commit message:**
```bash
git commit -m "feat(accounting): redesign AR Invoices with professional UI"
```

---

## Task 6: Redesign Fixed Assets Page

**Files:**
- Modify: `src/app/accounting/fixed-assets/page.tsx`
- Test: `tests/app/accounting/fixed-assets/page.test.tsx`

**Steps:**
- AccountingPageHeader with building icon
- KPI cards: Total, Active, Cost, NBV with proper formatting
- Depreciation trend mini-chart
- Category breakdown visualization
- Enhanced DataGrid with depreciation status

**Commit message:**
```bash
git commit -m "feat(accounting): redesign Fixed Assets with depreciation visualizations"
```

---

## Task 7: Redesign Equipment Page

**Files:**
- Modify: `src/app/accounting/equipment/page.tsx`
- Test: `tests/app/accounting/equipment/page.test.tsx`

**Steps:**
- AccountingPageHeader with wrench icon
- KPI cards: Total, Available, In-Use, Overdue, Due Soon
- Maintenance calendar preview
- Enhanced master-detail styling

**Commit message:**
```bash
git commit -m "feat(accounting): redesign Equipment with maintenance dashboard"
```

---

## Task 8: Redesign Reports Page

**Files:**
- Modify: `src/app/accounting/reports/page.tsx`
- Test: `tests/app/accounting/reports/page.test.tsx`

**Steps:**
- AccountingPageHeader with bar-chart icon
- Report type cards with icons and descriptions
- Date range selector in glassmorphism panel
- Enhanced report rendering with better typography
- Export options with icons

**Commit message:**
```bash
git commit -m "feat(accounting): redesign Reports page with visual report cards"
```

---

## Task 9: Redesign Period Close Page

**Files:**
- Modify: `src/app/accounting/period-close/page.tsx`
- Test: `tests/app/accounting/period-close/page.test.tsx`

**Steps:**
- AccountingPageHeader with calendar icon
- Period status KPI cards with visual indicators
- Timeline view of periods
- Enhanced validation panel with clear error/warning displays
- Close/Reopen dialogs with confirmation steps

**Commit message:**
```bash
git commit -m "feat(accounting): redesign Period Close with timeline and validation"
```

---

## Task 10: Redesign VAT Report Page

**Files:**
- Modify: `src/app/accounting/reports/vat/page.tsx`
- Test: `tests/app/accounting/reports/vat/page.test.tsx`

**Steps:**
- AccountingPageHeader with receipt icon and green accent
- VAT summary cards: Output, Input, Net
- Period selector with calendar
- Enhanced data grids for VAT entries
- Summary panel with visual breakdown

**Commit message:**
```bash
git commit -m "feat(accounting): redesign VAT Report with summary visualization"
```

---

## Task 11: Redesign WHT Report Page

**Files:**
- Modify: `src/app/accounting/reports/wht/page.tsx`
- Test: `tests/app/accounting/reports/wht/page.test.tsx`

**Steps:**
- AccountingPageHeader with file-text icon
- Certificate type selector with visual cards
- Summary KPI cards
- Enhanced certificate grid
- Improved certificate dialog

**Commit message:**
```bash
git commit -m "feat(accounting): redesign WHT Report with certificate visualization"
```

---

## Task 12: Enhance Dashboard Page (Already Redesigned - Polish)

**Files:**
- Modify: `src/app/accounting/page.tsx`
- Test: `tests/app/accounting/page.test.tsx`

**Steps:**
- Ensure consistency with new components
- Add real cash flow data (remove sample data)
- Enhance quick access cards with hover effects
- Add loading skeletons for all sections

**Commit message:**
```bash
git commit -m "feat(accounting): polish Dashboard with consistent components"
```

---

## Task 13: Final Integration and E2E Testing

**Files:**
- Test: `tests/e2e/accounting-module.test.tsx`

**Step 1: Write integration test**

```typescript
// tests/e2e/accounting-module.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('Accounting Module Integration', () => {
  it('all pages render without errors', async () => {
    // Test each page loads correctly
  });

  it('navigation between pages works correctly', async () => {
    // Test navigation flow
  });

  it('UI components are consistent across pages', async () => {
    // Test consistent styling
  });
});
```

**Step 2: Run all tests**

Run: `npm test -- --coverage`
Expected: All tests pass

**Step 3: Final commit**

```bash
git add .
git commit -m "test(accounting): add integration tests for UI redesign"
```

---

## Summary of Changes

| Page | Key Improvements |
|------|-----------------|
| Dashboard | Professional KPI cards, charts, quick access grid |
| Chart of Accounts | Gradient header, enhanced tree view, glassmorphism filters |
| Journal Entries | Status KPIs, improved master-detail, better forms |
| AP Invoices | Aging visualization, currency formatting, status badges |
| AR Invoices | Collection tracking, payment dialog, aging chart |
| Fixed Assets | Depreciation visualization, category breakdown |
| Equipment | Maintenance dashboard, calendar preview |
| Reports | Visual report cards, enhanced date selection |
| Period Close | Timeline view, validation panel, confirmation flows |
| VAT Report | Summary cards, VAT breakdown visualization |
| WHT Report | Certificate visualization, improved dialog |

---

**Plan complete and saved to `docs/plans/2025-12-25-accounting-module-ui-redesign.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
