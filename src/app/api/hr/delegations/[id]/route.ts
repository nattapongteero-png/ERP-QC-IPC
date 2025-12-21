// HR Delegation by ID API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getDelegationById, cancelDelegation } from '@/lib/services/hr.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/hr/delegations/[id] - Get delegation by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const delegation = await getDelegationById(Number(id));

        if (!delegation) {
          return notFoundResponse('Delegation not found');
        }

        return successResponse(delegation);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// DELETE /api/hr/delegations/[id] - Cancel/revoke delegation
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const delegation = await cancelDelegation(Number(id));
        return successResponse(delegation, 'Delegation cancelled successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Delegation not found') {
            return notFoundResponse(error.message);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}
