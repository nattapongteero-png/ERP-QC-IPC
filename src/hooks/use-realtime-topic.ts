'use client';

import { useEffect, useRef } from 'react';
import type { TopicName, RealtimeEvent } from '@/lib/realtime/types';

/**
 * Subscribe to realtime events for a given topic.
 *
 * Opens an EventSource connection on mount, closes on unmount.
 * Browser auto-reconnects on transient failures.
 *
 * The callback is stored in a ref so changing its identity does not
 * cause the connection to be torn down and re-established.
 */
export function useRealtimeTopic(
  topic: TopicName,
  onEvent: (data: Record<string, unknown>) => void
): void {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    const url = `/api/realtime/${topic}/events`;
    const eventSource = new EventSource(url);

    const handleChange = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data) as RealtimeEvent;
        callbackRef.current(event.data);
      } catch (err) {
        console.error('[realtime] Failed to parse event:', err);
      }
    };

    eventSource.addEventListener('change', handleChange);

    eventSource.onerror = () => {
      console.warn(
        `[realtime] Connection error for topic '${topic}'; browser will auto-reconnect`
      );
    };

    return () => {
      eventSource.removeEventListener('change', handleChange);
      eventSource.close();
    };
  }, [topic]);
}
