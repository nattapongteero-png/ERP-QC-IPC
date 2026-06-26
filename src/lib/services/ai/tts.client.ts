/**
 * TTS Client - vox-cpm (Thai, OpenAI-compatible)
 *
 * The "Mouth". Converts text to spoken audio. Primary ERP use: read AI answers
 * back to operators in voice-chat mode, and audible alerts on the line.
 *
 * Endpoint:
 *   POST /v1/audio/speech  (JSON: input, voice?, model?, response_format?)
 *
 * Voices: default | female | male | female_sofia | male_eugene
 *         (unknown ids fall back to default, no cloning)
 */

import { AI_CONFIG, buildHeaders, isConfigured } from './config';
import { logAiError } from './llm.client';
import type { SpeechOptions, SpeechResult } from './types';

/** Service caps input at 4096 chars; guard the caller. */
const MAX_INPUT_CHARS = 4096;

/**
 * Synthesize speech from text.
 *
 * @returns SpeechResult (audio bytes + content type) on success, or null.
 */
export async function synthesize(
  text: string,
  options: SpeechOptions = {}
): Promise<SpeechResult | null> {
  if (!isConfigured('tts')) {
    console.warn('[ai/tts] AI_TTS_BASE_URL not configured');
    return null;
  }
  if (!text.trim()) {
    console.warn('[ai/tts] empty input text');
    return null;
  }

  const { baseUrl, apiKey, model: defaultModel, voice: defaultVoice, timeout } = AI_CONFIG.tts;
  const format = options.format || 'wav';
  const input = text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;

  try {
    const response = await fetch(`${baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify({
        model: options.model || defaultModel,
        input,
        voice: options.voice || defaultVoice,
        response_format: format,
      }),
      signal: AbortSignal.timeout(options.timeoutMs || timeout),
    });

    if (!response.ok) {
      console.error(`[ai/tts] HTTP ${response.status} ${response.statusText}`);
      return null;
    }

    const audio = await response.arrayBuffer();
    return {
      audio,
      contentType: response.headers.get('content-type') || (format === 'mp3' ? 'audio/mpeg' : 'audio/wav'),
    };
  } catch (error) {
    logAiError('tts', error);
    return null;
  }
}
