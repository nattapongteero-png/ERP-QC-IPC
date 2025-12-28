/**
 * Sales Fulfillment API Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the service
const mockFulfillSalesOrderLine = vi.fn();

vi.mock('@/lib/services/sales.service', () => ({
  fulfillSalesOrderLine: (...args: any[]) => mockFulfillSalesOrderLine(...args),
}));

// Mock auth
vi.mock('@/lib/api-utils', () => ({
  withAuth: (req: NextRequest, handler: any) => handler({ id: 1 }),
  serverErrorResponse: (error: any) => new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 }),
}));

// Import after mocking
import { POST } from '@/app/api/sales/orders/[id]/fulfill/route';

describe('Sales Fulfillment API', () => {
  beforeEach(() => {
    mockFulfillSalesOrderLine.mockReset();
  });

  it('should fulfill order line successfully', async () => {
    mockFulfillSalesOrderLine.mockResolvedValue({
      deliveryId: 1,
      deliveryNumber: 'DL-202512-0001',
      shippedQuantity: 30,
    });

    const request = new NextRequest('http://localhost/api/sales/orders/1/fulfill', {
      method: 'POST',
      body: JSON.stringify({
        soLineId: 1,
        itemId: 1,
        lotId: 5,
        quantity: 30,
        notes: 'First shipment',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: '1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.deliveryNumber).toBe('DL-202512-0001');
  });

  it('should return error for invalid quantity', async () => {
    mockFulfillSalesOrderLine.mockRejectedValue(new Error('Quantity 100 exceeds pending quantity 50'));

    const request = new NextRequest('http://localhost/api/sales/orders/1/fulfill', {
      method: 'POST',
      body: JSON.stringify({
        soLineId: 1,
        itemId: 1,
        lotId: 5,
        quantity: 100,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: '1' }) });
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toContain('exceeds pending');
  });

  it('should validate required fields', async () => {
    const request = new NextRequest('http://localhost/api/sales/orders/1/fulfill', {
      method: 'POST',
      body: JSON.stringify({
        // Missing required fields
        quantity: 30,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: '1' }) });
    const data = await response.json();

    expect(data.success).toBe(false);
  });
});
