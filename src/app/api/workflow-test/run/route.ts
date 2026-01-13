/**
 * Workflow Test Run API
 *
 * SSE endpoint for executing workflow tests with real-time streaming.
 */

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { executeWorkflowTest } from '@/lib/services/workflow-test/workflow-test.service'
import { testConfigurationSchema } from '@/lib/validation/workflow-test'
import type { SSEMessage } from '@/types/workflow-test'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // 2 minute timeout

export async function POST(request: NextRequest) {
  // Check auth
  const session = await getSession()
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Parse request body
  let config = {}
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = testConfigurationSchema.partial().safeParse(body)
    if (parsed.success) {
      config = parsed.data
    }
  } catch {
    // Use default config
  }

  // Get the base URL for API calls
  // Always use internal localhost:3000 for server-to-server calls within Docker
  // - Dev: external 33021 -> internal 3000
  // - Prod: external via reverse proxy -> internal 3000
  // Using localhost avoids SSL issues and reverse proxy overhead
  const baseUrl = 'http://127.0.0.1:3000'

  // Get cookies for forwarding to internal API calls
  const cookies = request.headers.get('cookie') || ''

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      const send = (msg: SSEMessage) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`))
        } catch {
          // Stream might be closed
        }
      }

      try {
        await executeWorkflowTest({
          config,
          userId: session.userId,
          onMessage: send,
          baseUrl,
          cookies,
        })
      } catch (error) {
        send({
          type: 'error',
          error: {
            message: String(error),
            code: null,
            endpoint: 'workflow-test/run',
            httpStatus: 500,
            responseBody: null,
            stackTrace: null,
            timestamp: new Date().toISOString(),
          },
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}
