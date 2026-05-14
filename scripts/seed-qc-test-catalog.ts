#!/usr/bin/env bun
/**
 * Seed qc_test_catalog table across all production tenants.
 *
 * Strategy (so Day 1 is usable):
 *   (1) Create the table if it doesn't exist.
 *   (2) Pull distinct (testName, unit, testMethod) from quality_specs
 *       — these are tests the QC team has historically used.
 *   (3) Pull distinct (code, name, name_th, unit, test_method, min_value,
 *       max_value) from ipc_criteria — these are tests used in Production's
 *       in-process control that are commonly reused as QC specs too.
 *   (4) INSERT IGNORE into qc_test_catalog — idempotent, safe to re-run.
 *
 * Code convention: if ipc_criteria has a code, reuse it; otherwise derive
 * from the test name by uppercase + strip non-alphanumeric.
 */

import mysql from 'mysql2/promise';

const TENANTS = [
  'herbal_erp_metaherb',
  'herbal_erp_arjaro',
  'herbal_erp_renunakhon',
  'herbal_erp_huaikoeng',
  'herbal_erp_phonphisai',
];

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS qc_test_catalog (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  name_th VARCHAR(255),
  category VARCHAR(30) NOT NULL DEFAULT 'other',
  test_method VARCHAR(255),
  default_unit VARCHAR(50),
  default_min DECIMAL(15,4),
  default_max DECIMAL(15,4),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
`;

function makeCode(name: string, existing: Set<string>): string {
  const base = (name || 'TEST')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'TEST';
  let code = base;
  let n = 2;
  while (existing.has(code)) {
    const suffix = `_${n}`;
    code = (base.slice(0, 50 - suffix.length) + suffix).slice(0, 50);
    n++;
  }
  existing.add(code);
  return code;
}

function categoryOf(name: string): string {
  const n = (name || '').toLowerCase();
  if (/ph|acid|base|assay|potency|content|identif|color|clarity|loss|moist|residue|ash|heavy|impurit/i.test(n)) return 'chemical';
  if (/hardness|friab|disint|dissolut|thickness|diameter|weight|appearance|fill|particle|visc|density/i.test(n)) return 'physical';
  if (/microbial|sterility|bacteri|yeast|mold|endotox|e\.coli|salmonella|tamc|tymc|usp.*61|usp.*62/i.test(n)) return 'microbial';
  if (/taste|smell|odor|sensor/i.test(n)) return 'sensory';
  if (/stabilit|shelf|storage/i.test(n)) return 'stability';
  return 'other';
}

async function applyTenant(db: string) {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'rootpassword',
    database: db,
    charset: 'utf8mb4',
  });

  // Step 1 — ensure table exists
  await conn.query(CREATE_TABLE);

  // Existing codes (avoid collisions)
  const [existingRows] = (await conn.query('SELECT code FROM qc_test_catalog')) as [{ code: string }[], unknown];
  const existingCodes = new Set(existingRows.map((r) => r.code.toUpperCase()));

  let seededFromIpc = 0;
  let seededFromSpecs = 0;

  // Step 2 — seed from ipc_criteria (keeps original code, name, unit, method)
  const [ipcRows] = (await conn.query(
    `SELECT code, name, name_th, test_method, unit, min_value, max_value
     FROM ipc_criteria
     WHERE is_active = TRUE`
  )) as [
    { code: string; name: string; name_th: string | null; test_method: string | null; unit: string | null; min_value: string | number | null; max_value: string | number | null }[],
    unknown
  ];

  for (const r of ipcRows) {
    if (!r.name) continue;
    const code = r.code && r.code.trim() && !existingCodes.has(r.code.toUpperCase())
      ? r.code.toUpperCase()
      : makeCode(r.name, existingCodes);
    existingCodes.add(code);

    const [res] = (await conn.query(
      `INSERT IGNORE INTO qc_test_catalog
       (code, name, name_th, category, test_method, default_unit, default_min, default_max, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [code, r.name, r.name_th, categoryOf(r.name), r.test_method, r.unit, r.min_value, r.max_value]
    )) as [{ affectedRows: number }, unknown];
    if (res.affectedRows > 0) seededFromIpc++;
  }

  // Step 3 — seed from quality_specs distinct testName+unit (only if not already present by name)
  const [specRows] = (await conn.query(
    `SELECT DISTINCT test_name, test_method, unit, MIN(min_value) AS min_value, MAX(max_value) AS max_value
     FROM quality_specs
     WHERE test_name IS NOT NULL AND test_name <> ''
     GROUP BY test_name, test_method, unit`
  )) as [
    { test_name: string; test_method: string | null; unit: string | null; min_value: string | number | null; max_value: string | number | null }[],
    unknown
  ];

  // Build a set of names already in catalog to avoid re-seeding similar
  const [catalogNameRows] = (await conn.query('SELECT LOWER(name) AS n FROM qc_test_catalog')) as [{ n: string }[], unknown];
  const catalogNames = new Set(catalogNameRows.map((r) => r.n));

  for (const r of specRows) {
    if (!r.test_name) continue;
    if (catalogNames.has(r.test_name.toLowerCase())) continue;
    const code = makeCode(r.test_name, existingCodes);
    existingCodes.add(code);
    catalogNames.add(r.test_name.toLowerCase());

    const [res] = (await conn.query(
      `INSERT IGNORE INTO qc_test_catalog
       (code, name, category, test_method, default_unit, default_min, default_max, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [code, r.test_name, categoryOf(r.test_name), r.test_method, r.unit, r.min_value, r.max_value]
    )) as [{ affectedRows: number }, unknown];
    if (res.affectedRows > 0) seededFromSpecs++;
  }

  const [finalCount] = (await conn.query('SELECT COUNT(*) AS c FROM qc_test_catalog')) as [{ c: number }[], unknown];

  console.log(`  ${db}: seeded ${seededFromIpc} from IPC + ${seededFromSpecs} from specs = ${finalCount[0].c} total rows`);

  await conn.end();
}

async function main() {
  console.log('Seeding qc_test_catalog to production tenants...\n');
  for (const db of TENANTS) {
    try {
      await applyTenant(db);
    } catch (err) {
      console.error(`  ${db}: FAILED — ${(err as Error).message}`);
    }
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
