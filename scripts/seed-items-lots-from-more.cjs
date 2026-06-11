/**
 * Copy items + inventory lots from the herbal-erp-more tenant into local.
 * - items: name (name_th / name_en) gets "(more)" suffix, code gets "-MORE",
 *   inserted with fresh ids above the local max. on_hand/quarantine reset is
 *   left as-is from source.
 * - lots: re-pointed to the new item ids; warehouse_id remapped to a valid
 *   local warehouse (more wh 3/7 -> 1, 4 -> 3); fresh ids above the local max.
 *
 * Reads scripts/_more/items.json + lots.json. Writes scripts/_il-from-more.sql.
 * Local MAX ids passed via env: MAX_ITEM, MAX_LOT.
 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '_more');

const MAX_ITEM = Number(process.env.MAX_ITEM || 0);
const MAX_LOT = Number(process.env.MAX_LOT || 0);

const esc = (v) => (v === null || v === undefined ? 'NULL'
  : "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'");
const num = (v) => (v === null || v === undefined || v === '' ? 'NULL' : Number(v));
const bool = (v) => (v ? 1 : 0);
const dt = (v) => (v ? `'${String(v).replace('T', ' ').replace(/\..*$|Z$/, '')}'` : 'NULL');
const moreName = (n) => (n == null ? null : `${n} (more)`);

// more warehouse id -> valid local warehouse id (local has only 1..4)
const WH = { 1: 1, 2: 2, 3: 1, 4: 3, 7: 1 };
const mapWh = (w) => (WH[w] != null ? WH[w] : 1);

const items = (require(path.join(dir, 'items.json')).data?.items) || require(path.join(dir, 'items.json')).data || [];
const lots = (require(path.join(dir, 'lots.json')).data?.items) || require(path.join(dir, 'lots.json')).data || [];

const sql = ['SET NAMES utf8mb4;', 'SET FOREIGN_KEY_CHECKS=0;'];
sql.push("-- idempotent: clear prior '(more)' items + their lots");
sql.push("DELETE FROM inventory_lots WHERE lot_number LIKE 'MORE-%';");
sql.push("DELETE FROM items WHERE code LIKE '%-MORE';");

// ---- items (fresh ids; build oldItemId -> newItemId map for lots) ----
const itemMap = {};
items.forEach((it, i) => {
  const nid = MAX_ITEM + i + 1;
  itemMap[it.id] = nid;
  sql.push(`INSERT INTO items
    (id, code, name_th, name_en, type, category, primary_unit, secondary_unit, conversion_rate,
     weight_unit, secondary_to_weight_rate, weight_tracking_enabled, shelf_life_days, storage_condition,
     min_stock, max_stock, reorder_point, on_hand, on_hand_cost, quarantine_qty, is_lot_controlled,
     is_fefo, is_active, strength, current_wac, last_purchase_cost, standard_cost, created_at, updated_at)
    VALUES
    (${nid}, ${esc(it.code + '-MORE')}, ${esc(moreName(it.nameTh))}, ${esc(moreName(it.nameEn))},
     ${esc(it.type)}, ${esc(it.category)}, ${esc(it.primaryUnit)}, ${esc(it.secondaryUnit)}, ${num(it.conversionRate)},
     ${esc(it.weightUnit)}, ${num(it.secondaryToWeightRate)}, ${bool(it.weightTrackingEnabled)}, ${num(it.shelfLifeDays)}, ${esc(it.storageCondition)},
     ${num(it.minStock)}, ${num(it.maxStock)}, ${num(it.reorderPoint)}, ${num(it.onHand)}, ${num(it.onHandCost)}, ${num(it.quarantineQty)}, ${bool(it.isLotControlled)},
     ${bool(it.isFEFO)}, ${bool(it.isActive)}, ${esc(it.strength)}, ${num(it.currentWAC)}, ${num(it.lastPurchaseCost)}, ${num(it.standardCost)}, NOW(), NOW());`);
});

// ---- lots (re-point item_id via itemMap; remap warehouse) ----
let lotSkipped = 0;
lots.forEach((l, i) => {
  const newItem = itemMap[l.itemId];
  if (newItem == null) { lotSkipped++; return; } // lot of an item we didn't import
  const nid = MAX_LOT + i + 1;
  sql.push(`INSERT INTO inventory_lots
    (id, item_id, lot_number, batch_number, warehouse_id, quantity, reserved_quantity, unit, status,
     manufacturing_date, expiry_date, received_date, vendor_lot_number, cost,
     manufacturer_name, importer_name, country_of_origin, retest_date, retest_status, created_at, updated_at)
    VALUES
    (${nid}, ${newItem}, ${esc('MORE-' + (l.lotNumber || ('L' + l.id)))}, ${esc(l.batchNumber)}, ${mapWh(l.warehouseId)},
     ${num(l.quantity)}, ${num(l.reservedQuantity)}, ${esc(l.unit)}, ${esc(l.status)},
     ${dt(l.manufacturingDate)}, ${dt(l.expiryDate)}, ${dt(l.receivedDate)}, ${esc(l.vendorLotNumber)}, ${num(l.cost)},
     ${esc(l.manufacturerName)}, ${esc(l.importerName)}, ${esc(l.countryOfOrigin)}, ${dt(l.retestDate)}, ${esc(l.retestStatus)}, NOW(), NOW());`);
});

sql.push('SET FOREIGN_KEY_CHECKS=1;');
sql.push("SELECT 'items(more)' t, COUNT(*) n FROM items WHERE code LIKE '%-MORE' UNION ALL SELECT 'lots(more)', COUNT(*) FROM inventory_lots WHERE lot_number LIKE 'MORE-%';");

fs.writeFileSync(path.join(__dirname, '_il-from-more.sql'), sql.join('\n') + '\n');
console.log(`Wrote ${items.length} items + ${lots.length - lotSkipped} lots (${lotSkipped} lots skipped: item not imported) -> scripts/_il-from-more.sql`);
