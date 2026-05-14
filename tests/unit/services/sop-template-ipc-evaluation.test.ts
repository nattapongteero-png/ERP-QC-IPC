/**
 * Unit tests for IPC Criteria evaluation logic used in SOP Execution
 * "Complete Step" dialog. The same evaluation function runs in the browser
 * to decide whether a recorded value passes or fails the linked criteria.
 */
import { describe, it, expect } from 'vitest';

interface IPCCriteriaLink {
  criteriaType: string;
  minValue?: number | null;
  maxValue?: number | null;
  specTarget?: number | null;
}

interface IPCRecordedValue {
  procedureStepId?: number;
  criteriaId?: number;
  value?: number | null;
  checked?: boolean;
  notes?: string | null;
}

// Mirror of `evaluateIPC` from sop-execution page.
function evaluateIPC(
  criteria: IPCCriteriaLink,
  value: IPCRecordedValue | undefined
): 'pass' | 'fail' | 'pending' {
  if (!value) return 'pending';
  if (criteria.criteriaType === 'checkbox') {
    if (value.checked === undefined) return 'pending';
    return value.checked ? 'pass' : 'fail';
  }
  if (value.value == null || !Number.isFinite(value.value)) return 'pending';
  const v = value.value;
  if (criteria.minValue != null && v < criteria.minValue) return 'fail';
  if (criteria.maxValue != null && v > criteria.maxValue) return 'fail';
  return 'pass';
}

describe('evaluateIPC - numeric criteria', () => {
  const numericSpec: IPCCriteriaLink = {
    criteriaType: 'numeric',
    minValue: 95,
    maxValue: 105,
  };

  it('returns pending when no value recorded', () => {
    expect(evaluateIPC(numericSpec, undefined)).toBe('pending');
    expect(evaluateIPC(numericSpec, { value: null })).toBe('pending');
  });

  it('passes when value is within min-max range', () => {
    expect(evaluateIPC(numericSpec, { value: 100 })).toBe('pass');
    expect(evaluateIPC(numericSpec, { value: 95 })).toBe('pass'); // boundary ok
    expect(evaluateIPC(numericSpec, { value: 105 })).toBe('pass'); // boundary ok
  });

  it('fails when value is below minValue', () => {
    expect(evaluateIPC(numericSpec, { value: 94.99 })).toBe('fail');
    expect(evaluateIPC(numericSpec, { value: 0 })).toBe('fail');
  });

  it('fails when value is above maxValue', () => {
    expect(evaluateIPC(numericSpec, { value: 105.01 })).toBe('fail');
    expect(evaluateIPC(numericSpec, { value: 1000 })).toBe('fail');
  });

  it('handles min-only spec (no upper bound)', () => {
    const spec: IPCCriteriaLink = { criteriaType: 'numeric', minValue: 10 };
    expect(evaluateIPC(spec, { value: 9 })).toBe('fail');
    expect(evaluateIPC(spec, { value: 10 })).toBe('pass');
    expect(evaluateIPC(spec, { value: 99999 })).toBe('pass');
  });

  it('handles max-only spec (no lower bound)', () => {
    const spec: IPCCriteriaLink = { criteriaType: 'numeric', maxValue: 50 };
    expect(evaluateIPC(spec, { value: -100 })).toBe('pass');
    expect(evaluateIPC(spec, { value: 50 })).toBe('pass');
    expect(evaluateIPC(spec, { value: 51 })).toBe('fail');
  });

  it('treats NaN/Infinity as pending', () => {
    expect(evaluateIPC(numericSpec, { value: NaN })).toBe('pending');
    expect(evaluateIPC(numericSpec, { value: Infinity })).toBe('pending');
  });
});

