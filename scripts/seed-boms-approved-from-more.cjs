/**
 * Copy active + approved BOMs (+ full config) from herbal-erp-more into local.
 * BOM name gets "(more)", code gets "-MORE". All references are remapped to the
 * already-imported "(more)" master data, resolved by code:
 *   product/line item -> items.{code}-MORE
 *   room              -> production_rooms.{code}-MORE
 *   equipment         -> production_equipment.{code}-MORE
 *   sop templateId    -> sop_step_templates.{code}-MORE
 *   ipc criteriaId    -> ipc_criteria.{criteriaCode}   (IPC kept original codes)
 *   env conditionId   -> environmental_conditions.{code}-MORE
 *   env bomRoomId     -> the new bom_rooms row inserted for the same source room
 *
 * Reads scripts/_more/bom_<id>.json + bom_<id>_<cfg>.json + map_*.tsv.
 * Writes scripts/_boms-from-more.sql. Local max ids via env.
 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '_more');

const BOM_IDS = (process.env.BOM_IDS || '').split(',').map(Number).filter(Boolean);
let nextBom = Number(process.env.MAX_BOM);
let nextLine = Number(process.env.MAX_LINE);
let nextRoom = Number(process.env.MAX_ROOM);
let nextEquip = Number(process.env.MAX_EQUIP);
let nextSop = Number(process.env.MAX_SOP);
let nextIpc = Number(process.env.MAX_IPC);
let nextEnv = Number(process.env.MAX_ENV);

const esc = (v) => (v === null || v === undefined ? 'NULL'
  : "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'");
const num = (v) => (v === null || v === undefined || v === '' ? 'NULL' : Number(v));
const bool = (v) => (v ? 1 : 0);

function loadMap(file) {
  const m = {};
  fs.readFileSync(path.join(dir, file), 'utf8').split('\n').filter(Boolean).forEach((ln) => {
    const [code, id] = ln.split('\t'); m[code.trim()] = Number(id);
  });
  return m;
}
const mItem = loadMap('map_items.tsv');   // key: {code}-MORE
const mRoom = loadMap('map_rooms.tsv');
const mEquip = loadMap('map_equip.tsv');
const mSop = loadMap('map_sop.tsv');
const mEnv = loadMap('map_env.tsv');
const mIpc = loadMap('map_ipc.tsv');      // key: exact criteria code
const cfg = (bid, name) => { try { const x = require(path.join(dir, `bom_${bid}_${name}.json`)); return x.data?.items || x.data || x; } catch { return []; } };

const sql = ['SET NAMES utf8mb4;', 'SET FOREIGN_KEY_CHECKS=0;'];
const skipped = [];

// idempotent: drop prior (more) copies of these BOMs (+ child config) first
const codes = BOM_IDS.map((id) => esc(require(path.join(dir, `bom_${id}.json`)).data.code + '-MORE')).join(',');
sql.push(`SET @bids := (SELECT GROUP_CONCAT(id) FROM bom WHERE code IN (${codes}));`);
for (const t of ['bom_lines', 'bom_environmental_conditions', 'bom_in_process_qc', 'bom_sop_steps', 'bom_equipment', 'bom_rooms']) {
  sql.push(`DELETE FROM ${t} WHERE @bids IS NOT NULL AND FIND_IN_SET(bom_id, @bids);`);
}
sql.push(`DELETE FROM bom WHERE code IN (${codes});`);

for (const bid of BOM_IDS) {
  const b = require(path.join(dir, `bom_${bid}.json`)).data;
  const prod = mItem[`${b.productCode}-MORE`];
  if (!prod) { skipped.push(`BOM ${b.code}: product ${b.productCode} missing`); continue; }
  const newBom = ++nextBom;

  sql.push(`-- ===== ${b.code}-MORE (${b.status}) =====`);
  sql.push(`INSERT INTO bom (id,code,name,product_id,version,status,batch_size,batch_unit,yield_target,loss_allowance,theoretical_yield,fill_weight_mg,effective_date,created_at,updated_at)
    VALUES (${newBom}, ${esc(b.code + '-MORE')}, ${esc((b.name || '') + ' (more)')}, ${prod}, ${esc(b.version || '1.0')}, ${esc(b.status)},
      ${num(b.batchSize)}, ${esc(b.batchUnit)}, ${num(b.yieldTarget)}, ${num(b.lossAllowance)}, ${num(b.theoreticalYield)}, ${num(b.fillWeightMg)},
      ${b.effectiveDate ? esc(String(b.effectiveDate).slice(0, 10)) : 'NULL'}, NOW(), NOW());`);

  // lines
  (b.lines || []).forEach((l, i) => {
    const it = mItem[`${l.itemCode}-MORE`];
    if (!it) { skipped.push(`${b.code} line ${l.itemCode} missing`); return; }
    sql.push(`INSERT INTO bom_lines (id,bom_id,item_id,quantity,unit,sequence,is_optional,notes,percentage_in_formula,created_at)
      VALUES (${++nextLine}, ${newBom}, ${it}, ${num(l.quantity)}, ${esc(l.unit)}, ${num(l.sequence) || i + 1}, ${bool(l.isOptional)}, ${esc(l.notes)}, ${num(l.percentageInFormula)}, NOW());`);
  });

  // rooms (track sourceRoomId+phase -> new bom_room id for env linkage)
  const bomRoomKey = {}; // `${roomId}|${phase}` -> new bom_rooms id
  cfg(bid, 'rooms').forEach((r) => {
    const code = r.room?.code; const localRoom = code ? mRoom[`${code}-MORE`] : null;
    if (!localRoom) { skipped.push(`${b.code} room ${code} missing`); return; }
    const nid = ++nextRoom;
    bomRoomKey[`${r.roomId}|${r.phase}`] = nid;
    sql.push(`INSERT INTO bom_rooms (id,bom_id,room_id,phase,sequence,is_required,created_at)
      VALUES (${nid}, ${newBom}, ${localRoom}, ${esc(r.phase)}, ${num(r.sequence) || 1}, ${bool(r.isRequired)}, NOW());`);
  });

  // equipment
  cfg(bid, 'equipment').forEach((e) => {
    const code = e.equipment?.code; const localEq = code ? mEquip[`${code}-MORE`] : null;
    if (!localEq) { skipped.push(`${b.code} equip ${code} missing`); return; }
    sql.push(`INSERT INTO bom_equipment (id,bom_id,equipment_id,phase,sequence,is_required,created_at)
      VALUES (${++nextEquip}, ${newBom}, ${localEq}, ${esc(e.phase)}, ${num(e.sequence) || 1}, ${bool(e.isRequired)}, NOW());`);
  });

  // sop steps (templateId via template.code; phase, step names)
  cfg(bid, 'sop-steps').forEach((s, i) => {
    const tcode = s.template?.code; const localTpl = tcode ? mSop[`${tcode}-MORE`] : null;
    sql.push(`INSERT INTO bom_sop_steps (id,bom_id,template_id,sequence,step_name,step_name_th,instructions,instructions_th,parameters,requires_verification,is_critical,phase,created_at)
      VALUES (${++nextSop}, ${newBom}, ${localTpl || 'NULL'}, ${num(s.sequence) || i + 1}, ${esc(s.stepName)}, ${esc(s.stepNameTh)}, ${esc(s.instructions)}, ${esc(s.instructionsTh)}, ${esc(s.parameters)}, ${bool(s.requiresVerification)}, ${bool(s.isCritical)}, ${esc(s.phase || 'production')}, NOW());`);
  });

  // ipc (criteriaId via criteriaCode -> local ipc kept original code)
  cfg(bid, 'ipc').forEach((q, i) => {
    const localCrit = q.criteriaCode ? mIpc[q.criteriaCode] : null;
    if (!localCrit) { skipped.push(`${b.code} ipc ${q.criteriaCode} missing`); return; }
    sql.push(`INSERT INTO bom_in_process_qc (id,bom_id,criteria_id,sequence,sample_size,is_critical,phase,created_at)
      VALUES (${++nextIpc}, ${newBom}, ${localCrit}, ${num(q.sequence) || i + 1}, ${num(q.sampleSize) || 1}, ${bool(q.isCritical)}, ${esc(q.phase || 'production')}, NOW());`);
  });

  // environmental conditions (conditionId via code; bomRoomId via bomRoomKey)
  cfg(bid, 'environmental-conditions').forEach((c) => {
    const code = c.condition?.code; const localCond = code ? mEnv[`${code}-MORE`] : null;
    if (!localCond) { skipped.push(`${b.code} env ${code} missing`); return; }
    // resolve new bom_room id: source env row carries bomRoomId; match back via rooms cfg
    let newBomRoom = 'NULL';
    if (c.bomRoomId != null) {
      const srcRoom = cfg(bid, 'rooms').find((r) => r.id === c.bomRoomId);
      if (srcRoom) { const k = bomRoomKey[`${srcRoom.roomId}|${srcRoom.phase}`]; if (k) newBomRoom = k; }
    }
    sql.push(`INSERT INTO bom_environmental_conditions (id,bom_id,condition_id,bom_room_id,phase,created_at)
      VALUES (${++nextEnv}, ${newBom}, ${localCond}, ${newBomRoom}, ${esc(c.phase)}, NOW());`);
  });
}

sql.push('SET FOREIGN_KEY_CHECKS=1;');
fs.writeFileSync(path.join(__dirname, '_boms-from-more.sql'), sql.join('\n') + '\n');
console.log(`Wrote ${BOM_IDS.length} BOMs -> scripts/_boms-from-more.sql`);
if (skipped.length) console.log('SKIPPED:', skipped.join(' | '));
