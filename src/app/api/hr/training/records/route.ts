// HR Training Records API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getTrainingRecords,
  createTrainingRecord,
  getExpiringTrainingRecords,
  getExpiredTrainingRecords,
} from '@/lib/services/hr.service';
import { trainingRecordCreateSchema } from '@/lib/validation/hr';
import type { TrainingResult, TrainingRecordStatus } from '@/types/hr';

// GET /api/hr/training/records - List training records with optional filters
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const employeeId = searchParams.get('employeeId');
        const courseId = searchParams.get('courseId');
        const sessionId = searchParams.get('sessionId');
        const result = searchParams.get('result') as TrainingResult | null;
        const status = searchParams.get('status') as TrainingRecordStatus | null;
        const expiringWithinDays = searchParams.get('expiringWithinDays');
        const expiredOnly = searchParams.get('expiredOnly');

        // Handle special queries for expiring/expired records
        if (expiringWithinDays) {
          const expiring = await getExpiringTrainingRecords(Number(expiringWithinDays));
          return successResponse(expiring);
        }

        if (expiredOnly === 'true') {
          const expired = await getExpiredTrainingRecords();
          return successResponse(expired);
        }

        const records = await getTrainingRecords({
          employeeId: employeeId ? Number(employeeId) : undefined,
          courseId: courseId ? Number(courseId) : undefined,
          sessionId: sessionId ? Number(sessionId) : undefined,
          result: result || undefined,
          status: status || undefined,
        });

        return successResponse(records);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// POST /api/hr/training/records - Create new training record
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = trainingRecordCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const record = await createTrainingRecord(parseResult.data);
        return successResponse(record, 'Training record created successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Employee not found' || error.message === 'Training course not found') {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}
