/**
 * Seed Work Orders (UAT Local) — one per active dosage-form BOM (14), spread
 * across the full lifecycle, with in_progress WOs fully recordable at every
 * phase (sample data pre-filled but still editable in the Execution Dashboard).
 *
 * Flow per WO:
 *   1. POST /api/production/work-orders            (create + materials from BOM)
 *   2. (advance) POST .../requisition {action:approve}   — release gate
 *   3. (advance) SQL: pre-prod cleaning logs (clean+verified) + material
 *                weighing (weighed+verified)                — start gate
 *   4. PUT .../status planned->released->in_progress (gated API)
 *   5. POST .../sync-bom  (materialize SOP + IPC execution rows from BOM)
 *   6. SQL: sample phase data (some SOP steps done, some IPC recorded, an
 *           environmental log, a packaging weight log) — leaving the rest
 *           pending so the user can record them.
 *   7. completed/closed/cancelled set directly where chosen.
 *
 * The gated transitions go through the real API (business rules + audit run);
 * bulk sample fills are emitted as SQL applied by the shell wrapper, because
 * the alternative is dozens of brittle per-row API calls.
 *
 * Run: node scripts/seed-work-orders-uat.cjs   (writes scripts/_wo-fill.sql)
 */
const fs = require('fs');

const BASE = process.env.BASE || 'http://localhost:6809';
const EMAIL = process.env.EMAIL || 'admin@herbal-erp.com';
const PASSWORD = process.env.PASSWORD || 'admin123';
const OPERATOR = 2;   // production@
const VERIFIER = 3;   // qc@

// One WO per active dosage-form BOM. status = target lifecycle state.
// bomId & productId & unit must match the rebuilt active BOMs.
const PLAN = [
  { bomId: 1,  productId: 9,  unit: 'bottle', qty: 1000, status: 'in_progress', form: 'แคปซูลขมิ้นชัน' },
  { bomId: 2,  productId: 10, unit: 'bottle', qty: 1000, status: 'in_progress', form: 'แคปซูลฟ้าทะลายโจร' },
  { bomId: 3,  productId: 11, unit: 'bottle', qty: 900,  status: 'in_progress', form: 'แคปซูลกระชายขาว' },
  { bomId: 4,  productId: 50, unit: 'bottle', qty: 1000, status: 'in_progress', form: 'ยาเม็ดบอระเพ็ด' },
  { bomId: 5,  productId: 51, unit: 'box',    qty: 2000, status: 'in_progress', form: 'ผงขิงชง' },
  { bomId: 6,  productId: 52, unit: 'box',    qty: 2000, status: 'released',    form: 'ชาชงรางจืด' },
  { bomId: 7,  productId: 53, unit: 'bottle', qty: 1000, status: 'in_progress', form: 'ยาน้ำมะขามป้อม' },
  { bomId: 8,  productId: 54, unit: 'bottle', qty: 500,  status: 'released',    form: 'ลูกกลอน' },
  { bomId: 9,  productId: 55, unit: 'pcs',    qty: 2000, status: 'in_progress', form: 'ยาหม่อง' },
  { bomId: 10, productId: 56, unit: 'pcs',    qty: 1500, status: 'planned',     form: 'ครีมว่านหางจระเข้' },
  { bomId: 11, productId: 57, unit: 'bottle', qty: 1000, status: 'in_progress', form: 'น้ำมันนวด' },
  { bomId: 12, productId: 58, unit: 'pcs',    qty: 3000, status: 'planned',     form: 'ยาดม' },
  { bomId: 13, productId: 59, unit: 'pcs',    qty: 500,  status: 'completed',   form: 'ลูกประคบ' },
  { bomId: 14, productId: 60, unit: 'box',    qty: 1000, status: 'cancelled',   form: 'ยาอมมะแว้ง' },
];

