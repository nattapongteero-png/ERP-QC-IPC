/**
 * AR Invoice / Tax Invoice Print Document UI Test
 * Verifies the legal ใบกำกับภาษี form renders, shows both parties' tax ids,
 * money with fixed 2-dp (formatMoney), and the Thai baht text for the total.
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  ARInvoicePrintDocument,
  type ARInvoicePrintData,
} from '@/components/accounting/ARInvoicePrintDocument';

const seedInvoice: ARInvoicePrintData = {
  invoiceNumber: 'INV2026-0001',
  taxInvoiceNumber: 'T-202606-0001',
  invoiceDate: '2026-06-10',
  dueDate: '2026-07-10',
  description: 'ขายสินค้าสมุนไพร',
  subtotal: 10000,
  vatAmount: 700,
  totalAmount: 10700,
  paidAmount: 0,
  lines: [
    { description: 'แคปซูลขมิ้นชัน', quantity: 60, unitPrice: 100, amount: 6000 },
    { description: 'ยาหม่องสมุนไพร', quantity: 40, unitPrice: 100, amount: 4000 },
  ],
  customer: {
    name: 'โรงพยาบาลไทยสมุนไพร',
    taxId: '0994000123456',
    address: '120 ถนนพหลโยธิน กรุงเทพฯ',
  },
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

describe('ARInvoicePrintDocument', () => {
  it('renders the legal tax invoice form without crashing', () => {
    render(<ARInvoicePrintDocument invoice={seedInvoice} />);
    expect(screen.getByTestId('ari-print-document')).toBeInTheDocument();
    expect(screen.getByText('ใบกำกับภาษี / ใบแจ้งหนี้')).toBeInTheDocument();
    expect(screen.getByText('INV2026-0001')).toBeInTheDocument();
    expect(screen.getByText('T-202606-0001')).toBeInTheDocument();
  });

  it('shows the customer tax id (legal requirement)', () => {
    render(<ARInvoicePrintDocument invoice={seedInvoice} />);
    expect(screen.getByText(/0994000123456/)).toBeInTheDocument();
  });

  it('renders money with fixed 2 decimals', () => {
    render(<ARInvoicePrintDocument invoice={seedInvoice} />);
    // subtotal 10,000.00 (formatMoney keeps the .00, unlike formatNumber)
    expect(screen.getByText('10,000.00')).toBeInTheDocument();
    expect(screen.getByText('700.00')).toBeInTheDocument();
    expect(screen.getByText('10,700.00')).toBeInTheDocument();
  });

  it('renders the Thai baht text for the grand total', () => {
    render(<ARInvoicePrintDocument invoice={seedInvoice} />);
    // 10,700.00 -> หนึ่งหมื่นเจ็ดร้อยบาทถ้วน
    expect(screen.getByText(/หนึ่งหมื่นเจ็ดร้อยบาทถ้วน/)).toBeInTheDocument();
  });

  it('loads the seller company header from settings', async () => {
    render(<ARInvoicePrintDocument invoice={seedInvoice} />);
    await waitFor(() => {
      expect(screen.getByText('บริษัท สมุนไพรไทย จำกัด')).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/settings/company');
  });
});
