'use client';

/**
 * Root error boundary (App Router).
 *
 * Primary job: recover from "stale chunk after deploy". When a new build is
 * shipped, the JS chunk filenames change (new content hashes). A browser tab
 * left open across the deploy still references the OLD hashes, so the next
 * client-side (soft) navigation tries to load a chunk the server no longer
 * has → 404 → React throws → the user sees a blank "Application error:
 * a client-side exception" page.
 *
 * Here we detect that specific failure and reload the page ONCE, which pulls
 * the chunk manifest for the current build and recovers transparently. A
 * sessionStorage guard prevents an infinite reload loop if the error is not
 * actually a stale-chunk problem.
 */
import { useEffect } from 'react';

const RELOAD_GUARD_KEY = 'chunk-reload-attempted';

function isChunkLoadError(error: Error & { name?: string }): boolean {
  const name = error?.name || '';
  const msg = error?.message || '';
  return (
    name === 'ChunkLoadError' ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /Loading CSS chunk/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /'?text\/html'? is not a valid JavaScript MIME type/i.test(msg) ||
    /importing a module script failed/i.test(msg)
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    if (!chunkError) return;
    // Reload at most once per session to recover from a stale build, then
    // clear the guard so a later legitimate deploy can self-heal again.
    let alreadyReloaded = false;
    try {
      alreadyReloaded = sessionStorage.getItem(RELOAD_GUARD_KEY) === '1';
      if (!alreadyReloaded) sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
    } catch {
      // sessionStorage unavailable (private mode / SSR) — fall through and
      // attempt a single reload anyway; the browser cache makes loops unlikely.
    }
    if (!alreadyReloaded) {
      // Force a fresh load (bypass bfcache) so the new chunk manifest is used.
      window.location.reload();
    }
  }, [chunkError]);

  return (
    <html lang="th">
      <body
        style={{
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
          background: '#f8fafc',
          color: '#0f172a',
        }}
      >
        <div style={{ textAlign: 'center', padding: 24, maxWidth: 480 }}>
          {chunkError ? (
            <>
              <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                กำลังโหลดเวอร์ชันใหม่…
              </h1>
              <p style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>
                ระบบมีการอัปเดต กำลังรีเฟรชหน้าให้อัตโนมัติ หากไม่รีเฟรชภายในไม่กี่วินาที
                กรุณากดปุ่มด้านล่าง
              </p>
              <button
                onClick={() => {
                  try {
                    sessionStorage.removeItem(RELOAD_GUARD_KEY);
                  } catch {
                    /* ignore */
                  }
                  window.location.reload();
                }}
                style={btnStyle}
              >
                รีเฟรชหน้า
              </button>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                เกิดข้อผิดพลาด
              </h1>
              <p style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>
                ขออภัย เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button onClick={() => reset()} style={btnStyle}>
                  ลองใหม่
                </button>
                <button
                  onClick={() => window.location.reload()}
                  style={{ ...btnStyle, background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1' }}
                >
                  รีเฟรชหน้า
                </button>
              </div>
            </>
          )}
        </div>
      </body>
    </html>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#059669',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 20px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
