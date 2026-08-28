/**
 * The max-limit criteria type: a ceiling and nothing else.
 *
 * Plenty of criteria are written as "not more than" with no target to hit and
 * no floor worth stating — microbial limits, heavy metals, loss on drying,
 * friability. Expressing those as Target ± Tolerance forces the author to
 * invent a target and a lower bound the specification never had.
 */
import { describe, it, expect } from 'vitest';
import { defaultPayload, parseSpecPayload } from '@/lib/master-data/ipc-spec-payload';
import { CRITERIA_TYPE_META } from '@/lib/master-data/ipc-test-catalog';

/** The rule the recorder applies: at or under the limit passes. */
const judge = (reading: number, max: number) => (reading <= max ? 'pass' : 'fail');

describe('max_limit payload', () => {
  it('starts with an empty ceiling and no other bound', () => {
    const p = defaultPayload('max_limit');
    expect(p).toEqual({ type: 'max_limit', maxValue: '', note: '' });
    // Nothing resembling a target, a minimum or a tolerance.
    expect(Object.keys(p as object).sort()).toEqual(['maxValue', 'note', 'type']);
  });

  it('survives a save and reopen', () => {
    const stored = JSON.stringify({ type: 'max_limit', maxValue: '1000', note: 'USP <61>' });
    const back = parseSpecPayload('max_limit', stored);
    expect(back).toEqual({ type: 'max_limit', maxValue: '1000', note: 'USP <61>' });
  });

  it('keeps a numeric ceiling that was stored as a number', () => {
    const back = parseSpecPayload('max_limit', JSON.stringify({ type: 'max_limit', maxValue: 1000 }));
    expect((back as { maxValue: string }).maxValue).toBe('1000');
  });

  it('is a type the rest of the app knows about', () => {
    expect(CRITERIA_TYPE_META.max_limit).toBeDefined();
    expect(CRITERIA_TYPE_META.max_limit.label).toBe('Max Limit');
  });
});

describe('max_limit judgement', () => {
  it('passes under the limit and on it, fails above', () => {
    expect(judge(999, 1000)).toBe('pass');
    expect(judge(1000, 1000)).toBe('pass'); // "ไม่เกิน" includes the limit
    expect(judge(1000.0001, 1000)).toBe('fail');
  });

  it('has no lower bound — zero is a fine result', () => {
    expect(judge(0, 1000)).toBe('pass');
    expect(judge(-5, 1000)).toBe('pass');
  });
});
