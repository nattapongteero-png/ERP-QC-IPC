/**
 * Calibration certificate points — parsing and error calculation.
 *
 * What a balance calibration certificate actually reports, per international
 * practice, is a set of TEST POINTS: for each point the nominal value of the
 * certified standard weight, the value the instrument indicated, and the
 * measurement uncertainty of that reading.
 *   - ISO/IEC 17025 §7.8: results must be reported per measurement with units
 *     and, where relevant, the expanded measurement uncertainty (k≈2, ~95%).
 *   - OIML R76-1 / NIST HB44: error is indicated − nominal at each test load.
 *   - USP <41>: accuracy is judged at 0.10% of the reading; sensitivity /
 *     linearity / eccentricity at 0.05%.
 *
 * So the number the shop floor cares about — "ค่าที่ตรวจสอบได้" — is not one
 * scalar: it is (nominal, indicated) per point, from which error in g and in %
 * is DERIVED. Deriving rather than storing means the summary can never drift
 * away from the readings it was computed from.
 */

export interface CalibrationPoint {
  /** Nominal value of the certified standard weight used, in grams. */
  nominalG: number;
  /** Value the instrument indicated for that weight, in grams. */
  indicatedG: number;
  /** Expanded measurement uncertainty of the reading (± g). Optional. */
  uncertaintyG?: number | null;
}

export interface CalibrationPointResult extends CalibrationPoint {
  /** indicated − nominal, in grams. Signed: negative = reads low. */
  errorG: number;
  /** Error as a percentage of the nominal value. null when nominal is 0. */
  errorPercent: number | null;
}

export interface CalibrationSummary {
  points: CalibrationPointResult[];
  /** Largest |error| across all points, in grams. null when there are no points. */
  maxAbsErrorG: number | null;
  /** Largest |error %| across all points. null when no point has a usable %. */
  maxAbsErrorPercent: number | null;
  /**
   * Whether every point is within `tolerancePercent` (the equipment's own
   * acceptance criterion, defaulted to USP <41>'s 0.10% elsewhere in the app).
   * null when there is nothing to judge.
   */
  withinTolerance: boolean | null;
}

/** Parse the stored JSON column into points, tolerating null/garbage. */
export function parseCalibrationPoints(raw: string | null | undefined): CalibrationPoint[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p): CalibrationPoint | null => {
        const nominalG = Number(p?.nominalG);
        const indicatedG = Number(p?.indicatedG);
        if (!Number.isFinite(nominalG) || !Number.isFinite(indicatedG)) return null;
        // Guard the null/undefined/'' cases explicitly: Number(null) and
        // Number('') are both 0, which would turn "no uncertainty stated on the
        // certificate" into a claimed uncertainty of exactly 0 g.
        const rawU = p?.uncertaintyG;
        const u = rawU === null || rawU === undefined || rawU === '' ? NaN : Number(rawU);
        return { nominalG, indicatedG, uncertaintyG: Number.isFinite(u) ? u : null };
      })
      .filter((p): p is CalibrationPoint => p !== null);
  } catch {
    return [];
  }
}

/** Serialise points back to the stored JSON column ('' when empty). */
export function stringifyCalibrationPoints(points: CalibrationPoint[]): string {
  const clean = points.filter(
    (p) => Number.isFinite(p.nominalG) && Number.isFinite(p.indicatedG),
  );
  return clean.length > 0 ? JSON.stringify(clean) : '';
}

/**
 * Derive per-point error and the certificate-level summary.
 *
 * `tolerancePercent` is the acceptance criterion in percent (e.g. 0.1 = 0.10%),
 * matching production_equipment.tolerance_percent.
 */
export function summariseCalibration(
  points: CalibrationPoint[],
  tolerancePercent: number | null | undefined,
): CalibrationSummary {
  const results: CalibrationPointResult[] = points.map((p) => {
    const errorG = p.indicatedG - p.nominalG;
    const errorPercent = p.nominalG !== 0 ? (errorG / p.nominalG) * 100 : null;
    return { ...p, errorG, errorPercent };
  });

  if (results.length === 0) {
    return { points: results, maxAbsErrorG: null, maxAbsErrorPercent: null, withinTolerance: null };
  }

  const maxAbsErrorG = Math.max(...results.map((r) => Math.abs(r.errorG)));
  const percents = results
    .map((r) => r.errorPercent)
    .filter((v): v is number => v != null)
    .map(Math.abs);
  const maxAbsErrorPercent = percents.length > 0 ? Math.max(...percents) : null;

  const tol = Number(tolerancePercent);
  const withinTolerance =
    maxAbsErrorPercent != null && Number.isFinite(tol) && tol > 0
      ? maxAbsErrorPercent <= tol
      : null;

  return { points: results, maxAbsErrorG, maxAbsErrorPercent, withinTolerance };
}
