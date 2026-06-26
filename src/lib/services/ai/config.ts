/**
 * BMS AI Ecosystem - Configuration
 *
 * Single source of truth for the four self-hosted BMS AI services.
 * All endpoints are OpenAI-compatible (except OCR, which has its own JSON API).
 *
 *   - vllm-gemma  (Brain) : LLM chat/completions  -> Gemma-4-31B, 262k ctx
 *   - asr2        (Ear)   : speech -> text         -> Whisper-style transcription
 *   - vox-cpm     (Mouth) : text  -> speech        -> Thai TTS
 *   - pdf-ocr-mcp (Eye)   : document -> text       -> Typhoon/Chandra/Gemma4 OCR
 *
 * Configure base URLs via environment variables (see .env.example). Each client
 * degrades gracefully (returns null / aiUnavailable) when its URL is unset, so
 * the ERP keeps working even if the AI stack is down.
 */

export const AI_CONFIG = {
  /** LLM brain - vllm-gemma (OpenAI-compatible) */
  llm: {
    baseUrl: process.env.AI_LLM_BASE_URL || 'https://vllm-gemma.bmscloud.in.th',
    /** Optional bearer token if the gateway enforces auth */
    apiKey: process.env.AI_LLM_API_KEY || '',
    /** Default model alias served by the vLLM gateway */
    model: process.env.AI_LLM_MODEL || 'default',
    timeout: Number(process.env.AI_LLM_TIMEOUT_MS) || 60000,
  },

  /** Speech-to-text - asr2 (Whisper-style /v1/audio/transcriptions) */
  asr: {
    baseUrl: process.env.AI_ASR_BASE_URL || 'https://asr2.bmscloud.in.th',
    apiKey: process.env.AI_ASR_API_KEY || '',
    model: process.env.AI_ASR_MODEL || 'default',
    timeout: Number(process.env.AI_ASR_TIMEOUT_MS) || 60000,
  },

  /** Text-to-speech - vox-cpm (OpenAI-compatible /v1/audio/speech) */
  tts: {
    baseUrl: process.env.AI_TTS_BASE_URL || 'https://vox-cpm.bmscloud.in.th',
    apiKey: process.env.AI_TTS_API_KEY || '',
    model: process.env.AI_TTS_MODEL || 'voxcpm-thai',
    voice: process.env.AI_TTS_VOICE || 'default',
    timeout: Number(process.env.AI_TTS_TIMEOUT_MS) || 60000,
  },

  /** Document OCR - pdf-ocr-mcp (custom JSON API under /api) */
  ocr: {
    baseUrl: process.env.AI_OCR_BASE_URL || 'https://pdf-ocr-mcp.bmscloud.in.th',
    apiKey: process.env.AI_OCR_API_KEY || '',
    timeout: Number(process.env.AI_OCR_TIMEOUT_MS) || 120000,
  },
} as const;

/** Build standard auth + JSON headers for an OpenAI-compatible service. */
export function buildHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

/** True when a service has a base URL configured (i.e. is usable). */
export function isConfigured(service: keyof typeof AI_CONFIG): boolean {
  return Boolean(AI_CONFIG[service].baseUrl);
}
