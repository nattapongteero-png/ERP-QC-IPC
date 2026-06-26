/**
 * Tests for the generic AI summary service (node env — fast, no jsdom).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const complete = vi.fn();
vi.mock('@/lib/services/ai', () => ({ complete: (...a: unknown[]) => complete(...a) }));

import { summarizeRecord } from '@/lib/services/ai-summary.service';

beforeEach(() => complete.mockReset());

describe('summarizeRecord', () => {
  it('builds a grounded prompt from fields + items and returns the summary', async () => {
    complete.mockResolvedValue('สรุป: CAPA นี้อยู่ระหว่างดำเนินการ ความเสี่ยงสูง');

    const out = await summarizeRecord({
      domain: 'capa',
      heading: 'CAPA-2026-001 — Mixer contamination',
      fields: { status: 'in_progress', riskScore: 20, patientImpact: true, empty: '' },
      items: [{ label: 'Clean mixer', detail: 'corrective · done' }],
      focus: 'risk',
    });

    expect(out).toContain('CAPA');
    const userPrompt = complete.mock.calls[0][0] as string;
    const systemPrompt = complete.mock.calls[0][1] as string;

    expect(userPrompt).toContain('CAPA-2026-001');
    expect(userPrompt).toContain('status: in_progress');
    expect(userPrompt).toContain('patientImpact: yes'); // boolean formatted
    expect(userPrompt).toContain('Clean mixer');
    expect(userPrompt).toContain('Emphasize: risk');
    expect(userPrompt).not.toContain('empty:'); // empty values dropped
    expect(systemPrompt).toContain('Thai'); // default language
  });

  it('honours English language and array formatting', async () => {
    complete.mockResolvedValue('summary');
    await summarizeRecord({
      domain: 'deviation',
      heading: 'DEV-1',
      fields: { affected: ['A', 'B', 'C'] },
      language: 'en',
    });
    const userPrompt = complete.mock.calls[0][0] as string;
    const systemPrompt = complete.mock.calls[0][1] as string;
    expect(userPrompt).toContain('affected: A, B, C');
    expect(systemPrompt).toContain('English');
  });

  it('returns null when the LLM is unavailable', async () => {
    complete.mockResolvedValue(null);
    const out = await summarizeRecord({ domain: 'capa', heading: 'X', fields: { a: 1 } });
    expect(out).toBeNull();
  });

  it('returns null for an empty request without calling the LLM', async () => {
    const out = await summarizeRecord({ domain: 'generic', heading: '   ', fields: {} });
    expect(out).toBeNull();
    expect(complete).not.toHaveBeenCalled();
  });
});
