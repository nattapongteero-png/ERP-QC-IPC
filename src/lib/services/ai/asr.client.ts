/**
 * ASR Client - asr2 (Whisper-style, OpenAI-compatible)
 *
 * The "Ear". Converts spoken audio to text. Primary ERP use: hands-free
 * operator input on the production line (gloves on, hands busy) and voice notes
 * on deviations / observations.
 *
 * Endpoint:
 *   POST /v1/audio/transcriptions  (multipart/form-data: file, model, language?)
 */

import { AI_CONFIG, isConfigured } from './config';
import { logAiError } from './llm.client';
import type { TranscriptionOptions, TranscriptionResult } from './types';

/**
 * Transcribe an audio Blob/File to text.
 *
 * @param audio    Audio bytes (wav/mp3/webm/m4a...).
 * @param filename Filename with a correct extension (the service may sniff it).
 * @returns TranscriptionResult on success, or null on failure / unconfigured.
 */
export async function transcribe(
  audio: Blob,
  filename: string,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult | null> {
  if (!isConfigured('asr')) {
    console.warn('[ai/asr] AI_ASR_BASE_URL not configured');
    return null;
  }

  const { baseUrl, apiKey, model: defaultModel, timeout } = AI_CONFIG.asr;

  const form = new FormData();
  form.append('file', audio, filename);
  form.append('model', options.model || defaultModel);
  if (options.language) form.append('language', options.language);
  if (options.prompt) form.append('prompt', options.prompt);
  // Ask for verbose JSON so we can surface detected language when available.
  form.append('response_format', 'verbose_json');

  // Do NOT set Content-Type; the runtime sets the multipart boundary.
  const headers: Record<string, string> = {};
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  try {
    const response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      headers,
      body: form,
      signal: AbortSignal.timeout(options.timeoutMs || timeout),
    });

    if (!response.ok) {
      console.error(`[ai/asr] HTTP ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const text = data?.text;
    if (typeof text !== 'string') {
      console.error('[ai/asr] Invalid response (no text field)');
      return null;
    }
    return {
      text,
      language: typeof data?.language === 'string' ? data.language : undefined,
    };
  } catch (error) {
    logAiError('asr', error);
    return null;
  }
}
