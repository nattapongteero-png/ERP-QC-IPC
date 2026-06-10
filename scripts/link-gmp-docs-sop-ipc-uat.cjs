/**
 * Link GMP documents to SOP templates and IPC criteria (Master Data, UAT Local).
 *
 * Creates one dedicated SOP document per SOP step-template (17) and one IPC
 * test-method SOP per dosage form (4), each with a real Thai PDF, then links:
 *   - every sop_template_steps row  -> its template's SOP document
 *   - every ipc_criteria row        -> its dosage-form test-method document
 * via the gmp_document_id column.
 *
 * The document create/upload/version goes through the live API; the
 * gmp_document_id links are written to scripts/_gmp-link.sql (applied by the
 * shell wrapper) because the IPC master route upserts-by-code (re-run unsafe)
 * and the SOP-step route needs per-step ids — a direct column UPDATE is the
 * simplest idempotent path.
 *
 * Run: node scripts/link-gmp-docs-sop-ipc-uat.cjs
 */
const fs = require('fs');
const path = require('path');
const { makeClient } = require('./lib/gmp-doc-seed-lib.cjs');

const BASE = process.env.BASE || 'http://localhost:6809';
const EMAIL = process.env.EMAIL || 'admin@herbal-erp.com';
const PASSWORD = process.env.PASSWORD || 'admin123';

// SOP step-template -> { templateId, code(unique short), thai title, dept, body }
// templateId matches sop_step_templates.id (1..17).
const SOP_TEMPLATES = [
  [1,  'SOP-LC',    'ตรวจสอบความพร้อมสายการผลิต (Line Clearance)', 2, 'การเคลียร์วัสดุรุ่นก่อน ตรวจสอบฉลากและเอกสาร และบันทึกผลก่อนเริ่มการผลิตทุกครั้ง'],
  [2,  'SOP-DISP',  'การจ่ายวัตถุดิบ (Dispensing)', 2, 'การตรวจสอบใบสั่งจ่าย ชั่งและจ่ายวัตถุดิบตามสูตร ติดฉลากและตรวจสอบซ้ำแบบ Triple Independence'],
  [3,  'SOP-PREP',  'การเตรียมวัตถุดิบ (Preparation)', 2, 'การตรวจรับวัตถุดิบ คัดแยกและทำความสะอาดเบื้องต้น และการเตรียมภาชนะให้พร้อมใช้งาน'],
  [4,  'SOP-MILL',  'การบดวัตถุดิบ (Milling)', 2, 'การตั้งค่าเครื่องบด การบดวัตถุดิบให้ได้ขนาดอนุภาคตามข้อกำหนด และการตรวจขนาดอนุภาค'],
  [5,  'SOP-SIEVE', 'การร่อนผง (Sieving)', 2, 'การเตรียมตะแกรงตามเบอร์ที่กำหนด การร่อนผง และการบันทึกผลผลิตที่ผ่านตะแกรง'],
  [6,  'SOP-DRY',   'การอบแห้ง (Drying)', 2, 'การนำวัตถุดิบเข้าตู้อบ การควบคุมอุณหภูมิและเวลา จนได้ความชื้นเป้าหมาย และการตรวจความชื้น'],
  [7,  'SOP-BLEND', 'การผสมแห้ง (Dry Blending)', 2, 'การใส่วัตถุดิบเข้าเครื่องผสม การผสมแห้งตามเวลาที่กำหนด และการสุ่มตรวจความสม่ำเสมอของการผสม'],
  [8,  'SOP-MIX',   'การผสม (Mixing)', 2, 'การใส่ส่วนผสม การผสมให้เป็นเนื้อเดียวกัน และการตรวจลักษณะของเนื้อผสม'],
  [9,  'SOP-HEAT',  'การให้ความร้อน (Heating)', 2, 'การตั้งอุณหภูมิ การให้ความร้อนและคงอุณหภูมิตามที่กำหนด และการเฝ้าระวังระหว่างกระบวนการ'],
  [10, 'SOP-COOL',  'การทำให้เย็น (Cooling)', 2, 'การเริ่มลดอุณหภูมิ การเฝ้าวัดอุณหภูมิ และการยืนยันว่าถึงอุณหภูมิเป้าหมายก่อนขั้นตอนถัดไป'],
  [11, 'SOP-FILL',  'การบรรจุลงแคปซูล (Filling)', 2, 'การตั้งน้ำหนักบรรจุ การบรรจุแคปซูล และการตรวจน้ำหนักระหว่างผลิตตามแผน IPC'],
  [12, 'SOP-PACK',  'การบรรจุภัณฑ์ (Packaging)', 12, 'การบรรจุลงภาชนะ การซีล และการติดฉลากพร้อมระบุรหัสรุ่นและวันหมดอายุ'],
  [13, 'SOP-IPC',   'การควบคุมระหว่างผลิต (In-Process Control)', 4, 'การวางแผนการสุ่ม IPC การทดสอบตัวอย่าง และการบันทึกพร้อมตัดสินผลตามเกณฑ์ยอมรับ'],
  [14, 'SOP-WEIGH', 'การชั่งน้ำหนัก (Weighing)', 2, 'การตรวจสอบและสอบเทียบเครื่องชั่ง การหักภาชนะและชั่ง และการบันทึกน้ำหนักสุทธิ'],
  [15, 'SOP-CLEAN', 'การทำความสะอาด (Cleaning)', 5, 'การถอดชิ้นส่วน การทำความสะอาดและล้างตามวิธีที่กำหนด และการตรวจสอบความสะอาดก่อนใช้งาน'],
  [16, 'SOP-INSP',  'การตรวจสอบ (Inspection)', 3, 'การเตรียมการตรวจสอบ การตรวจสอบตามเกณฑ์ และการบันทึกผลการตรวจสอบ'],
  [17, 'SOP-GEN',   'ขั้นตอนการปฏิบัติงานทั่วไป (General Procedure)', 2, 'ขั้นตอนการเตรียมการ การดำเนินการ และการบันทึกผลสำหรับงานทั่วไปที่ไม่เข้าหมวดเฉพาะ'],
];

