/**
 * @vitest-environment jsdom
 *
 * UI tests for VoiceInputButton. Mocks MediaRecorder + getUserMedia so the
 * record→transcribe flow can be driven without real audio hardware.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceInputButton } from '@/components/ai/voice-input-button';

class MockMediaRecorder {
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  mimeType = 'audio/webm';
  state = 'inactive';
  constructor(public stream: unknown) {}
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

function setupMedia() {
  (global as any).MediaRecorder = MockMediaRecorder;
  const track = { stop: vi.fn() };
  Object.defineProperty(global.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) },
  });
}

function mockFetch(body: unknown, ok = true, status = 200) {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as unknown as Response);
}

beforeEach(() => {
  vi.restoreAllMocks();
  setupMedia();
});

describe('VoiceInputButton', () => {
  it('renders the mic button', () => {
    render(<VoiceInputButton onTranscript={() => {}} />);
    expect(screen.getByTestId('voice-input-button')).toBeInTheDocument();
  });

  it('records then transcribes and emits the text', async () => {
    mockFetch({ text: 'ทดสอบเสียง', aiUnavailable: false });
    const onTranscript = vi.fn();
    render(<VoiceInputButton onTranscript={onTranscript} language="th" />);

    // start recording
    fireEvent.click(screen.getByTestId('voice-input-button'));
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());

    // stop -> triggers transcribe
    fireEvent.click(screen.getByTestId('voice-input-button'));

    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('ทดสอบเสียง'));

    // sent multipart with language
    const form = (global.fetch as any).mock.calls[0][1].body as FormData;
    expect(form.get('language')).toBe('th');
    expect(form.get('file')).toBeInstanceOf(Blob);
  });

  it('shows an error when transcription is unavailable', async () => {
    mockFetch({ text: null, aiUnavailable: true });
    render(<VoiceInputButton onTranscript={() => {}} />);
    fireEvent.click(screen.getByTestId('voice-input-button'));
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('voice-input-button'));
    await waitFor(() => expect(screen.getByTestId('voice-input-error')).toBeInTheDocument());
  });

  it('shows an error when mic permission is denied', async () => {
    (navigator.mediaDevices.getUserMedia as any).mockRejectedValue(new Error('denied'));
    render(<VoiceInputButton onTranscript={() => {}} />);
    fireEvent.click(screen.getByTestId('voice-input-button'));
    await waitFor(() => expect(screen.getByTestId('voice-input-error')).toBeInTheDocument());
  });
});
