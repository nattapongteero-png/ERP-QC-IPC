import { NextRequest, NextResponse } from 'next/server';
import { withAuth, successResponse, errorResponse } from '@/lib/api-utils';
import { calculateSamplingPlan, createQCTestRequest } from '@/lib/services/quality.service';

// GET - Calculate AQL sampling plan
export async function GET(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const { searchParams } = new URL(request.url);
      const lotSize = parseInt(searchParams.get('lotSize') || '100');
      const inspectionLevel = (searchParams.get('level') || 'II') as 'I' | 'II' | 'III';
      const aql = parseFloat(searchParams.get('aql') || '1.0');

      const plan = calculateSamplingPlan(lotSize, inspectionLevel, aql);

      return successResponse({
        ...plan,
        explanation: `For lot size ${lotSize} at inspection level ${inspectionLevel} with AQL ${aql}%, sample ${plan.sampleSize} units. Accept if defects ≤ ${plan.acceptNumber}, reject if defects ≥ ${plan.rejectNumber}.`,
      });
    } catch (error) {
      console.error('Sampling plan error:', error);
      return errorResponse('Failed to calculate sampling plan', 500);
    }
  });
}

// POST - Create QC test request for a lot
export async function POST(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const body = await request.json();
      const { lotId, testTypes } = body;

      if (!lotId || !testTypes || !Array.isArray(testTypes)) {
        return errorResponse('lotId and testTypes array are required', 400);
      }

      const testIds = await createQCTestRequest(lotId, testTypes, user.userId);

      return successResponse({
        testIds,
        message: `Created ${testIds.length} QC test requests`,
      });
    } catch (error) {
      console.error('Create QC test error:', error);
      return errorResponse('Failed to create QC test request', 500);
    }
  });
}
