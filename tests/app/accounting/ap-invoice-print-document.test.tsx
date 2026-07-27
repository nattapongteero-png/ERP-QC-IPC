/**
 * AP Invoice Print Document UI Test
 * Verifies the printable vendor-invoice document renders without runtime errors
 * and includes the vendor block, line items, the VAT/WHT totals and the Thai
 * baht text for the net payable.
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  APInvoicePrintDocument,
  type APInvoicePrintData,
} from '@/components/accounting/APInvoicePrintDocument';

const seedInvoice: APInvoicePrintData = {
  invoiceNumber: 'AP2026-0001',
  invoiceDate: '2026-06-10',
  receivedDate: '2026-06-11',
  dueDate: '2026-07-10',
  description: 'ค่าวัตถุดิบสมุนไพร',
  subtotal: 10000,
  vatAmount: 700,
  whtAmount: 300, // 3% WHT on services
  totalAmount: 10700,
  paidAmount: 0,
  lines: [
    {
      description: 'ผงขมิ้นชัน',
      quantity: 100,
      unitPrice: 50,
      amount: 5000,
    },
    {
      description: 'สารสกัดฟ้าทะลายโจร',
      quantity: 50,
      unitPrice: 100,
      amount: 5000,
    },
  ],
  vendor: {
    name: 'บริษัท สมุนไพรวัตถุดิบ จำกัด',
    taxId: '0105551112223',
    address: '99 ถ.รังสิต ปทุมธานี',
    contactPerson: 'คุณมานะ',
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

describe('APInvoicePrintDocument', () => {
  it('renders the printable AP invoice without crashing', () => {
    render(<APInvoicePrintDocument invoice={seedInvoice} />);
    expect(screen.getByTestId('api-print-document')).toBeInTheDocument();
    expect(screen.getByText('ใบแจ้งหนี้เจ้าหนี้')).toBeInTheDocument();
    expect(screen.getByText('AP2026-0001')).toBeInTheDocument();
  });

  it('shows vendor info and line items', () => {
    render(<APInvoicePrintDocument invoice={seedInvoice} />);
    expect(screen.getByText('บริษัท สมุนไพรวัตถุดิบ จำกัด')).toBeInTheDocument();
    expect(screen.getByText('ผงขมิ้นชัน')).toBeInTheDocument();
    expect(screen.getByText('สารสกัดฟ้าทะลายโจร')).toBeInTheDocument();
    // vendor tax id is a legal requirement on the document
    expect(screen.getByText(/0105551112223/)).toBeInTheDocument();
  });

  it('shows subtotal, VAT, withholding tax and net payable', () => {
    render(<APInvoicePrintDocument invoice={seedInvoice} />);
    expect(screen.getByText('10,000.00')).toBeInTheDocument(); // subtotal
    expect(screen.getByText('700.00')).toBeInTheDocument(); // VAT
    expect(screen.getByText('-300.00')).toBeInTheDocument(); // WHT deducted
    // net payable = 10,700 - 300 = 10,400.00
    expect(screen.getByText('10,400.00')).toBeInTheDocument();
  });

  it('renders the Thai baht text for the net payable', () => {
    render(<APInvoicePrintDocument invoice={seedInvoice} />);
    // 10,400.00 -> หนึ่งหมื่นสี่ร้อยบาทถ้วน
    expect(
      screen.getByText(/หนึ่งหมื่นสี่ร้อยบาทถ้วน/),
    ).toBeInTheDocument();
  });

  it('loads company header (buyer) from settings', async () => {
    render(<APInvoicePrintDocument invoice={seedInvoice} />);
    await waitFor(() => {
      expect(screen.getByText('บริษัท สมุนไพรไทย จำกัด')).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/settings/company');
  });

  it('hides the withholding-tax row when there is no WHT', () => {
    render(
      <APInvoicePrintDocument
        invoice={{ ...seedInvoice, whtAmount: 0 }}
      />,
    );
    expect(screen.queryByText('หัก ภาษี ณ ที่จ่าย')).not.toBeInTheDocument();
  });
});
