// HR Training Courses API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getTrainingCourses,
  createTrainingCourse,
} from '@/lib/services/hr.service';
import { trainingCourseCreateSchema } from '@/lib/validation/hr';

// GET /api/hr/training/courses - List training courses with optional filters
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const isMandatory = searchParams.get('isMandatory');
        const isActive = searchParams.get('isActive');
        const search = searchParams.get('search');

        const courses = await getTrainingCourses({
          category: category || undefined,
          isMandatory: isMandatory ? isMandatory === 'true' : undefined,
          isActive: isActive !== null ? isActive === 'true' : true, // Default to active only
          search: search || undefined,
        });

        return successResponse({ data: courses });
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// POST /api/hr/training/courses - Create new training course
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = trainingCourseCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const course = await createTrainingCourse(parseResult.data);
        return successResponse(course, 'Training course created successfully');
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}
