# Accounting Financial Reports Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Create four dedicated financial report pages (Trial Balance, Balance Sheet, Income Statement, Cash Flow) with Thai/English bilingual support, multi-period comparison, KPI cards, charts, drill-down navigation, and PDF/Excel/CSV exports.

**Architecture:** Leverage existing `accounting-reports.service.ts` and API endpoints. Build shared report components in `_components/`, add language context for bilingual toggle, create export service for PDF/Excel/CSV, then build each report page with KPI cards, charts, and data tables.

**Tech Stack:** Next.js 16, React 19, TypeScript, TanStack Query, Recharts, DevExtreme DataGrid, jsPDF + jspdf-autotable (PDF), xlsx (Excel), Tailwind CSS

---

## Phase 1: Dependencies & Shared Infrastructure

### Task 1.1: Install PDF Export Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install jsPDF and autotable plugin**

Run:
```bash
npm install jspdf jspdf-autotable @types/jspdf
```

**Step 2: Verify installation**

Run: `npm ls jspdf jspdf-autotable`
Expected: Shows both packages installed

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jsPDF for PDF report export"
```

---

### Task 1.2: Create Report Language Context

**Files:**
- Create: `src/contexts/report-language-context.tsx`
- Test: `tests/contexts/report-language-context.test.tsx`

**Step 1: Write the test**

```typescript
// tests/contexts/report-language-context.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportLanguageProvider, useReportLanguage } from '@/contexts/report-language-context';

function TestComponent() {
  const { language, setLanguage, t } = useReportLanguage();
  return (
    <div>
      <span data-testid="current-lang">{language}</span>
      <button onClick={() => setLanguage(language === 'en' ? 'th' : 'en')}>Toggle</button>
      <span data-testid="translated">{t('trialBalance')}</span>
    </div>
  );
}

describe('ReportLanguageContext', () => {
  it('defaults to English', () => {
    render(
      <ReportLanguageProvider>
        <TestComponent />
      </ReportLanguageProvider>
    );
    expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
    expect(screen.getByTestId('translated')).toHaveTextContent('Trial Balance');
  });

  it('toggles to Thai', () => {
    render(
      <ReportLanguageProvider>
        <TestComponent />
      </ReportLanguageProvider>
    );
    fireEvent.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('current-lang')).toHaveTextContent('th');
    expect(screen.getByTestId('translated')).toHaveTextContent('งบทดลอง');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/contexts/report-language-context.test.tsx`
Expected: FAIL - module not found

**Step 3: Create the context**

```typescript
// src/contexts/report-language-context.tsx
'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

type Language = 'en' | 'th';

interface Translations {
  [key: string]: { en: string; th: string };
}

const translations: Translations = {
  // Report titles
  trialBalance: { en: 'Trial Balance', th: 'งบทดลอง' },
  balanceSheet: { en: 'Balance Sheet', th: 'งบแสดงฐานะการเงิน' },
  incomeStatement: { en: 'Income Statement', th: 'งบกำไรขาดทุน' },
  cashFlowStatement: { en: 'Cash Flow Statement', th: 'งบกระแสเงินสด' },

  // Section headers
  assets: { en: 'Assets', th: 'สินทรัพย์' },
  currentAssets: { en: 'Current Assets', th: 'สินทรัพย์หมุนเวียน' },
  nonCurrentAssets: { en: 'Non-Current Assets', th: 'สินทรัพย์ไม่หมุนเวียน' },
  liabilities: { en: 'Liabilities', th: 'หนี้สิน' },
  currentLiabilities: { en: 'Current Liabilities', th: 'หนี้สินหมุนเวียน' },
  nonCurrentLiabilities: { en: 'Non-Current Liabilities', th: 'หนี้สินไม่หมุนเวียน' },
  equity: { en: 'Equity', th: 'ส่วนของผู้ถือหุ้น' },
  revenue: { en: 'Revenue', th: 'รายได้' },
  costOfGoodsSold: { en: 'Cost of Goods Sold', th: 'ต้นทุนขาย' },
  grossProfit: { en: 'Gross Profit', th: 'กำไรขั้นต้น' },
  operatingExpenses: { en: 'Operating Expenses', th: 'ค่าใช้จ่ายดำเนินงาน' },
  operatingIncome: { en: 'Operating Income', th: 'กำไรจากการดำเนินงาน' },
  netIncome: { en: 'Net Income', th: 'กำไรสุทธิ' },
  operatingActivities: { en: 'Operating Activities', th: 'กิจกรรมดำเนินงาน' },
  investingActivities: { en: 'Investing Activities', th: 'กิจกรรมลงทุน' },
  financingActivities: { en: 'Financing Activities', th: 'กิจกรรมจัดหาเงิน' },

  // Column headers
  accountCode: { en: 'Account Code', th: 'รหัสบัญชี' },
  accountName: { en: 'Account Name', th: 'ชื่อบัญชี' },
  debit: { en: 'Debit', th: 'เดบิต' },
  credit: { en: 'Credit', th: 'เครดิต' },
  openingBalance: { en: 'Opening Balance', th: 'ยอดยกมา' },
  periodActivity: { en: 'Period Activity', th: 'เคลื่อนไหวระหว่างงวด' },
  closingBalance: { en: 'Closing Balance', th: 'ยอดคงเหลือ' },
  amount: { en: 'Amount', th: 'จำนวนเงิน' },
  percentOfRevenue: { en: '% of Revenue', th: '% ของรายได้' },

  // KPI labels
  totalDebits: { en: 'Total Debits', th: 'รวมเดบิต' },
  totalCredits: { en: 'Total Credits', th: 'รวมเครดิต' },
  variance: { en: 'Variance', th: 'ผลต่าง' },
  totalAssets: { en: 'Total Assets', th: 'รวมสินทรัพย์' },
  totalLiabilities: { en: 'Total Liabilities', th: 'รวมหนี้สิน' },
  totalEquity: { en: 'Total Equity', th: 'รวมส่วนของผู้ถือหุ้น' },
  currentRatio: { en: 'Current Ratio', th: 'อัตราส่วนหมุนเวียน' },
  quickRatio: { en: 'Quick Ratio', th: 'อัตราส่วนเงินสด' },
  debtToEquity: { en: 'Debt to Equity', th: 'หนี้สินต่อส่วนของผู้ถือหุ้น' },
  grossMargin: { en: 'Gross Margin', th: 'อัตรากำไรขั้นต้น' },
  operatingMargin: { en: 'Operating Margin', th: 'อัตรากำไรจากการดำเนินงาน' },
  netMargin: { en: 'Net Margin', th: 'อัตรากำไรสุทธิ' },
  operatingCashFlow: { en: 'Operating Cash Flow', th: 'กระแสเงินสดจากการดำเนินงาน' },
  freeCashFlow: { en: 'Free Cash Flow', th: 'กระแสเงินสดอิสระ' },

  // Actions
  export: { en: 'Export', th: 'ส่งออก' },
  print: { en: 'Print', th: 'พิมพ์' },
  refresh: { en: 'Refresh', th: 'รีเฟรช' },
  asOfDate: { en: 'As of Date', th: 'ณ วันที่' },
  periodFrom: { en: 'Period From', th: 'ตั้งแต่วันที่' },
  periodTo: { en: 'Period To', th: 'ถึงวันที่' },

  // Status
  balanced: { en: 'Balanced', th: 'สมดุล' },
  outOfBalance: { en: 'Out of Balance', th: 'ไม่สมดุล' },
  noData: { en: 'No data found for the selected period', th: 'ไม่พบข้อมูลสำหรับงวดที่เลือก' },
};

interface ReportLanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string) => string;
  getAccountName: (nameTh: string, nameEn: string) => string;
}

const ReportLanguageContext = createContext<ReportLanguageContextType | null>(null);

export function ReportLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('reportLanguage') as Language | null;
    if (saved === 'en' || saved === 'th') {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('reportLanguage', lang);
  }, []);

  const t = useCallback((key: string): string => {
    return translations[key]?.[language] || key;
  }, [language]);

  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }, []);

  const formatDate = useCallback((date: string): string => {
    const d = new Date(date);
    return new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  }, [language]);

  const getAccountName = useCallback((nameTh: string, nameEn: string): string => {
    return language === 'th' ? nameTh : nameEn;
  }, [language]);

  return (
    <ReportLanguageContext.Provider value={{ language, setLanguage, t, formatCurrency, formatDate, getAccountName }}>
      {children}
    </ReportLanguageContext.Provider>
  );
}

