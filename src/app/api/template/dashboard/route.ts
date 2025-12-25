// Template Dashboard API
// Feature: Template Module for prototyping

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getTemplateDashboardMetrics } from '@/lib/services/template.service';

// GET /api/template/dashboard - Get dashboard metrics
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const metrics = await getTemplateDashboardMetrics();
        return successResponse(metrics);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    []
  );
}
