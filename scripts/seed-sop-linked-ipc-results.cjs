/**
 * Record SOP-linked IPC results for the in_progress / completed WOs so the
 * SOP Execution screen shows real IPC results (all three criteria types:
 * weight, numeric, checkbox) and leaves one step mid-recording so the operator
 * sees the "record IPC now" state.
 *
 * Mirrors recordSOPLinkedIPCResults():
 *   quality_tests row keyed by sample_number = 'SOP-{execId}-IPC-{critId}',
 *   test_type='in_process', ipc_criteria_id, status, ipc_phase
 *   + ipc_test_samples rows (per-sample numeric/text + result).
 *
 * The display in wo-execution.service matches recorded tests to a step by that
 * exact sample_number, so we must use it verbatim.
 *
 * Writes scripts/_sop-ipc-results.sql (applied by the wrapper). Idempotent:
 * deletes prior SOP-linked tests + their samples for these WOs first.
 */
const fs = require('fs');

const OP = 2, VER = 3;

// Input data is produced by the shell wrapper into scripts/_ipc-data.tsv via:
//   SELECT w.id, w.status, e.id, e.status, l.criteria_id, c.criteria_type,
//          c.min_value, c.max_value, c.spec_tolerance_percent, c.sample_size,
//          c.unit, <phase>, <in_process lot id>
//   FROM work_orders w JOIN wo_sop_execution e ... JOIN bom_sop_step_ipc l ...
//   WHERE w.status IN ('in_progress','completed')
// (Node runs on the Windows host with no /bin/bash, so we read a file rather
//  than shelling into the mysql container.)
const rows = fs.readFileSync('scripts/_ipc-data.tsv', 'utf8')
  .split('\n').filter(Boolean).map(l => l.split('\t'));

// Group by (wo, execId)
const groups = {};
for (const r of rows) {
  const [woId, woStatus, execId, execStatus, critId, type, minV, maxV, tolPct, sampleSize, unit, phase, lotId] = r;
  const key = `${woId}|${execId}`;
  if (!groups[key]) groups[key] = { woId: +woId, woStatus, execId: +execId, execStatus, phase, lotId: lotId ? +lotId : null, ipc: [] };
  groups[key].ipc.push({ critId: +critId, type, minV: minV === 'NULL' ? null : +minV, maxV: maxV === 'NULL' ? null : +maxV, tolPct: +tolPct, sampleSize: Math.min(+sampleSize || 5, 10), unit });
}

// Nominal in-spec value per criteria type/code for realistic numbers.
function sampleValue(ipc) {
  if (ipc.type === 'weight') return 500.0;                 // mg nominal
  if (ipc.type === 'numeric') {
    if (ipc.minV != null && ipc.maxV != null) return +(((ipc.minV + ipc.maxV) / 2).toFixed(2));
    if (ipc.maxV != null) return +(ipc.maxV * 0.6).toFixed(2);   // below max
    if (ipc.minV != null) return +(ipc.minV * 1.05).toFixed(2);  // above min
    return 1.0;
  }
  return null; // checkbox -> result only
}

const sql = ['SET NAMES utf8mb4;'];
const S = (x) => sql.push(x);

// Clean prior SOP-linked tests for these WOs (and their samples).
const woIds = [...new Set(Object.values(groups).map(g => g.woId))];
if (woIds.length) {
  S(`DELETE s FROM ipc_test_samples s JOIN quality_tests q ON q.id=s.quality_test_id WHERE q.sample_number LIKE 'SOP-%-IPC-%' AND q.lot_id IN (SELECT id FROM inventory_lots WHERE lot_number IN (SELECT CONCAT(batch_number,'-IP') FROM work_orders WHERE id IN (${woIds.join(',')})));`);
  S(`DELETE q FROM quality_tests q WHERE q.sample_number LIKE 'SOP-%-IPC-%' AND q.lot_id IN (SELECT id FROM inventory_lots WHERE lot_number IN (SELECT CONCAT(batch_number,'-IP') FROM work_orders WHERE id IN (${woIds.join(',')})));`);
}

// Decide per group whether IPC is recorded (pass) or left pending.
// Rule: if the SOP step is 'verified' or WO is completed -> record all (pass).
//       if step is 'in_progress' -> record all but ONE criterion (leave it
//         pending) so the operator sees a half-done recording.
//       if step is 'pending' -> leave ALL pending (nothing recorded) so the
//         "record IPC now" prompt is the next action.
let pendingDemoUsed = false;
for (const g of Object.values(groups)) {
  if (!g.lotId) continue;
  const stepDone = g.execStatus === 'verified' || g.woStatus === 'completed';
  const stepInProgress = g.execStatus === 'in_progress';

  g.ipc.forEach((ipc, i) => {
    const sn = `SOP-${g.execId}-IPC-${ipc.critId}`;
    let record;
    if (stepDone) record = true;
    else if (stepInProgress) record = i < g.ipc.length - 1; // all but last
    else record = false; // pending step -> record nothing

    if (!record) return; // leave it unrecorded -> shows as "to record"

    const n = ipc.sampleSize;
    const val = sampleValue(ipc);
    // quality_tests row (status pass)
    S(`INSERT INTO quality_tests
        (lot_id,test_type,sample_number,ipc_criteria_id,sample_size,status,result,tested_by,test_date,
         spec_min_value,spec_max_value,spec_unit,criteria_type,tolerance_percent,spec_tolerance_percent,
         ipc_phase,retest_round,requested_by,requested_at,notes,created_at,updated_at)
       VALUES (${g.lotId},'in_process','${sn}',${ipc.critId},${n},'pass','pass',${OP},NOW(),
         ${ipc.minV ?? 'NULL'},${ipc.maxV ?? 'NULL'},${ipc.unit && ipc.unit!=='NULL' ? `'${ipc.unit}'` : 'NULL'},'${ipc.type}',0,${ipc.tolPct||0},
         '${g.phase}',1,${OP},NOW(),'ตัวอย่าง seed: IPC ใน SOP',NOW(),NOW());`);
    S(`SET @qt := LAST_INSERT_ID();`);
    // samples
    for (let s = 1; s <= n; s++) {
      if (ipc.type === 'checkbox') {
        S(`INSERT INTO ipc_test_samples (quality_test_id,sample_number,test_round,result,created_at) VALUES (@qt,${s},1,'pass',NOW());`);
      } else {
        // tiny variation around nominal so it isn't flat
        const v = (val + ((s % 3) - 1) * (val * 0.002)).toFixed(4);
        S(`INSERT INTO ipc_test_samples (quality_test_id,sample_number,test_round,numeric_value,result,created_at) VALUES (@qt,${s},1,${v},'pass',NOW());`);
      }
    }
  });
}

fs.writeFileSync('scripts/_sop-ipc-results.sql', sql.join('\n') + '\n');
console.log(`Wrote SOP-linked IPC results SQL for ${Object.keys(groups).length} step-groups across ${woIds.length} WOs -> scripts/_sop-ipc-results.sql`);
