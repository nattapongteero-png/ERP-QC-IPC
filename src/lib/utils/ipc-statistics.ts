/**
 * IPC statistics helpers — used by the eBMR's In-Process Control section
 * (audit gap #3) to compute mean, sample standard deviation, and the
 * percentage deviation from the spec midpoint / target.
 *
 * Pure functions. No external state. Safe to import from server + client.
 */

export interface IPCSamplePoint {
  numericResult: number | null | undefined;
  status?: string | null;
}

export interface IPCSampleStats {
  count: number;
  mean: number | null;
  /** Sample standard deviation (Bessel-corrected, n-1). null when n < 2. */
  stdDev: number | null;
  min: number | null;
  max: number | null;
}

/**
 * Compute count/mean/sd/min/max for a set of test results. Non-numeric
 * entries (text-only tests, pending, null) are ignored — only finite
 * numericResult values participate.
 */
export function computeIPCStats(samples: IPCSamplePoint[]): IPCSampleStats {
  const values = samples
    .filter((s) => s.numericResult != null)
    .map((s) => Number(s.numericResult))
    .filter((v) => Number.isFinite(v));

  if (values.length === 0) {
    return { count: 0, mean: null, stdDev: null, min: null, max: null };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  let stdDev: number | null = null;
  if (values.length >= 2) {
    const sqDiffSum = values.reduce((acc, v) => acc + (v - mean) ** 2, 0);
    stdDev = Math.sqrt(sqDiffSum / (values.length - 1));
  }

  return { count: values.length, mean, stdDev, min, max };
}

/**
 * Percentage deviation of `value` from the spec midpoint (or from the
 * target if specified). Returns null when the spec is not numeric or
 * the value is missing.
 *
 * For a spec range [min, max]:
 *   target  = (min + max) / 2   (unless an explicit target is passed)
 *   %dev    = (value - target) / target * 100
 *
 * Edge cases:
 *   - target = 0  → returns null (avoid divide-by-zero)
 *   - either spec bound missing → returns null
 */
export function computePercentDeviation(
  value: number | null | undefined,
  specMin: number | null | undefined,
  specMax: number | null | undefined,
  target?: number | null,
): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const v = Number(value);

  let centre: number | null = null;
  if (target != null && Number.isFinite(Number(target))) {
    centre = Number(target);
  } else if (
    specMin != null &&
    specMax != null &&
    Number.isFinite(Number(specMin)) &&
    Number.isFinite(Number(specMax))
  ) {
    centre = (Number(specMin) + Number(specMax)) / 2;
  }
  if (centre == null || centre === 0) return null;

  return ((v - centre) / centre) * 100;
}

/**
 * Group IPC tests by the `ipcPhase` column. Tests without a phase are
 * bucketed under 'production' so they still show up on the eBMR rather
 * than being silently dropped.
 */
export function groupIPCByPhase<T extends { ipcPhase?: string | null }>(
  tests: T[],
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const t of tests) {
    const phase = t.ipcPhase || 'production';
    if (!out[phase]) out[phase] = [];
    out[phase].push(t);
  }
  return out;
}
