/**
 * Tests for the BMS AI Ecosystem adapter layer.
 *
 * Two layers:
 *  1. Unit tests (mocked fetch) - fast, deterministic, always run. Verify each
 *     client builds the right request and parses the right response, and that it
 *     degrades gracefully (returns null) on error / missing config.
 *  2. Live connectivity test (opt-in) - actually hits vllm-gemma. Runs only when
 *     AI_LIVE_TEST=1 so CI stays offline-safe.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Force known base URLs before importing the modules (config reads env at import).
process.env.AI_LLM_BASE_URL = 'https://vllm-gemma.test';
process.env.AI_OCR_BASE_URL = 'https://pdf-ocr-mcp.test';
process.env.AI_ASR_BASE_URL = 'https://asr2.test';
process.env.AI_TTS_BASE_URL = 'https://vox-cpm.test';

import { chat, complete, completeJson } from '@/lib/services/ai/llm.client';
import { extractFromBase64 } from '@/lib/services/ai/ocr.client';
import { transcribe } from '@/lib/services/ai/asr.client';
import { synthesize } from '@/lib/services/ai/tts.client';
import { AI_CONFIG } from '@/lib/services/ai/config';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
    arrayBuffer: async () => new ArrayBuffer(8),
    headers: new Headers({ 'content-type': 'audio/wav' }),
  } as unknown as Response;
}

describe('ai/llm.client', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('chat() posts to /v1/chat/completions and returns content + usage', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({
        model: 'gemma4',
        choices: [{ message: { content: 'สวัสดีครับ' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
    );

    const result = await chat([{ role: 'user', content: 'hi' }]);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${AI_CONFIG.llm.baseUrl}/v1/chat/completions`);
    expect(init?.method).toBe('POST');
    expect(result?.content).toBe('สวัสดีครับ');
    expect(result?.usage?.totalTokens).toBe(15);
  });

  it('completeJson() forces json mode and parses the response', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: '{"ok":true,"n":3}' } }] })
    );

    const result = await completeJson<{ ok: boolean; n: number }>('extract');

    const body = JSON.parse((fetchSpy.mock.calls[0][1]?.body as string) ?? '{}');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(result).toEqual({ ok: true, n: 3 });
  });

  it('returns null on HTTP error (graceful degradation)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({}, false, 503));
    expect(await complete('x')).toBeNull();
  });

  it('returns null on network throw', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await complete('x')).toBeNull();
  });
});

describe('ai/ocr.client', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('extractFromBase64() posts pdf_base64 + snake_case options', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({
        text: 'CoA content',
        chars: 11,
        fmt: 'markdown',
        pages: [{ page_index: 0, source: 'ocr', chars: 11, finish_reason: 'stop' }],
        ocr_page_count: 1,
        any_truncated: false,
      })
    );

    const result = await extractFromBase64('QkFTRTY0', { fmt: 'markdown', backend: 'chandra', analyzePages: true });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${AI_CONFIG.ocr.baseUrl}/api/pdf_extract`);
    const body = JSON.parse(init?.body as string);
    expect(body.pdf_base64).toBe('QkFTRTY0');
    expect(body.fmt).toBe('markdown');
    expect(body.backend).toBe('chandra');
    expect(body.analyze_pages).toBe(true);
    expect(result?.text).toBe('CoA content');
    expect(result?.pages[0].pageIndex).toBe(0);
    expect(result?.pages[0].finishReason).toBe('stop');
  });
});

describe('ai/asr.client', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('transcribe() posts multipart to /v1/audio/transcriptions and returns text', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ text: 'บันทึกเสียง', language: 'th' })
    );

    const blob = new Blob(['fake-audio'], { type: 'audio/wav' });
    const result = await transcribe(blob, 'note.wav', { language: 'th' });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${AI_CONFIG.asr.baseUrl}/v1/audio/transcriptions`);
    expect(init?.body).toBeInstanceOf(FormData);
    expect(result?.text).toBe('บันทึกเสียง');
    expect(result?.language).toBe('th');
  });
});

describe('ai/tts.client', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('synthesize() posts JSON to /v1/audio/speech and returns audio bytes', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({}, true));

    const result = await synthesize('สวัสดี', { voice: 'female', format: 'wav' });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${AI_CONFIG.tts.baseUrl}/v1/audio/speech`);
    const body = JSON.parse(init?.body as string);
    expect(body.input).toBe('สวัสดี');
    expect(body.voice).toBe('female');
    expect(result?.audio).toBeInstanceOf(ArrayBuffer);
    expect(result?.contentType).toContain('audio');
  });

  it('returns null for empty input without calling fetch', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    expect(await synthesize('   ')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------------------
// Live connectivity test (opt-in): AI_LIVE_TEST=1 bun run test ai-clients
// ----------------------------------------------------------------------------
const liveIt = process.env.AI_LIVE_TEST === '1' ? it : it.skip;

describe('ai/llm.client (LIVE - real vllm-gemma)', () => {
  let realFetch: typeof fetch;
  beforeEach(() => {
    realFetch = global.fetch;
    process.env.AI_LLM_BASE_URL = 'https://vllm-gemma.bmscloud.in.th';
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  liveIt('responds to a simple prompt', async () => {
    const answer = await complete(
      'Reply with exactly the word OK and nothing else.',
      undefined,
      { temperature: 0, maxTokens: 8 }
    );
    expect(answer).toBeTruthy();
    expect(answer!.toUpperCase()).toContain('OK');
  }, 60000);
});
