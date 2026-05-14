#!/usr/bin/env bun
// Sync the hardcoded PERMISSIONS map (src/lib/auth/index.ts) into each
// tenant database so the Role Management UI and the DB-driven runtime
// permission check agree on the same catalog.
//
// This is idempotent — running again only inserts what's missing.
//
// Usage: bun run scripts/sync-permissions-to-db.ts
//
// Two tables are touched:
//   1. hr_app_permissions (module, code, name, description)
//   2. hr_role_permissions (role_id, permission_id) — only for default
//      assignments derived from the hardcoded PERMISSIONS[code]: Role[].
//
// Existing rows are NEVER deleted. The UI can still add extra overrides
// on top; those survive this script untouched.

import mysql from 'mysql2/promise';
import { PERMISSIONS } from '../src/lib/auth';
import { expandRole } from '../src/lib/auth/role-mapping';

const TENANTS = [
  'herbal_erp_metaherb',
  'herbal_erp_arjaro',
  'herbal_erp_renunakhon',
  'herbal_erp_huaikoeng',
  'herbal_erp_phonphisai',
];

// Pretty names + module grouping for each hardcoded permission code.
// Used only to populate hr_app_permissions.name / .module when we insert
// a new row. Existing rows keep their display metadata.
function describe(code: string): { module: string; name: string } {
  const parts = code.split(':');
  const group = parts[0];
  const action = parts[parts.length - 1];

  const moduleByGroup: Record<string, string> = {
    users: 'User Management',
    items: 'Master Data',
    inventory: 'Inventory',
    production: 'Production',
    quality: 'Quality',
    purchasing: 'Purchasing',
    sales: 'Sales',
    reports: 'Reports',
    settings: 'Settings',
    hr: 'HR',
    'vmi-settings': 'VMI',
    'vmi-sync': 'VMI',
    'vmi-orders': 'VMI',
    documents: 'GMP',
    capa: 'GMP',
    complaints: 'GMP',
    recalls: 'GMP',
    stability: 'GMP',
    sanitation: 'GMP',
    audit: 'GMP',
    pqr: 'GMP',
    change_control: 'GMP',
    accounting: 'Accounting',
    cost: 'Cost',
    admin: 'Admin',
    issues: 'Issues',
  };

  const actionNames: Record<string, string> = {
    read: 'View',
    write: 'Edit',
    delete: 'Delete',
    adjust: 'Adjust',
    approve: 'Approve',
    execute: 'Execute',
    complete: 'Complete',
    post: 'Post',
    reverse: 'Reverse',
    close: 'Close',
    pay: 'Pay',
    confirm: 'Confirm',
    export: 'Export',
    create: 'Create',
    assign: 'Assign',
    admin: 'Admin',
    health_staff: 'Health Staff',
    mark: 'Mark',
    verify: 'Verify',
    clean_mark: 'Mark Clean',
    clean_verify: 'Verify Clean',
    investigate: 'Investigate',
  };

  const prettyAction = actionNames[action] || action;
  // Build a readable middle segment if the code has 3+ parts
  // e.g. "accounting:ap_invoices:pay" -> "AP Invoices Pay"
  const middle = parts.slice(1, -1).map((s) => s.replace(/_/g, ' ')).join(' ');
  const name = middle
    ? `${middle.replace(/\b\w/g, (c) => c.toUpperCase())} ${prettyAction}`
    : `${group.replace(/\b\w/g, (c) => c.toUpperCase())} ${prettyAction}`;

  return {
    module: moduleByGroup[group] || group,
    name,
  };
}

async function syncTenant(db: string) {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'rootpassword',
    database: db,
    charset: 'utf8mb4',
  });

  console.log(`\n=== ${db} ===`);

  // 1. Insert missing permission codes
  let addedPerms = 0;
  for (const code of Object.keys(PERMISSIONS)) {
    const { module, name } = describe(code);
    const [res] = (await conn.query(
      'INSERT IGNORE INTO hr_app_permissions (code, name, module, description) VALUES (?, ?, ?, ?)',
      [code, name, module, `Permission: ${code}`]
    )) as [{ affectedRows: number }, unknown];
    if (res.affectedRows > 0) addedPerms++;
  }
  console.log(`  Permissions added: ${addedPerms}`);

  // 2. Build role-code → role-id map from DB
  const [roleRows] = (await conn.query(
    'SELECT id, UPPER(code) AS code FROM hr_app_roles'
  )) as [{ id: number; code: string }[], unknown];
  const roleIdByCode = new Map(roleRows.map((r) => [r.code, r.id]));

  // 3. Build permission-code → id map
  const [permRows] = (await conn.query(
    'SELECT id, code FROM hr_app_permissions'
  )) as [{ id: number; code: string }[], unknown];
  const permIdByCode = new Map(permRows.map((p) => [p.code, p.id]));

  // 4. For each hardcoded assignment, resolve to (role_id, permission_id)
  //    and INSERT IGNORE. We run expandRole in reverse: for each HR role
  //    code in the DB, check whether its legacy aliases overlap the
  //    PERMISSIONS allow-list for this permission.
  let addedLinks = 0;
  for (const [permCode, allowedLegacyRoles] of Object.entries(PERMISSIONS)) {
    const permId = permIdByCode.get(permCode);
    if (!permId) continue;

    for (const [roleCode, roleId] of roleIdByCode) {
      const expanded = expandRole(roleCode);
      const matches = expanded.some((legacy) =>
        (allowedLegacyRoles as readonly string[]).includes(legacy)
      );
      if (!matches) continue;

      const [res] = (await conn.query(
        'INSERT IGNORE INTO hr_role_permissions (role_id, permission_id) VALUES (?, ?)',
        [roleId, permId]
      )) as [{ affectedRows: number }, unknown];
      if (res.affectedRows > 0) addedLinks++;
    }
  }
  console.log(`  Role-permission links added: ${addedLinks}`);

  await conn.end();
}

async function main() {
  for (const db of TENANTS) {
    try {
      await syncTenant(db);
    } catch (err) {
      console.error(`  FAILED: ${(err as Error).message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
