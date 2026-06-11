/**
 * Replicate IPC criteria copied from the herbal-erp-more tenant into local.
 * Reads scripts/_more_ipc.json (the API dump) and emits an INSERT that
 * reproduces all 10 records faithfully — preserving ids (25..34, no conflict
 * with local 1..16), the JSON `specification` envelope, criteriaType variants
 * (visual/numeric/multi_point/tare/custom_multi_field), and tare references.
 *
 * Writes scripts/_ipc-from-more.sql.
 */
const fs = require('fs');
const rows = (require('./_more_ipc.json').data) || [];

const esc = (v) => {
  if (v === null || v === undefined) return 'NULL';
  return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
};
const num = (v) => (v === null || v === undefined || v === '' ? 'NULL' : Number(v));
const bool = (v) => (v ? 1 : 0);

const sql = ['SET NAMES utf8mb4;'];
// Remove any prior copy of these codes first (idempotent re-run).
const codes = rows.map((r) => esc(r.code)).join(',');
sql.push(`DELETE FROM ipc_criteria WHERE code IN (${codes});`);

for (const r of rows) {
  sql.push(
    `INSERT INTO ipc_criteria
      (id, code, name, name_th, test_method, specification, min_value, max_value, unit,
       sample_size, check_interval_minutes, is_critical, is_active, dosage_form, criteria_type,
       tolerance_percent, spec_target, spec_tolerance_percent, acceptance_stages, max_retest_rounds,
       tare_source_criteria_id, created_at)
     VALUES
      (${r.id}, ${esc(r.code)}, ${esc(r.name)}, ${esc(r.nameTh)}, ${esc(r.testMethod)}, ${esc(r.specification)},
       ${num(r.minValue)}, ${num(r.maxValue)}, ${esc(r.unit)}, ${num(r.sampleSize)},
       ${num(r.checkIntervalMinutes)}, ${bool(r.isCritical)}, ${bool(r.isActive)}, ${esc(r.dosageForm)}, ${esc(r.criteriaType)},
       ${num(r.tolerancePercent)}, ${num(r.specTarget)}, ${num(r.specTolerancePercent)},
       ${esc(r.acceptanceStages)}, ${num(r.maxRetestRounds)}, ${num(r.tareSourceCriteriaId)}, NOW());`
  );
}

sql.push('SELECT id, code, criteria_type, name_th FROM ipc_criteria WHERE id BETWEEN 25 AND 34 ORDER BY id;');
fs.writeFileSync('scripts/_ipc-from-more.sql', sql.join('\n') + '\n');
console.log(`Wrote ${rows.length} IPC records -> scripts/_ipc-from-more.sql`);
