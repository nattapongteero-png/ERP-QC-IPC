/**
 * Voice Transcription API (generic)
 *
 * POST /api/ai/transcribe  (multipart/form-data)
 *   - file     (required) : audio blob (wav/mp3/webm/m4a…)
 *   - language (optional) : ISO hint, e.g. "th"
 *
 * Converts spoken audio to text via the ASR service (asr2). Reusable by any
 * form that wants hands-free voice input (production line, deviation notes…).
 * Auth required; any authenticated user may dictate.
 */
import { NextRequest } from 'next/server';
import { successResponse, errorResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { transcribe } from '@/lib/services/ai';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return errorResponse('Expected multipart/form-data', 400);
      }

      const file = form.get('file');
      if (!(file instanceof Blob) || file.size === 0) {
        return errorResponse('Missing audio file', 400);
      }
      if (file.size > MAX_AUDIO_BYTES) {
        return errorResponse('Audio too large (max 25MB)', 413);
      }

      const languageRaw = form.get('language');
      const language = typeof languageRaw === 'string' && languageRaw ? languageRaw : undefined;
      const filename = (file as File).name || 'audio.webm';

      const result = await transcribe(file, filename, { language });

      if (result === null) {
        return successResponse({ text: null, aiUnavailable: true });
      }
      return successResponse({ text: result.text, language: result.language, aiUnavailable: false });
    } catch (error) {
      return serverErrorResponse(error);
    }
  });
}
