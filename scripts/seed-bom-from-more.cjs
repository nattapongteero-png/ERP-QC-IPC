/**
 * Copy active BOM(s) + lines from the herbal-erp-more tenant into local.
 * - BOM name gets "(more)" suffix, code gets "-MORE".
 * - product_id and each line's item_id are resolved to the already-imported
 *   "(more)" item via its code ({moreCode}-MORE -> local item id).
 * - Fresh BOM/line ids above the local max. Config tables (rooms/equipment/
 *   sop/ipc/pkg-qc/env) are copied if present (this active BOM has none).
 *
 * Reads scripts/_more/bom12.json + scripts/_more/item_code_map.tsv.
 * Writes scripts/_bom-from-more.sql. Local max ids via env MAX_BOM, MAX_LINE.
 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '_more');

const MAX_BOM = Number(process.env.MAX_BOM || 0);
const MAX_LINE = Number(process.env.MAX_LINE || 0);

const esc = (v) => (v === null || v === undefined ? 'NULL'
  : "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'");
const num = (v) => (v === null || v === undefined || v === '' ? 'NULL' : Number(v));

// code (without -MORE) -> local item id
const codeMap = {};
fs.readFileSync(path.join(dir, 'item_code_map.tsv'), 'utf8').split('\n').filter(Boolean).forEach((ln) => {
  const [code, id] = ln.split('\t');
  codeMap[code.trim()] = Number(id);          // e.g. "RM-HRB-001-MORE" -> 61
});
const localItem = (moreCode) => codeMap[`${moreCode}-MORE`]; // resolve a more item code

const bom = require(path.join(dir, 'bom12.json')).data;
const newBomId = MAX_BOM + 1;
const prodLocal = localItem(bom.productCode);
if (!prodLocal) throw new Error(`product ${bom.productCode}-MORE not found in local items`);

const sql = ['SET NAMES utf8mb4;'];
sql.push("-- idempotent: drop prior (more) copy of this BOM + its lines");
sql.push(`DELETE FROM bom_lines WHERE bom_id IN (SELECT id FROM bom WHERE code='${bom.code}-MORE');`);
sql.push(`DELETE FROM bom WHERE code='${bom.code}-MORE';`);

sql.push(`INSERT INTO bom
  (id, code, name, product_id, version, status, batch_size, batch_unit, yield_target, loss_allowance,
   theoretical_yield, fill_weight_mg, effective_date, created_at, updated_at)
  VALUES
  (${newBomId}, ${esc(bom.code + '-MORE')}, ${esc((bom.name || '') + ' (more)')}, ${prodLocal},
   ${esc(bom.version || '1.0')}, 'active', ${num(bom.batchSize)}, ${esc(bom.batchUnit)},
   ${num(bom.yieldTarget)}, ${num(bom.lossAllowance)}, ${num(bom.theoreticalYield)}, ${num(bom.fillWeightMg)},
   ${bom.effectiveDate ? esc(String(bom.effectiveDate).slice(0, 10)) : 'NOW()'}, NOW(), NOW());`);

let li = 0, skipped = [];
(bom.lines || []).forEach((l) => {
  const itemLocal = localItem(l.itemCode);
  if (!itemLocal) { skipped.push(l.itemCode); return; }
  const lid = MAX_LINE + (++li);
  sql.push(`INSERT INTO bom_lines
    (id, bom_id, item_id, quantity, unit, sequence, is_optional, notes, percentage_in_formula, created_at)
    VALUES
    (${lid}, ${newBomId}, ${itemLocal}, ${num(l.quantity)}, ${esc(l.unit)}, ${num(l.sequence) || li},
     ${l.isOptional ? 1 : 0}, ${esc(l.notes)}, ${num(l.percentageInFormula)}, NOW());`);
});

sql.push(`SELECT b.id, b.code, b.name, b.status, (SELECT COUNT(*) FROM bom_lines l WHERE l.bom_id=b.id) lines FROM bom b WHERE b.code='${bom.code}-MORE';`);
fs.writeFileSync(path.join(__dirname, '_bom-from-more.sql'), sql.join('\n') + '\n');
console.log(`Wrote BOM ${bom.code}-MORE + ${li} lines${skipped.length ? ` (skipped lines: ${skipped.join(',')})` : ''} -> scripts/_bom-from-more.sql`);
