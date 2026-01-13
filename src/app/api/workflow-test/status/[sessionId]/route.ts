/**
 * Workflow Test Status API
 *
 * Get status of a specific test session.
 */

import { NextRequest } from 'next/server'
import { withAuth, successResponse, notFoundResponse, serverErrorResponse } from '@/lib/api-utils'
import { getSession as getTestSession } from '@/lib/services/workflow-test/workflow-test.service'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ sessionId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { sessionId } = await params
        const session = getTestSession(sessionId)

        if (!session) {
          return notFoundResponse('Session not found')
        }

        return successResponse(session)
      } catch (error) {
        return serverErrorResponse(error, 'workflow-test/status')
      }
    },
    ['settings:read']
  )
}
