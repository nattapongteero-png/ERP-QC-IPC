import { NextRequest, NextResponse } from 'next/server';
import { withAuth, successResponse, errorResponse } from '@/lib/api-utils';
import { generateVMISnapshot, processVMIASN, evaluateVendorPerformance } from '@/lib/services/purchasing.service';

// GET - Generate VMI snapshot for a vendor
export async function GET(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const { searchParams } = new URL(request.url);
      const vendorId = parseInt(searchParams.get('vendorId') || '0');
      const action = searchParams.get('action') || 'snapshot';

      if (!vendorId) {
        return errorResponse('vendorId is required', 400);
      }

      if (action === 'performance') {
        const evaluation = await evaluateVendorPerformance(vendorId);
        return successResponse(evaluation);
      }

      const snapshot = await generateVMISnapshot(vendorId);
      return successResponse(snapshot);
    } catch (error) {
      console.error('VMI error:', error);
      return errorResponse((error as Error).message || 'Failed to generate VMI data', 500);
    }
  });
}

// POST - Process ASN from VMI vendor
export async function POST(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const body = await request.json();
      const { asnNumber, vendorId, expectedDeliveryDate, lines } = body;

      if (!asnNumber || !vendorId || !expectedDeliveryDate || !lines) {
        return errorResponse('asnNumber, vendorId, expectedDeliveryDate, and lines are required', 400);
      }

      const result = await processVMIASN(
        { asnNumber, vendorId, expectedDeliveryDate, lines },
        user.userId
      );

      return successResponse({
        ...result,
        message: 'ASN processed successfully. Purchase order created and approved.',
      });
    } catch (error) {
      console.error('Process ASN error:', error);
      return errorResponse((error as Error).message || 'Failed to process ASN', 500);
    }
  });
}
