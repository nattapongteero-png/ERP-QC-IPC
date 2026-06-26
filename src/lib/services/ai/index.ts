/**
 * BMS AI Ecosystem - public entrypoint
 *
 * Single import surface for the four self-hosted AI services. Import named
 * clients to keep call sites explicit:
 *
 *   import { llm, ocr, asr, tts } from '@/lib/services/ai';
 *   const answer = await llm.complete('สรุป CAPA นี้ให้หน่อย', SYSTEM_PROMPT);
 *
 * Or import a specific function directly:
 *
 *   import { complete } from '@/lib/services/ai';
 */

export * as llm from './llm.client';
export * as ocr from './ocr.client';
export * as asr from './asr.client';
export * as tts from './tts.client';

// Flat re-exports of the most-used functions for convenience.
export { chat, complete, completeJson } from './llm.client';
export { extractFromBase64, extractFromFile } from './ocr.client';
export { transcribe } from './asr.client';
export { synthesize } from './tts.client';

export { AI_CONFIG, isConfigured } from './config';
export type * from './types';
