/**
 * Phase State Service
 *
 * Computes environmental-monitoring phase state ON THE FLY from work order
 * status and activity checklists. No dedicated lifecycle table — state is
 * always derived, so it can never drift from reality.
 *
 * Three monitored phases (each has its own Environmental Monitoring tab):
 *   - pre_production
 *   - production
 *   - packaging
 *
 * Rules (all within an active WO, status in released/in_progress):
 *
 *   Pre-Production is "done" when Material Weighing is fully verified.
 *   Production is "done" when IPC tests are fully approved.
 *   Packaging is "done" when Packaging Integrity checks all pass.
 *
 * activePhase = the first phase (in order) that isn't "done".
 * pending     = status != released/in_progress, OR a prior phase isn't done yet
 * active      = this phase is the activePhase
 * completed   = this phase is "done"
 *
 * Consumed by:
 *   - POST /api/environmental-logs (IoT mode): gate which phase receives logs
 *   - GET  /api/production/work-orders/[id]/phase/status: UI badges
 *   - Environmental Monitoring page: per-tab banner + state
 */

import { eq, and } from 'drizzle-orm';
import { executeDbOperation, getTableRef } from '../db/db-helper';
import {
  getWOMaterials,
  getWOIPCTests,
  getWOPackagingIntegrityLogs,
} from './wo-execution.service';

export type MonitoredPhase = 'pre_production' | 'production' | 'packaging';
export type PhaseStatus = 'pending' | 'active' | 'completed';

const PHASE_ORDER: MonitoredPhase[] = ['pre_production', 'production', 'packaging'];
const ACTIVE_WO_STATUSES = ['released', 'in_progress'];

export interface PhaseStateInfo {
  status: PhaseStatus;
  /** ISO timestamp or null — first env log or WO release time */
  startedAt: string | null;
  /** ISO timestamp or null — last env log when phase is completed */
  completedAt: string | null;
  /** Progress for the activity that drives this phase's completion */
  progress: { completed: number; total: number };
  /** True when the WO's BOM has at least one room mapped to this phase */
  hasRoomMapping: boolean;
}

export interface PhaseStateResponse {
  workOrderId: number;
  workOrderStatus: string;
  /** WO's bomId — used by UI to build deep-links to BOM Rooms setup */
  bomId: number | null;
  activePhase: MonitoredPhase | null;
  pre_production: PhaseStateInfo;
  production: PhaseStateInfo;
  packaging: PhaseStateInfo;
}

/**
 * Check whether each phase's "completion criteria" is met.
 * Rule: phase is done only when its gating activity has progress > 0 AND all items are verified/approved/passed.
 */
async function getPhaseCompletionFlags(woId: number): Promise<{
  pre_production: { done: boolean; progress: { completed: number; total: number } };
  production: { done: boolean; progress: { completed: number; total: number } };
  packaging: { done: boolean; progress: { completed: number; total: number } };
}> {
  const [materials, ipcTests, integrityLogs] = await Promise.all([
    getWOMaterials(woId).catch(() => []),
    getWOIPCTests(woId).catch(() => [] as Array<Record<string, unknown>>),
    getWOPackagingIntegrityLogs(woId).catch(() => [] as Array<Record<string, unknown>>),
  ]);

  // Pre-Production: every material has been weighed (weighedAt set).
  // We use "weighed" rather than "verified" because users expect the phase to
  // auto-advance as soon as the activity is DONE — verification is a separate
  // GMP sign-off that may happen later and shouldn't block the phase boundary.
  // For every phase: when the gating activity has ZERO items, nothing is
  // configured for this WO/phase, so the phase is considered done and the WO
  // can advance past it (don't strand the operator on an empty phase).
  const weighingTotal = materials.length;
  const weighingDone = materials.filter(
    (m: Record<string, unknown>) => Boolean(m.weighedAt),
  ).length;
  const preProductionDone = weighingTotal === 0 || weighingDone === weighingTotal;

  // Production: IPC tests have a recorded result (pass or fail).
  const ipcTotal = ipcTests.length;
  const ipcRecorded = ipcTests.filter(
    (t: Record<string, unknown>) => Boolean(t.result) || t.status === 'pass' || t.status === 'passed' || t.status === 'fail' || t.status === 'failed',
  ).length;
  const productionDone = ipcTotal === 0 || ipcRecorded === ipcTotal;

  // Packaging: integrity checks all have verdicts (pass or fail). We don't
  // gate on passed-only because a failed check still closes the activity;
  // QA can reject via other workflows.
  const integrityTotal = integrityLogs.length;
  const integrityRecorded = integrityLogs.filter(
    (l: Record<string, unknown>) =>
      l.tubeCapComplete !== null && l.tubeCapComplete !== undefined,
  ).length;
  const packagingDone = integrityTotal === 0 || integrityRecorded === integrityTotal;

  return {
    pre_production: {
      done: preProductionDone,
      progress: { completed: weighingDone, total: weighingTotal },
    },
    production: {
      done: productionDone,
      progress: { completed: ipcRecorded, total: ipcTotal },
    },
    packaging: {
      done: packagingDone,
      progress: { completed: integrityRecorded, total: integrityTotal },
    },
  };
}

/**
 * Find the earliest/latest created_at of env logs for a given WO+phase.
 * Used to derive "started at" / "completed at" for the UI (no separate lifecycle table).
 */
