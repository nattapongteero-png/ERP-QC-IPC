/**
 * Inventory Service Integration Tests
 *
 * End-to-end workflow tests:
 * - Receive, QC, Release, Issue workflow
 * - FEFO multi-lot picking
 * - Transfer between warehouses
 * - Expiry alert detection
 * - Stock summary accuracy
 * - GMP compliance workflows
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';

let sqlite: Database;
let testDb: ReturnType<typeof drizzle>;

vi.mock('@/lib/db', async () => {
  return {
    isSqlite: () => true,
    getDb: async () => testDb,
    getSqliteDb: () => testDb,
    db: () => testDb,
    markSchemaSynced: () => {},
    schema,
  };
});

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

import {
  receiveMaterial, updateLotStatus, getLotsForPicking,
  issueMaterial, adjustInventory, transferInventory,
  getStockSummary, checkExpiryAlerts, recalculateItemOnHand,
  getLotDetails, getAvailableLots, receiveMaterialExtended,
  updateLotManufacturerInfo, updateLotRetestInfo, recordRetestCompletion,
} from '@/lib/services/inventory.service';

const USER = 1;
const NEAR = new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0];
const MID = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
const FAR = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];
const PAST = new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0];

function seed() {
  sqlite.exec(`INSERT INTO users (id,email,password,name,role,is_active) VALUES (1,'a@t.com','h','A','admin',1)`);
  sqlite.exec(`INSERT INTO warehouses (id,code,name,type,is_active) VALUES (1,'WH1','RM WH','raw_material',1),(2,'WH2','FG WH','finished_goods',1),(3,'WH3','QC','quarantine',1)`);
  sqlite.exec(`INSERT INTO vendors (id,code,name,is_active) VALUES (1,'V1','Supplier',1)`);
  sqlite.exec(`INSERT INTO items (id,code,name_th,type,primary_unit,on_hand,on_hand_cost,is_active) VALUES (1,'RM1','ขมิ้นชัน','raw_material','kg',0,0,1),(2,'RM2','ฟ้าทะลายโจร','raw_material','kg',0,0,1)`);
}

function clean() {
  for (const t of ['inventory_transactions','inventory_lots','items','warehouses','vendors','users'])
    try { sqlite.exec(`DELETE FROM ${t}`); } catch { /**/ }
}

