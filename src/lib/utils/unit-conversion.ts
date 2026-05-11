/**
 * 3-level unit conversion: Primary Unit (PU) ↔ Secondary Unit (SU) ↔ Weight Unit (WU)
 *
 * Bridge unit = SU. All conversions normalize to SU first to avoid drift across
 * floating-point chains (PU→WU directly would compound rounding error).
 *
 * Example for ขมิ้นชันแคปซูล:
 *   PU = กล่อง, SU = แคปซูล, WU = กรัม
 *   Ratio1: 1 PU = 1,000 SU
 *   Ratio2: 1 SU = 0.1 WU
 */
export type UnitLevel = 'PU' | 'SU' | 'WU';

export interface UnitConfig {
  primaryUnit: string;          // PU label (e.g. 'box')
  secondaryUnit?: string | null; // SU label (e.g. 'capsule')
  weightUnit?: string | null;    // WU label (e.g. 'g')
  conversionRate?: number | null;        // Ratio1: 1 PU = N SU
  secondaryToWeightRate?: number | null; // Ratio2: 1 SU = N WU
  weightTrackingEnabled?: boolean;       // toggle for WU
}

export interface ConversionResult {
  pu: number | null;
  su: number;
  wu: number | null;
}

export interface IssuanceResult {
  requestedSU: number;
  puToIssue: number;       // integer count of PU (after ceil)
  actualIssuedSU: number;  // puToIssue * Ratio1
  remainderSU: number;     // actualIssuedSU - requestedSU (excess in SU at point-of-use)
}

export interface ReturnResult {
  totalIssuedSU: number;
  actualUsedSU: number;
  returnedSU: number;       // totalIssuedSU - actualUsedSU
  returnedPU: number;       // returnedSU / Ratio1 (may be fractional → "0.25 box")
  isZeroCost: true;         // returns are always zero-cost (already costed at issue)
}

const isPositive = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

/**
 * Convert an amount from one unit level to all other levels.
 * Returns null for levels that cannot be derived from the available ratios.
 */
export function convertUnits(
  amount: number,
  fromUnit: UnitLevel,
  config: UnitConfig
): ConversionResult {
  const r1 = config.conversionRate;
  const r2 = config.secondaryToWeightRate;
  const wuOn = config.weightTrackingEnabled === true && isPositive(r2);

  // Step 1: normalize input to SU (the bridge unit)
  let su: number;
  if (fromUnit === 'SU') {
    su = amount;
  } else if (fromUnit === 'PU') {
    if (!isPositive(r1)) {
      throw new Error('convertUnits: PU input requires positive conversionRate');
    }
    su = amount * r1;
  } else {
    if (!wuOn) {
      throw new Error('convertUnits: WU input requires weightTrackingEnabled + secondaryToWeightRate');
    }
    su = amount / (r2 as number);
  }

  // Step 2: derive PU and WU from SU
  const pu = isPositive(r1) ? su / r1 : null;
  const wu = wuOn ? su * (r2 as number) : null;

  return { pu, su, wu };
}

/**
 * Calculate how many PU to physically pull from the warehouse to satisfy a
 * request expressed in SU. Always rounds UP — you can't issue half a box.
 *
 * Example: requested 1,700 SU with Ratio1=1,000 → puToIssue=2, actualIssuedSU=2,000,
 * remainderSU=300 (the leftover capsules sitting in the production room).
 */
export function calculateIssuance(
  requestedSU: number,
  config: UnitConfig
): IssuanceResult {
  const r1 = config.conversionRate;
  if (!isPositive(r1)) {
    throw new Error('calculateIssuance: positive conversionRate is required');
  }
  if (requestedSU <= 0) {
    throw new Error('calculateIssuance: requestedSU must be positive');
  }

  const puToIssue = Math.ceil(requestedSU / r1);
  const actualIssuedSU = puToIssue * r1;
  const remainderSU = actualIssuedSU - requestedSU;

  return { requestedSU, puToIssue, actualIssuedSU, remainderSU };
}

/**
 * Calculate the return-to-warehouse amount after weighing what was actually
 * consumed in production.
 *
 * Inputs:
 *   - actualWeightUsed: weighed quantity in WU (e.g. 175 g)
 *   - totalIssuedSU: SU originally issued (e.g. 2,000 capsules from 2 boxes)
 *
 * Output:
 *   - returnedSU + returnedPU (fractional PU is allowed for return slips)
 *   - flagged isZeroCost because the cost was already booked at issue time
 *
 * Example: issued 2,000 SU, used 175 g (=1,750 SU) → return 250 SU = 0.25 PU
 */
export function calculateReturn(
  actualWeightUsed: number,
  totalIssuedSU: number,
  config: UnitConfig
): ReturnResult {
  const r1 = config.conversionRate;
  const r2 = config.secondaryToWeightRate;
  if (!isPositive(r1)) {
    throw new Error('calculateReturn: positive conversionRate is required');
  }
  if (!config.weightTrackingEnabled || !isPositive(r2)) {
    throw new Error('calculateReturn: weight tracking must be enabled with positive secondaryToWeightRate');
  }
  if (actualWeightUsed < 0 || totalIssuedSU <= 0) {
    throw new Error('calculateReturn: invalid input quantities');
  }

  const actualUsedSU = actualWeightUsed / r2;

  if (actualUsedSU > totalIssuedSU) {
    throw new Error(
      `calculateReturn: actualUsed (${actualUsedSU} SU) exceeds issued (${totalIssuedSU} SU)`
    );
  }

  const returnedSU = totalIssuedSU - actualUsedSU;
  const returnedPU = returnedSU / r1;

  return {
    totalIssuedSU,
    actualUsedSU,
    returnedSU,
    returnedPU,
    isZeroCost: true,
  };
}
