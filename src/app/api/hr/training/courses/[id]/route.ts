// HR Training Course by ID API
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
  getTrainingCourseById,
  updateTrainingCourse,
  deactivateTrainingCourse,
} from '@/lib/services/hr.service';
import { trainingCourseUpdateSchema } from '@/lib/validation/hr';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/hr/training/courses/[id] - Get training course by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const course = await getTrainingCourseById(Number(id));

        if (!course) {
          return notFoundResponse('Training course not found');
        }

        return successResponse(course);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// PUT /api/hr/training/courses/[id] - Update training course
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const body = await request.json();

        // Validate input
        const parseResult = trainingCourseUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const course = await updateTrainingCourse(Number(id), parseResult.data);
        return successResponse(course, 'Training course updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Training course not found') {
            return notFoundResponse(error.message);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}

// DELETE /api/hr/training/courses/[id] - Deactivate training course
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const course = await deactivateTrainingCourse(Number(id));
        return successResponse(course, 'Training course deactivated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Training course not found') {
            return notFoundResponse(error.message);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:admin']
  );
}