let COOKIE = '';
async function api(path, opts = {}) {
  const headers = Object.assign({}, opts.headers || {});
  if (COOKIE) headers['Cookie'] = COOKIE;
  const res = await fetch(BASE + path, { ...opts, headers });
  const sc = res.headers.get('set-cookie');
  if (sc) COOKIE = sc.split(',').map((c) => c.split(';')[0]).join('; ');
  const txt = await res.text();
  let body; try { body = JSON.parse(txt); } catch { body = txt; }
  return { status: res.status, body };
}
async function login() {
  const r = await api('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!r.body?.success) throw new Error('login failed: ' + JSON.stringify(r.body));
}

// Order of lifecycle for transition stepping
const RANK = { planned: 0, released: 1, in_progress: 2, completed: 3, closed: 4 };

const sql = ['SET NAMES utf8mb4;'];
// Records SQL helpers — woId resolved after creation.
function fillGatePrereqs(woId, bomId) {
  // Pre-production cleaning logs for each pre_production room+equipment, clean+verified.
  sql.push(
    `INSERT INTO wo_cleaning_logs (work_order_id,phase,item_type,room_id,equipment_id,is_clean,operator_id,performed_at,verifier_id,verified_at,verify_result,notes)
     SELECT ${woId},'pre_production','room',r.room_id,NULL,1,${OPERATOR},NOW(),${VERIFIER},NOW(),'pass','ตัวอย่าง seed'
     FROM bom_rooms r WHERE r.bom_id=${bomId} AND r.phase='pre_production';`);
  sql.push(
    `INSERT INTO wo_cleaning_logs (work_order_id,phase,item_type,room_id,equipment_id,is_clean,operator_id,performed_at,verifier_id,verified_at,verify_result,notes)
     SELECT ${woId},'pre_production','equipment',NULL,e.equipment_id,1,${OPERATOR},NOW(),${VERIFIER},NOW(),'pass','ตัวอย่าง seed'
     FROM bom_equipment e WHERE e.bom_id=${bomId} AND e.phase='pre_production';`);
  // Material weighing: weighed + verified for every WO material.
  sql.push(
    `UPDATE work_order_materials SET weighed_qty=planned_quantity, weighed_by=${OPERATOR}, weighed_at=NOW(),
       verified_by=${VERIFIER}, verified_at=NOW(), status='weighed'
     WHERE work_order_id=${woId};`);
}
function fillSamplePhaseData(woId, bomId) {
  // Mark ~half the SOP steps completed+verified (lowest sequences) — leaves the
  // rest pending so the operator can record them.
  sql.push(
    `UPDATE wo_sop_execution SET is_completed=1, status='verified', operator_id=${OPERATOR},
       started_at=NOW(), completed_at=NOW(), verifier_id=${VERIFIER}, verified_at=NOW()
     WHERE work_order_id=${woId}
       AND sequence <= (SELECT FLOOR(MAX(s2.sequence)/2) FROM (SELECT sequence FROM wo_sop_execution WHERE work_order_id=${woId}) s2);`);
  // Record IPC result on the first IPC criterion (status passed) — rest pending.
  sql.push(
    `UPDATE quality_tests SET status='passed', result='ผ่านเกณฑ์ (ตัวอย่าง seed)', numeric_result=spec_target,
       tested_by=${OPERATOR}, test_date=NOW()
     WHERE id = (SELECT id FROM (SELECT id FROM quality_tests WHERE lot_id IN
                 (SELECT id FROM inventory_lots WHERE lot_number LIKE CONCAT('%',
                   (SELECT batch_number FROM work_orders WHERE id=${woId}),'%'))
                 ORDER BY id LIMIT 1) t);`);
  // One environmental log for the production phase.
  sql.push(
    `INSERT INTO wo_environmental_logs (work_order_id,bom_condition_id,room_id,phase,recorded_date,recorded_time,temperature,humidity,is_normal,operator_id,notes)
     SELECT ${woId},NULL,(SELECT room_id FROM bom_rooms WHERE bom_id=${bomId} AND phase='production' LIMIT 1),
            'production',DATE_FORMAT(NOW(),'%Y-%m-%d'),DATE_FORMAT(NOW(),'%H:%i'),23.5,55.0,1,${OPERATOR},'ตัวอย่าง seed';`);
}

(async () => {
  await login();
  console.log('✓ logged in');

  const created = [];
  for (let i = 0; i < PLAN.length; i++) {
    const p = PLAN[i];
    const batchNumber = `B26${String(p.bomId).padStart(2, '0')}${String(i + 1).padStart(2, '0')}`;
    const r = await api('/api/production/work-orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bomId: p.bomId, productId: p.productId, batchNumber,
        plannedQuantity: p.qty, unit: p.unit,
        assignees: [
          { employeeId: OPERATOR, role: 'operator' },
          { employeeId: VERIFIER, role: 'qa_verifier' },
        ],
      }),
    });
    if (!r.body?.success) { console.error(`✗ create ${p.form}:`, JSON.stringify(r.body)); continue; }
    const woId = r.body.data.id;
    created.push({ ...p, woId, batchNumber, woNumber: r.body.data.woNumber });
    console.log(`✓ ${r.body.data.woNumber}  ${p.form}  (target ${p.status})  materials=${r.body.data.materialsCreated}`);
  }

  // Advance each WO toward its target status.
  for (const w of created) {
    const targetRank = w.status === 'cancelled' ? -1 : RANK[w.status];

    // planned -> released needs requisition approved (real API + audit)
    if (targetRank >= RANK.released) {
      const reqr = await api(`/api/production/work-orders/${w.woId}/requisition`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (!reqr.body?.success) console.warn(`  ${w.woNumber}: requisition approve -> ${JSON.stringify(reqr.body?.error || reqr.body)}`);
      else console.log(`  ${w.woNumber}: requisition approved`);
    }

    // Materialize SOP + IPC execution rows from the BOM (real API). Works at any
    // status — only needs the WO's bomId. This auto-creates the in-process lot
    // and the IPC quality_tests rows the dashboard records against.
    if (targetRank >= RANK.in_progress) {
      const syncr = await api(`/api/production/work-orders/${w.woId}/sync-bom`, { method: 'POST' });
      const d = syncr.body?.data;
      console.log(`  ${w.woNumber}: sync-bom sop=${d?.sopInserted ?? '?'} ipc=${d?.ipcInserted ?? '?'}`);
      fillGatePrereqs(w.woId, w.bomId);   // cleaning + weighing (gate prereqs)
    }
  }

  // Emit status transitions (SQL) + sample phase data for in_progress WOs.
  for (const w of created) {
    if (w.status === 'cancelled') {
      sql.push(`UPDATE work_orders SET status='cancelled', notes='ยกเลิกตัวอย่าง seed' WHERE id=${w.woId};`);
      continue;
    }
    if (RANK[w.status] >= RANK.released) {
      sql.push(`UPDATE work_orders SET status='released' WHERE id=${w.woId} AND status='planned';`);
    }
    if (RANK[w.status] >= RANK.in_progress) {
      sql.push(`UPDATE work_orders SET status='in_progress', actual_start_date=NOW() WHERE id=${w.woId};`);
      fillSamplePhaseData(w.woId, w.bomId);
    }
    if (RANK[w.status] >= RANK.completed) {
      sql.push(`UPDATE work_orders SET status='${w.status}', actual_end_date=NOW(), actual_quantity=planned_quantity, completed_by=${OPERATOR}, completed_at=NOW() WHERE id=${w.woId};`);
    }
  }

  fs.writeFileSync('scripts/_wo-fill.sql', sql.join('\n') + '\n');
  fs.writeFileSync('scripts/_wo-created.json', JSON.stringify(created, null, 2));
  console.log(`\nWrote gate/status SQL -> scripts/_wo-fill.sql (${created.length} WOs)`);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
