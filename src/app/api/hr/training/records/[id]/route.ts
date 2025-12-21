// HR Training Record by ID API
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
  getTrainingRecordById,
  updateTrainingRecord,
} from '@/lib/services/hr.service';
import { z } from 'zod';
import { trainingResultSchema } from '@/lib/validation/hr';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const trainingRecordUpdateSchema = z.object({
  completionDate: z.string().refine((val) => !isNaN(Date.parse(val))).optional(),
  result: trainingResultSchema.optional(),
  score: z.number().min(0).max(100).optional(),
  assessedBy: z.number().int().positive().optional(),
  certificateNumber: z.string().max(50).optional(),
  notes: z.string().optional(),
});

// GET /api/hr/training/records/[id] - Get training record by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const record = await getTrainingRecordById(Number(id));

        if (!record) {
          return notFoundResponse('Training record not found');
        }

        return successResponse(record);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// PUT /api/hr/training/records/[id] - Update training record
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const body = await request.json();

        // Validate input
        const parseResult = trainingRecordUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const record = await updateTrainingRecord(Number(id), parseResult.data);
        return successResponse(record, 'Training record updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Training record not found') {
            return notFoundResponse(error.message);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}