describe('evaluateIPC - checkbox criteria', () => {
  const checkSpec: IPCCriteriaLink = { criteriaType: 'checkbox' };

  it('returns pending when checkbox not touched', () => {
    expect(evaluateIPC(checkSpec, { checked: undefined })).toBe('pending');
    expect(evaluateIPC(checkSpec, {})).toBe('pending');
  });

  it('passes when checked=true', () => {
    expect(evaluateIPC(checkSpec, { checked: true })).toBe('pass');
  });

  it('fails when checked=false (explicit fail)', () => {
    expect(evaluateIPC(checkSpec, { checked: false })).toBe('fail');
  });

  it('ignores numeric value on checkbox criteria', () => {
    expect(evaluateIPC(checkSpec, { value: 100, checked: true })).toBe('pass');
  });
});

describe('evaluateIPC - merge logic for completeStep payload (per sub-step)', () => {
  interface LinkedCriteria {
    procedureStepId: number;
    criteriaId: number;
  }
  interface Payload {
    _confirmedSubSteps?: number[];
    _ipcValues?: IPCRecordedValue[];
    [k: string]: unknown;
  }

  const ipcKey = (stepId: number, critId: number) => `${stepId}:${critId}`;

  // Mirror of handleCompleteStep merge used in sop-execution page.
  function buildPayload(
    existing: Record<string, unknown>,
    actualParams: Record<string, number>,
    ipcValues: Record<string, IPCRecordedValue>,
    linked: LinkedCriteria[]
  ): Payload {
    const list: IPCRecordedValue[] = [];
    for (const l of linked) {
      const v = ipcValues[ipcKey(l.procedureStepId, l.criteriaId)];
      if (v) list.push(v);
    }
    return { ...existing, ...actualParams, _ipcValues: list };
  }

  it('preserves existing keys (e.g. _confirmedSubSteps)', () => {
    const existing = { _confirmedSubSteps: [1, 2, 3] };
    const params = { temperature: 75 };
    const ipc = {
      '10:5': { procedureStepId: 10, criteriaId: 5, value: 10 },
    };
    const payload = buildPayload(existing, params, ipc, [
      { procedureStepId: 10, criteriaId: 5 },
    ]);
    expect(payload._confirmedSubSteps).toEqual([1, 2, 3]);
    expect(payload.temperature).toBe(75);
    expect(payload._ipcValues).toHaveLength(1);
    expect(payload._ipcValues?.[0].procedureStepId).toBe(10);
  });

  it('keys by (procedureStepId, criteriaId) — same criteria under different sub-steps', () => {
    // Same IPC criteria 50 linked under two different sub-steps (10 and 20)
    // must produce two independent recorded values.
    const ipcValues = {
      '10:50': { procedureStepId: 10, criteriaId: 50, value: 100 },
      '20:50': { procedureStepId: 20, criteriaId: 50, value: 105 },
    };
    const payload = buildPayload({}, {}, ipcValues, [
      { procedureStepId: 10, criteriaId: 50 },
      { procedureStepId: 20, criteriaId: 50 },
    ]);
    expect(payload._ipcValues).toHaveLength(2);
    expect(payload._ipcValues?.[0].value).toBe(100);
    expect(payload._ipcValues?.[1].value).toBe(105);
  });

  it('drops values for orphaned criteria (criteria removed from linkage after WO start)', () => {
    const ipcValues = {
      '10:5': { procedureStepId: 10, criteriaId: 5, value: 50 }, // still linked
      '10:99': { procedureStepId: 10, criteriaId: 99, value: 12 }, // no longer linked
    };
    const payload = buildPayload({}, {}, ipcValues, [
      { procedureStepId: 10, criteriaId: 5 },
    ]);
    expect(payload._ipcValues).toHaveLength(1);
    expect(payload._ipcValues?.[0].criteriaId).toBe(5);
  });

  it('handles no IPC linkage at all (empty list)', () => {
    const payload = buildPayload({}, { pressure: 1.2 }, {}, []);
    expect(payload._ipcValues).toEqual([]);
    expect(payload.pressure).toBe(1.2);
  });
});