// IPC test-method SOP per dosage form -> links all ipc_criteria of that form.
const IPC_METHODS = [
  ['capsule',   'IPCM-CAP', 'วิธีทดสอบควบคุมระหว่างผลิต: รูปแบบแคปซูล', 4,
    'น้ำหนักเฉลี่ยแคปซูล: สุ่ม 10 แคปซูล ชั่งและคำนวณค่าเฉลี่ย เกณฑ์ ±5% ของเป้าหมาย',
    'น้ำหนักผงบรรจุต่อแคปซูล: ชั่งหักน้ำหนักปลอกแคปซูลเปล่า',
    'ความชื้นผงบรรจุ เวลาแตกตัว ลักษณะภายนอก และการล็อกฝาแคปซูล ตามเกณฑ์ที่กำหนด'],
  ['tablet',    'IPCM-TAB', 'วิธีทดสอบควบคุมระหว่างผลิต: รูปแบบยาเม็ด', 4,
    'น้ำหนักเฉลี่ยเม็ด: สุ่ม 20 เม็ด เกณฑ์ ±5%',
    'ความแข็ง ความกร่อน เวลาแตกตัว และความหนาของเม็ด ตามข้อกำหนดเภสัชตำรับ'],
  ['powder',    'IPCM-PWD', 'วิธีทดสอบควบคุมระหว่างผลิต: รูปแบบผง/แกรนูล', 4,
    'ความชื้นผง: วัดด้วยเครื่อง Moisture Analyzer เกณฑ์ตามข้อกำหนดผลิตภัณฑ์',
    'ความสม่ำเสมอของการผสม (Blend Uniformity): RSD ไม่เกิน 5%',
    'ขนาดอนุภาค/ความละเอียด: ตรวจด้วยตะแกรงมาตรฐาน'],
  ['packaging', 'IPCM-PKG', 'วิธีทดสอบควบคุมระหว่างผลิต: ขั้นบรรจุภัณฑ์', 4,
    'ความสมบูรณ์ของซีล: ทดสอบการรั่วของซอง/ขวด',
    'ความถูกต้องของฉลาก: ตรวจชื่อผลิตภัณฑ์ เลขที่รุ่น และวันหมดอายุให้ตรงกับใบสั่งผลิต'],
];

