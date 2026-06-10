/**
 * Generate coherent, phase-by-phase execution progress for the seeded WOs so
 * status matches what is actually recorded — no phase skipping, and every
 * reached phase has its Line Clearance + Cleaning recorded first.
 *
 * Phase order: pre_production -> production -> post_production -> packaging -> inspection
 * Rule per "fully completed" phase:
 *   1. line_clearance_checklists (status='verified')
 *   2. wo_cleaning_logs for that phase's BOM rooms+equipment (clean + verified)
 *   3. that phase's SOP steps  -> completed + verified
 *   4. that phase's IPC tests  -> passed (+ approved)
 *   5. one environmental log for the phase
 *   + pre_production also: material weighing (weighed + verified)
 *   + production also: production output (bulk + finished qty)
 *   + packaging also: packaging weight + integrity logs
 *   + inspection: wo_finished_inspection (passed)
 * The CURRENT phase of an in_progress WO gets LC + cleaning done but its
 * SOP/IPC left partial (first step/test only) so the operator continues there.
 *
 * Per-WO target = how far it has progressed. completed WOs do every phase fully.
 *
 * Writes scripts/_wo-phase.sql (applied by the wrapper).
 */
const fs = require('fs');

const OP = 2, VER = 3;             // operator=production@, verifier=qc@
const PHASES = ['pre_production', 'production', 'post_production', 'packaging', 'inspection'];

// Per-WO progress target. "upto" = last phase that is recorded at all; phases
// before it are FULLY done, the "upto" phase is the CURRENT phase (partial for
// in_progress, full for completed). Distribute so the user sees varied progress.
const TARGETS = {
  14: { upto: 'packaging',      full: false }, // capsule turmeric — at packaging
  15: { upto: 'packaging',      full: false }, // capsule andro — at packaging
  16: { upto: 'production',     full: false }, // capsule krachai — at production
  17: { upto: 'production',     full: false }, // tablet — at production
  18: { upto: 'post_production',full: false }, // powder ginger — at post (no post rooms -> skip cleaning there)
  20: { upto: 'post_production',full: false }, // syrup — at post
  22: { upto: 'pre_production', full: false }, // balm — just started (pre-prod)
  24: { upto: 'pre_production', full: false }, // oil — just started
  26: { upto: 'inspection',     full: true  }, // compress — COMPLETED, everything done
};

const sql = ['SET NAMES utf8mb4;'];
const S = (x) => sql.push(x);

// Phase index helper
const idx = (p) => PHASES.indexOf(p);

