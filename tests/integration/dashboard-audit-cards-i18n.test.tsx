/**
 * Integration Tests: Audit Dashboard Cards i18n
 *
 * The audit dashboard at /dashboard/audit renders 8 KPI cards (RM Summary,
 * RM Status, Expiry Alert, Min Stock, QC Summary, Production Status,
 * Pending QC, FG Approved). Before this fix their titles/subtitles were
 * hardcoded English strings — switching the top-bar language did nothing
 * for these cards. This file asserts the cards render Thai when the locale
 * is th and English when the locale is en.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';

// Use real next-intl so NextIntlClientProvider actually controls locale.
vi.unmock('next-intl');

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NextIntlClientProvider } from 'next-intl';

import thDashboard from '../../src/locales/th/dashboard.json';
import enDashboard from '../../src/locales/en/dashboard.json';

import { RmSummaryCard } from '@/components/dashboard/rm-summary-card';
import { RmStatusCard } from '@/components/dashboard/rm-status-card';
import { ExpiryAlertCard } from '@/components/dashboard/expiry-alert-card';
import { MinStockAlertCard } from '@/components/dashboard/min-stock-alert-card';
import { QcSummaryCard } from '@/components/dashboard/qc-summary-card';
import { ProductionStatusCard } from '@/components/dashboard/production-status-card';
import { PendingQcCard } from '@/components/dashboard/pending-qc-card';
import { FgApprovedCard } from '@/components/dashboard/fg-approved-card';

// Mock the inner KpiCard visual wrapper — we only care that its title/subtitle
// props render; we don't need real styling for these tests.
vi.mock('@/components/dashboard/kpi-card', () => ({
  KpiCard: ({
    title,
    subtitle,
    value,
    children,
  }: {
    title: string;
    subtitle?: string;
    value: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <div data-testid="kpi-card">
      <h3 data-testid="kpi-title">{title}</h3>
      <div data-testid="kpi-value">{value}</div>
      {subtitle && <div data-testid="kpi-subtitle">{subtitle}</div>}
      <div data-testid="kpi-body">{children}</div>
    </div>
  ),
}));

function renderLocale(ui: React.ReactElement, locale: 'th' | 'en') {
  const messages = { dashboard: locale === 'th' ? thDashboard : enDashboard };
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Bangkok">
      {ui}
    </NextIntlClientProvider>,
  );
}

// --- Fixtures ----------------------------------------------------------------
// Complete shapes matching src/lib/services/audit-dashboard-service.ts
const rmSummary = { totalLots: 120, totalQuantity: 45000, byMonth: [] };
const rmStatus = {
  total: 100,
  quarantine: 10,
  underTest: 5,
  released: 70,
  rejected: 2,
  blocked: 0,
};
const expiryAlerts = { expired: 1, expiringSoon: 3, expiringWarning: 5, items: [] };
const minStockAlerts = {
  criticalCount: 2,
  warningCount: 4,
  items: [],
};
const qcSummary = {
  totalTests: 100,
  passRate: 95,
  passedTests: 90,
  failedTests: 3,
  pendingTests: 7,
  byTestType: [],
};
const productionStatus = {
  completionRate: 87,
  completed: 40,
  inProgress: 5,
  planned: 10,
  released: 0,
  cancelled: 0,
  total: 55,
};
const pendingQcRelease = {
  count: 3,
  items: [
    { lotId: 1, lotNumber: 'L001', itemName: 'Item A', testDate: '2025-12-01', daysWaiting: 5 },
    { lotId: 2, lotNumber: 'L002', itemName: 'Item B', testDate: '2025-11-28', daysWaiting: 8 },
  ],
};
const fgApproved = { totalBatches: 25, totalQuantity: 12000, byMonth: [] };

// --- Tests -------------------------------------------------------------------
describe('Audit Dashboard Cards — i18n', () => {
  describe('RmSummaryCard', () => {
    it('English', () => {
      renderLocale(<RmSummaryCard data={rmSummary} />, 'en');
      expect(screen.getByText('RM Received YTD')).toBeInTheDocument();
      expect(screen.getByText('lots')).toBeInTheDocument();
    });
    it('Thai', () => {
      renderLocale(<RmSummaryCard data={rmSummary} />, 'th');
      expect(screen.getByText('วัตถุดิบที่รับเข้า YTD')).toBeInTheDocument();
      expect(screen.getByText('ล็อต')).toBeInTheDocument();
    });
  });

  describe('RmStatusCard', () => {
    it('English', () => {
      renderLocale(<RmStatusCard data={rmStatus} />, 'en');
      expect(screen.getByText('RM Status')).toBeInTheDocument();
      expect(screen.getByText('total lots')).toBeInTheDocument();
      expect(screen.getByText(/Quarantine: 10/)).toBeInTheDocument();
      expect(screen.getByText(/Under Test: 5/)).toBeInTheDocument();
      expect(screen.getByText(/Released: 70/)).toBeInTheDocument();
      expect(screen.getByText(/Rejected: 2/)).toBeInTheDocument();
    });
    it('Thai', () => {
      renderLocale(<RmStatusCard data={rmStatus} />, 'th');
      expect(screen.getByText('สถานะวัตถุดิบ')).toBeInTheDocument();
      expect(screen.getByText('ล็อตรวม')).toBeInTheDocument();
      expect(screen.getByText(/กักกัน: 10/)).toBeInTheDocument();
      expect(screen.getByText(/อยู่ระหว่างทดสอบ: 5/)).toBeInTheDocument();
      expect(screen.getByText(/ปล่อยใช้งาน: 70/)).toBeInTheDocument();
    });
  });

  describe('ExpiryAlertCard', () => {
    it('English', () => {
      renderLocale(<ExpiryAlertCard data={expiryAlerts} />, 'en');
      expect(screen.getByText('Expiry Alerts')).toBeInTheDocument();
      expect(screen.getByText(/Expired: 1/)).toBeInTheDocument();
      expect(screen.getByText(/30 days: 3/)).toBeInTheDocument();
      expect(screen.getByText(/90 days: 5/)).toBeInTheDocument();
    });
    it('Thai', () => {
      renderLocale(<ExpiryAlertCard data={expiryAlerts} />, 'th');
      expect(screen.getByText('แจ้งเตือนหมดอายุ')).toBeInTheDocument();
      expect(screen.getByText(/หมดอายุ: 1/)).toBeInTheDocument();
      expect(screen.getByText(/30 วัน: 3/)).toBeInTheDocument();
      expect(screen.getByText(/90 วัน: 5/)).toBeInTheDocument();
    });
  });

  describe('MinStockAlertCard', () => {
    it('English', () => {
      renderLocale(<MinStockAlertCard data={minStockAlerts} />, 'en');
      expect(screen.getByText('Min Stock Alerts')).toBeInTheDocument();
      expect(screen.getByText(/Below Min: 2/)).toBeInTheDocument();
      expect(screen.getByText(/Below Reorder: 4/)).toBeInTheDocument();
    });
    it('Thai', () => {
      renderLocale(<MinStockAlertCard data={minStockAlerts} />, 'th');
      expect(screen.getByText('แจ้งเตือนสต็อกต่ำ')).toBeInTheDocument();
      expect(screen.getByText(/ต่ำกว่าขั้นต่ำ: 2/)).toBeInTheDocument();
      expect(screen.getByText(/ต่ำกว่าจุดสั่งซื้อ: 4/)).toBeInTheDocument();
    });
  });

  describe('QcSummaryCard', () => {
    it('English', () => {
      renderLocale(<QcSummaryCard data={qcSummary} />, 'en');
      expect(screen.getByText('QC Summary YTD')).toBeInTheDocument();
      expect(screen.getByText('pass rate')).toBeInTheDocument();
      expect(screen.getByText(/Pass: 90/)).toBeInTheDocument();
      expect(screen.getByText(/Fail: 3/)).toBeInTheDocument();
      expect(screen.getByText(/Pending: 7/)).toBeInTheDocument();
    });
    it('Thai', () => {
      renderLocale(<QcSummaryCard data={qcSummary} />, 'th');
      expect(screen.getByText('สรุปการทดสอบคุณภาพ YTD')).toBeInTheDocument();
      expect(screen.getByText('อัตราผ่าน')).toBeInTheDocument();
      expect(screen.getByText(/ผ่าน: 90/)).toBeInTheDocument();
      expect(screen.getByText(/ไม่ผ่าน: 3/)).toBeInTheDocument();
      expect(screen.getByText(/รอดำเนินการ: 7/)).toBeInTheDocument();
    });
  });

  describe('ProductionStatusCard', () => {
    it('English', () => {
      renderLocale(<ProductionStatusCard data={productionStatus} />, 'en');
      expect(screen.getByText('Production YTD')).toBeInTheDocument();
      expect(screen.getByText('completion')).toBeInTheDocument();
      expect(screen.getByText(/Done: 40/)).toBeInTheDocument();
      expect(screen.getByText(/In Progress: 5/)).toBeInTheDocument();
      expect(screen.getByText(/Planned: 10/)).toBeInTheDocument();
    });
    it('Thai', () => {
      renderLocale(<ProductionStatusCard data={productionStatus} />, 'th');
      expect(screen.getByText('การผลิต YTD')).toBeInTheDocument();
      expect(screen.getByText('ความสำเร็จ')).toBeInTheDocument();
      expect(screen.getByText(/เสร็จแล้ว: 40/)).toBeInTheDocument();
      expect(screen.getByText(/กำลังดำเนินการ: 5/)).toBeInTheDocument();
      expect(screen.getByText(/ตามแผน: 10/)).toBeInTheDocument();
    });
  });

  describe('PendingQcCard', () => {
    it('English', () => {
      renderLocale(<PendingQcCard data={pendingQcRelease} />, 'en');
      expect(screen.getByText('Pending QC Release')).toBeInTheDocument();
      expect(screen.getByText(/Oldest: 8 days waiting/)).toBeInTheDocument();
    });
    it('Thai', () => {
      renderLocale(<PendingQcCard data={pendingQcRelease} />, 'th');
      expect(screen.getByText('รอ QC ปล่อยใช้งาน')).toBeInTheDocument();
      expect(screen.getByText(/เก่าสุด: 8 วัน/)).toBeInTheDocument();
    });
    it('shows translated "no items" message when count is 0', () => {
      renderLocale(
        <PendingQcCard data={{ count: 0, items: [] as typeof pendingQcRelease.items }} />,
        'th',
      );
      expect(screen.getByText('ไม่มีรายการรอดำเนินการ')).toBeInTheDocument();
    });
  });

  describe('FgApprovedCard', () => {
    it('English', () => {
      renderLocale(<FgApprovedCard data={fgApproved} />, 'en');
      expect(screen.getByText('FG Approved YTD')).toBeInTheDocument();
      expect(screen.getByText('batches')).toBeInTheDocument();
      // "12,000 units total"
      expect(screen.getByText(/12,000 units total/)).toBeInTheDocument();
    });
    it('Thai', () => {
      renderLocale(<FgApprovedCard data={fgApproved} />, 'th');
      expect(screen.getByText('สินค้าสำเร็จรูปอนุมัติ YTD')).toBeInTheDocument();
      expect(screen.getByText('แบตช์')).toBeInTheDocument();
      // "12,000 หน่วยรวม"
      expect(screen.getByText(/12,000 หน่วยรวม/)).toBeInTheDocument();
    });
  });
});

describe('Audit cards — locale coverage (all 8 cards have TH + EN)', () => {
  // Parametric catalog: ensures someone adding a 9th card can't skip translations.
  const cards: Array<{
    name: string;
    render: (locale: 'th' | 'en') => ReturnType<typeof renderLocale>;
    enTitle: string;
    thTitle: string;
  }> = [
    {
      name: 'RmSummary',
      render: (l) => renderLocale(<RmSummaryCard data={rmSummary} />, l),
      enTitle: 'RM Received YTD',
      thTitle: 'วัตถุดิบที่รับเข้า YTD',
    },
    {
      name: 'RmStatus',
      render: (l) => renderLocale(<RmStatusCard data={rmStatus} />, l),
      enTitle: 'RM Status',
      thTitle: 'สถานะวัตถุดิบ',
    },
    {
      name: 'ExpiryAlert',
      render: (l) => renderLocale(<ExpiryAlertCard data={expiryAlerts} />, l),
      enTitle: 'Expiry Alerts',
      thTitle: 'แจ้งเตือนหมดอายุ',
    },
    {
      name: 'MinStockAlert',
      render: (l) => renderLocale(<MinStockAlertCard data={minStockAlerts} />, l),
      enTitle: 'Min Stock Alerts',
      thTitle: 'แจ้งเตือนสต็อกต่ำ',
    },
    {
      name: 'QcSummary',
      render: (l) => renderLocale(<QcSummaryCard data={qcSummary} />, l),
      enTitle: 'QC Summary YTD',
      thTitle: 'สรุปการทดสอบคุณภาพ YTD',
    },
    {
      name: 'ProductionStatus',
      render: (l) => renderLocale(<ProductionStatusCard data={productionStatus} />, l),
      enTitle: 'Production YTD',
      thTitle: 'การผลิต YTD',
    },
    {
      name: 'PendingQc',
      render: (l) => renderLocale(<PendingQcCard data={pendingQcRelease} />, l),
      enTitle: 'Pending QC Release',
      thTitle: 'รอ QC ปล่อยใช้งาน',
    },
    {
      name: 'FgApproved',
      render: (l) => renderLocale(<FgApprovedCard data={fgApproved} />, l),
      enTitle: 'FG Approved YTD',
      thTitle: 'สินค้าสำเร็จรูปอนุมัติ YTD',
    },
  ];

  it.each(cards)('$name renders its English title and Thai title differently', (card) => {
    const { unmount } = card.render('en');
    expect(screen.getByText(card.enTitle)).toBeInTheDocument();
    unmount();
    card.render('th');
    expect(screen.getByText(card.thTitle)).toBeInTheDocument();
    expect(card.enTitle).not.toBe(card.thTitle);
  });
});
