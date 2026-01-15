// Confidential Access Group Members API
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
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
} from '@/lib/services/confidentiality.service';
import { addGroupMemberSchema } from '@/lib/validation/confidentiality';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/confidential-groups/[id]/members - List all members of a group
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

        // Check if group exists
        const group = await getConfidentialAccessGroup(groupId);
        if (!group) {
          return notFoundResponse('Confidential access group not found');
        }

        const members = await getGroupMembers(groupId);
        return successResponse(members);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['admin:read']
  );
}

// POST /api/admin/confidential-groups/[id]/members - Add a member to a group
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const groupId = Number(id);

        if (isNaN(groupId)) {
          return errorResponse('Invalid group ID', 400);
        }

        // Check if group exists
        const group = await getConfidentialAccessGroup(groupId);
        if (!group) {
          return notFoundResponse('Confidential access group not found');
        }

        const body = await request.json();

        // Validate input
        const parseResult = addGroupMemberSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const result = await addGroupMember(groupId, parseResult.data.userId, session.userId);
        return successResponse(result, 'Member added to group successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('Duplicate entry') || error.message.includes('UNIQUE constraint')) {
            return errorResponse('User is already a member of this group', 409);
          }
          if (error.message.includes('foreign key') || error.message.includes('FOREIGN KEY')) {
            return errorResponse('User not found', 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['admin:write']
  );
}

// DELETE /api/admin/confidential-groups/[id]/members - Remove a member from a group
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

        // Get userId from query params
        const { searchParams } = new URL(request.url);
        const userIdParam = searchParams.get('userId');

        if (!userIdParam) {
          return errorResponse('userId query parameter is required', 400);
        }

        const userId = Number(userIdParam);
        if (isNaN(userId)) {
          return errorResponse('Invalid userId', 400);
        }

        // Check if group exists
        const group = await getConfidentialAccessGroup(groupId);
        if (!group) {
          return notFoundResponse('Confidential access group not found');
        }

        await removeGroupMember(groupId, userId);
        return successResponse({ groupId, userId }, 'Member removed from group successfully');
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['admin:write']
  );
}
