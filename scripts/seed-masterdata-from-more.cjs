/**
 * Copy master-data from the herbal-erp-more tenant into local, appending
 * "(more)" to each name (and "-MORE" to codes to avoid UNIQUE collisions).
 * Inserts as brand-new rows with fresh ids above the local max per table, so
 * nothing existing is touched. Equipment.room_id is remapped to the new
 * room ids.
 *
 * Reads scripts/_more/<module>.json (API dumps). Writes scripts/_md-from-more.sql.
 * MAX ids are passed in via args (resolved from the DB by the shell wrapper).
 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '_more');

// local MAX(id) per table — filled by the wrapper through env.
const BASE = {
  rooms: Number(process.env.MAX_ROOMS || 0),
  equip: Number(process.env.MAX_EQUIP || 0),
  env: Number(process.env.MAX_ENV || 0),
  sop: Number(process.env.MAX_SOP || 0),
  pkg: Number(process.env.MAX_PKG || 0),
};

const esc = (v) => (v === null || v === undefined ? 'NULL'
  : "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'");
const num = (v) => (v === null || v === undefined || v === '' ? 'NULL' : Number(v));
const bool = (v) => (v ? 1 : 0);
const load = (m) => { const d = require(`${dir}/${m}.json`); return d.data?.items || d.data || d; };
// append (more) to a name; keep null as null
const moreName = (n) => (n == null ? null : `${n} (more)`);

const sql = ['SET NAMES utf8mb4;'];
sql.push("-- idempotent: clear prior '(more)' copies first");
sql.push("DELETE FROM production_equipment WHERE code LIKE '%-MORE';");
sql.push("DELETE FROM production_rooms WHERE code LIKE '%-MORE';");
sql.push("DELETE FROM environmental_conditions WHERE code LIKE '%-MORE';");
sql.push("DELETE FROM sop_step_templates WHERE code LIKE '%-MORE';");
sql.push("DELETE FROM packaging_qc_criteria WHERE code LIKE '%-MORE';");

// ---- production_rooms ---- (build oldRoomId -> newRoomId map for equipment)
const roomMap = {};
load('production-rooms').forEach((r, i) => {
  const nid = BASE.rooms + i + 1;
  roomMap[r.id] = nid;
  sql.push(`INSERT INTO production_rooms (id, code, name, name_th, room_type, description, is_active, created_at, updated_at)
    VALUES (${nid}, ${esc(r.code + '-MORE')}, ${esc(moreName(r.name))}, ${esc(moreName(r.nameTh))}, ${esc(r.roomType)}, ${esc(r.description)}, ${bool(r.isActive)}, NOW(), NOW());`);
});

// ---- production_equipment ---- (remap room_id via roomMap)
load('production-equipment').forEach((e, i) => {
  const nid = BASE.equip + i + 1;
  const newRoom = e.roomId != null && roomMap[e.roomId] != null ? roomMap[e.roomId] : 'NULL';
  sql.push(`INSERT INTO production_equipment (id, code, name, name_th, equipment_type, capacity, room_id, description, is_active, created_at, updated_at)
    VALUES (${nid}, ${esc(e.code + '-MORE')}, ${esc(moreName(e.name))}, ${esc(moreName(e.nameTh))}, ${esc(e.equipmentType)}, ${esc(e.capacity)}, ${newRoom}, ${esc(e.description)}, ${bool(e.isActive)}, NOW(), NOW());`);
});

// ---- environmental_conditions ---- (name only)
load('environmental-conditions').forEach((c, i) => {
  const nid = BASE.env + i + 1;
  sql.push(`INSERT INTO environmental_conditions (id, code, name, temperature_min, temperature_max, humidity_max, monitoring_interval_minutes, notes, is_active, created_at)
    VALUES (${nid}, ${esc(c.code + '-MORE')}, ${esc(moreName(c.name))}, ${num(c.temperatureMin)}, ${num(c.temperatureMax)}, ${num(c.humidityMax)}, ${num(c.monitoringIntervalMinutes)}, ${esc(c.notes)}, ${bool(c.isActive)}, NOW());`);
});

// ---- sop_step_templates ---- (name + nameTh)
load('sop-templates').forEach((s, i) => {
  const nid = BASE.sop + i + 1;
  sql.push(`INSERT INTO sop_step_templates (id, code, name, name_th, category, instructions, instructions_th, default_parameters, is_active, created_at)
    VALUES (${nid}, ${esc(s.code + '-MORE')}, ${esc(moreName(s.name))}, ${esc(moreName(s.nameTh))}, ${esc(s.category)}, ${esc(s.instructions)}, ${esc(s.instructionsTh)}, ${esc(s.defaultParameters)}, ${bool(s.isActive)}, NOW());`);
});

// ---- packaging_qc_criteria ---- (name only)
load('packaging-qc-criteria').forEach((p, i) => {
  const nid = BASE.pkg + i + 1;
  sql.push(`INSERT INTO packaging_qc_criteria (id, code, name, weight_min, weight_max, sample_size, max_failures, check_interval_minutes, units_per_pack, is_active, created_at)
    VALUES (${nid}, ${esc(p.code + '-MORE')}, ${esc(moreName(p.name))}, ${num(p.weightMin)}, ${num(p.weightMax)}, ${num(p.sampleSize)}, ${num(p.maxFailures)}, ${num(p.checkIntervalMinutes)}, ${num(p.unitsPerPack)}, ${bool(p.isActive)}, NOW());`);
});

sql.push("SELECT 'rooms' t, COUNT(*) n FROM production_rooms WHERE code LIKE '%-MORE' UNION ALL SELECT 'equip', COUNT(*) FROM production_equipment WHERE code LIKE '%-MORE' UNION ALL SELECT 'env', COUNT(*) FROM environmental_conditions WHERE code LIKE '%-MORE' UNION ALL SELECT 'sop', COUNT(*) FROM sop_step_templates WHERE code LIKE '%-MORE' UNION ALL SELECT 'pkg', COUNT(*) FROM packaging_qc_criteria WHERE code LIKE '%-MORE';");

fs.writeFileSync('scripts/_md-from-more.sql', sql.join('\n') + '\n');
console.log('Wrote master-data copy SQL -> scripts/_md-from-more.sql');
