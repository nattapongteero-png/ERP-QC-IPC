/**
 * Workflow Test Cleanup API
 *
 * Endpoint to cleanup test data created by workflow tests.
 */

import { NextRequest } from 'next/server'
import { withAuth, successResponse, serverErrorResponse } from '@/lib/api-utils'
import { cleanupTestData, getTestDataCounts } from '@/lib/services/workflow-test/test-data-cleanup'
import { cleanupRequestSchema } from '@/lib/validation/workflow-test'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const body = await request.json().catch(() => ({}))
        const parsed = cleanupRequestSchema.safeParse(body)
        const prefix = parsed.success ? parsed.data.prefix : 'WFTEST_'

        const result = await cleanupTestData(prefix)

        return successResponse(result, 'Cleanup completed')
      } catch (error) {
        return serverErrorResponse(error, 'workflow-test/cleanup')
      }
    },
    ['settings:write']
  )
}

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url)
        const prefix = searchParams.get('prefix') || 'WFTEST_'

        const counts = await getTestDataCounts(prefix)

        return successResponse({
          prefix,
          counts,
          totalRecords: Object.values(counts).reduce((a, b) => a + b, 0),
        })
      } catch (error) {
        return serverErrorResponse(error, 'workflow-test/cleanup')
      }
    },
    ['settings:read']
  )
}
