// Export production_rooms from a tenant DB into an Excel workbook whose column
// headers match exactly what POST /api/master-data/production-rooms accepts as
// payload keys, so the same file can be re-imported (upsert by `code`).
//
// Usage: bun scripts/export-production-rooms.ts <database> <output.xlsx>
//   e.g. bun scripts/export-production-rooms.ts herbal_erp_renunakhon \
//        exports/production-rooms-renunakhon.xlsx

import mysql from 'mysql2/promise';
import ExcelJS from 'exceljs';
import path from 'node:path';

const [, , database, outFile] = process.argv;
if (!database || !outFile) {
  console.error('Usage: bun scripts/export-production-rooms.ts <database> <output.xlsx>');
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST || 'mysql',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'rootpassword',
  database,
});

const [rows] = await conn.execute<any[]>(
  `SELECT code, name, name_th AS nameTh, room_type AS roomType,
          description, is_active AS isActive
   FROM production_rooms
   ORDER BY code`,
);
await conn.end();

const wb = new ExcelJS.Workbook();
wb.creator = 'herbal-erp export';
const ws = wb.addWorksheet('production_rooms');

// Column header keys MUST match POST payload field names — the import handler
// reads `code`, `name`, `nameTh`, `roomType`, `description`, `isActive`.
ws.columns = [
  { header: 'code',        key: 'code',        width: 12 },
  { header: 'name',        key: 'name',        width: 40 },
  { header: 'nameTh',      key: 'nameTh',      width: 40 },
  { header: 'roomType',    key: 'roomType',    width: 18 },
  { header: 'description', key: 'description', width: 50 },
  { header: 'isActive',    key: 'isActive',    width: 10 },
];

// Header style — bold + light fill so import can be eyeballed
ws.getRow(1).font = { bold: true };
ws.getRow(1).fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' },
};

for (const r of rows) {
  ws.addRow({
    code: r.code,
    name: r.name,
    nameTh: r.nameTh,
    roomType: r.roomType,
    description: r.description ?? '',
    isActive: r.isActive ? true : false,
  });
}

const out = path.resolve(outFile);
await wb.xlsx.writeFile(out);
console.log(`wrote ${rows.length} rows -> ${out}`);
