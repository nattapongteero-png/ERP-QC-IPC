// HR Training Session by ID API
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
  getTrainingSessionById,
  updateTrainingSession,
  cancelTrainingSession,
  completeTrainingSession,
} from '@/lib/services/hr.service';
import { trainingSessionUpdateSchema } from '@/lib/validation/hr';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/hr/training/sessions/[id] - Get training session by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const session = await getTrainingSessionById(Number(id));

        if (!session) {
          return notFoundResponse('Training session not found');
        }

        return successResponse(session);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// PUT /api/hr/training/sessions/[id] - Update training session
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const body = await request.json();

        // Validate input
        const parseResult = trainingSessionUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const session = await updateTrainingSession(Number(id), parseResult.data);
        return successResponse(session, 'Training session updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Training session not found') {
            return notFoundResponse(error.message);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}

// PATCH /api/hr/training/sessions/[id] - Update session status (cancel/complete)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const { action } = await request.json();

        let session;
        if (action === 'cancel') {
          session = await cancelTrainingSession(Number(id));
        } else if (action === 'complete') {
          session = await completeTrainingSession(Number(id));
        } else {
          return errorResponse('Invalid action. Use "cancel" or "complete"', 400);
        }

        return successResponse(session, `Training session ${action}ed successfully`);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Training session not found') {
            return notFoundResponse(error.message);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}
