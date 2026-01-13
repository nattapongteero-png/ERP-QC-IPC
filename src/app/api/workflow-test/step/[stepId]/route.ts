/**
 * Workflow Test Step Detail API
 *
 * Get detailed information about a specific test step.
 */

import { NextRequest } from 'next/server'
import { withAuth, successResponse, notFoundResponse, errorResponse, serverErrorResponse } from '@/lib/api-utils'
import { getStepDetails } from '@/lib/services/workflow-test/workflow-test.service'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ stepId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { stepId: stepIdStr } = await params
        const stepId = parseInt(stepIdStr)

        if (isNaN(stepId) || stepId < 1 || stepId > 31) {
          return errorResponse('Invalid step ID. Must be between 1 and 31.', 400)
        }

        const { searchParams } = new URL(request.url)
        const sessionId = searchParams.get('sessionId')

        if (!sessionId) {
          return errorResponse('sessionId query parameter is required', 400)
        }

        const step = getStepDetails(sessionId, stepId)

        if (!step) {
          return notFoundResponse('Step not found in session')
        }

        return successResponse(step)
      } catch (error) {
        return serverErrorResponse(error, 'workflow-test/step')
      }
    },
    ['settings:read']
  )
}
