/**
 * Sales Deliveries API Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock database
const mockDeliveries = [
  {
    id: 1,
    deliveryNumber: 'DL-202512-0001',
    soLineId: 1,
    itemCode: 'FG-001',
    itemName: 'ฟ้าทะลายโจรแคปซูล',
    lotNumber: 'LOT-001',
    quantity: 30,
    unit: 'box',
    deliveryDate: '2025-12-25',
    status: 'shipped',
  },
];

vi.mock('@/lib/db/db-helper', () => ({
  getTableRef: (name: string) => ({ name }),
  executeDbOperation: async (fn: any) => mockDeliveries,
}));

vi.mock('@/lib/api-utils', () => ({
  withAuth: (req: NextRequest, handler: any) => handler({ id: 1 }),
  serverErrorResponse: (error: any) => new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 }),
}));

import { GET } from '@/app/api/sales/orders/[id]/deliveries/route';

describe('Sales Deliveries API', () => {
  it('should return deliveries for an order', async () => {
    const request = new NextRequest('http://localhost/api/sales/orders/1/deliveries');
    const response = await GET(request, { params: Promise.resolve({ id: '1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.deliveries).toHaveLength(1);
    expect(data.data.deliveries[0].deliveryNumber).toBe('DL-202512-0001');
  });
});