export function useReportLanguage() {
  const context = useContext(ReportLanguageContext);
  if (!context) {
    throw new Error('useReportLanguage must be used within a ReportLanguageProvider');
  }
  return context;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/contexts/report-language-context.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/contexts/report-language-context.tsx tests/contexts/report-language-context.test.tsx
git commit -m "feat(reports): add bilingual language context for financial reports"
```

---

### Task 1.3: Create Report Export Service

**Files:**
- Create: `src/lib/services/report-export.service.ts`
- Test: `tests/lib/services/report-export.service.test.ts`

**Step 1: Write the test**

```typescript
// tests/lib/services/report-export.service.test.ts
import { describe, it, expect, vi } from 'vitest';

// Mock jsPDF
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn(),
    text: vi.fn(),
    save: vi.fn(),
    autoTable: vi.fn(),
  })),
}));

// Mock xlsx
vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn().mockReturnValue({}),
    book_new: vi.fn().mockReturnValue({ SheetNames: [], Sheets: {} }),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

import { exportToCSV, formatReportDataForExport } from '@/lib/services/report-export.service';

describe('Report Export Service', () => {
  it('formats report data for export', () => {
    const data = [
      { accountCode: '1110', accountName: 'Cash', debit: 100000, credit: 0 },
      { accountCode: '2110', accountName: 'AP', debit: 0, credit: 50000 },
    ];
    const columns = [
      { key: 'accountCode', label: 'Account Code' },
      { key: 'accountName', label: 'Account Name' },
      { key: 'debit', label: 'Debit' },
      { key: 'credit', label: 'Credit' },
    ];

    const result = formatReportDataForExport(data, columns);
    expect(result).toHaveLength(2);
    expect(result[0]['Account Code']).toBe('1110');
    expect(result[0]['Debit']).toBe(100000);
  });

  it('exports to CSV with Thai character support', () => {
    const data = [{ name: 'เงินสด', amount: 100000 }];
    const csv = exportToCSV(data, [
      { key: 'name', label: 'Name' },
      { key: 'amount', label: 'Amount' },
    ]);
    expect(csv).toContain('Name,Amount');
    expect(csv).toContain('เงินสด');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/services/report-export.service.test.ts`
Expected: FAIL

**Step 3: Create the export service**

```typescript
// src/lib/services/report-export.service.ts
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Extend jsPDF types for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: AutoTableOptions) => jsPDF;
  }
}

interface AutoTableOptions {
  head: string[][];
  body: (string | number)[][];
  startY?: number;
  theme?: string;
  headStyles?: Record<string, unknown>;
  styles?: Record<string, unknown>;
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
}

export interface ExportColumn {
  key: string;
  label: string;
  labelTh?: string;
  format?: 'currency' | 'percent' | 'number' | 'text';
}

export interface ExportOptions {
  filename: string;
  title: string;
  titleTh?: string;
  subtitle?: string;
  language?: 'en' | 'th';
  companyName?: string;
  asOfDate?: string;
  periodStart?: string;
  periodEnd?: string;
}

/**
 * Format report data for export by mapping keys to labels
 */
export function formatReportDataForExport<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[]
): Record<string, unknown>[] {
  return data.map(row => {
    const formattedRow: Record<string, unknown> = {};
    columns.forEach(col => {
      formattedRow[col.label] = row[col.key];
    });
    return formattedRow;
  });
}

/**
 * Export data to CSV with UTF-8 BOM for Thai character support
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[],
  options?: ExportOptions
): string {
  const headers = columns.map(c => options?.language === 'th' && c.labelTh ? c.labelTh : c.label);
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return String(value);
    })
  );

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  return '\uFEFF' + csv; // Add UTF-8 BOM for Excel Thai support
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export data to Excel with formatting
 */
export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[],
  options: ExportOptions
): void {
  const formattedData = formatReportDataForExport(data, columns);
  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();

  // Add metadata
  workbook.Props = {
    Title: options.title,
    Author: options.companyName || 'Herbal Medicine ERP',
    CreatedDate: new Date(),
  };

  XLSX.utils.book_append_sheet(workbook, worksheet, options.title.substring(0, 31));
  XLSX.writeFile(workbook, `${options.filename}.xlsx`);
}