function lineClearance(wo, phase) {
  S(`INSERT INTO line_clearance_checklists
      (work_order_id,phase,previous_product_cleared,area_clean,equipment_clean,no_contamination_risk,labels_removed,docs_ready,
       performed_by,performed_at,verified_by,verified_at,status,notes)
     VALUES (${wo},'${phase}',1,1,1,1,1,1,${OP},NOW(),${VER},NOW(),'verified','ตัวอย่าง seed: ${phase}');`);
}
function sopPhaseFull(wo, phase) {
  S(`UPDATE wo_sop_execution e
     JOIN bom_sop_steps s ON s.id=e.bom_step_id
     SET e.is_completed=1, e.status='verified', e.operator_id=${OP}, e.started_at=NOW(), e.completed_at=NOW(),
         e.verifier_id=${VER}, e.verified_at=NOW(), e.line_clearance_confirmed=1, e.line_clearance_by=${VER}, e.line_clearance_at=NOW(),
         e.pm_approved_by=CASE WHEN s.is_critical=1 THEN ${VER} ELSE e.pm_approved_by END,
         e.pm_approved_at=CASE WHEN s.is_critical=1 THEN NOW() ELSE e.pm_approved_at END
     WHERE e.work_order_id=${wo} AND s.phase='${phase}';`);
}
function sopPhasePartial(wo, phase) {
  // Complete only the first step of this phase; rest stay pending.
  S(`UPDATE wo_sop_execution e
     JOIN bom_sop_steps s ON s.id=e.bom_step_id
     SET e.is_completed=1, e.status='verified', e.operator_id=${OP}, e.started_at=NOW(), e.completed_at=NOW(),
         e.verifier_id=${VER}, e.verified_at=NOW(), e.line_clearance_confirmed=1, e.line_clearance_by=${VER}, e.line_clearance_at=NOW()
     WHERE e.work_order_id=${wo} AND s.phase='${phase}'
       AND e.sequence=(SELECT MIN(e2.sequence) FROM (SELECT e3.sequence FROM wo_sop_execution e3 JOIN bom_sop_steps s3 ON s3.id=e3.bom_step_id WHERE e3.work_order_id=${wo} AND s3.phase='${phase}') e2);`);
}
// IPC pass status is literally 'pass' / result 'pass' (matches the recording
// service + the dashboard's isCompleted predicate). 'passed' would NOT count.
function ipcPhaseFull(wo, phase) {
  S(`UPDATE quality_tests q
     SET q.status='pass', q.result='pass', q.numeric_result=COALESCE(q.spec_target,q.spec_min_value,0),
         q.tested_by=${OP}, q.test_date=NOW(), q.approved_by=${VER}, q.approved_at=NOW(), q.notes='ตัวอย่าง seed'
     WHERE q.test_type IN ('IPC','ipc','in_process') AND q.ipc_phase='${phase}'
       AND q.lot_id IN (SELECT id FROM inventory_lots WHERE lot_number=CONCAT((SELECT batch_number FROM work_orders WHERE id=${wo}),'-IP'));`);
}
function ipcPhasePartial(wo, phase) {
  S(`UPDATE quality_tests q
     SET q.status='pass', q.result='pass', q.numeric_result=COALESCE(q.spec_target,q.spec_min_value,0),
         q.tested_by=${OP}, q.test_date=NOW(), q.notes='ตัวอย่าง seed'
     WHERE q.id=(SELECT id FROM (SELECT q2.id FROM quality_tests q2 WHERE q2.test_type IN ('IPC','ipc','in_process') AND q2.ipc_phase='${phase}'
         AND q2.lot_id IN (SELECT id FROM inventory_lots WHERE lot_number=CONCAT((SELECT batch_number FROM work_orders WHERE id=${wo}),'-IP'))
         ORDER BY q2.id LIMIT 1) t);`);
}
function materialWeighing(wo) {
  S(`UPDATE work_order_materials SET weighed_qty=planned_quantity, weighed_by=${OP}, weighed_at=NOW(),
       verified_by=${VER}, verified_at=NOW(), status='weighed' WHERE work_order_id=${wo};`);
}
function productionOutput(wo) {
  S(`UPDATE work_orders SET bulk_output_qty=planned_quantity, bulk_output_recorded_at=NOW(), bulk_output_recorded_by=${OP},
       finished_output_qty=planned_quantity, finished_output_recorded_at=NOW(), finished_output_recorded_by=${OP}
     WHERE id=${wo};`);
}
function packagingChecks(wo) {
  S(`INSERT INTO wo_packaging_weight_logs (work_order_id,bom_qc_id,check_time,sample_weights,failed_count,is_pass,operator_id,notes)
     VALUES (${wo},NULL,DATE_FORMAT(NOW(),'%H:%i'),'[10.1,10.0,9.9,10.2,10.0]',0,1,${OP},'ตัวอย่าง seed');`);
  S(`INSERT INTO wo_packaging_integrity_logs (work_order_id,check_time,tube_cap_complete,lot_number_correct,packing_correct,operator_id,inspector_id,notes)
     VALUES (${wo},DATE_FORMAT(NOW(),'%H:%i'),1,1,1,${OP},${VER},'ตัวอย่าง seed');`);
}
function finishedInspection(wo, passed) {
  const checklist = JSON.stringify([
    { item: 'ลักษณะภายนอก', result: 'pass' },
    { item: 'ความถูกต้องของฉลาก', result: 'pass' },
    { item: 'จำนวนบรรจุ', result: 'pass' },
  ]).replace(/'/g, "''");
  S(`INSERT INTO wo_finished_inspection (work_order_id,sample_date,sampler_id,sample_qty_for_test,sample_qty_for_retention,checklist_results,inspector_id,inspected_at,status,notes)
     VALUES (${wo},DATE_FORMAT(NOW(),'%Y-%m-%d'),${OP},50,3,'${checklist}',${VER},NOW(),'${passed ? 'passed' : 'pending'}','ตัวอย่าง seed');`);
}

// Cleaning + environmental use a JOIN to work_orders for bomId (no session var).
function cleaningJ(wo, phase) {
  S(`INSERT INTO wo_cleaning_logs (work_order_id,phase,item_type,room_id,equipment_id,is_clean,operator_id,performed_at,verifier_id,verified_at,verify_result,notes)
     SELECT ${wo},'${phase}','room',r.room_id,NULL,1,${OP},NOW(),${VER},NOW(),'pass','ตัวอย่าง seed'
     FROM bom_rooms r JOIN work_orders w ON w.bom_id=r.bom_id WHERE w.id=${wo} AND r.phase='${phase}';`);
  S(`INSERT INTO wo_cleaning_logs (work_order_id,phase,item_type,room_id,equipment_id,is_clean,operator_id,performed_at,verifier_id,verified_at,verify_result,notes)
     SELECT ${wo},'${phase}','equipment',NULL,e.equipment_id,1,${OP},NOW(),${VER},NOW(),'pass','ตัวอย่าง seed'
     FROM bom_equipment e JOIN work_orders w ON w.bom_id=e.bom_id WHERE w.id=${wo} AND e.phase='${phase}';`);
}
function envLogJ(wo, phase) {
  S(`INSERT INTO wo_environmental_logs (work_order_id,bom_condition_id,room_id,phase,recorded_date,recorded_time,temperature,humidity,is_normal,operator_id,notes)
     SELECT ${wo},NULL,r.room_id,'${phase}',DATE_FORMAT(NOW(),'%Y-%m-%d'),DATE_FORMAT(NOW(),'%H:%i'),23.5,55.0,1,${OP},'ตัวอย่าง seed'
     FROM bom_rooms r JOIN work_orders w ON w.bom_id=r.bom_id WHERE w.id=${wo} AND r.phase='${phase}' LIMIT 1;`);
}

for (const [woStr, tgt] of Object.entries(TARGETS)) {
  const wo = Number(woStr);
  const uptoIdx = idx(tgt.upto);
  S(`-- ===== WO ${wo}: up to '${tgt.upto}'${tgt.full ? ' (COMPLETE)' : ''} =====`);

  for (let pi = 0; pi <= uptoIdx; pi++) {
    const phase = PHASES[pi];
    const isCurrent = pi === uptoIdx && !tgt.full;

    if (phase === 'inspection') {
      finishedInspection(wo, true);
      continue;
    }

    // 1. Line clearance for the phase (always, before cleaning)
    lineClearance(wo, phase);
    // 2. Cleaning for the phase (rooms+equipment that exist for it)
    cleaningJ(wo, phase);
    // 5. Environmental log for the phase
    envLogJ(wo, phase);

    // pre_production extra: material weighing
    if (phase === 'pre_production') materialWeighing(wo);

    // 3/4. SOP + IPC for the phase — full unless this is the current partial phase
    if (isCurrent) {
      sopPhasePartial(wo, phase);
      ipcPhasePartial(wo, phase);
    } else {
      sopPhaseFull(wo, phase);
      ipcPhaseFull(wo, phase);
      if (phase === 'production') productionOutput(wo);
      if (phase === 'packaging') packagingChecks(wo);
    }
  }
}

fs.writeFileSync('scripts/_wo-phase.sql', sql.join('\n') + '\n');
console.log(`Wrote phase-progress SQL for ${Object.keys(TARGETS).length} WOs -> scripts/_wo-phase.sql`);
