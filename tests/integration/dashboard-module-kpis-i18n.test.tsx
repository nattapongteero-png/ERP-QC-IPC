/**
 * Integration Tests: Dashboard Module KPI i18n
 *
 * Regression context: user reported that when switching Thai → English →
 * Thai on https://herbal-erp-metaherb.bmscloud.in.th/dashboard, the
 * "Module KPIs" card + sub-tabs (HR, Purchasing, Sales, VMI, GMP) stayed
 * frozen in the original language. Root cause: the card title, card
 * description, all 5 tab titles, and every KPI label/subtitle inside
 * the 5 section components were hardcoded strings — they never called
 * useTranslations().
 *
 * This file proves every label responds to the active locale by rendering
 * each component twice (once with a TH NextIntlClientProvider, once with EN)
 * and asserting the output strings diverge.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';

// Restore real next-intl (tests/setup.ts globally mocks useTranslations with
// English only; here we need a real NextIntlClientProvider so the TH locale
// actually takes effect).
vi.unmock('next-intl');

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NextIntlClientProvider } from 'next-intl';

// Mock DevExtreme TabPanel — renders items + titles in DOM so we can query them.
vi.mock('devextreme-react/tab-panel', () => ({
  default: vi.fn(({ items, itemTitleRender, itemRender, selectedIndex }) => {
    const currentItem = items?.[selectedIndex] ?? items?.[0];
    return (
      <div data-testid="tab-panel">
        <div data-testid="tab-headers">
          {items?.map((item: { id: string }) => (
            <div key={item.id} data-testid={`tab-header-${item.id}`}>
              {itemTitleRender ? itemTitleRender(item) : null}
            </div>
          ))}
        </div>
        <div data-testid="tab-content">
          {currentItem && itemRender ? itemRender(currentItem) : null}
        </div>
      </div>
    );
  }),
  Item: vi.fn(() => null),
}));

// Import the real translation JSON blobs
import thDashboard from '../../src/locales/th/dashboard.json';
import enDashboard from '../../src/locales/en/dashboard.json';

// Import components AFTER next-intl has been restored
import { ModuleKpiTabs } from '@/components/dashboard/module-kpi-tabs';
import { HRKpiSection } from '@/components/dashboard/hr-kpi-section';
import { PurchaseKpiSection } from '@/components/dashboard/purchase-kpi-section';
import { SalesKpiSection } from '@/components/dashboard/sales-kpi-section';
import { VMIKpiSection } from '@/components/dashboard/vmi-kpi-section';
import { GMPKpiSection } from '@/components/dashboard/gmp-kpi-section';
import type { DashboardModuleKpis } from '@/lib/services/dashboard.service';

// Sample data fixtures — values won't change across locales, only labels.
const hrData = {
  totalEmployees: 50,
  activeEmployees: 45,
  trainingCompliance: 85,
  healthRecordsDue: 3,
  gmpAuthorized: 20,
  pendingNotifications: 5,
};

const purchaseData = {
  pendingPOs: 10,
  approvedPOs: 25,
  poValueMtd: 500000,
  activeVendors: 15,
  onTimeDeliveryRate: 92,
  avlCoverage: 75,
};

const salesData = {
  pendingSOs: 8,
  soValueMtd: 750000,
  ordersFulfilledMtd: 42,
  atpShortages: 2,
  fulfillmentRate: 88,
};

const vmiData = {
  vmiItems: 30,
  lastSyncTime: '2025-12-25T10:00:00Z',
  stockBelowReorder: 5,
  pendingAsns: 3,
  outstandingOrderValue: 150000,
};

const gmpData = {
  openIssues: 4,
  openDeviations: 2,
  openCapas: 1,
  openAuditFindings: 3,
  trainingGaps: 4,
};

const moduleData: DashboardModuleKpis = {
  hr: hrData,
  purchase: purchaseData,
  sales: salesData,
  vmi: vmiData,
  gmp: gmpData,
  generatedAt: '2025-12-25T12:00:00Z',
};

// Renders UI inside a NextIntlClientProvider configured for a given locale.
function renderLocale(
  ui: React.ReactElement,
  locale: 'th' | 'en',
) {
  const messages = { dashboard: locale === 'th' ? thDashboard : enDashboard };
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Bangkok">
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('Dashboard Module KPIs — i18n switch', () => {
  describe('ModuleKpiTabs (card + tab titles)', () => {
    it('renders English labels under en locale', () => {
      renderLocale(
        <ModuleKpiTabs data={moduleData} isLoading={false} />,
        'en',
      );
      // Card title + description
      expect(screen.getByText('Module KPIs')).toBeInTheDocument();
      expect(
        screen.getByText('Performance indicators broken down by module'),
      ).toBeInTheDocument();
      // Tab titles
      expect(screen.getByText('HR / Personnel')).toBeInTheDocument();
      expect(screen.getByText('Purchasing')).toBeInTheDocument();
      expect(screen.getByText('Sales')).toBeInTheDocument();
      expect(screen.getByText('VMI')).toBeInTheDocument();
      expect(screen.getByText('GMP Compliance')).toBeInTheDocument();
    });

    it('renders Thai labels under th locale', () => {
      renderLocale(
        <ModuleKpiTabs data={moduleData} isLoading={false} />,
        'th',
      );
      expect(screen.getByText('ตัวชี้วัดประสิทธิภาพตามโมดูล')).toBeInTheDocument();
      expect(screen.getByText('ตัวชี้วัดประสิทธิภาพแยกตามโมดูล')).toBeInTheDocument();
      expect(screen.getByText('ทรัพยากรบุคคล')).toBeInTheDocument();
      // "จัดซื้อ" appears for tab id=purchase
      expect(screen.getAllByText('จัดซื้อ').length).toBeGreaterThan(0);
      expect(screen.getByText('ขาย')).toBeInTheDocument();
      // VMI + GMP Compliance stay in English by design (brand-locked)
      expect(screen.getAllByText('VMI').length).toBeGreaterThan(0);
      expect(screen.getAllByText('GMP Compliance').length).toBeGreaterThan(0);
    });
  });

  describe('HRKpiSection', () => {
    it('English labels', () => {
      renderLocale(<HRKpiSection data={hrData} />, 'en');
      expect(screen.getByText('Total Employees')).toBeInTheDocument();
      expect(screen.getByText('Training Compliance')).toBeInTheDocument();
      expect(screen.getByText('Health Records Due')).toBeInTheDocument();
      expect(screen.getByText('GMP Authorized')).toBeInTheDocument();
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    it('Thai labels', () => {
      renderLocale(<HRKpiSection data={hrData} />, 'th');
      expect(screen.getByText('พนักงานทั้งหมด')).toBeInTheDocument();
      expect(screen.getByText('การอบรมที่เป็นปัจจุบัน')).toBeInTheDocument();
      expect(screen.getByText('บันทึกสุขภาพครบกำหนด')).toBeInTheDocument();
      expect(screen.getByText('ผู้ได้รับอนุญาต GMP')).toBeInTheDocument();
      expect(screen.getByText('การแจ้งเตือน')).toBeInTheDocument();
    });
  });

  describe('PurchaseKpiSection', () => {
    it('English labels', () => {
      renderLocale(<PurchaseKpiSection data={purchaseData} />, 'en');
      expect(screen.getByText('Pending POs')).toBeInTheDocument();
      expect(screen.getByText('PO Value (MTD)')).toBeInTheDocument();
      expect(screen.getByText('Active Vendors')).toBeInTheDocument();
      expect(screen.getByText('AVL Coverage')).toBeInTheDocument();
      expect(screen.getByText('Approved POs')).toBeInTheDocument();
      expect(screen.getByText('On-Time Delivery')).toBeInTheDocument();
    });

    it('Thai labels', () => {
      renderLocale(<PurchaseKpiSection data={purchaseData} />, 'th');
      expect(screen.getByText('ใบสั่งซื้อรออนุมัติ')).toBeInTheDocument();
      expect(screen.getByText('มูลค่าใบสั่งซื้อ (MTD)')).toBeInTheDocument();
      expect(screen.getByText('ผู้ขายที่ใช้งาน')).toBeInTheDocument();
      expect(screen.getByText('ความครอบคลุม AVL')).toBeInTheDocument();
      expect(screen.getByText('ใบสั่งซื้อที่อนุมัติแล้ว')).toBeInTheDocument();
      expect(screen.getByText('การส่งมอบตรงเวลา')).toBeInTheDocument();
    });
  });

  describe('SalesKpiSection', () => {
    it('English labels', () => {
      renderLocale(<SalesKpiSection data={salesData} />, 'en');
      expect(screen.getByText('Pending Orders')).toBeInTheDocument();
      expect(screen.getByText('Sales Value (MTD)')).toBeInTheDocument();
      expect(screen.getByText('Orders Fulfilled')).toBeInTheDocument();
      expect(screen.getByText('Fulfillment Rate')).toBeInTheDocument();
      expect(screen.getByText('ATP Shortages')).toBeInTheDocument();
    });

    it('Thai labels', () => {
      renderLocale(<SalesKpiSection data={salesData} />, 'th');
      expect(screen.getByText('ใบสั่งขายรอดำเนินการ')).toBeInTheDocument();
      expect(screen.getByText('มูลค่าการขาย (MTD)')).toBeInTheDocument();
      expect(screen.getByText('ใบสั่งที่ส่งมอบแล้ว')).toBeInTheDocument();
      expect(screen.getByText('อัตราการส่งมอบ')).toBeInTheDocument();
      expect(screen.getByText('ATP ขาดแคลน')).toBeInTheDocument();
    });
  });

  describe('VMIKpiSection', () => {
    it('English labels', () => {
      renderLocale(<VMIKpiSection data={vmiData} />, 'en');
      expect(screen.getByText('VMI Items')).toBeInTheDocument();
      expect(screen.getByText('Below Reorder')).toBeInTheDocument();
      expect(screen.getByText('Pending ASNs')).toBeInTheDocument();
      expect(screen.getByText('Outstanding Value')).toBeInTheDocument();
      expect(screen.getByText('Last Sync')).toBeInTheDocument();
    });

    it('Thai labels', () => {
      renderLocale(<VMIKpiSection data={vmiData} />, 'th');
      expect(screen.getByText('รายการ VMI')).toBeInTheDocument();
      expect(screen.getByText('ต่ำกว่าจุดสั่งซื้อ')).toBeInTheDocument();
      expect(screen.getByText('ASN รอรับเข้า')).toBeInTheDocument();
      expect(screen.getByText('มูลค่าคงค้าง')).toBeInTheDocument();
      expect(screen.getByText('ซิงค์ล่าสุด')).toBeInTheDocument();
    });

    it('shows translated "Never" when lastSyncTime is null', () => {
      renderLocale(
        <VMIKpiSection data={{ ...vmiData, lastSyncTime: null }} />,
        'th',
      );
      expect(screen.getByText('ยังไม่เคย')).toBeInTheDocument();
    });
  });

  describe('GMPKpiSection', () => {
    it('English labels', () => {
      renderLocale(<GMPKpiSection data={gmpData} />, 'en');
      expect(screen.getByText('Compliance Score')).toBeInTheDocument();
      expect(screen.getByText('Open Deviations')).toBeInTheDocument();
      expect(screen.getByText('Open CAPAs')).toBeInTheDocument();
      expect(screen.getByText('Audit Findings')).toBeInTheDocument();
      expect(screen.getByText('Training Gaps')).toBeInTheDocument();
    });

    it('Thai labels', () => {
      renderLocale(<GMPKpiSection data={gmpData} />, 'th');
      expect(screen.getByText('คะแนนการปฏิบัติตาม')).toBeInTheDocument();
      // "ความเบี่ยงเบนที่เปิดอยู่" appears here — shared with dashboard.kpis.openDeviations
      expect(screen.getAllByText('ความเบี่ยงเบนที่เปิดอยู่').length).toBeGreaterThan(0);
      expect(screen.getByText('CAPA ที่เปิดอยู่')).toBeInTheDocument();
      expect(screen.getByText('ข้อพบจากการตรวจสอบ')).toBeInTheDocument();
      expect(screen.getByText('ช่องว่างการอบรม')).toBeInTheDocument();
    });
  });

  describe('Language switch — text diverges across locales', () => {
    it('HR total-employees label differs TH vs EN', () => {
      const { unmount } = renderLocale(<HRKpiSection data={hrData} />, 'en');
      const en = screen.getByText('Total Employees').textContent;
      unmount();
      renderLocale(<HRKpiSection data={hrData} />, 'th');
      const th = screen.getByText('พนักงานทั้งหมด').textContent;
      expect(en).not.toBe(th);
    });

    it('Module KPI card title differs TH vs EN', () => {
      const { unmount } = renderLocale(
        <ModuleKpiTabs data={moduleData} isLoading={false} />,
        'en',
      );
      expect(screen.getByText('Module KPIs')).toBeInTheDocument();
      unmount();
      renderLocale(
        <ModuleKpiTabs data={moduleData} isLoading={false} />,
        'th',
      );
      expect(screen.getByText('ตัวชี้วัดประสิทธิภาพตามโมดูล')).toBeInTheDocument();
      // And the English string should NOT appear in Thai locale
      expect(screen.queryByText('Module KPIs')).not.toBeInTheDocument();
    });
  });
});