/**
 * Export data to PDF with company header and formatting
 */
export function exportToPDF<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[],
  options: ExportOptions
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Header
  const title = options.language === 'th' && options.titleTh ? options.titleTh : options.title;
  doc.setFontSize(16);
  doc.text(title, 14, 15);

  if (options.companyName) {
    doc.setFontSize(10);
    doc.text(options.companyName, 14, 22);
  }

  if (options.asOfDate) {
    doc.setFontSize(10);
    doc.text(`As of: ${options.asOfDate}`, 14, 28);
  } else if (options.periodStart && options.periodEnd) {
    doc.setFontSize(10);
    doc.text(`Period: ${options.periodStart} - ${options.periodEnd}`, 14, 28);
  }

  // Table
  const headers = columns.map(c => options.language === 'th' && c.labelTh ? c.labelTh : c.label);
  const body = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) return '';
      if (col.format === 'currency' && typeof value === 'number') {
        return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(value);
      }
      if (col.format === 'percent' && typeof value === 'number') {
        return `${value.toFixed(2)}%`;
      }
      return String(value);
    })
  );

  doc.autoTable({
    head: [headers],
    body,
    startY: 35,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { top: 35 },
  });

  doc.save(`${options.filename}.pdf`);
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/services/report-export.service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/services/report-export.service.ts tests/lib/services/report-export.service.test.ts
git commit -m "feat(reports): add PDF/Excel/CSV export service"
```

---

## Phase 2: Shared Report Components

### Task 2.1: Create ReportHeader Component

**Files:**
- Create: `src/app/accounting/reports/_components/ReportHeader.tsx`
- Test: `tests/app/accounting/reports/_components/ReportHeader.test.tsx`

**Step 1: Write the test**

```typescript
// tests/app/accounting/reports/_components/ReportHeader.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportHeader } from '@/app/accounting/reports/_components/ReportHeader';
import { ReportLanguageProvider } from '@/contexts/report-language-context';

function renderWithProvider(ui: React.ReactElement) {
  return render(<ReportLanguageProvider>{ui}</ReportLanguageProvider>);
}

