/**
 * Multi-stage acceptance plan helpers.
 *
 * USP <711> Dissolution and <905> Uniformity of Dosage Units describe a
 * tiered retest workflow: pull N samples for stage 1; if it fails, pull
 * additional samples for stage 2; if that fails, reject or open a deviation.
 *
 * Stages are stored as a JSON-serialized array on the IPC criteria row.
 * Empty/null acceptanceStages means single-stage (use sampleSize +
 * tolerancePercent on the row directly).
 */

export type OnFailAction = 'next_stage' | 'reject_batch' | 'deviation';

export interface AcceptanceStage {
  /** Sample size pulled for this stage */
  sampleSize: number;
  /** Sample-failure tolerance % allowed in this stage */
  tolerancePercent: number;
  /** What happens when this stage's tolerance is exceeded */
  onFail: OnFailAction;
}

const ON_FAIL_LABEL: Record<OnFailAction, string> = {
  next_stage: 'ไปยัง Stage ถัดไป',
  reject_batch: 'ปฏิเสธรุ่นผลิต',
  deviation: 'บันทึก Deviation',
};

export function getOnFailLabel(action: OnFailAction): string {
  return ON_FAIL_LABEL[action] ?? action;
}

/**
 * USP <711> Dissolution recommended plan: 6 → 6 → 12 (cumulative 6, 12, 24).
 * Stages 1, 2 advance on fail; stage 3 ends with deviation.
 */
export const USP_DISSOLUTION_PLAN: AcceptanceStage[] = [
  { sampleSize: 6, tolerancePercent: 0, onFail: 'next_stage' },
  { sampleSize: 6, tolerancePercent: 0, onFail: 'next_stage' },
  { sampleSize: 12, tolerancePercent: 0, onFail: 'deviation' },
];

/**
 * USP <905> Content Uniformity recommended plan: 10 → 20.
 */
export const USP_UNIFORMITY_PLAN: AcceptanceStage[] = [
  { sampleSize: 10, tolerancePercent: 0, onFail: 'next_stage' },
  { sampleSize: 20, tolerancePercent: 0, onFail: 'deviation' },
];

/**
 * Parse acceptanceStages from DB. Returns empty array on null/invalid JSON.
 * Never throws — single-stage criteria are valid and have null stages.
 */
export function parseAcceptanceStages(value: unknown): AcceptanceStage[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(isValidStage) as AcceptanceStage[];
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidStage) as AcceptanceStage[];
  } catch {
    return [];
  }
}

function isValidStage(s: unknown): s is AcceptanceStage {
  if (!s || typeof s !== 'object') return false;
  const stage = s as Record<string, unknown>;
  return (
    typeof stage.sampleSize === 'number' &&
    stage.sampleSize > 0 &&
    typeof stage.tolerancePercent === 'number' &&
    stage.tolerancePercent >= 0 &&
    (stage.onFail === 'next_stage' || stage.onFail === 'reject_batch' || stage.onFail === 'deviation')
  );
}

/**
 * Serialize stages for DB storage. Returns null when there are no stages so
 * the column stays NULL rather than carrying "[]" — callers reading the row
 * can rely on null vs non-null to detect single-stage vs multi-stage.
 */
export function serializeAcceptanceStages(stages: unknown): string | null {
  const valid = parseAcceptanceStages(stages);
  if (valid.length === 0) return null;
  return JSON.stringify(valid);
}

/**
 * Per-stage acceptance math: how many samples may fail before the stage
 * triggers its onFail action.
 */
export function calcStageAcceptance(stage: AcceptanceStage): {
  sampleSize: number;
  allowedFail: number;
  mustPass: number;
} {
  const allowedFail = Math.floor((stage.sampleSize * stage.tolerancePercent) / 100);
  return {
    sampleSize: stage.sampleSize,
    allowedFail,
    mustPass: stage.sampleSize - allowedFail,
  };
}

/**
 * Total samples across all stages (useful for batch planning).
 */
export function totalStageSamples(stages: AcceptanceStage[]): number {
  return stages.reduce((sum, s) => sum + s.sampleSize, 0);
}

export function emptyStage(): AcceptanceStage {
  return { sampleSize: 6, tolerancePercent: 0, onFail: 'next_stage' };
}
