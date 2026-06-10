/**
 * PR Print Document UI Test
 * Verifies the printable purchase-requisition form renders without
 * runtime errors and includes the key document fields and line items.
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { PRPrintDocument } from '@/components/purchasing/PRPrintDocument';
import type { PRWithLines } from '@/types/purchase-requisition';

const seedPR: PRWithLines = {
  id: 1,
  prNumber: 'PR2026-0001',
  requesterId: 1,
  requesterName: 'สมชาย ใจดี',
  departmentId: 2,
  departmentName: 'ฝ่ายผลิต',
  status: 'draft',
  priority: 'high',
  requiredDate: '2026-07-01',
  description: 'ขอซื้อวัตถุดิบสำหรับการผลิต',
  justification: 'สต๊อกใกล้หมด',
  totalAmount: 3500,
  createdAt: '2026-06-10',
  updatedAt: '2026-06-10',
  lines: [
    {
      id: 10,
      prId: 1,
      lineNumber: 1,
      itemId: 5,
      itemCode: 'RM-001',
      description: 'ขมิ้นชันผง',
      quantity: 10,
      unitOfMeasure: 'kg',
      estimatedUnitPrice: 250,
      estimatedAmount: 2500,
      notes: 'เกรด A',
      status: 'pending',
      createdAt: '2026-06-10',
      updatedAt: '2026-06-10',
    },
    {
      id: 11,
      prId: 1,
      lineNumber: 2,
      itemId: null,
      itemCode: null,
      description: 'ถุงบรรจุภัณฑ์',
      quantity: 100,
      unitOfMeasure: 'pcs',
      estimatedUnitPrice: 10,
      estimatedAmount: 1000,
      notes: null,
      status: 'pending',
      createdAt: '2026-06-10',
      updatedAt: '2026-06-10',
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

describe('PRPrintDocument', () => {
  it('renders the printable PR form without crashing', async () => {
    render(<PRPrintDocument pr={seedPR} />);

    expect(screen.getByTestId('pr-print-document')).toBeInTheDocument();
    // Title + PR number
    expect(screen.getByText('ใบขอซื้อ')).toBeInTheDocument();
    expect(screen.getByText('PR2026-0001')).toBeInTheDocument();
  });

  it('shows requester, department and line items', async () => {
    render(<PRPrintDocument pr={seedPR} />);

    expect(screen.getByText('สมชาย ใจดี')).toBeInTheDocument();
    expect(screen.getByText('ฝ่ายผลิต')).toBeInTheDocument();
    expect(screen.getByText('ขมิ้นชันผง')).toBeInTheDocument();
    expect(screen.getByText('ถุงบรรจุภัณฑ์')).toBeInTheDocument();
    expect(screen.getByText('RM-001')).toBeInTheDocument();
  });

  it('loads and displays company header from settings', async () => {
    render(<PRPrintDocument pr={seedPR} />);

    await waitFor(() => {
      expect(screen.getByText('บริษัท สมุนไพรไทย จำกัด')).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/settings/company');
  });

  it('computes the total from line amounts', async () => {
    render(<PRPrintDocument pr={seedPR} />);
    // 10*250 + 100*10 = 3,500.00
    expect(screen.getByText('3,500.00')).toBeInTheDocument();
  });
});