describe('ReportHeader', () => {
  it('renders title and subtitle', () => {
    renderWithProvider(
      <ReportHeader
        titleKey="trialBalance"
        subtitle="As of 2026-01-17"
        onRefresh={() => {}}
      />
    );
    expect(screen.getByText('Trial Balance')).toBeInTheDocument();
    expect(screen.getByText('As of 2026-01-17')).toBeInTheDocument();
  });

  it('toggles language when clicked', () => {
    renderWithProvider(
      <ReportHeader titleKey="trialBalance" onRefresh={() => {}} />
    );
    const toggle = screen.getByTestId('language-toggle');
    fireEvent.click(toggle);
    expect(screen.getByText('งบทดลอง')).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button clicked', () => {
    const onRefresh = vi.fn();
    renderWithProvider(
      <ReportHeader titleKey="trialBalance" onRefresh={onRefresh} />
    );
    fireEvent.click(screen.getByTestId('refresh-button'));
    expect(onRefresh).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/app/accounting/reports/_components/ReportHeader.test.tsx`
Expected: FAIL

**Step 3: Create the component**

```typescript
// src/app/accounting/reports/_components/ReportHeader.tsx
'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReportLanguage } from '@/contexts/report-language-context';

export interface ReportHeaderProps {
  titleKey: string;
  subtitle?: string;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function ReportHeader({ titleKey, subtitle, onRefresh, isLoading }: ReportHeaderProps) {
  const { language, setLanguage, t } = useReportLanguage();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t(titleKey)}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Language Toggle */}
        <button
          data-testid="language-toggle"
          onClick={() => setLanguage(language === 'en' ? 'th' : 'en')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        >
          <span className={`text-sm font-medium ${language === 'th' ? 'text-blue-600' : 'text-gray-500'}`}>
            🇹🇭 TH
          </span>
          <span className="text-gray-300">|</span>
          <span className={`text-sm font-medium ${language === 'en' ? 'text-blue-600' : 'text-gray-500'}`}>
            EN 🇬🇧
          </span>
        </button>

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          data-testid="refresh-button"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/app/accounting/reports/_components/ReportHeader.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/accounting/reports/_components/ReportHeader.tsx tests/app/accounting/reports/_components/ReportHeader.test.tsx
git commit -m "feat(reports): add ReportHeader component with language toggle"
```

---

### Task 2.2: Create ReportKPICards Component

**Files:**
- Create: `src/app/accounting/reports/_components/ReportKPICards.tsx`
- Test: `tests/app/accounting/reports/_components/ReportKPICards.test.tsx`

**Step 1: Write the test**

```typescript
// tests/app/accounting/reports/_components/ReportKPICards.test.tsx
import { render, screen } from '@testing-library/react';
import { ReportKPICards, type ReportKPI } from '@/app/accounting/reports/_components/ReportKPICards';
import { ReportLanguageProvider } from '@/contexts/report-language-context';

describe('ReportKPICards', () => {
  const kpis: ReportKPI[] = [
    { labelKey: 'totalDebits', value: 1000000, format: 'currency', status: 'neutral' },
    { labelKey: 'totalCredits', value: 1000000, format: 'currency', status: 'neutral' },
    { labelKey: 'variance', value: 0, format: 'currency', status: 'good' },
  ];

  it('renders all KPI cards', () => {
    render(
      <ReportLanguageProvider>
        <ReportKPICards kpis={kpis} />
      </ReportLanguageProvider>
    );
    expect(screen.getByText('Total Debits')).toBeInTheDocument();
    expect(screen.getByText('Total Credits')).toBeInTheDocument();
    expect(screen.getByText('Variance')).toBeInTheDocument();
  });

  it('formats currency values', () => {
    render(
      <ReportLanguageProvider>
        <ReportKPICards kpis={kpis} />
      </ReportLanguageProvider>
    );
    expect(screen.getAllByText(/฿1,000,000/)).toHaveLength(2);
  });

  it('shows good status with green color', () => {
    render(
      <ReportLanguageProvider>
        <ReportKPICards kpis={kpis} />
      </ReportLanguageProvider>
    );
    const varianceCard = screen.getByTestId('kpi-variance');
    expect(varianceCard).toHaveClass('border-emerald-200');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/app/accounting/reports/_components/ReportKPICards.test.tsx`
Expected: FAIL

**Step 3: Create the component**

```typescript
// src/app/accounting/reports/_components/ReportKPICards.tsx
'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useReportLanguage } from '@/contexts/report-language-context';

export interface ReportKPI {
  labelKey: string;
  value: number;
  previousValue?: number;
  format: 'currency' | 'percent' | 'ratio' | 'number';
  status: 'good' | 'warning' | 'danger' | 'neutral';
  suffix?: string;
}

export interface ReportKPICardsProps {
  kpis: ReportKPI[];
  isLoading?: boolean;
}

const statusStyles = {
  good: { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  warning: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700' },
  danger: { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-700' },
  neutral: { border: 'border-gray-200', bg: 'bg-gray-50', text: 'text-gray-700' },
};

export function ReportKPICards({ kpis, isLoading }: ReportKPICardsProps) {
  const { t, formatCurrency } = useReportLanguage();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
            <div className="h-6 w-24 bg-gray-200 rounded" />
          </Card>
        ))}
      </div>
    );
  }

  function formatValue(kpi: ReportKPI): string {
    switch (kpi.format) {
      case 'currency':
        return formatCurrency(kpi.value);
      case 'percent':
        return `${kpi.value.toFixed(1)}%`;
      case 'ratio':
        return kpi.value.toFixed(2) + (kpi.suffix || '');
      case 'number':
        return new Intl.NumberFormat('th-TH').format(kpi.value);
      default:
        return String(kpi.value);
    }
  }

  function getTrend(kpi: ReportKPI) {
    if (kpi.previousValue === undefined) return null;
    const change = ((kpi.value - kpi.previousValue) / kpi.previousValue) * 100;
    if (Math.abs(change) < 0.1) return { icon: Minus, color: 'text-gray-500', value: '0%' };
    if (change > 0) return { icon: TrendingUp, color: 'text-emerald-600', value: `+${change.toFixed(1)}%` };
    return { icon: TrendingDown, color: 'text-red-600', value: `${change.toFixed(1)}%` };
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
      {kpis.map((kpi) => {
        const styles = statusStyles[kpi.status];
        const trend = getTrend(kpi);

        return (
          <Card
            key={kpi.labelKey}
            data-testid={`kpi-${kpi.labelKey}`}
            className={`p-4 border-2 ${styles.border}`}
          >
            <p className="text-sm font-medium text-gray-600 truncate">{t(kpi.labelKey)}</p>
            <p className={`mt-1 text-xl font-bold ${styles.text}`}>{formatValue(kpi)}</p>
            {trend && (
              <div className={`flex items-center gap-1 mt-1 text-xs ${trend.color}`}>
                <trend.icon className="h-3 w-3" />
                <span>{trend.value}</span>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/app/accounting/reports/_components/ReportKPICards.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/accounting/reports/_components/ReportKPICards.tsx tests/app/accounting/reports/_components/ReportKPICards.test.tsx
git commit -m "feat(reports): add ReportKPICards component"
```

---

### Task 2.3: Create ReportToolbar Component

**Files:**
- Create: `src/app/accounting/reports/_components/ReportToolbar.tsx`
- Test: `tests/app/accounting/reports/_components/ReportToolbar.test.tsx`

**Step 1: Write the test**

```typescript
// tests/app/accounting/reports/_components/ReportToolbar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportToolbar } from '@/app/accounting/reports/_components/ReportToolbar';
import { ReportLanguageProvider } from '@/contexts/report-language-context';

describe('ReportToolbar', () => {
  const mockHandlers = {
    onExportPDF: vi.fn(),
    onExportExcel: vi.fn(),
    onExportCSV: vi.fn(),
    onPrint: vi.fn(),
  };

  it('renders all export buttons', () => {
    render(
      <ReportLanguageProvider>
        <ReportToolbar {...mockHandlers} />
      </ReportLanguageProvider>
    );
    expect(screen.getByTestId('export-pdf')).toBeInTheDocument();
    expect(screen.getByTestId('export-excel')).toBeInTheDocument();
    expect(screen.getByTestId('export-csv')).toBeInTheDocument();
    expect(screen.getByTestId('print-button')).toBeInTheDocument();
  });

  it('calls onExportPDF when PDF button clicked', () => {
    render(
      <ReportLanguageProvider>
        <ReportToolbar {...mockHandlers} />
      </ReportLanguageProvider>
    );
    fireEvent.click(screen.getByTestId('export-pdf'));
    expect(mockHandlers.onExportPDF).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/app/accounting/reports/_components/ReportToolbar.test.tsx`
Expected: FAIL

**Step 3: Create the component**

```typescript
// src/app/accounting/reports/_components/ReportToolbar.tsx
'use client';

import { FileText, FileSpreadsheet, FileDown, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ReportToolbarProps {
  onExportPDF: () => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onPrint: () => void;
  disabled?: boolean;
}

export function ReportToolbar({
  onExportPDF,
  onExportExcel,
  onExportCSV,
  onPrint,
  disabled,
}: ReportToolbarProps) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Button
        variant="outline"
        size="sm"
        onClick={onExportPDF}
        disabled={disabled}
        data-testid="export-pdf"
        className="gap-2"
      >
        <FileText className="h-4 w-4 text-red-500" />
        PDF
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onExportExcel}
        disabled={disabled}
        data-testid="export-excel"
        className="gap-2"
      >
        <FileSpreadsheet className="h-4 w-4 text-green-600" />
        Excel
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onExportCSV}
        disabled={disabled}
        data-testid="export-csv"
        className="gap-2"
      >
        <FileDown className="h-4 w-4 text-blue-500" />
        CSV
      </Button>

      <div className="border-l border-gray-200 h-6 mx-2" />

      <Button
        variant="outline"
        size="sm"
        onClick={onPrint}
        disabled={disabled}
        data-testid="print-button"
        className="gap-2"
      >
        <Printer className="h-4 w-4" />
        Print
      </Button>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/app/accounting/reports/_components/ReportToolbar.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/accounting/reports/_components/ReportToolbar.tsx tests/app/accounting/reports/_components/ReportToolbar.test.tsx
git commit -m "feat(reports): add ReportToolbar component for exports"
```

---

### Task 2.4: Create ReportPeriodSelector Component

**Files:**
- Create: `src/app/accounting/reports/_components/ReportPeriodSelector.tsx`
- Test: `tests/app/accounting/reports/_components/ReportPeriodSelector.test.tsx`

**Step 1: Write the test**

```typescript
// tests/app/accounting/reports/_components/ReportPeriodSelector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportPeriodSelector } from '@/app/accounting/reports/_components/ReportPeriodSelector';
import { ReportLanguageProvider } from '@/contexts/report-language-context';

describe('ReportPeriodSelector', () => {
  it('renders as-of-date mode', () => {
    const onDateChange = vi.fn();
    render(
      <ReportLanguageProvider>
        <ReportPeriodSelector
          mode="asOfDate"
          asOfDate="2026-01-17"
          onAsOfDateChange={onDateChange}
        />
      </ReportLanguageProvider>
    );
    expect(screen.getByTestId('as-of-date-picker')).toBeInTheDocument();
  });

  it('renders period range mode', () => {
    render(
      <ReportLanguageProvider>
        <ReportPeriodSelector
          mode="periodRange"
          periodStart="2026-01-01"
          periodEnd="2026-01-31"
          onPeriodStartChange={() => {}}
          onPeriodEndChange={() => {}}
        />
      </ReportLanguageProvider>
    );
    expect(screen.getByTestId('period-start-picker')).toBeInTheDocument();
    expect(screen.getByTestId('period-end-picker')).toBeInTheDocument();
  });

  it('renders quick presets', () => {
    render(
      <ReportLanguageProvider>
        <ReportPeriodSelector
          mode="asOfDate"
          asOfDate="2026-01-17"
          onAsOfDateChange={() => {}}
          showPresets
        />
      </ReportLanguageProvider>
    );
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Month End')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/app/accounting/reports/_components/ReportPeriodSelector.test.tsx`
Expected: FAIL

**Step 3: Create the component**

```typescript
// src/app/accounting/reports/_components/ReportPeriodSelector.tsx
'use client';

import { DateBox } from 'devextreme-react/date-box';
import { Button } from '@/components/ui/button';
import { useReportLanguage } from '@/contexts/report-language-context';

type PresetType = 'today' | 'monthEnd' | 'quarterEnd' | 'yearEnd' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'ytd';

interface AsOfDateProps {
  mode: 'asOfDate';
  asOfDate: string;
  onAsOfDateChange: (date: string) => void;
  periodStart?: never;
  periodEnd?: never;
  onPeriodStartChange?: never;
  onPeriodEndChange?: never;
}

interface PeriodRangeProps {
  mode: 'periodRange';
  periodStart: string;
  periodEnd: string;
  onPeriodStartChange: (date: string) => void;
  onPeriodEndChange: (date: string) => void;
  asOfDate?: never;
  onAsOfDateChange?: never;
}

type ReportPeriodSelectorProps = (AsOfDateProps | PeriodRangeProps) & {
  showPresets?: boolean;
  onGenerate?: () => void;
  isLoading?: boolean;
};

export function ReportPeriodSelector(props: ReportPeriodSelectorProps) {
  const { t, language } = useReportLanguage();

  const presets: { label: string; labelTh: string; type: PresetType }[] = props.mode === 'asOfDate'
    ? [
        { label: 'Today', labelTh: 'วันนี้', type: 'today' },
        { label: 'Month End', labelTh: 'สิ้นเดือน', type: 'monthEnd' },
        { label: 'Quarter End', labelTh: 'สิ้นไตรมาส', type: 'quarterEnd' },
        { label: 'Year End', labelTh: 'สิ้นปี', type: 'yearEnd' },
      ]
    : [
        { label: 'This Month', labelTh: 'เดือนนี้', type: 'thisMonth' },
        { label: 'Last Month', labelTh: 'เดือนที่แล้ว', type: 'lastMonth' },
        { label: 'This Quarter', labelTh: 'ไตรมาสนี้', type: 'thisQuarter' },
        { label: 'YTD', labelTh: 'ตั้งแต่ต้นปี', type: 'ytd' },
      ];

  function applyPreset(type: PresetType) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const quarter = Math.floor(month / 3);

    if (props.mode === 'asOfDate' && props.onAsOfDateChange) {
      switch (type) {
        case 'today':
          props.onAsOfDateChange(today.toISOString().split('T')[0]);
          break;
        case 'monthEnd':
          props.onAsOfDateChange(new Date(year, month + 1, 0).toISOString().split('T')[0]);
          break;
        case 'quarterEnd':
          props.onAsOfDateChange(new Date(year, (quarter + 1) * 3, 0).toISOString().split('T')[0]);
          break;
        case 'yearEnd':
          props.onAsOfDateChange(`${year}-12-31`);
          break;
      }
    } else if (props.mode === 'periodRange' && props.onPeriodStartChange && props.onPeriodEndChange) {
      switch (type) {
        case 'thisMonth':
          props.onPeriodStartChange(new Date(year, month, 1).toISOString().split('T')[0]);
          props.onPeriodEndChange(new Date(year, month + 1, 0).toISOString().split('T')[0]);
          break;
        case 'lastMonth':
          props.onPeriodStartChange(new Date(year, month - 1, 1).toISOString().split('T')[0]);
          props.onPeriodEndChange(new Date(year, month, 0).toISOString().split('T')[0]);
          break;
        case 'thisQuarter':
          props.onPeriodStartChange(new Date(year, quarter * 3, 1).toISOString().split('T')[0]);
          props.onPeriodEndChange(new Date(year, (quarter + 1) * 3, 0).toISOString().split('T')[0]);
          break;
        case 'ytd':
          props.onPeriodStartChange(`${year}-01-01`);
          props.onPeriodEndChange(today.toISOString().split('T')[0]);
          break;
      }
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
      {props.mode === 'asOfDate' ? (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">{t('asOfDate')}:</label>
          <DateBox
            data-testid="as-of-date-picker"
            value={props.asOfDate}
            onValueChanged={(e) => props.onAsOfDateChange(e.value?.toISOString().split('T')[0] || '')}
            displayFormat="dd/MM/yyyy"
            width={150}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">{t('periodFrom')}:</label>
            <DateBox
              data-testid="period-start-picker"
              value={props.periodStart}
              onValueChanged={(e) => props.onPeriodStartChange(e.value?.toISOString().split('T')[0] || '')}
              displayFormat="dd/MM/yyyy"
              width={150}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">{t('periodTo')}:</label>
            <DateBox
              data-testid="period-end-picker"
              value={props.periodEnd}
              onValueChanged={(e) => props.onPeriodEndChange(e.value?.toISOString().split('T')[0] || '')}
              displayFormat="dd/MM/yyyy"
              width={150}
            />
          </div>
        </>
      )}

      {props.showPresets && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Quick:</span>
          {presets.map((preset) => (
            <button
              key={preset.type}
              onClick={() => applyPreset(preset.type)}
              className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              {language === 'th' ? preset.labelTh : preset.label}
            </button>
          ))}
        </div>
      )}

      {props.onGenerate && (
        <Button
          onClick={props.onGenerate}
          disabled={props.isLoading}
          data-testid="generate-button"
        >
          Generate Report
        </Button>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/app/accounting/reports/_components/ReportPeriodSelector.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/accounting/reports/_components/ReportPeriodSelector.tsx tests/app/accounting/reports/_components/ReportPeriodSelector.test.tsx
git commit -m "feat(reports): add ReportPeriodSelector component"
```

---

### Task 2.5: Create DrillDownLink Component

**Files:**
- Create: `src/app/accounting/reports/_components/DrillDownLink.tsx`
- Test: `tests/app/accounting/reports/_components/DrillDownLink.test.tsx`

**Step 1: Write the test**

```typescript
// tests/app/accounting/reports/_components/DrillDownLink.test.tsx
import { render, screen } from '@testing-library/react';
import { DrillDownLink } from '@/app/accounting/reports/_components/DrillDownLink';
import { ReportLanguageProvider } from '@/contexts/report-language-context';

describe('DrillDownLink', () => {
  it('renders formatted currency value', () => {
    render(
      <ReportLanguageProvider>
        <DrillDownLink
          value={1000000}
          accountCode="1110"
          fromDate="2026-01-01"
          toDate="2026-01-31"
        />
      </ReportLanguageProvider>
    );
    expect(screen.getByText(/฿1,000,000/)).toBeInTheDocument();
  });

  it('renders link with correct href', () => {
    render(
      <ReportLanguageProvider>
        <DrillDownLink
          value={500000}
          accountCode="1110"
          fromDate="2026-01-01"
          toDate="2026-01-31"
        />
      </ReportLanguageProvider>
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/accounting/gl-accounts/1110?from=2026-01-01&to=2026-01-31');
  });

  it('shows zero without link', () => {
    render(
      <ReportLanguageProvider>
        <DrillDownLink
          value={0}
          accountCode="1110"
          fromDate="2026-01-01"
          toDate="2026-01-31"
        />
      </ReportLanguageProvider>
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/app/accounting/reports/_components/DrillDownLink.test.tsx`
Expected: FAIL

**Step 3: Create the component**

```typescript
// src/app/accounting/reports/_components/DrillDownLink.tsx
'use client';

import Link from 'next/link';
import { useReportLanguage } from '@/contexts/report-language-context';

export interface DrillDownLinkProps {
  value: number;
  accountCode: string;
  fromDate: string;
  toDate: string;
  className?: string;
}

export function DrillDownLink({ value, accountCode, fromDate, toDate, className = '' }: DrillDownLinkProps) {
  const { formatCurrency } = useReportLanguage();

  if (value === 0) {
    return <span className={`text-gray-400 ${className}`}>-</span>;
  }

  const href = `/accounting/gl-accounts/${accountCode}?from=${fromDate}&to=${toDate}`;

  return (
    <Link
      href={href}
      className={`text-blue-600 hover:text-blue-800 hover:underline font-medium ${className}`}
    >
      {formatCurrency(value)}
    </Link>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/app/accounting/reports/_components/DrillDownLink.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/accounting/reports/_components/DrillDownLink.tsx tests/app/accounting/reports/_components/DrillDownLink.test.tsx
git commit -m "feat(reports): add DrillDownLink component for GL navigation"
```

---

### Task 2.6: Create Shared Components Index

**Files:**
- Create: `src/app/accounting/reports/_components/index.ts`

**Step 1: Create the index file**

```typescript
// src/app/accounting/reports/_components/index.ts
export { ReportHeader } from './ReportHeader';
export type { ReportHeaderProps } from './ReportHeader';

export { ReportKPICards } from './ReportKPICards';
export type { ReportKPI, ReportKPICardsProps } from './ReportKPICards';

export { ReportToolbar } from './ReportToolbar';
export type { ReportToolbarProps } from './ReportToolbar';

export { ReportPeriodSelector } from './ReportPeriodSelector';

export { DrillDownLink } from './DrillDownLink';
export type { DrillDownLinkProps } from './DrillDownLink';
```

**Step 2: Commit**

```bash
git add src/app/accounting/reports/_components/index.ts
git commit -m "feat(reports): add shared components index"
```

---

## Phase 3: Report Pages

### Task 3.1: Create Trial Balance Page

**Files:**
- Create: `src/app/accounting/reports/trial-balance/page.tsx`
- Test: `tests/app/accounting/reports/trial-balance/page.test.tsx`

**Step 1: Write the test**

```typescript
// tests/app/accounting/reports/trial-balance/page.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TrialBalancePage from '@/app/accounting/reports/trial-balance/page';
import { ReportLanguageProvider } from '@/contexts/report-language-context';

// Mock fetch
global.fetch = vi.fn();

const mockTrialBalance = {
  data: {
    asOfDate: '2026-01-17',
    fiscalPeriod: '2026-01-01',
    entries: [
      { accountCode: '1110', accountName: 'Cash', category: 'asset', openingDebit: 100000, openingCredit: 0, periodDebit: 50000, periodCredit: 20000, closingDebit: 130000, closingCredit: 0 },
      { accountCode: '2110', accountName: 'Accounts Payable', category: 'liability', openingDebit: 0, openingCredit: 50000, periodDebit: 10000, periodCredit: 30000, closingDebit: 0, closingCredit: 70000 },
    ],
    totals: { openingDebit: 100000, openingCredit: 50000, periodDebit: 60000, periodCredit: 50000, closingDebit: 130000, closingCredit: 70000 },
  },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ReportLanguageProvider>
        <TrialBalancePage />
      </ReportLanguageProvider>
    </QueryClientProvider>
  );
}

describe('Trial Balance Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTrialBalance),
    });
  });

  it('renders page title', () => {
    renderPage();
    expect(screen.getByText('Trial Balance')).toBeInTheDocument();
  });

  it('shows KPI cards after loading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('kpi-totalDebits')).toBeInTheDocument();
    });
  });

  it('shows trial balance entries', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('1110')).toBeInTheDocument();
      expect(screen.getByText('Cash')).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/app/accounting/reports/trial-balance/page.test.tsx`
Expected: FAIL

**Step 3: Create the page**

```typescript
// src/app/accounting/reports/trial-balance/page.tsx
'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import DataGrid, { Column, Summary, TotalItem, ColumnChooser, Export, Grouping, GroupPanel } from 'devextreme-react/data-grid';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ReportLanguageProvider, useReportLanguage } from '@/contexts/report-language-context';
import {
  ReportHeader,
  ReportKPICards,
  ReportToolbar,
  ReportPeriodSelector,
  DrillDownLink,
  type ReportKPI,
} from '../_components';
import { exportToPDF, exportToExcel, exportToCSV, downloadCSV } from '@/lib/services/report-export.service';
import type { TrialBalanceReport, TrialBalanceEntry } from '@/types/accounting';

async function fetchTrialBalance(asOfDate: string): Promise<TrialBalanceReport> {
  const res = await fetch(`/api/accounting/reports/trial-balance?asOfDate=${asOfDate}`);
  if (!res.ok) throw new Error('Failed to fetch trial balance');
  const data = await res.json();
  return data.data;
}

function TrialBalanceContent() {
  const { language, t, formatCurrency, getAccountName } = useReportLanguage();
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split('T')[0]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['trial-balance', asOfDate],
    queryFn: () => fetchTrialBalance(asOfDate),
  });

  const kpis: ReportKPI[] = data ? [
    { labelKey: 'totalDebits', value: data.totals.closingDebit, format: 'currency', status: 'neutral' },
    { labelKey: 'totalCredits', value: data.totals.closingCredit, format: 'currency', status: 'neutral' },
    { labelKey: 'variance', value: Math.abs(data.totals.closingDebit - data.totals.closingCredit), format: 'currency', status: data.totals.closingDebit === data.totals.closingCredit ? 'good' : 'danger' },
  ] : [];

  const chartData = data ? [
    { name: 'Assets', debit: data.entries.filter(e => e.category === 'asset').reduce((s, e) => s + e.closingDebit, 0), credit: data.entries.filter(e => e.category === 'asset').reduce((s, e) => s + e.closingCredit, 0) },
    { name: 'Liabilities', debit: data.entries.filter(e => e.category === 'liability').reduce((s, e) => s + e.closingDebit, 0), credit: data.entries.filter(e => e.category === 'liability').reduce((s, e) => s + e.closingCredit, 0) },
    { name: 'Equity', debit: data.entries.filter(e => e.category === 'equity').reduce((s, e) => s + e.closingDebit, 0), credit: data.entries.filter(e => e.category === 'equity').reduce((s, e) => s + e.closingCredit, 0) },
    { name: 'Revenue', debit: data.entries.filter(e => e.category === 'revenue').reduce((s, e) => s + e.closingDebit, 0), credit: data.entries.filter(e => e.category === 'revenue').reduce((s, e) => s + e.closingCredit, 0) },
    { name: 'Expenses', debit: data.entries.filter(e => e.category === 'expense').reduce((s, e) => s + e.closingDebit, 0), credit: data.entries.filter(e => e.category === 'expense').reduce((s, e) => s + e.closingCredit, 0) },
  ] : [];

  const columns = [
    { key: 'accountCode', label: t('accountCode') },
    { key: 'accountName', label: t('accountName') },
    { key: 'openingDebit', label: `${t('openingBalance')} ${t('debit')}`, format: 'currency' as const },
    { key: 'openingCredit', label: `${t('openingBalance')} ${t('credit')}`, format: 'currency' as const },
    { key: 'periodDebit', label: `${t('periodActivity')} ${t('debit')}`, format: 'currency' as const },
    { key: 'periodCredit', label: `${t('periodActivity')} ${t('credit')}`, format: 'currency' as const },
    { key: 'closingDebit', label: `${t('closingBalance')} ${t('debit')}`, format: 'currency' as const },
    { key: 'closingCredit', label: `${t('closingBalance')} ${t('credit')}`, format: 'currency' as const },
  ];

  const handleExportPDF = useCallback(() => {
    if (!data) return;
    exportToPDF(data.entries, columns, {
      filename: `trial-balance-${asOfDate}`,
      title: 'Trial Balance',
      titleTh: 'งบทดลอง',
      language,
      asOfDate,
    });
  }, [data, asOfDate, language, columns]);

  const handleExportExcel = useCallback(() => {
    if (!data) return;
    exportToExcel(data.entries, columns, {
      filename: `trial-balance-${asOfDate}`,
      title: 'Trial Balance',
      language,
      asOfDate,
    });
  }, [data, asOfDate, language, columns]);

  const handleExportCSV = useCallback(() => {
    if (!data) return;
    const csv = exportToCSV(data.entries, columns, { language, filename: '', title: '' });
    downloadCSV(csv, `trial-balance-${asOfDate}.csv`);
  }, [data, asOfDate, language, columns]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="p-6" data-testid="trial-balance-page">
      <ReportHeader
        titleKey="trialBalance"
        subtitle={`${t('asOfDate')}: ${asOfDate}`}
        onRefresh={() => refetch()}
        isLoading={isLoading}
      />

      <ReportPeriodSelector
        mode="asOfDate"
        asOfDate={asOfDate}
        onAsOfDateChange={setAsOfDate}
        showPresets
      />

      <ReportKPICards kpis={kpis} isLoading={isLoading} />

      <ReportToolbar
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onPrint={handlePrint}
        disabled={!data}
      />

      {/* Chart */}
      {data && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{t('debit')} vs {t('credit')} by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `฿${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                  <Bar dataKey="debit" name={t('debit')} fill="#3b82f6" />
                  <Bar dataKey="credit" name={t('credit')} fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Grid */}
      <Card>
        <CardContent className="p-0">
          <DataGrid
            dataSource={data?.entries || []}
            showBorders
            rowAlternationEnabled
            columnAutoWidth
            wordWrapEnabled
          >
            <GroupPanel visible />
            <Grouping autoExpandAll />
            <ColumnChooser enabled />
            <Export enabled />
            <Column dataField="accountCode" caption={t('accountCode')} width={100} />
            <Column dataField="accountName" caption={t('accountName')} />
            <Column dataField="category" caption="Category" groupIndex={0} />
            <Column dataField="openingDebit" caption={`${t('openingBalance')} ${t('debit')}`} dataType="number" format="#,##0.00" />
            <Column dataField="openingCredit" caption={`${t('openingBalance')} ${t('credit')}`} dataType="number" format="#,##0.00" />
            <Column dataField="periodDebit" caption={`${t('periodActivity')} ${t('debit')}`} dataType="number" format="#,##0.00" />
            <Column dataField="periodCredit" caption={`${t('periodActivity')} ${t('credit')}`} dataType="number" format="#,##0.00" />
            <Column dataField="closingDebit" caption={`${t('closingBalance')} ${t('debit')}`} dataType="number" format="#,##0.00" />
            <Column dataField="closingCredit" caption={`${t('closingBalance')} ${t('credit')}`} dataType="number" format="#,##0.00" />
            <Summary>
              <TotalItem column="openingDebit" summaryType="sum" valueFormat="#,##0.00" />
              <TotalItem column="openingCredit" summaryType="sum" valueFormat="#,##0.00" />
              <TotalItem column="periodDebit" summaryType="sum" valueFormat="#,##0.00" />
              <TotalItem column="periodCredit" summaryType="sum" valueFormat="#,##0.00" />
              <TotalItem column="closingDebit" summaryType="sum" valueFormat="#,##0.00" />
              <TotalItem column="closingCredit" summaryType="sum" valueFormat="#,##0.00" />
            </Summary>
          </DataGrid>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TrialBalancePage() {
  return (
    <ReportLanguageProvider>
      <TrialBalanceContent />
    </ReportLanguageProvider>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/app/accounting/reports/trial-balance/page.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/accounting/reports/trial-balance/page.tsx tests/app/accounting/reports/trial-balance/page.test.tsx
git commit -m "feat(reports): add Trial Balance page with KPIs, charts, and export"
```

---

### Task 3.2: Create Balance Sheet Page

**Files:**
- Create: `src/app/accounting/reports/balance-sheet/page.tsx`
- Test: `tests/app/accounting/reports/balance-sheet/page.test.tsx`

**Note:** Similar structure to Trial Balance. Follow same TDD pattern:
1. Write test checking page title, KPIs (Total Assets, Liabilities, Equity, Current Ratio, Quick Ratio, D/E)
2. Implement page with hierarchical table showing Assets (Current/Non-Current), Liabilities, Equity
3. Add donut chart for asset composition
4. Add balance check indicator (Assets = Liabilities + Equity)
5. Run test to verify passes
6. Commit

---

### Task 3.3: Create Income Statement Page

**Files:**
- Create: `src/app/accounting/reports/income-statement/page.tsx`
- Test: `tests/app/accounting/reports/income-statement/page.test.tsx`

**Note:** Similar structure. Follow TDD pattern:
1. Write test checking page title, KPIs (Revenue, Gross Profit, Operating Income, Net Income, Margins)
2. Implement page with period range selector
3. Add hierarchical table: Revenue → COGS → Gross Profit → Operating Expenses → Operating Income → Other → Net Income
4. Add area chart for trend
5. Run test to verify passes
6. Commit

---

### Task 3.4: Create Cash Flow Statement Page

**Files:**
- Create: `src/app/accounting/reports/cash-flow/page.tsx`
- Test: `tests/app/accounting/reports/cash-flow/page.test.tsx`

**Note:** Similar structure. Follow TDD pattern:
1. Write test checking page title, KPIs (Operating CF, Investing CF, Financing CF, Net Change, Free CF)
2. Implement page with period range selector
3. Add table sections: Operating (indirect method), Investing, Financing
4. Add waterfall chart for cash flow visualization
5. Run test to verify passes
6. Commit

---

## Phase 4: Integration & Final Testing

### Task 4.1: Update Reports Index Page

**Files:**
- Modify: `src/app/accounting/reports/page.tsx`

**Step 1: Update the main reports page to link to individual report pages**

Add quick access cards linking to:
- `/accounting/reports/trial-balance`
- `/accounting/reports/balance-sheet`
- `/accounting/reports/income-statement`
- `/accounting/reports/cash-flow`

**Step 2: Commit**

```bash
git add src/app/accounting/reports/page.tsx
git commit -m "feat(reports): update main reports page with links to dedicated report pages"
```

---

### Task 4.2: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 3: Run ESLint**

Run: `npm run lint`
Expected: No errors (warnings acceptable)

---

### Task 4.3: Manual E2E Testing

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test each report page**

- Navigate to `/accounting/reports/trial-balance`
  - Verify KPI cards show data
  - Verify chart renders
  - Verify table shows entries
  - Test language toggle
  - Test PDF/Excel/CSV exports

- Navigate to `/accounting/reports/balance-sheet`
  - Same verification steps

- Navigate to `/accounting/reports/income-statement`
  - Same verification steps

- Navigate to `/accounting/reports/cash-flow`
  - Same verification steps

**Step 3: Commit any fixes**

---

### Task 4.4: Final Commit

**Step 1: Create final commit**

```bash
git add .
git commit -m "feat(reports): complete accounting financial reports implementation

- Trial Balance with multi-period comparison
- Balance Sheet with ratios and drill-down
- Income Statement with margin analysis
- Cash Flow Statement (indirect method)
- Bilingual Thai/English support
- PDF/Excel/CSV export functionality
- KPI cards and charts for each report
- Drill-down navigation to GL ledger"
```

---

## Summary

| Phase | Tasks | Components |
|-------|-------|------------|
| 1 | 1.1-1.3 | Dependencies, Language Context, Export Service |
| 2 | 2.1-2.6 | ReportHeader, ReportKPICards, ReportToolbar, ReportPeriodSelector, DrillDownLink |
| 3 | 3.1-3.4 | Trial Balance, Balance Sheet, Income Statement, Cash Flow pages |
| 4 | 4.1-4.4 | Integration, testing, final verification |

**Total: 14 tasks**

Each task follows TDD: Write failing test → Implement → Verify test passes → Commit
