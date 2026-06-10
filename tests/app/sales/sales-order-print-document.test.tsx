/**
 * Sales Order Print Document UI Test
 * Verifies the printable sales document renders without runtime errors and
 * includes key fields, line items, and the VAT totals block.
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  SalesOrderPrintDocument,
  type SalesOrderPrintData,
} from '@/components/sales/SalesOrderPrintDocument';

const seedOrder: SalesOrderPrintData = {
  soNumber: 'SO2026-0001',
  customerName: 'โรงพยาบาลไทยสมุนไพร',
  customerContact: 'คุณสมหญิง ใจดี',
  customerAddress: '120 ถนนพหลโยธิน กรุงเทพฯ 10900',
  orderDate: '2026-06-10',
  requiredDate: '2026-06-20',
  status: 'confirmed',
  paymentTerms: 'เครดิต 30 วัน',
  notes: 'จัดส่งภายในเวลาทำการ',
  lines: [
    {
      itemCode: 'FG-001',
      itemName: 'แคปซูลขมิ้นชัน 500mg',
      itemUnit: 'ขวด',
      quantity: 100,
      unitPrice: 120,
      lineTotal: 12000,
    },
    {
      itemCode: 'FG-002',
      itemName: 'ยาหม่องสมุนไพร',
      itemUnit: 'ตลับ',
      quantity: 50,
      unitPrice: 80,
      lineTotal: 4000,
    },
  ],
};

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    json: async () => ({
      success: true,
      data: {
        companyName: 'Thai Herbal Co., Ltd.',
        companyNameTh: 'บริษัท สมุนไพรไทย จำกัด',
        address: '123 ถ.สุขุมวิท กรุงเทพฯ',
        phone: '02-123-4567',
        email: 'info@herbal.co.th',
        taxId: '0105551234567',
      },
    }),
  }) as any;
});

describe('SalesOrderPrintDocument', () => {
  it('renders the printable sales document without crashing', () => {
    render(<SalesOrderPrintDocument order={seedOrder} />);
    expect(screen.getByTestId('so-print-document')).toBeInTheDocument();
    expect(screen.getByText('ใบสั่งขาย / ใบส่งสินค้า')).toBeInTheDocument();
    expect(screen.getByText('SO2026-0001')).toBeInTheDocument();
  });

  it('shows customer info and line items', () => {
    render(<SalesOrderPrintDocument order={seedOrder} />);
    expect(screen.getByText('โรงพยาบาลไทยสมุนไพร')).toBeInTheDocument();
    expect(screen.getByText('แคปซูลขมิ้นชัน 500mg')).toBeInTheDocument();
    expect(screen.getByText('ยาหม่องสมุนไพร')).toBeInTheDocument();
    expect(screen.getByText('FG-001')).toBeInTheDocument();
  });

  it('computes subtotal, VAT 7%, and grand total', () => {
    render(<SalesOrderPrintDocument order={seedOrder} />);
    // subtotal = 12,000 + 4,000 = 16,000.00
    expect(screen.getByText('16,000.00')).toBeInTheDocument();
    // VAT 7% = 1,120.00
    expect(screen.getByText('1,120.00')).toBeInTheDocument();
    // grand total = 17,120.00
    expect(screen.getByText('17,120.00')).toBeInTheDocument();
  });

  it('renders the Thai baht text for the grand total', () => {
    render(<SalesOrderPrintDocument order={seedOrder} />);
    // 17,120.00 -> หนึ่งหมื่นเจ็ดพันหนึ่งร้อยยี่สิบบาทถ้วน
    expect(
      screen.getByText(/หนึ่งหมื่นเจ็ดพันหนึ่งร้อยยี่สิบบาทถ้วน/),
    ).toBeInTheDocument();
  });

  it('loads company header from settings', async () => {
    render(<SalesOrderPrintDocument order={seedOrder} />);
    await waitFor(() => {
      expect(screen.getByText('บริษัท สมุนไพรไทย จำกัด')).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/settings/company');
  });
});
