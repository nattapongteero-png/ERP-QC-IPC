import { NextRequest, NextResponse } from 'next/server';
import { withAuth, successResponse, errorResponse } from '@/lib/api-utils';
import { explodeBOM, calculateMRP } from '@/lib/services/production.service';

// GET - Explode BOM to get all required materials
export async function GET(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const { searchParams } = new URL(request.url);
      const bomId = parseInt(searchParams.get('bomId') || '0');
      const quantity = parseFloat(searchParams.get('quantity') || '0');

      if (!bomId || !quantity) {
        return errorResponse('bomId and quantity are required', 400);
      }

      const materials = await explodeBOM(bomId, quantity);

      // Calculate totals
      const totalRequired = materials.reduce((sum, m) => sum + m.requiredQuantity, 0);
      const totalShortage = materials.reduce((sum, m) => sum + m.shortage, 0);
      const hasShortage = totalShortage > 0;

      return successResponse({
        materials,
        summary: {
          totalMaterials: materials.length,
          totalRequired,
          totalShortage,
          hasShortage,
          canProduce: !hasShortage,
        },
      });
    } catch (error) {
      console.error('BOM explosion error:', error);
      return errorResponse('Failed to explode BOM', 500);
    }
  });
}

// POST - Calculate MRP for multiple demands
export async function POST(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const body = await request.json();
      const { demands, planningHorizonDays } = body;

      if (!demands || !Array.isArray(demands)) {
        return errorResponse('demands array is required', 400);
      }

      const mrpResult = await calculateMRP(demands, planningHorizonDays || 30);

      return successResponse({
        requirements: mrpResult,
        summary: {
          totalItems: mrpResult.length,
          totalOrderQuantity: mrpResult.reduce((sum, r) => sum + r.orderQuantity, 0),
        },
      });
    } catch (error) {
      console.error('MRP calculation error:', error);
      return errorResponse('Failed to calculate MRP', 500);
    }
  });
}
