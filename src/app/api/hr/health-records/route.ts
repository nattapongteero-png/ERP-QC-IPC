// HR Health Records API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getHealthRecords,
  createHealthRecord,
} from '@/lib/services/hr.service';
import {
  healthRecordCreateSchema,
  healthRecordQuerySchema,
} from '@/lib/validation/hr';
import { hasPermission, type Role } from '@/lib/auth';
import type { ExaminationType, FitnessStatus } from '@/types/hr';

// GET /api/hr/health-records - List health records (filtered by role)
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { searchParams } = new URL(request.url);
        const queryResult = healthRecordQuerySchema.safeParse(
          Object.fromEntries(searchParams.entries())
        );

        const filters: {
          employeeId?: number;
          examinationType?: ExaminationType;
          fitnessStatus?: FitnessStatus;
          fromDate?: string;
          toDate?: string;
        } = {};

        if (queryResult.success) {
          if (queryResult.data.employeeId) {
            filters.employeeId = queryResult.data.employeeId;
          }
          if (queryResult.data.examinationType) {
            filters.examinationType = queryResult.data.examinationType;
          }
          if (queryResult.data.fitnessStatus) {
            filters.fitnessStatus = queryResult.data.fitnessStatus;
          }
          if (queryResult.data.fromDate) {
            filters.fromDate = queryResult.data.fromDate;
          }
          if (queryResult.data.toDate) {
            filters.toDate = queryResult.data.toDate;
          }
        }

        // Check if user has health_staff permission for full details
        const hasHealthStaffPermission = hasPermission(session.role as Role, 'hr:health_staff');

        const records = await getHealthRecords(filters, hasHealthStaffPermission);
        return successResponse(records);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// POST /api/hr/health-records - Create health record
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = healthRecordCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const record = await createHealthRecord(parseResult.data, session.userId);
        return successResponse(record, 'Health record created successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Employee not found') {
            return errorResponse(error.message, 404);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:health_staff']
  );
}
