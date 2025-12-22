// HR Training Sessions API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getTrainingSessions,
  createTrainingSession,
} from '@/lib/services/hr.service';
import { trainingSessionCreateSchema } from '@/lib/validation/hr';
import type { TrainingSessionStatus } from '@/types/hr';

// GET /api/hr/training/sessions - List training sessions with optional filters
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const courseId = searchParams.get('courseId');
        const status = searchParams.get('status') as TrainingSessionStatus | null;
        const instructorId = searchParams.get('instructorId');
        const fromDate = searchParams.get('fromDate');
        const toDate = searchParams.get('toDate');

        const sessions = await getTrainingSessions({
          courseId: courseId ? Number(courseId) : undefined,
          status: status || undefined,
          instructorId: instructorId ? Number(instructorId) : undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        });

        return successResponse(sessions);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// POST /api/hr/training/sessions - Create new training session
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = trainingSessionCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const session = await createTrainingSession(parseResult.data);
        return successResponse(session, 'Training session created successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Training course not found') {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}