async function getPhaseTimeBounds(
  woId: number,
  phase: MonitoredPhase,
): Promise<{ first: string | null; last: string | null }> {
  const envLogs = getTableRef('wOEnvironmentalLogs');
  const rows = await executeDbOperation(async (db) => {
    return db
      .select({ createdAt: envLogs.createdAt })
      .from(envLogs)
      .where(and(eq(envLogs.workOrderId, woId), eq(envLogs.phase, phase)));
  });

  if (rows.length === 0) return { first: null, last: null };

  let first: string | null = null;
  let last: string | null = null;
  for (const r of rows) {
    const t = r.createdAt ? String(r.createdAt) : null;
    if (!t) continue;
    if (!first || t < first) first = t;
    if (!last || t > last) last = t;
  }
  return { first, last };
}

/**
 * Compute full phase state for a work order.
 * Single entry point used by API + IoT gating.
 */
/**
 * Query bom_rooms to find which phases are mapped for a given BOM.
 * Returns a set of phases that have at least one room mapping.
 */
async function getMappedPhases(bomId: number): Promise<Set<string>> {
  const bomRooms = getTableRef('bOMRooms');
  const rows = await executeDbOperation(async (db) => {
    return db
      .select({ phase: bomRooms.phase })
      .from(bomRooms)
      .where(eq(bomRooms.bomId, bomId));
  });
  return new Set(rows.map((r: { phase: string }) => String(r.phase)));
}

export async function getPhaseState(workOrderId: number): Promise<PhaseStateResponse> {
  const workOrders = getTableRef('workOrders');
  const woRows = await executeDbOperation(async (db) => {
    return db
      .select({ id: workOrders.id, status: workOrders.status, bomId: workOrders.bomId })
      .from(workOrders)
      .where(eq(workOrders.id, workOrderId))
      .limit(1);
  });

  const wo = woRows[0];
  if (!wo) {
    throw new Error(`Work order ${workOrderId} not found`);
  }

  const workOrderStatus = String(wo.status);
  const isActive = ACTIVE_WO_STATUSES.includes(workOrderStatus);
  const bomId = wo.bomId ? Number(wo.bomId) : null;

  // Query BOM room mappings (once) to populate hasRoomMapping on each phase info.
  const mappedPhases = bomId ? await getMappedPhases(bomId) : new Set<string>();

  // If WO is not active, every phase is pending (unless WO is already completed —
  // then treat everything as completed for read-only historical view).
  if (!isActive) {
    const completedWO = workOrderStatus === 'completed';
    const emptyInfo = (phase: MonitoredPhase): PhaseStateInfo => ({
      status: completedWO ? 'completed' : 'pending',
      startedAt: null,
      completedAt: null,
      progress: { completed: 0, total: 0 },
      hasRoomMapping: mappedPhases.has(phase),
    });

    // Still fill in time bounds from actual logs (so completed WOs show timestamps).
    const [pre, prod, pack] = await Promise.all([
      getPhaseTimeBounds(workOrderId, 'pre_production'),
      getPhaseTimeBounds(workOrderId, 'production'),
      getPhaseTimeBounds(workOrderId, 'packaging'),
    ]);

    return {
      workOrderId,
      workOrderStatus,
      bomId,
      activePhase: null,
      pre_production: { ...emptyInfo('pre_production'), startedAt: pre.first, completedAt: pre.last },
      production: { ...emptyInfo('production'), startedAt: prod.first, completedAt: prod.last },
      packaging: { ...emptyInfo('packaging'), startedAt: pack.first, completedAt: pack.last },
    };
  }

  // WO is active — compute per-phase done flags, then find the first undone phase.
  const flags = await getPhaseCompletionFlags(workOrderId);

  let activePhase: MonitoredPhase | null = null;
  for (const phase of PHASE_ORDER) {
    if (!flags[phase].done) {
      activePhase = phase;
      break;
    }
  }
  // If every phase is done, there's no active phase — user should complete the WO.
  // activePhase stays null in that case.

  // Gather time bounds for all three phases.
  const [preBounds, prodBounds, packBounds] = await Promise.all([
    getPhaseTimeBounds(workOrderId, 'pre_production'),
    getPhaseTimeBounds(workOrderId, 'production'),
    getPhaseTimeBounds(workOrderId, 'packaging'),
  ]);

  const buildInfo = (
    phase: MonitoredPhase,
    bounds: { first: string | null; last: string | null },
  ): PhaseStateInfo => {
    const f = flags[phase];
    let status: PhaseStatus;
    if (f.done) {
      status = 'completed';
    } else if (activePhase === phase) {
      status = 'active';
    } else {
      status = 'pending';
    }
    return {
      status,
      startedAt: bounds.first,
      // completedAt is the last log time only when phase is completed (frozen)
      completedAt: f.done ? bounds.last : null,
      progress: f.progress,
      hasRoomMapping: mappedPhases.has(phase),
    };
  };

  return {
    workOrderId,
    workOrderStatus,
    bomId,
    activePhase,
    pre_production: buildInfo('pre_production', preBounds),
    production: buildInfo('production', prodBounds),
    packaging: buildInfo('packaging', packBounds),
  };
}

/**
 * Lightweight helper — returns just the active phase.
 * Used by IoT POST endpoint to decide whether to log.
 */
export async function getActivePhase(workOrderId: number): Promise<MonitoredPhase | null> {
  const workOrders = getTableRef('workOrders');
  const woRows = await executeDbOperation(async (db) => {
    return db
      .select({ status: workOrders.status })
      .from(workOrders)
      .where(eq(workOrders.id, workOrderId))
      .limit(1);
  });

  const wo = woRows[0];
  if (!wo || !ACTIVE_WO_STATUSES.includes(String(wo.status))) return null;

  const flags = await getPhaseCompletionFlags(workOrderId);
  for (const phase of PHASE_ORDER) {
    if (!flags[phase].done) return phase;
  }
  return null;
}
