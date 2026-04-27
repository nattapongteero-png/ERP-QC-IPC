import { EventEmitter } from 'events';
import type { TopicName, RealtimeEvent } from './types';

class RealtimeBus extends EventEmitter {
  publish(topic: TopicName, data: Record<string, unknown>): void {
    const event: RealtimeEvent = { topic, data, timestamp: Date.now() };
    this.emit(topic, event);
  }

  subscribe(topic: TopicName, listener: (event: RealtimeEvent) => void): () => void {
    this.on(topic, listener);
    return () => {
      this.off(topic, listener);
    };
  }
}

export const realtimeBus = new RealtimeBus();
realtimeBus.setMaxListeners(100);
