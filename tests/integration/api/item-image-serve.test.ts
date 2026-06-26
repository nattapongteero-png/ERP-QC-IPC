/**
 * Regression: serving an item image whose file_name contains Thai (non
 * Latin-1) characters must not 500.
 *
 * HTTP header values are ByteStrings (ISO-8859-1). The original code put the
 * raw filename into Content-Disposition, so any Unicode filename (e.g.
 * "ผขมิ้นชัน01.jpg") threw "Cannot convert argument to a ByteString ..." and
 * the route returned 500 — the image showed as broken in the UI.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

const THAI_NAME = 'ผขมิ้นชัน01.jpg';
const FAKE_DATA = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]); // JPEG-ish bytes

vi.mock('@/lib/db/db-helper', () => ({
  getTableRef: (n: string) => ({ __table: n }),
  executeDbOperation: async (op: (db: unknown) => unknown) =>
    op({
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  limit: async () => [
                    {
                      id: 8,
                      mimeType: 'image/jpeg',
                      imageData: FAKE_DATA,
                      thumbnailData: FAKE_DATA,
                      fileName: THAI_NAME,
                    },
                  ],
                };
              },
            };
          },
        };
      },
    }),
}));

import { GET } from '@/app/api/items/[id]/images/[imageId]/route';

function makeRequest(thumbnail = false) {
  const url = `http://localhost/api/items/1/images/8${thumbnail ? '?thumbnail=true' : ''}`;
  return new NextRequest(url);
}

describe('GET /api/items/[id]/images/[imageId] — Thai filename', () => {
  it('serves the image (200) instead of 500 when filename has Thai chars', async () => {
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: '1', imageId: '8' }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');

    const body = Buffer.from(await res.arrayBuffer());
    expect(body.length).toBe(FAKE_DATA.length);
  });

  it('sets a Latin-1-safe Content-Disposition with RFC 5987 filename*', async () => {
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: '1', imageId: '8' }),
    });

    const cd = res.headers.get('Content-Disposition') ?? '';
    // ASCII fallback present, no raw Thai bytes in the plain filename
    expect(cd).toContain('inline; filename="');
    // RFC 5987 encoded original name
    expect(cd).toContain(`filename*=UTF-8''${encodeURIComponent(THAI_NAME)}`);
    // The header value itself must be representable as a ByteString
    expect(() => Buffer.from(cd, 'latin1')).not.toThrow();
    for (const ch of cd) {
      expect(ch.charCodeAt(0)).toBeLessThanOrEqual(255);
    }
  });
});
