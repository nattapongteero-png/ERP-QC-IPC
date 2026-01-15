// Confidential Access Group by ID API
// Feature: BOM Confidentiality Protection (014-unit-cost)

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getConfidentialAccessGroup,
  updateConfidentialAccessGroup,
  deleteConfidentialAccessGroup,
} from '@/lib/services/confidentiality.service';
import { confidentialAccessGroupUpdateSchema } from '@/lib/validation/confidentiality';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/confidential-groups/[id] - Get a confidential access group by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const groupId = Number(id);

        if (isNaN(groupId)) {
          return errorResponse('Invalid group ID', 400);
        }

        const group = await getConfidentialAccessGroup(groupId);

        if (!group) {
          return notFoundResponse('Confidential access group not found');
        }

        return successResponse(group);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['admin:read']
  );
}

// PUT /api/admin/confidential-groups/[id] - Update a confidential access group
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const groupId = Number(id);

        if (isNaN(groupId)) {
          return errorResponse('Invalid group ID', 400);
        }

        // Check if group exists
        const existing = await getConfidentialAccessGroup(groupId);
        if (!existing) {
          return notFoundResponse('Confidential access group not found');
        }

        const body = await request.json();

        // Validate input
        const parseResult = confidentialAccessGroupUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        await updateConfidentialAccessGroup(groupId, parseResult.data);

        // Fetch and return updated group
        const updated = await getConfidentialAccessGroup(groupId);
        return successResponse(updated, 'Confidential access group updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('Duplicate entry') || error.message.includes('UNIQUE constraint')) {
            return errorResponse('Group code already exists', 409);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['admin:write']
  );
}

// DELETE /api/admin/confidential-groups/[id] - Delete a confidential access group
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const groupId = Number(id);

        if (isNaN(groupId)) {
          return errorResponse('Invalid group ID', 400);
        }

        // Check if group exists
        const existing = await getConfidentialAccessGroup(groupId);
        if (!existing) {
          return notFoundResponse('Confidential access group not found');
        }

        await deleteConfidentialAccessGroup(groupId);
        return successResponse({ id: groupId }, 'Confidential access group deleted successfully');
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['admin:write']
  );
}
