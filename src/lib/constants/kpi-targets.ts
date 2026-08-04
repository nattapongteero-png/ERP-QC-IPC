/**
 * KPI targets and the definitions behind the ambiguous ones.
 *
 * ⚠️ THESE ARE PROVISIONAL. The dashboard plan's Phase 0 says the department
 * heads must confirm every target and definition in writing before the
 * dashboards go live, because the classic way a dashboard project dies is that
 * its numbers disagree with the spreadsheet each department already trusts.
 * The values below are the plan's worked examples — they are here so the pages
 * can be built and reviewed, NOT because anyone has signed them off yet.
 *
 * Everything lives in one file so confirming a target is a one-line edit rather
 * than a hunt through page components.
 */

/** Percentage targets. A KPI at or above its target reads as "on target". */
export const KPI_TARGETS = {
  production: {
    /** Work orders finished on or before plannedEndDate. */
    scheduleAdherencePercent: 92,
    /** actualQuantity ÷ plannedQuantity. */
    yieldPercent: 93,
    /** Lots completed with no qualifying deviation. */
    rightFirstTimePercent: 96,
    /** rejectQuantity ÷ (actual + reject) — lower is better. */
    maxRejectPercent: 2,
    /** Completed → QA released, in days — lower is better. */
    maxQaReleaseDays: 3,
  },
  purchasing: {
    /** Receipts on or before the PO's expectedDate. */
    onTimeDeliveryPercent: 95,
    /** Requisition created → PO approved, in days — lower is better. */
    maxPoCycleDays: 5,
    /** Share of spend held by the top 3 vendors — lower is safer. */
    maxTop3ConcentrationPercent: 60,
    /** GRN lines accepted by QC. */
    incomingAcceptancePercent: 98,
  },
  sales: {
    /** Delivered complete and on time. */
    otifPercent: 95,
    /** Gross margin on delivered revenue. */
    grossMarginPercent: 33,
    /** Quotations that became orders. */
    winRatePercent: 25,
    /** Share of receivables past due — lower is better. */
    maxOverdueArPercent: 10,
  },
} as const;

/**
 * The three definitions the plan flags as ambiguous. Each is stated explicitly
 * so the number on screen can be traced to a rule, and so changing the rule is
 * a deliberate edit rather than a quiet drift.
 */
export const KPI_DEFINITIONS = {
  /**
   * Right First Time counts a work order as "first time right" when it carries
   * no deviation of these severities. Minor deviations are excluded by default:
   * counting every paperwork note would push RFT toward zero and stop the
   * number meaning anything.
   */
  rftDeviationSeverities: ['major', 'critical'] as string[],

  /**
   * On-time delivery tolerance. Arriving early is on time; the grace period
   * applies to lateness only.
   */
  otdGraceDays: 0,

  /**
   * OTIF treats an early shipment as on time (no upper bound on earliness).
   * Set to a number if the business wants early deliveries penalised.
   */
  otifEarlyToleranceDays: null as number | null,

  /**
   * Purchase price variance baseline. 'standard_cost' ties the dashboard to the
   * accounting standard-cost module so procurement and finance argue from one
   * number; 'last_po' is the fallback when standard costs are not maintained.
   */
  ppvBaseline: 'standard_cost' as 'standard_cost' | 'last_po',
} as const;

/** Rolling window (days) the headline "last 30 days" figures use. */
export const KPI_WINDOW_DAYS = 30;

/** How many months of history the trend charts show. */
export const KPI_TREND_MONTHS = 12;

/**
 * Judge a percentage KPI against its target.
 * `lowerIsBetter` flips the comparison for things like reject rate.
 */
export function kpiStatus(
  value: number | null | undefined,
  target: number,
  lowerIsBetter = false,
): 'on_target' | 'below_target' | 'unknown' {
  if (value == null || !Number.isFinite(value)) return 'unknown';
  const ok = lowerIsBetter ? value <= target : value >= target;
  return ok ? 'on_target' : 'below_target';
}
