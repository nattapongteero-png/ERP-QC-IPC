/**
 * Workflow Test History API
 *
 * Get list of recent test sessions.
 */

import { NextRequest } from 'next/server'
import { withAuth, successResponse, serverErrorResponse } from '@/lib/api-utils'
import { getRecentSessions } from '@/lib/services/workflow-test/workflow-test.service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url)
        const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')))

        const sessions = getRecentSessions(limit)

        // Map to summary format
        const summaries = sessions.map((session) => ({
          id: session.id,
          status: session.status,
          startedAt: session.startedAt,
          completedAt: session.completedAt,
          totalDuration: session.totalDuration,
          passedSteps: session.phases.reduce((sum, p) => sum + p.passedCount, 0),
          failedSteps: session.phases.reduce((sum, p) => sum + p.failedCount, 0),
          createdBy: session.createdBy,
        }))

        return successResponse(summaries)
      } catch (error) {
        return serverErrorResponse(error, 'workflow-test/history')
      }
    },
    ['settings:read']
  )
}