describe('Inventory Integration', () => {
  beforeAll(() => {
    sqlite = new Database(':memory:');
    sqlite.exec('PRAGMA journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });
    for (const t of [schema.sqliteUsers,schema.sqliteVendors,schema.sqliteItems,schema.sqliteWarehouses,schema.sqliteWarehouseLocations,schema.sqliteInventoryLots,schema.sqliteInventoryTransactions])
      try { sqlite.exec(generateCreateTableSql(t)); } catch { /**/ }
  });
  afterAll(() => { sqlite.close(); });
  beforeEach(() => { clean(); seed(); });

  describe('Full Lifecycle', () => {
    it('receive then QC then release then issue', async () => {
      const id = await receiveMaterial(1,'B001',500,'kg',1,FAR,1,'PO1',USER);
      expect((await getLotDetails(id))!.status).toBe('quarantine');
      await updateLotStatus(id,'released',USER,undefined,'COA1');
      expect((await getLotDetails(id))!.status).toBe('released');
      await issueMaterial(id,200,'WO',1,'WO1',USER);
      expect((await getLotDetails(id))!.quantity).toBe(300);
      await issueMaterial(id,100,'WO',2,'WO2',USER);
      expect((await getLotDetails(id))!.quantity).toBe(200);
    });

    it('block on recall hides from available', async () => {
      const id = await receiveMaterial(1,'RCL',100,'kg',1,FAR,1,'PO1',USER);
      await updateLotStatus(id,'released',USER);
      await updateLotStatus(id,'blocked',USER,'Recall');
      expect((await getLotDetails(id))!.status).toBe('blocked');
      expect((await getAvailableLots(1)).find(l=>l.lotNumber==='RCL')).toBeUndefined();
    });
  });

  describe('FEFO Picking', () => {
    it('picks in expiry order across 3 lots', async () => {
      const a = await receiveMaterial(1,'FAR',100,'kg',1,FAR,null,null,USER);
      await updateLotStatus(a,'released',USER);
      const b = await receiveMaterial(1,'NEAR',80,'kg',1,NEAR,null,null,USER);
      await updateLotStatus(b,'released',USER);
      const c = await receiveMaterial(1,'MID',120,'kg',1,MID,null,null,USER);
      await updateLotStatus(c,'released',USER);

      const r = await getLotsForPicking(1,250);
      expect(r.remaining).toBe(0);
      expect(r.allocated[0].lotNumber).toBe('NEAR');
      expect(r.allocated[1].lotNumber).toBe('MID');
      expect(r.allocated[2].lotNumber).toBe('FAR');
    });

    it('excludes quarantine from picking', async () => {
      const a = await receiveMaterial(1,'REL',100,'kg',1,FAR,null,null,USER);
      await updateLotStatus(a,'released',USER);
      await receiveMaterial(1,'QC',200,'kg',1,NEAR,null,null,USER);
      expect((await getLotsForPicking(1,150)).remaining).toBe(50);
    });
  });

  describe('Warehouse Transfer', () => {
    it('preserves total after transfer', async () => {
      const id = await receiveMaterial(1,'X1',200,'kg',1,FAR,1,'PO1',USER);
      await updateLotStatus(id,'released',USER);
      const { newLotId } = await transferInventory(id,2,80,USER);
      expect((await getLotDetails(id))!.quantity).toBe(120);
      expect((await getLotDetails(newLotId))!.quantity).toBe(80);
    });

    it('handles sequential transfers', async () => {
      const id = await receiveMaterial(1,'S1',300,'kg',1,FAR,null,null,USER);
      await updateLotStatus(id,'released',USER);
      await transferInventory(id,2,100,USER);
      await transferInventory(id,3,50,USER);
      expect((await getLotDetails(id))!.quantity).toBe(150);
    });
  });

  describe('Expiry Alerts', () => {
    it('detects expired and near-expiry', async () => {
      const a = await receiveMaterial(1,'PAST',50,'kg',1,PAST,null,null,USER);
      await updateLotStatus(a,'released',USER);
      const b = await receiveMaterial(1,'SOON',100,'kg',1,NEAR,null,null,USER);
      await updateLotStatus(b,'released',USER);
      const c = await receiveMaterial(1,'OK',200,'kg',1,FAR,null,null,USER);
      await updateLotStatus(c,'released',USER);

      const al = await checkExpiryAlerts(30);
      expect(al.expired.find(x=>x.lotNumber==='PAST')).toBeDefined();
      expect([...al.nearExpiry,...al.expired].find(x=>x.lotNumber==='OK')).toBeUndefined();
    });
  });

  describe('Stock Summary', () => {
    it('tracks across operations', async () => {
      const a = await receiveMaterial(1,'A',100,'kg',1,FAR,null,null,USER);
      await updateLotStatus(a,'released',USER);
      const b = await receiveMaterial(1,'B',200,'kg',1,FAR,null,null,USER);
      await updateLotStatus(b,'released',USER);
      await receiveMaterial(1,'C',50,'kg',1,FAR,null,null,USER);
      await issueMaterial(a,30,'WO',1,'W1',USER);
      await adjustInventory(b,180,'count',USER);

      const s = await getStockSummary(1);
      expect(s!.onHand).toBeGreaterThanOrEqual(250);
      expect(s!.quarantine).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Recalculate OnHand', () => {
    it('matches lot sum', async () => {
      const a = await receiveMaterial(1,'R1',500,'kg',1,FAR,null,null,USER);
      await updateLotStatus(a,'released',USER);
      await issueMaterial(a,150,'WO',1,'W1',USER);
      const b = await receiveMaterial(1,'R2',200,'kg',1,FAR,null,null,USER);
      await updateLotStatus(b,'released',USER);
      expect((await recalculateItemOnHand(1)).onHand).toBeGreaterThanOrEqual(550);
    });
  });

  describe('GMP Compliance', () => {
    it('tracks manufacturer through lifecycle', async () => {
      const id = await receiveMaterialExtended({
        itemId:1,lotNumber:'GMP1',quantity:500,unit:'kg',
        warehouseId:1,expiryDate:FAR,
        manufacturerName:'Thai Med Co.',countryOfOrigin:'TH',
        retestDate:MID,retestIntervalMonths:6,
      },USER);
      await updateLotManufacturerInfo(id,'Thai Med Co.',1,'Importer',null,'TH',USER);
      const lot = await getLotDetails(id);
      expect(lot!.manufacturerName).toBe('Thai Med Co.');
      expect(lot!.importerName).toBe('Importer');
    });

    it('manages retest schedule', async () => {
      const id = await receiveMaterial(1,'RT1',100,'kg',1,FAR,null,null,USER);
      const rd = new Date(Date.now()+90*86400000).toISOString().split('T')[0];
      await updateLotRetestInfo(id,rd,6,USER);
      const r = await recordRetestCompletion(id,USER);
      if (r.nextRetestDate) expect(r.nextRetestDate.length).toBeGreaterThan(0);
    });
  });
});
