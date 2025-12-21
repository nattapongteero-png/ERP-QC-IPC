// HR Health Record by ID API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getHealthRecordById,
  updateHealthRecord,
} from '@/lib/services/hr.service';
import { healthRecordUpdateSchema } from '@/lib/validation/hr';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/hr/health-records/[id] - Get health record by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;

        // Check if user has health_staff permission for full details
        const hasHealthStaffPermission = session.permissions?.includes('hr:health_staff');

        const record = await getHealthRecordById(Number(id), hasHealthStaffPermission);

        if (!record) {
          return notFoundResponse('Health record not found');
        }

        return successResponse(record);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// PUT /api/hr/health-records/[id] - Update health record
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const body = await request.json();

        // Validate input
        const parseResult = healthRecordUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const record = await updateHealthRecord(Number(id), parseResult.data);
        return successResponse(record, 'Health record updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Health record not found') {
            return notFoundResponse(error.message);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:health_staff']
  );
}
