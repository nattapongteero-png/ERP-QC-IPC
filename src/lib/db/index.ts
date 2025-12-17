import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import * as schema from './schema';

// Environment detection - use custom DB_TYPE env var since Next.js overrides NODE_ENV
function useSqlite(): boolean {
  // Use DB_TYPE=sqlite for SQLite, otherwise use MySQL
  return process.env.DB_TYPE === 'sqlite';
}

function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

// SQLite connection (for testing)
let sqliteDb: ReturnType<typeof drizzleSqlite> | null = null;

const DB_PATH = process.env.SQLITE_DB_PATH || '/home/ubuntu/herbal-medicine-erp/data/herbal-erp.db';

export function getSqliteDb(dbPath: string = DB_PATH) {
  if (!sqliteDb) {
    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqliteDb = drizzleSqlite(sqlite, { schema });
  }
  return sqliteDb;
}

// MySQL connection pool (for production)
let mysqlPool: mysql.Pool | null = null;
let mysqlDb: any = null;

export async function getMysqlDb() {
  if (!mysqlDb) {
    mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'herbal_erp',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    mysqlDb = drizzleMysql(mysqlPool as any, { schema, mode: 'default' });
  }
  return mysqlDb;
}

// Get appropriate database based on environment
export async function getDb() {
  console.log('DB_TYPE:', process.env.DB_TYPE);
  if (useSqlite()) {
    console.log('Using SQLite database');
    return getSqliteDb();
  }
  console.log('Using MySQL database');
  return getMysqlDb();
}

// Close connections
export async function closeConnections() {
  if (mysqlPool) {
    await mysqlPool.end();
    mysqlPool = null;
    mysqlDb = null;
  }
  sqliteDb = null;
}

