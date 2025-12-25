/**
 * Mock Drill API Route
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * POST /api/recalls/mock-drill - Execute mock recall drill
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { executeMockDrill } from '@/lib/services/recall-service';
import { mockDrillRequestSchema } from '@/lib/validation/recalls';

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const body = await request.json();
        const validatedData = mockDrillRequestSchema.parse(body);

        const result = await executeMockDrill(validatedData, session.userId);

        return successResponse(result);
      } catch (error) {
        console.error('Error executing mock drill:', error);
        return serverErrorResponse(error);
      }
    },
    ['recalls:execute']
  );
}
