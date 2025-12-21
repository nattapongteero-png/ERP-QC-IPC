// HR Job Descriptions API for Position
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
  getJobDescriptions,
  createJobDescription,
  getCurrentJobDescription,
  getPositionById,
} from '@/lib/services/hr.service';
import { jobDescriptionCreateSchema } from '@/lib/validation/hr';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/hr/positions/[id]/job-descriptions - List job descriptions for position
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const positionId = Number(id);

        // Verify position exists
        const position = await getPositionById(positionId);
        if (!position) {
          return notFoundResponse('Position not found');
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const currentOnly = searchParams.get('current') === 'true';

        if (currentOnly) {
          const current = await getCurrentJobDescription(positionId);
          return successResponse({ data: current ? [current] : [] });
        }

        const jobDescriptions = await getJobDescriptions({
          positionId,
          status: status as 'draft' | 'pending_approval' | 'approved' | 'obsolete' | undefined,
        });

        return successResponse({ data: jobDescriptions });
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// POST /api/hr/positions/[id]/job-descriptions - Create new job description
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const positionId = Number(id);

        // Verify position exists
        const position = await getPositionById(positionId);
        if (!position) {
          return notFoundResponse('Position not found');
        }

        const body = await request.json();

        // Validate input (positionId comes from URL)
        const parseResult = jobDescriptionCreateSchema.safeParse({
          ...body,
          positionId,
        });
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const jobDescription = await createJobDescription(parseResult.data);
        return successResponse(jobDescription, 'Job description created successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Position not found') {
            return notFoundResponse(error.message);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}
