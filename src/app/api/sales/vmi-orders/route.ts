/**
 * VMI Orders API Routes
 *
 * GET  - List VMI orders with filters
 * POST - Poll for new orders from VMI Portals
 *
 * Feature: 008-vmi-vendor-sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { VmiSalesOrderService } from '@/lib/services/vmi-sales-order.service';
import { z } from 'zod';

// Validation schemas
const listQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  portalId: z.coerce.number().optional(),
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
  searchTerm: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const pollRequestSchema = z.object({
  portalId: z.number().optional(),
});

/**
 * GET /api/sales/vmi-orders
 * List VMI orders with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = listQuerySchema.parse(searchParams);

    const service = new VmiSalesOrderService();
    const result = await service.listOrders({
      page: query.page,
      limit: query.limit,
      portalId: query.portalId,
      status: query.status,
      searchTerm: query.searchTerm,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Failed to list VMI orders:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list VMI orders',
    }, { status: 500 });
  }
}

/**
 * POST /api/sales/vmi-orders
 * Poll for new orders from VMI Portals
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { portalId } = pollRequestSchema.parse(body);

    const service = new VmiSalesOrderService();
    const results = await service.pollOrders(portalId);

    // Calculate totals
    const totalNew = results.reduce((sum, r) => sum + r.ordersReceived, 0);
    const totalErrors = results.filter(r => r.errors && r.errors.length > 0).length;

    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: {
          portalsPolled: results.length,
          totalNewOrders: totalNew,
          portalsWithErrors: totalErrors,
        },
      },
    });
  } catch (error) {
    console.error('Failed to poll VMI orders:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: error.errors,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to poll VMI orders',
    }, { status: 500 });
  }
}