function sopSections(title, body) {
  return [
    { heading: '1. วัตถุประสงค์และขอบเขต', paras: [
      `เพื่อกำหนดวิธีปฏิบัติมาตรฐานสำหรับ "${title}" ให้เป็นไปตามหลักเกณฑ์ GMP และสามารถสอบกลับได้`] },
    { heading: '2. วิธีปฏิบัติ', paras: [body] },
    { heading: '3. การบันทึกและทวนสอบ', paras: [
      'บันทึกผลการปฏิบัติงานในแบบบันทึกการผลิตประจำรุ่น (BMR) และให้ผู้ทวนสอบลงนามกำกับทุกขั้นตอนวิกฤต'] },
    { heading: '4. เอกสารอ้างอิง', paras: [
      'คู่มือระบบคุณภาพ (Quality Manual), สูตรการผลิต (BOM) ฉบับอนุมัติ และนโยบายคุณภาพของบริษัท'] },
  ];
}
function ipcSections(paras) {
  return [
    { heading: '1. วัตถุประสงค์', paras: ['เพื่อกำหนดวิธีทดสอบและเกณฑ์ยอมรับสำหรับการควบคุมระหว่างกระบวนการผลิต (IPC) ของรูปแบบยานี้'] },
    { heading: '2. วิธีทดสอบและเกณฑ์ยอมรับ', paras },
    { heading: '3. การจัดการผลไม่ผ่านเกณฑ์', paras: ['กรณีผลไม่อยู่ในเกณฑ์ ให้หยุดกระบวนการ บันทึกความเบี่ยงเบน และดำเนินการตามขั้นตอน CAPA'] },
  ];
}

(async () => {
  const c = makeClient(BASE, EMAIL, PASSWORD);
  await c.login();
  console.log('✓ logged in');

  // type names for PDF header
  const typesRes = await c.api('/api/documents/types');
  const types = typesRes.body?.data || [];
  const sopTypeId = (types.find((t) => t.code === 'SOP') || { id: 1 }).id;
  const sopTypeName = (types.find((t) => t.code === 'SOP') || { name: 'Standard Operating Procedure' }).name;

  const links = []; // {sql}
  const sql = [];
  sql.push('SET NAMES utf8mb4;');

  // --- SOP documents, one per template ---
  console.log('\n— Creating SOP documents (one per SOP template) —');
  for (const [templateId, code, title, dept, body] of SOP_TEMPLATES) {
    const r = await c.createDocWithPdf({
      typeId: sopTypeId, code, typeName: sopTypeName, title, department: dept,
      status: 'active', sections: sopSections(title, body),
    });
    // finalize active + link all steps of this template
    sql.push(`UPDATE document_versions SET status='approved', effective_date=NOW() WHERE document_id=${r.id};`);
    sql.push(`UPDATE documents SET status='active', current_version_id=(SELECT MAX(v.id) FROM document_versions v WHERE v.document_id=${r.id}) WHERE id=${r.id};`);
    sql.push(`UPDATE sop_template_steps SET gmp_document_id=${r.id} WHERE template_id=${templateId};`);
    console.log(`  ✓ ${r.documentNumber} → SOP template #${templateId} (${code}) [${r.sizeKb}KB]`);
  }

  // --- IPC test-method documents, one per dosage form ---
  console.log('\n— Creating IPC test-method documents (per dosage form) —');
  for (const [dosage, code, title, dept, ...paras] of IPC_METHODS) {
    const r = await c.createDocWithPdf({
      typeId: sopTypeId, code, typeName: sopTypeName, title, department: dept,
      status: 'active', sections: ipcSections(paras),
    });
    sql.push(`UPDATE document_versions SET status='approved', effective_date=NOW() WHERE document_id=${r.id};`);
    sql.push(`UPDATE documents SET status='active', current_version_id=(SELECT MAX(v.id) FROM document_versions v WHERE v.document_id=${r.id}) WHERE id=${r.id};`);
    sql.push(`UPDATE ipc_criteria SET gmp_document_id=${r.id} WHERE dosage_form='${dosage}';`);
    console.log(`  ✓ ${r.documentNumber} → IPC dosage '${dosage}' (${code}) [${r.sizeKb}KB]`);
  }

  const outPath = path.join('scripts', '_gmp-link.sql');
  fs.writeFileSync(outPath, sql.join('\n') + '\n');
  console.log(`\nWrote link SQL -> ${outPath}`);
  console.log('Done creating documents. Apply the SQL to finalize + link.');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
