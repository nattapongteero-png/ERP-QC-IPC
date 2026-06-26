'use client';

/**
 * VoiceInputButton — reusable hands-free dictation control.
 *
 * Records mic audio via MediaRecorder, sends it to /api/ai/transcribe (asr2),
 * and calls onTranscript with the recognized text. Drop next to any text field
 * for voice entry (production line, deviation notes, observations).
 *
 *   <VoiceInputButton onTranscript={(text) => setNote(text)} language="th" />
 *
 * Plain <button> (no DevExtreme) so it stays light and testable. Degrades
 * gracefully: shows an error if the mic is denied or the AI is unavailable.
 */
import { useRef, useState, useCallback } from 'react';
import { Mic, Square, Loader2, AlertTriangle } from 'lucide-react';

interface VoiceInputButtonProps {
  /** Called with the transcribed text on success. */
  onTranscript: (text: string) => void;
  /** ISO language hint, e.g. "th" (default) or "en". */
  language?: string;
  endpoint?: string;
  className?: string;
}

type State = 'idle' | 'recording' | 'transcribing';

const DEFAULT_ENDPOINT = '/api/ai/transcribe';

export function VoiceInputButton({
  onTranscript,
  language = 'th',
  endpoint = DEFAULT_ENDPOINT,
  className,
}: VoiceInputButtonProps) {
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const transcribe = useCallback(
    async (audio: Blob) => {
      setState('transcribing');
      try {
        const form = new FormData();
        form.append('file', audio, 'recording.webm');
        if (language) form.append('language', language);

        const res = await fetch(endpoint, { method: 'POST', body: form });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body?.error || `เกิดข้อผิดพลาด (${res.status})`);
          return;
        }
        const data = body?.data ?? body;
        if (data?.aiUnavailable || !data?.text) {
          setError('ระบบถอดเสียงไม่พร้อมใช้งานขณะนี้');
          return;
        }
        onTranscript(String(data.text));
      } catch {
        setError('ไม่สามารถส่งเสียงไปถอดข้อความได้');
      } finally {
        setState('idle');
      }
    },
    [endpoint, language, onTranscript]
  );

  const startRecording = useCallback(async () => {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('อุปกรณ์นี้ไม่รองรับการอัดเสียง');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        void transcribe(blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setState('recording');
    } catch {
      setError('ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน');
      stopStream();
    }
  }, [stopStream, transcribe]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, []);

  const onClick = state === 'recording' ? stopRecording : startRecording;
  const busy = state === 'transcribing';

  return (
    <span className={className} data-testid="voice-input">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        data-testid="voice-input-button"
        aria-label={state === 'recording' ? 'หยุดอัดเสียง' : 'อัดเสียง'}
        title={state === 'recording' ? 'หยุดอัดเสียง' : 'พูดเพื่อกรอกข้อความ'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 12px',
          borderRadius: 8,
          border: '1px solid',
          borderColor: state === 'recording' ? '#fca5a5' : '#d1d5db',
          background: state === 'recording' ? '#fef2f2' : '#fff',
          color: state === 'recording' ? '#dc2626' : '#374151',
          fontSize: 13,
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? (
          <>
            <Loader2 size={15} className="spin" /> กำลังถอดเสียง…
          </>
        ) : state === 'recording' ? (
          <>
            <Square size={15} /> หยุด
          </>
        ) : (
          <>
            <Mic size={15} /> พูด
          </>
        )}
      </button>

      {error && (
        <span
          role="alert"
          data-testid="voice-input-error"
          style={{ marginLeft: 8, color: '#b91c1c', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <AlertTriangle size={13} /> {error}
        </span>
      )}
    </span>
  );
}
