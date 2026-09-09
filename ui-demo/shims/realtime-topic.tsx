/**
 * `useRealtimeTopic`, neutered.
 *
 * The real hook opens an EventSource against /api/realtime/…, which a static
 * host answers with 404 — and EventSource retries a failed connection forever,
 * so the demo would sit there reconnecting for as long as the tab is open.
 * Nothing here streams, so subscribing is a no-op.
 */
export function useRealtimeTopic(): void {}
