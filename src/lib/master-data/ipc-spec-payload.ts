/**
 * Per-criteria-type structured payload, stored as JSON in `specification`.
 *
 * Numeric criteria don't use a payload — their spec lives in
 * specTarget / specTolerancePercent / minValue / maxValue / unit.
 *
 * Older rows may have plain text in `specification`. parseSpecPayload
 * silently falls back to a legacy mapping so existing data still renders.
 */

export interface PassFailPayload {
  type: 'pass_fail';
  passDefinition: string;
  failDefinition: string;
  defaultExpected: 'pass' | 'fail';
}

export interface VisualPayload {
  type: 'visual';
  description: string;
  checklist: string[];
  referenceImage: string;
}

export interface TextPayload {
  type: 'text';
  format: string;
  example: string;
  required: boolean;
}

export type SpecPayload = PassFailPayload | VisualPayload | TextPayload;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

export function parseSpecPayload(
  criteriaType: string,
  raw: unknown,
): SpecPayload | null {
  if (criteriaType === 'numeric' || criteriaType === 'checkbox') return null;
  if (raw === null || raw === undefined || raw === '') {
    return defaultPayload(criteriaType);
  }

  // Try JSON first
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (isObject(parsed) && parsed.type === criteriaType) {
        return validatePayload(parsed) ?? defaultPayload(criteriaType);
      }
    } catch {
      // fall through to legacy text handling
    }
  }
  if (isObject(raw) && raw.type === criteriaType) {
    return validatePayload(raw) ?? defaultPayload(criteriaType);
  }

  // Legacy plain-text fallback — best-effort migration of pre-redesign rows
  const text = typeof raw === 'string' ? raw : '';
  if (criteriaType === 'pass_fail') {
    return { type: 'pass_fail', passDefinition: text, failDefinition: '', defaultExpected: 'pass' };
  }
  if (criteriaType === 'visual') {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    return {
      type: 'visual',
      description: lines[0] ?? '',
      checklist: lines.slice(1).map((l) => l.replace(/^[-•]\s*/, '')),
      referenceImage: '',
    };
  }
  if (criteriaType === 'text') {
    return { type: 'text', format: text, example: '', required: true };
  }
  return null;
}

function validatePayload(obj: Record<string, unknown>): SpecPayload | null {
  if (obj.type === 'pass_fail') {
    return {
      type: 'pass_fail',
      passDefinition: typeof obj.passDefinition === 'string' ? obj.passDefinition : '',
      failDefinition: typeof obj.failDefinition === 'string' ? obj.failDefinition : '',
      defaultExpected: obj.defaultExpected === 'fail' ? 'fail' : 'pass',
    };
  }
  if (obj.type === 'visual') {
    return {
      type: 'visual',
      description: typeof obj.description === 'string' ? obj.description : '',
      checklist: Array.isArray(obj.checklist)
        ? obj.checklist.filter((x): x is string => typeof x === 'string')
        : [],
      referenceImage: typeof obj.referenceImage === 'string' ? obj.referenceImage : '',
    };
  }
  if (obj.type === 'text') {
    return {
      type: 'text',
      format: typeof obj.format === 'string' ? obj.format : '',
      example: typeof obj.example === 'string' ? obj.example : '',
      required: obj.required !== false,
    };
  }
  return null;
}

export function defaultPayload(criteriaType: string): SpecPayload | null {
  if (criteriaType === 'pass_fail') {
    return { type: 'pass_fail', passDefinition: '', failDefinition: '', defaultExpected: 'pass' };
  }
  if (criteriaType === 'visual') {
    return { type: 'visual', description: '', checklist: [], referenceImage: '' };
  }
  if (criteriaType === 'text') {
    return { type: 'text', format: '', example: '', required: true };
  }
  return null;
}

export function serializeSpecPayload(payload: SpecPayload | null): string | null {
  if (!payload) return null;
  return JSON.stringify(payload);
}