// Database initialization and migration
export async function initializeDatabase() {
  const db = await getDb();
  
  if (useSqlite()) {
    // For SQLite testing, create tables directly
    const sqlite = (db as any).session?.client as Database.Database;
    if (sqlite) {
      // Create tables for SQLite
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          department TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS audit_trail (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id),
          action TEXT NOT NULL,
          table_name TEXT,
          record_id INTEGER,
          old_value TEXT,
          new_value TEXT,
          ip_address TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          name_th TEXT NOT NULL,
          name_en TEXT,
          type TEXT NOT NULL,
          category TEXT,
          primary_unit TEXT NOT NULL,
          secondary_unit TEXT,
          conversion_rate REAL,
          shelf_life_days INTEGER,
          storage_condition TEXT,
          min_stock REAL DEFAULT 0,
          max_stock REAL,
          reorder_point REAL,
          is_lot_controlled INTEGER NOT NULL DEFAULT 1,
          is_fefo INTEGER NOT NULL DEFAULT 1,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS herbal_attributes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id INTEGER NOT NULL REFERENCES items(id),
          botanical_name TEXT,
          part_used TEXT,
          origin_country TEXT,
          origin_province TEXT,
          harvest_date TEXT,
          drying_method TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS vendors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          contact_person TEXT,
          phone TEXT,
          email TEXT,
          address TEXT,
          tax_id TEXT,
          is_approved INTEGER NOT NULL DEFAULT 0,
          is_vmi INTEGER NOT NULL DEFAULT 0,
          lead_time_days INTEGER,
          payment_terms TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS approved_vendor_list (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id INTEGER NOT NULL REFERENCES items(id),
          vendor_id INTEGER NOT NULL REFERENCES vendors(id),
          approval_date TEXT,
          expiry_date TEXT,
          is_preferred INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS warehouses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          location TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS warehouse_locations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
          code TEXT NOT NULL,
          name TEXT,
          zone TEXT,
          rack TEXT,
          shelf TEXT,
          bin TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS inventory_lots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id INTEGER NOT NULL REFERENCES items(id),
          lot_number TEXT NOT NULL,
          batch_number TEXT,
          warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
          location_id INTEGER REFERENCES warehouse_locations(id),
          quantity REAL NOT NULL DEFAULT 0,
          reserved_quantity REAL NOT NULL DEFAULT 0,
          unit TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'quarantine',
          manufacturing_date TEXT,
          expiry_date TEXT,
          received_date TEXT,
          vendor_id INTEGER REFERENCES vendors(id),
          po_number TEXT,
          coa_number TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS inventory_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lot_id INTEGER NOT NULL REFERENCES inventory_lots(id),
          transaction_type TEXT NOT NULL,
          quantity REAL NOT NULL,
          unit TEXT NOT NULL,
          reference_type TEXT,
          reference_id INTEGER,
          reference_number TEXT,
          from_warehouse_id INTEGER REFERENCES warehouses(id),
          to_warehouse_id INTEGER REFERENCES warehouses(id),
          reason TEXT,
          performed_by INTEGER REFERENCES users(id),
          approved_by INTEGER REFERENCES users(id),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS bom (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          product_id INTEGER NOT NULL REFERENCES items(id),
          version TEXT NOT NULL DEFAULT '1.0',
          status TEXT NOT NULL DEFAULT 'draft',
          batch_size REAL NOT NULL,
          batch_unit TEXT NOT NULL,
          yield_target REAL,
          loss_allowance REAL,
          effective_date TEXT,
          expiry_date TEXT,
          approved_by INTEGER REFERENCES users(id),
          approved_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS bom_lines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bom_id INTEGER NOT NULL REFERENCES bom(id),
          item_id INTEGER NOT NULL REFERENCES items(id),
          quantity REAL NOT NULL,
          unit TEXT NOT NULL,
          sequence INTEGER NOT NULL DEFAULT 1,
          is_optional INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS operations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bom_id INTEGER NOT NULL REFERENCES bom(id),
          sequence INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          work_center_id INTEGER,
          standard_time REAL,
          setup_time REAL,
          cleaning_time REAL,
          instructions TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS work_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wo_number TEXT NOT NULL UNIQUE,
          bom_id INTEGER NOT NULL REFERENCES bom(id),
          product_id INTEGER NOT NULL REFERENCES items(id),
          batch_number TEXT NOT NULL,
          planned_quantity REAL NOT NULL,
          actual_quantity REAL,
          unit TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'planned',
          priority INTEGER NOT NULL DEFAULT 5,
          planned_start_date TEXT,
          planned_end_date TEXT,
          actual_start_date TEXT,
          actual_end_date TEXT,
          yield_percentage REAL,
          notes TEXT,
          created_by INTEGER REFERENCES users(id),
          approved_by INTEGER REFERENCES users(id),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS work_order_materials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
          item_id INTEGER NOT NULL REFERENCES items(id),
          lot_id INTEGER REFERENCES inventory_lots(id),
          planned_quantity REAL NOT NULL,
          actual_quantity REAL,
          unit TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          issued_by INTEGER REFERENCES users(id),
          issued_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS batch_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
          operation_id INTEGER NOT NULL REFERENCES operations(id),
          sequence INTEGER NOT NULL,
          step_name TEXT NOT NULL,
          instructions TEXT,
          parameters TEXT,
          actual_values TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          start_time TEXT,
          end_time TEXT,
          performed_by INTEGER REFERENCES users(id),
          verified_by INTEGER REFERENCES users(id),
          verified_at TEXT,
          notes TEXT,
          attachments TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS quality_specs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id INTEGER NOT NULL REFERENCES items(id),
          test_name TEXT NOT NULL,
          test_method TEXT,
          specification TEXT,
          min_value REAL,
          max_value REAL,
          unit TEXT,
          is_critical INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS quality_tests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lot_id INTEGER NOT NULL REFERENCES inventory_lots(id),
          spec_id INTEGER NOT NULL REFERENCES quality_specs(id),
          test_type TEXT NOT NULL,
          sample_number TEXT,
          test_date TEXT,
          result TEXT,
          numeric_result REAL,
          status TEXT NOT NULL DEFAULT 'pending',
          tested_by INTEGER REFERENCES users(id),
          approved_by INTEGER REFERENCES users(id),
          approved_at TEXT,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS deviations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          deviation_number TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          source_type TEXT,
          source_id INTEGER,
          severity TEXT NOT NULL DEFAULT 'minor',
          status TEXT NOT NULL DEFAULT 'open',
          root_cause TEXT,
          corrective_action TEXT,
          preventive_action TEXT,
          reported_by INTEGER REFERENCES users(id),
          assigned_to INTEGER REFERENCES users(id),
          due_date TEXT,
          closed_by INTEGER REFERENCES users(id),
          closed_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS purchase_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          po_number TEXT NOT NULL UNIQUE,
          vendor_id INTEGER NOT NULL REFERENCES vendors(id),
          status TEXT NOT NULL DEFAULT 'draft',
          order_date TEXT,
          expected_date TEXT,
          total_amount REAL,
          currency TEXT NOT NULL DEFAULT 'THB',
          payment_terms TEXT,
          shipping_address TEXT,
          notes TEXT,
          created_by INTEGER REFERENCES users(id),
          approved_by INTEGER REFERENCES users(id),
          approved_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS purchase_order_lines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          po_id INTEGER NOT NULL REFERENCES purchase_orders(id),
          item_id INTEGER NOT NULL REFERENCES items(id),
          quantity REAL NOT NULL,
          received_quantity REAL NOT NULL DEFAULT 0,
          unit TEXT NOT NULL,
          unit_price REAL NOT NULL,
          total_price REAL NOT NULL,
          expected_date TEXT,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sales_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          so_number TEXT NOT NULL UNIQUE,
          customer_name TEXT NOT NULL,
          customer_contact TEXT,
          customer_address TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          order_date TEXT,
          required_date TEXT,
          shipped_date TEXT,
          total_amount REAL,
          currency TEXT NOT NULL DEFAULT 'THB',
          payment_terms TEXT,
          notes TEXT,
          created_by INTEGER REFERENCES users(id),
          approved_by INTEGER REFERENCES users(id),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sales_order_lines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          so_id INTEGER NOT NULL REFERENCES sales_orders(id),
          item_id INTEGER NOT NULL REFERENCES items(id),
          lot_id INTEGER REFERENCES inventory_lots(id),
          quantity REAL NOT NULL,
          shipped_quantity REAL NOT NULL DEFAULT 0,
          unit TEXT NOT NULL,
          unit_price REAL NOT NULL,
          total_price REAL NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS equipment (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          type TEXT,
          location TEXT,
          manufacturer TEXT,
          model TEXT,
          serial_number TEXT,
          installation_date TEXT,
          last_maintenance_date TEXT,
          next_maintenance_date TEXT,
          last_calibration_date TEXT,
          next_calibration_date TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS maintenance_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          equipment_id INTEGER NOT NULL REFERENCES equipment(id),
          type TEXT NOT NULL,
          description TEXT,
          scheduled_date TEXT,
          completed_date TEXT,
          performed_by INTEGER REFERENCES users(id),
          cost REAL,
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'scheduled',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS vmi_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vendor_id INTEGER NOT NULL REFERENCES vendors(id),
          transaction_type TEXT NOT NULL,
          item_id INTEGER REFERENCES items(id),
          quantity REAL,
          unit TEXT,
          data TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          sent_at TEXT,
          received_at TEXT,
          error_message TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          value TEXT,
          description TEXT,
          category TEXT,
          updated_by INTEGER REFERENCES users(id),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
  }
  
  return db;
}

export { schema };
