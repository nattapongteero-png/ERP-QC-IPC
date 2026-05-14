import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { GET } from '@/app/api/realtime/[topic]/events/route';
import { realtimeBus } from '@/lib/realtime';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: 1,
    email: 'test@test.com',
    role: 'Admin',
  }),
}));

function makeRequest(topic: string): { req: NextRequest; abort: () => void } {
  const controller = new AbortController();
  const req = new Request(`http://localhost/api/realtime/${topic}/events`, {
    signal: controller.signal,
  }) as unknown as NextRequest;
  return { req, abort: () => controller.abort() };
}

describe('GET /api/realtime/[topic]/events', () => {
  beforeEach(() => {
    realtimeBus.removeAllListeners();
  });

  it('returns 400 for invalid topic', async () => {
    const { req } = makeRequest('not-a-topic');
    const response = await GET(req, {
      params: Promise.resolve({ topic: 'not-a-topic' }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid topic');
  });

  it('returns SSE stream for valid topic', async () => {
    const { req, abort } = makeRequest('requisition-changed');
    const response = await GET(req, {
      params: Promise.resolve({ topic: 'requisition-changed' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');
    expect(response.headers.get('Cache-Control')).toContain('no-cache');

    abort();
  });

  it('streams initial connect message', async () => {
    const { req, abort } = makeRequest('requisition-changed');
    const response = await GET(req, {
      params: Promise.resolve({ topic: 'requisition-changed' }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const first = await reader.read();
    const text = decoder.decode(first.value);
    expect(text).toContain('event: connected');

    abort();
  });

  it('streams published events to subscribers', async () => {
    const { req, abort } = makeRequest('requisition-changed');
    const response = await GET(req, {
      params: Promise.resolve({ topic: 'requisition-changed' }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Drain initial connect message
    await reader.read();

    // Publish event after subscription is active
    setTimeout(() => {
      realtimeBus.publish('requisition-changed', { workOrderId: 99, status: 'approved' });
    }, 10);

    // Read published event
    const second = await reader.read();
    const text = decoder.decode(second.value);
    expect(text).toContain('event: change');
    expect(text).toContain('"workOrderId":99');
    expect(text).toContain('"status":"approved"');

    abort();
  });
});
