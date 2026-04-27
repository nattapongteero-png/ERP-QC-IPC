/**
 * Realtime SSE Endpoint
 *
 * Streams events from the in-process EventBus to subscribed clients.
 * Each browser tab opens one EventSource connection per topic.
 */

import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { realtimeBus } from '@/lib/realtime';
import type { TopicName, RealtimeEvent } from '@/lib/realtime';

const VALID_TOPICS: readonly TopicName[] = ['requisition-changed'] as const;

function isValidTopic(t: string): t is TopicName {
  return (VALID_TOPICS as readonly string[]).includes(t);
}

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ topic: string }> }
) {
  // Auth
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate topic
  const { topic } = await params;
  if (!isValidTopic(topic)) {
    return new Response(JSON.stringify({ error: 'Invalid topic' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const safeEnqueue = (chunk: Uint8Array): boolean => {
        if (closed) return false;
        try {
          controller.enqueue(chunk);
          return true;
        } catch {
          closed = true;
          return false;
        }
      };

      // Initial connect message lets client know subscription is active
      safeEnqueue(encoder.encode(`event: connected\ndata: {}\n\n`));

      // Subscribe to topic — events are pushed to this stream
      const unsubscribe = realtimeBus.subscribe(topic, (event: RealtimeEvent) => {
        const message = `event: change\ndata: ${JSON.stringify(event)}\n\n`;
        safeEnqueue(encoder.encode(message));
      });

      // Heartbeat keeps connection alive through proxies (Nginx, CDN)
      const heartbeat = setInterval(() => {
        if (!safeEnqueue(encoder.encode(`: heartbeat\n\n`))) {
          clearInterval(heartbeat);
        }
      }, 30000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      // Browser closes EventSource → server receives abort signal
      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
