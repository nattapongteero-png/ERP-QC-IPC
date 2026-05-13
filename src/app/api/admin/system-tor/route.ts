import { NextResponse } from 'next/server';
import { Workbook } from 'exceljs';

/**
 * GET /api/admin/system-tor
 *
 * Generates the system Terms of Reference (TOR) for Herbal Medicine ERP
 * as a multi-sheet Excel workbook, on the fly. Public endpoint — TOR is
 * project documentation, not operational data; the standalone viewer
 * (public/system-tor-herbal-erp.html) links here as a Download button.
 *
 * Filename: herbal-erp-tor-YYYYMMDD.xlsx
 */
export async function GET() {
  const wb = new Workbook();
    wb.creator = 'Herbal Medicine ERP';
    wb.created = new Date();
    wb.title = 'TOR — Herbal Medicine ERP';

    // ────────────── Shared style helpers ──────────────
    const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1F4E79' } };
    const SUBHEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD9E1F2' } };

    const styleTitle = (ws: import('exceljs').Worksheet, row: number, text: string) => {
      const r = ws.getRow(row);
      r.getCell(1).value = text;
      r.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
      r.fill = HEADER_FILL;
      r.height = 28;
      ws.mergeCells(row, 1, row, 6);
      r.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    };

    const styleHeader = (ws: import('exceljs').Worksheet, row: number, cells: string[]) => {
      const r = ws.getRow(row);
      cells.forEach((c, i) => (r.getCell(i + 1).value = c));
      r.font = { bold: true, color: { argb: 'FF1F4E79' } };
      r.fill = SUBHEADER_FILL;
      r.alignment = { vertical: 'middle', wrapText: true };
      r.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFB4C7E7' } },
          bottom: { style: 'thin', color: { argb: 'FFB4C7E7' } },
        };
      });
    };

    const bordered = (ws: import('exceljs').Worksheet, startRow: number, endRow: number, endCol: number) => {
      for (let r = startRow; r <= endRow; r++) {
        const row = ws.getRow(r);
        for (let c = 1; c <= endCol; c++) {
          const cell = row.getCell(c);
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE7E6E6' } },
            left: { style: 'thin', color: { argb: 'FFE7E6E6' } },
            bottom: { style: 'thin', color: { argb: 'FFE7E6E6' } },
            right: { style: 'thin', color: { argb: 'FFE7E6E6' } },
          };
          cell.alignment = { vertical: 'top', wrapText: true };
        }
      }
    };

    // ───────────────── Sheet 1: ภาพรวมระบบ ─────────────────
    const s1 = wb.addWorksheet('1. ภาพรวมระบบ', { views: [{ state: 'frozen', ySplit: 1 }] });
    s1.columns = [
      { width: 30 }, { width: 70 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
    ];
    styleTitle(s1, 1, 'TOR ระบบบริหารจัดการการผลิตยาสมุนไพร (Herbal Medicine ERP)');
    const overview: Array<[string, string]> = [
      ['ชื่อโครงการ', 'Herbal Medicine ERP — ระบบบริหารจัดการการผลิตยาสมุนไพรครบวงจร'],
      ['วัตถุประสงค์', 'จัดการการผลิตยาสมุนไพรตั้งแต่ต้นน้ำถึงปลายน้ำ ครอบคลุม BOM, ใบสั่งผลิต, การชั่งวัตถุดิบ, QC, GMP Compliance, การขาย, การจัดซื้อ และการบัญชี — เป็นไปตามมาตรฐาน GMP/PIC-S และข้อกำหนดด้าน Data Integrity'],
      ['ขอบเขตการใช้งาน', 'รองรับ Multi-Tenant (ปัจจุบัน 6 tenants: arjaro, more, metaherb, renunakhon, phonphisai, huaikoeng) — แต่ละ tenant แยก database โดยใช้ codebase เดียวกัน'],
      ['รูปแบบการเข้าใช้งาน', 'Web-based Application รองรับทั้ง Desktop และ Mobile / Tablet — ผ่าน Browser มาตรฐาน (Chrome, Edge, Safari)'],
      ['ภาษา', 'Thai (Primary) / English — i18n ผ่าน next-intl'],
      ['ผู้ใช้งานเป้าหมาย', 'Operator ฝ่ายผลิต, QA / QC, Warehouse, Procurement, Sales, Accounting, HR, Manager, Admin'],
      ['มาตรฐานที่อ้างอิง', 'GMP PIC/S, WHO TRS 1003, 21 CFR Part 11 (Electronic Records & Signatures), ICH Q9 (Risk), ICH Q10 (PQS)'],
      ['Deployment', 'On-premise / Cloud (Docker Compose) — แต่ละ tenant มี container แยก + MySQL 8.0 shared'],
      ['Real-time Sync', 'รองรับ Server-Sent Events (SSE) — เมื่อ user A อนุมัติใบเบิก user B ใน browser อื่นเห็นทันทีโดยไม่ต้อง refresh'],
    ];
    let row = 3;
    overview.forEach(([k, v]) => {
      s1.getRow(row).getCell(1).value = k;
      s1.getRow(row).getCell(1).font = { bold: true };
      s1.getRow(row).getCell(2).value = v;
      s1.mergeCells(row, 2, row, 6);
      row++;
    });
    bordered(s1, 3, row - 1, 6);

    // ───────────────── Sheet 2: โมดูลทั้งหมด ─────────────────
    const s2 = wb.addWorksheet('2. โมดูลทั้งหมด', { views: [{ state: 'frozen', ySplit: 3 }] });
    s2.columns = [{ width: 5 }, { width: 25 }, { width: 50 }, { width: 12 }, { width: 25 }];
    styleTitle(s2, 1, 'โมดูลหลักของระบบ (11 Core Modules)');
    styleHeader(s2, 3, ['#', 'ชื่อโมดูล', 'คำอธิบาย', 'จำนวนหน้า', 'ผู้ใช้งานหลัก']);
    const modules: Array<[number, string, string, number, string]> = [
      [1, 'Dashboard', 'หน้าสรุปภาพรวมระบบ KPI หลัก + Quick Actions', 1, 'ทุก Role'],
      [2, 'Inventory (คลังสินค้า)', 'รายการสินค้า/วัตถุดิบ (3-level Unit: PU/SU/WU) / ล็อตคงคลัง / คลังย่อย / ธุรกรรม / ใบเบิกวัตถุดิบ / การคืนวัตถุดิบ / แจ้งเตือนหมดอายุ', 7, 'Warehouse, Production'],
      [3, 'Production (การผลิต)', 'สูตรการผลิต (BOM) พร้อม IPC + SOP / ใบสั่งผลิต Work Orders / บันทึก Batch (EBMR) / Master Data ห้องผลิต+เครื่องจักร+SOP Templates+IPC Criteria+QC Criteria', 4, 'Production, QA'],
      [4, 'Quality (คุณภาพ)', 'บันทึก QC / Certificate of Analysis (COA) + Templates / Test Panels / Tests / Specifications / Deviations / Audit Trail', 8, 'QC, QA'],
      [5, 'GMP Compliance', 'เอกสาร / Change Control / CAPA / Complaints / Recalls / Sanitation / Stability / Internal Audit / Contracts / PQR', 10, 'QA, GMP'],
      [6, 'Purchasing (จัดซื้อ)', 'ใบขอซื้อ (PR) / ใบสั่งซื้อ (PO) / Vendors + Approved Vendor List', 3, 'Procurement'],
      [7, 'Sales (ขาย)', 'ใบสั่งขาย (SO) / VMI Orders / Customers', 3, 'Sales'],
      [8, 'Accounting (บัญชี)', 'ผังบัญชี / Journal Entries / AP / AR / Fixed Assets / Equipment / Period Close / Bank Reconciliation / Credit-Debit Notes / 3-Way Matching / Approvals / Standard Costs / Variance Reports + Reports', 16, 'Accounting, Finance'],
      [9, 'Cost Management', 'Landed Costs / Work Centers / Cost Summary', 4, 'Cost Accountant'],
      [10, 'VMI Portal', 'Vendor-Managed Inventory Dashboard + Sync + Orders', 3, 'Vendor, Sales'],
      [11, 'HR', 'Organization / Employees / Positions / Training / Authorizations / Health Records / Roles + Permissions / Notifications / Audit Trail', 9, 'HR, Admin'],
    ];
    let r2 = 4;
    modules.forEach((m) => {
      m.forEach((v, i) => (s2.getRow(r2).getCell(i + 1).value = v));
      r2++;
    });
    bordered(s2, 4, r2 - 1, 5);

    // ───────────────── Sheet 3: รายละเอียดฟีเจอร์ ─────────────────
    const s3 = wb.addWorksheet('3. รายละเอียดฟีเจอร์', { views: [{ state: 'frozen', ySplit: 3 }] });
    s3.columns = [{ width: 22 }, { width: 32 }, { width: 70 }, { width: 14 }];
    styleTitle(s3, 1, 'รายละเอียดฟีเจอร์แยกตามโมดูล');
    styleHeader(s3, 3, ['โมดูล', 'ฟีเจอร์ / หน้าจอ', 'รายละเอียดงาน', 'สถานะ']);
    const features: Array<[string, string, string, string]> = [
      ['Inventory', 'รายการสินค้า (Items)', 'CRUD วัตถุดิบ/สินค้าสำเร็จรูป รองรับ 3-level Unit (กล่อง→แคปซูล→กรัม), เก็บ Storage Condition, Shelf Life, Reorder Point', 'พร้อมใช้'],
      ['Inventory', 'ล็อตคงคลัง (Lots)', 'จัดการ Lot ตามวันหมดอายุ (FEFO) — มี Tab ใบเบิกวัตถุดิบเป็น notification', 'พร้อมใช้'],
      ['Inventory', 'คลังย่อย (Warehouses)', 'จัดการคลังหลัก/คลังย่อย แต่ละคลังกำหนด zone ได้', 'พร้อมใช้'],
      ['Inventory', 'ธุรกรรม (Transactions)', 'ประวัติการเคลื่อนไหวสต็อก — รับเข้า/เบิกออก/ปรับ/ย้าย', 'พร้อมใช้'],
      ['Inventory', 'ใบเบิกวัตถุดิบ (Requisitions)', 'Inbox สำหรับคลัง — เห็นใบเบิกที่ฝ่ายผลิตส่งมา ตรวจสต็อกแล้วอนุมัติปล่อยของ', 'พร้อมใช้'],
      ['Inventory', 'การคืนวัตถุดิบ (Returns)', 'รับวัตถุดิบที่ไม่ได้ใช้คืนเข้าคลัง — บันทึก lot ใหม่ใน PU พร้อม Zero Cost', 'พร้อมใช้'],
      ['Inventory', 'แจ้งเตือนหมดอายุ', 'Dashboard lot ที่ใกล้หมดอายุ — แยกเป็น critical/warning', 'พร้อมใช้'],
      ['Production', 'BOM/Recipes', 'สูตรการผลิต รองรับ 3-level Unit dropdown ใน BOM line + Cost calculation ที่แม่นยำ', 'พร้อมใช้'],
      ['Production', 'BOM Configuration', 'กำหนด Required Rooms + Equipment + Environmental Conditions + SOP Steps + IPC — Phase Level', 'พร้อมใช้'],
      ['Production', 'Work Orders', 'สร้าง/ติดตามใบสั่งผลิต — แสดงสถานะตามขั้นตอน Released → InProgress → Completed', 'พร้อมใช้'],
      ['Production', 'Material Weighing', 'ชั่งวัตถุดิบหน้าไลน์ผลิต — บันทึก Weighed Qty พร้อม Electronic Signature', 'พร้อมใช้'],
      ['Production', 'Line Clearance', 'ตรวจเช็คความพร้อมก่อนเริ่มผลิต 6 ข้อ + Sign by Operator + Verify by QA', 'พร้อมใช้'],
      ['Production', 'SOP Execution', 'ดำเนินตาม SOP step-by-step พร้อม IPC test inline + E-Signature ทุก step', 'พร้อมใช้'],
      ['Production', 'Batch Records (EBMR)', 'Electronic Batch Manufacturing Record — รวมข้อมูล production batch ทั้งหมด พิมพ์เป็น PDF', 'พร้อมใช้'],
      ['Production', 'Master Data — Rooms', 'จัดการห้องผลิต พร้อม Room Type (Weighing, Mixing, Packaging, Storage)', 'พร้อมใช้'],
      ['Production', 'Master Data — Equipment', 'จัดการเครื่องจักร พร้อม Calibration tracking', 'พร้อมใช้'],
      ['Production', 'Master Data — SOP Templates', 'Template SOP Step ที่นำมา reuse ใน BOM ได้', 'พร้อมใช้'],
      ['Production', 'Master Data — IPC Criteria', 'รายการ IPC Test ที่ใช้ได้ — เลือกมาใช้ใน BOM ผ่าน Phase Level', 'พร้อมใช้'],
      ['Production', 'Master Data — Environmental Conditions', 'มาตรฐานสภาพแวดล้อมห้องผลิต (Temp/Humidity)', 'พร้อมใช้'],
      ['Quality', 'QC Entry', 'บันทึกผล QC test — multi-sample + multi-round + retest', 'พร้อมใช้'],
      ['Quality', 'Certificate of Analysis (COA)', 'ออกใบรับรองคุณภาพ พร้อม template editor + logo upload', 'พร้อมใช้'],
      ['Quality', 'COA Templates', 'จัดการ template COA ต่อ category + default-per-category', 'พร้อมใช้'],
      ['Quality', 'Test Panels', 'กลุ่ม test ที่ใช้ร่วมกัน ลดเวลา setup', 'พร้อมใช้'],
      ['Quality', 'Tests', 'รายการ Test methods ที่ใช้ในระบบ', 'พร้อมใช้'],
      ['Quality', 'Specifications', 'ข้อกำหนดเกณฑ์การยอมรับ', 'พร้อมใช้'],
      ['Quality', 'Deviations', 'บันทึก Deviation พร้อม root cause analysis + corrective action', 'พร้อมใช้'],
      ['Quality', 'QC Audit Trail', 'ประวัติการแก้ไขข้อมูล QC ทั้งหมด (ALCOA+)', 'พร้อมใช้'],
      ['GMP', 'Documents', 'จัดการเอกสาร GMP — version control + approval workflow', 'พร้อมใช้'],
      ['GMP', 'Change Control', 'บันทึก/ขออนุมัติการเปลี่ยนแปลงในระบบผลิต', 'พร้อมใช้'],
      ['GMP', 'CAPA', 'Corrective and Preventive Action — ติดตามจาก deviation/complaint จนปิดเคส', 'พร้อมใช้'],
      ['GMP', 'Complaints', 'รับเรื่องร้องเรียนจากลูกค้า + investigation + response', 'พร้อมใช้'],
      ['GMP', 'Recalls', 'การเรียกคืน batch ที่มีปัญหา', 'พร้อมใช้'],
      ['GMP', 'Sanitation', 'กำหนดการ + บันทึกการทำความสะอาด', 'พร้อมใช้'],
      ['GMP', 'Stability', 'การศึกษา stability — ตามช่วงเวลา + condition', 'พร้อมใช้'],
      ['GMP', 'Internal Audit', 'แผนตรวจสอบภายใน + รายงานผล + follow-up', 'พร้อมใช้'],
      ['GMP', 'Contracts', 'สัญญากับ supplier/customer ที่เกี่ยวกับ GMP', 'พร้อมใช้'],
      ['GMP', 'PQR', 'Product Quality Review — รายงานคุณภาพรายผลิตภัณฑ์', 'พร้อมใช้'],
      ['Purchasing', 'Purchase Requisitions (PR)', 'ใบขอซื้อ — สร้างจาก reorder point หรือ manual', 'พร้อมใช้'],
      ['Purchasing', 'Purchase Orders (PO)', 'ใบสั่งซื้อ — รองรับ split-VAT / inclusive-VAT toggle + 3-way matching', 'พร้อมใช้'],
      ['Purchasing', 'Vendors', 'ฐานข้อมูล supplier + Approved Vendor List (AVL)', 'พร้อมใช้'],
      ['Sales', 'Sales Orders (SO)', 'ใบสั่งขาย + Delivery + Invoicing', 'พร้อมใช้'],
      ['Sales', 'VMI Orders', 'คำสั่งซื้อจาก VMI Portal — sync อัตโนมัติ', 'พร้อมใช้'],
      ['Sales', 'Customers', 'ฐานข้อมูลลูกค้า', 'พร้อมใช้'],
      ['Accounting', 'Chart of Accounts', 'ผังบัญชี — 109 บัญชี seed สำหรับธุรกิจยา', 'พร้อมใช้'],
      ['Accounting', 'Journal Entries', 'การลงบัญชี manual + auto จาก transactions', 'พร้อมใช้'],
      ['Accounting', 'AP Invoices', 'ใบแจ้งหนี้เจ้าหนี้ — เชื่อม PO + 3-way matching', 'พร้อมใช้'],
      ['Accounting', 'AR Invoices', 'ใบแจ้งหนี้ลูกหนี้ — เชื่อม SO + Delivery', 'พร้อมใช้'],
      ['Accounting', 'Fixed Assets', 'ทะเบียนสินทรัพย์ + depreciation', 'พร้อมใช้'],
      ['Accounting', 'Period Close', 'ปิดงวดบัญชี — lock entries หลังปิด', 'พร้อมใช้'],
      ['Accounting', 'Bank Reconciliation', 'กระทบยอด bank statement', 'พร้อมใช้'],
      ['Accounting', 'Credit/Debit Notes', 'ใบลดหนี้/เพิ่มหนี้', 'พร้อมใช้'],
      ['Accounting', '3-Way Matching', 'จับคู่ PO + GR + Invoice ก่อน approve payment', 'พร้อมใช้'],
      ['Accounting', 'Standard Costs', 'ต้นทุนมาตรฐาน + variance analysis', 'พร้อมใช้'],
      ['Accounting', 'Variance Reports', 'รายงาน variance ของแต่ละ cost center', 'พร้อมใช้'],
      ['Cost', 'Landed Costs', 'รวมต้นทุนนำเข้าวัตถุดิบ — freight, duty, etc.', 'พร้อมใช้'],
      ['Cost', 'Work Centers', 'จัดการ cost ที่แต่ละ work center', 'พร้อมใช้'],
      ['Cost', 'Cost Summary', 'รายงานสรุปต้นทุน WAC (Weighted Average Cost)', 'พร้อมใช้'],
      ['VMI', 'VMI Dashboard', 'KPI Sales จาก Vendor', 'พร้อมใช้'],
      ['VMI', 'VMI Sync', 'Sync ข้อมูลกับ vendor ผ่าน webhook', 'พร้อมใช้'],
      ['HR', 'Organization', 'โครงสร้างองค์กร tree view', 'พร้อมใช้'],
      ['HR', 'Employees', 'ฐานข้อมูลพนักงาน + role assignment', 'พร้อมใช้'],
      ['HR', 'Positions', 'ตำแหน่งงาน + Job Description', 'พร้อมใช้'],
      ['HR', 'Training', 'หลักสูตร + Session + Records', 'พร้อมใช้'],
      ['HR', 'Authorizations', 'การมอบหมายอำนาจ (Delegation)', 'พร้อมใช้'],
      ['HR', 'Health Records', 'บันทึกสุขภาพ — ใช้ใน GMP gate', 'พร้อมใช้'],
      ['HR', 'Roles & Permissions', 'จัดการ Role + per-permission grant', 'พร้อมใช้'],
      ['HR', 'Notifications', 'การแจ้งเตือนงาน', 'พร้อมใช้'],
      ['HR', 'Audit Trail', 'ประวัติการเปลี่ยนแปลง HR', 'พร้อมใช้'],
      ['System', 'Reports', 'รายงานต่างๆ ผ่าน DevExpress Report Designer', 'พร้อมใช้'],
      ['System', 'Users', 'จัดการผู้ใช้ระบบ', 'พร้อมใช้'],
      ['System', 'Confidential Groups', 'กลุ่มความลับ — ปิด BOM ไม่ให้ user นอกกลุ่มเห็น', 'พร้อมใช้'],
      ['System', 'Settings — Approval Workflows', 'กำหนด workflow อนุมัติ + role-based bypass', 'พร้อมใช้'],
      ['System', 'Settings — Matching Tolerances', 'กำหนด tolerance สำหรับ 3-way matching', 'พร้อมใช้'],
    ];
    let r3 = 4;
    features.forEach((f) => {
      f.forEach((v, i) => (s3.getRow(r3).getCell(i + 1).value = v));
      r3++;
    });
    bordered(s3, 4, r3 - 1, 4);

    // ───────────────── Sheet 4: ข้อกำหนดทางเทคนิค ─────────────────
    const s4 = wb.addWorksheet('4. ข้อกำหนดทางเทคนิค', { views: [{ state: 'frozen', ySplit: 3 }] });
    s4.columns = [{ width: 22 }, { width: 28 }, { width: 60 }];
    styleTitle(s4, 1, 'Technical Stack & Architecture');
    styleHeader(s4, 3, ['Layer', 'Technology', 'รายละเอียด']);
    const tech: Array<[string, string, string]> = [
      ['Frontend Framework', 'Next.js 16 (App Router)', 'Server Components + Streaming + dynamic-loaded chunks สำหรับ widget ใหญ่'],
      ['UI Library', 'React 19', 'รุ่นล่าสุด รองรับ Concurrent Mode + Suspense'],
      ['Language', 'TypeScript 5.x (strict)', 'ทุกไฟล์ใน src/ เปิด strict mode ห้าม any โดยไม่จำเป็น'],
      ['UI Components', 'DevExtreme React 25.2.3', 'DataGrid, Form, Charts, Tabs, Popup — รองรับ Thai locale'],
      ['Styling', 'Tailwind CSS', 'utility-first + custom design tokens'],
      ['Charts/Reports', 'DevExpress Reporting + Recharts', 'Server-side report rendering (.NET backend) + client-side dashboard charts'],
      ['Data Fetching', 'TanStack Query 5.x', 'Server-state caching + invalidation + realtime sync via SSE'],
      ['Forms', 'DevExtreme Form + Zod', 'Type-safe validation schemas'],
      ['Database ORM', 'Drizzle ORM', 'Dual schema: SQLite (test) + MySQL (prod) จาก source-of-truth เดียวกัน'],
      ['Database', 'MySQL 8.0', 'Production — InnoDB + utf8mb4 + per-tenant DB'],
      ['Database (Test)', 'SQLite (bun:sqlite)', 'In-memory testing — โหลดเร็วกว่า docker mysql 100x'],
      ['Auth', 'Session-based + bcryptjs', 'HTTP-only cookie + 12 round bcrypt + role permissions table'],
      ['File Upload', 'Local FS (uploads/)', 'รองรับ COA logo, attachment, signatures'],
      ['i18n', 'next-intl', 'TH (Primary) + EN'],
      ['Real-time', 'Server-Sent Events (SSE)', 'Topic-based pub/sub — requisition-changed, wo-status, sop-execution'],
      ['Excel Export', 'ExcelJS', 'รองรับ multi-sheet, styling, formulas'],
      ['PDF', 'DevExpress Reports + Alpine Chromium', 'PDF rendering สำหรับ COA + EBMR + WO reports'],
      ['Deployment', 'Docker Compose', '7 containers ต่อ tenant set: 6 app + 1 MySQL + reporting backend × N'],
      ['Reverse Proxy', 'Nginx (external)', 'Reverse proxy + TLS termination + tenant routing'],
      ['Browser Support', 'Chrome 110+, Edge 110+, Safari 16+', 'IE/Legacy ไม่รองรับ'],
      ['Mobile', 'Responsive Web', 'รองรับ iPhone/iPad/Android browser — ไม่ใช่ native app'],
      ['Testing', 'Vitest + React Testing Library + Playwright', 'Unit + Component + E2E'],
    ];
    let r4 = 4;
    tech.forEach((t) => {
      t.forEach((v, i) => (s4.getRow(r4).getCell(i + 1).value = v));
      r4++;
    });
    bordered(s4, 4, r4 - 1, 3);

    // ───────────────── Sheet 5: GMP & ความปลอดภัย ─────────────────
    const s5 = wb.addWorksheet('5. GMP & ความปลอดภัย', { views: [{ state: 'frozen', ySplit: 3 }] });
    s5.columns = [{ width: 30 }, { width: 75 }];
    styleTitle(s5, 1, 'GMP Compliance & Security Requirements');
    styleHeader(s5, 3, ['ข้อกำหนด', 'การรองรับในระบบ']);
    const gmp: Array<[string, string]> = [
      ['21 CFR Part 11 — Electronic Signatures', 'ทุก action ที่ critical ต้องใส่รหัสผ่านยืนยัน (perform/verify/approve) — บันทึก signature + timestamp + meaning ใน DB'],
      ['21 CFR Part 11 — Electronic Records', 'Audit Trail บันทึก old/new value ทุก field ที่แก้ — ห้ามลบ ห้ามแก้ย้อนหลัง'],
      ['ALCOA+ Data Integrity', 'Attributable (who) / Legible / Contemporaneous (when) / Original / Accurate + Complete / Consistent / Enduring / Available'],
      ['Audit Trail', 'ตาราง audit_trail บันทึก operation/table/entityId/userId/oldValue/newValue/ipAddress/timestamp'],
      ['Role-Based Access Control', 'HR Roles + Permissions Table — เปลี่ยน permission ใน /hr/roles มีผลทันที (cached 60s)'],
      ['GMP Dual-Control', 'Operator ที่ Perform step ห้าม Verify เอง — ระบบบล็อก + แสดง "รอผู้ตรวจสอบคนอื่น"'],
      ['Confidential BOM', 'BOM ที่อยู่ใน Confidential Group — เปิดดูได้เฉพาะ user ในกลุ่ม (ยกเว้น admin bypass)'],
      ['Session Management', 'HTTP-only cookie + 12-hour timeout + concurrent login support'],
      ['Password Policy', 'bcrypt 12 rounds + minimum length enforced ที่ form level'],
      ['Backup', 'MySQL binary backup ทุกคืน 02:00 — เก็บ 30 วัน'],
      ['Disaster Recovery', 'Docker volumes mounted to host — recover ได้จาก snapshot'],
      ['Change Control', 'ทุก major schema change ผ่าน migration ที่ track ใน git history'],
      ['Validation Master Plan', 'ระบบมี Stability Study + Internal Audit module — track ตามมาตรฐาน WHO TRS 1003'],
      ['Electronic Batch Record (EBMR)', 'รวมข้อมูล batch ครบทุก step — พิมพ์เป็น PDF พร้อม e-signature ทุกขั้นตอน'],
      ['Computer System Validation (CSV)', 'ระบบรองรับการทำ IQ/OQ/PQ — มี test suite ครอบคลุม + manual test scripts'],
      ['Data Encryption', 'TLS 1.3 (in transit) — รหัสผ่าน bcrypt (at rest) — ไม่เก็บ plain text password'],
      ['Network Isolation', 'Database container ไม่ expose external port — เฉพาะ App container เข้าถึงได้'],
    ];
    let r5 = 4;
    gmp.forEach((g) => {
      g.forEach((v, i) => (s5.getRow(r5).getCell(i + 1).value = v));
      r5++;
    });
    bordered(s5, 4, r5 - 1, 2);

    // ───────────────── Sheet 6: ส่งมอบและระยะเวลา ─────────────────
    const s6 = wb.addWorksheet('6. ส่งมอบและระยะเวลา', { views: [{ state: 'frozen', ySplit: 3 }] });
    s6.columns = [{ width: 8 }, { width: 28 }, { width: 50 }, { width: 14 }, { width: 18 }];
    styleTitle(s6, 1, 'Deliverables, Timeline & Warranty');
    styleHeader(s6, 3, ['Phase', 'Scope', 'Deliverables', 'ระยะเวลา', 'Milestone']);
    const phases: Array<[string, string, string, string, string]> = [
      ['1', 'Inventory + Production + QC', 'Items 3-level, Lots, Warehouses, BOM, Work Orders, EBMR, Master Data, QC Entry, Audit Trail', '3 เดือน', 'UAT pass + GMP audit ผ่าน'],
      ['2', 'GMP Compliance + Accounting', 'CAPA, Documents, Change Control, Complaints, Recalls, Sanitation, Stability, COA, AP/AR, Journal, Period Close', '3 เดือน', 'GMP module ครบ + บัญชีปิดงวดได้'],
      ['3', 'Sales + Purchasing + Cost', 'PO, PR, Vendors, SO, Customers, Landed Cost, Work Centers, Standard Cost + Variance', '2 เดือน', 'End-to-end procure-to-pay + order-to-cash'],
      ['4', 'HR + VMI + Reports', 'HR Organization, Training, Roles, VMI Portal + Webhook, DevExpress Reports, i18n', '2 เดือน', 'HR ครบ + Vendor Portal ใช้งานได้'],
      ['5', 'Hardening + Hand-over', 'Performance tuning, Security audit, Documentation, Training delivery, Production deployment', '1 เดือน', 'Production live + User trained'],
    ];
    let r6 = 4;
    phases.forEach((p) => {
      p.forEach((v, i) => (s6.getRow(r6).getCell(i + 1).value = v));
      r6++;
    });
    r6++;
    s6.getRow(r6).getCell(1).value = 'รวมระยะเวลาทั้งหมด';
    s6.getRow(r6).getCell(1).font = { bold: true };
    s6.mergeCells(r6, 2, r6, 4);
    s6.getRow(r6).getCell(2).value = '11 เดือน (Phase 1-5) — ปัจจุบันระบบอยู่ระหว่าง Phase 3-4';
    s6.getRow(r6).getCell(2).font = { bold: true };
    r6++;

    r6++;
    styleHeader(s6, r6, ['#', 'Deliverables ภาพรวม', '', '', '']);
    s6.mergeCells(r6, 2, r6, 5);
    r6++;
    const deliverables = [
      'Source code ครบทุก module (Git repository)',
      'Database schema scripts (Drizzle migrations)',
      'Docker Compose configuration + deployment scripts',
      'User Manual (TH + EN) สำหรับ 8 personas (Production / QA / Warehouse / Accounting / Sales / Purchasing / HR / Admin)',
      'API Documentation (REST endpoints + payload schemas)',
      'Training สดในที่ทำการ — 3 รอบ (operator, QA, manager) รอบละ 1 วัน',
      'Test data + UAT scripts',
      'GMP Compliance Matrix — 21 CFR Part 11 + ALCOA+',
      'Performance benchmark report (load test 100 concurrent users)',
      'Security Audit Report',
    ];
    deliverables.forEach((d, i) => {
      s6.getRow(r6).getCell(1).value = i + 1;
      s6.getRow(r6).getCell(2).value = d;
      s6.mergeCells(r6, 2, r6, 5);
      r6++;
    });

    r6++;
    styleHeader(s6, r6, ['', 'การรับประกันและบำรุงรักษา', '', '', '']);
    s6.mergeCells(r6, 2, r6, 5);
    r6++;
    const warranty: Array<[string, string]> = [
      ['ระยะรับประกัน', '1 ปี นับจากวันที่ Go-Live — แก้ bug ที่เกิดจากความผิดพลาดของระบบโดยไม่คิดค่าใช้จ่าย'],
      ['SLA Response', 'Critical bug: ตอบใน 4 ชม. แก้ใน 24 ชม. / Normal: ตอบใน 1 วันทำการ'],
      ['Maintenance ต่อเนื่อง', 'ค่าบำรุงรักษารายปี 15% ของมูลค่าโครงการ — ครอบคลุม security patches + minor enhancements'],
      ['Source Code', 'Customer เป็นเจ้าของ source code — ทาง vendor มีสิทธิ์ใช้ reference เท่านั้น'],
      ['Support Hours', 'จันทร์-ศุกร์ 09:00-18:00 (ยกเว้นเสาร์-อาทิตย์ + วันหยุดราชการ)'],
    ];
    warranty.forEach(([k, v]) => {
      s6.getRow(r6).getCell(1).value = k;
      s6.getRow(r6).getCell(1).font = { bold: true };
      s6.getRow(r6).getCell(2).value = v;
      s6.mergeCells(r6, 2, r6, 5);
      r6++;
    });
    bordered(s6, 4, r6 - 1, 5);

    // ───────────────── Sheet 7: ภาคผนวก ─────────────────
    const s7 = wb.addWorksheet('7. ภาคผนวก', { views: [{ state: 'frozen', ySplit: 3 }] });
    s7.columns = [{ width: 35 }, { width: 70 }];
    styleTitle(s7, 1, 'Appendix — สถิติและรายละเอียดเพิ่มเติม');
    styleHeader(s7, 3, ['หัวข้อ', 'รายละเอียด']);
    const appendix: Array<[string, string]> = [
      ['จำนวน Database Tables', '~150+ tables ครอบคลุม 11 modules (รายละเอียดดูใน schema.ts)'],
      ['จำนวน API Endpoints', '300+ endpoints (REST) — GET/POST/PUT/PATCH/DELETE'],
      ['จำนวน UI Pages', '70+ หน้า (รวม sub-pages)'],
      ['Lines of Code', '~150,000+ บรรทัด TypeScript/TSX'],
      ['จำนวน Components ที่ Reusable', '100+ shared components ใน src/components/'],
      ['Test Coverage', 'Unit + Integration + E2E (Playwright) — มี test suite ใน tests/'],
      ['Branches', 'Feature branches แยกตาม spec (เช่น 015-i18n, 014-unit-cost, 017-ipc-criteria-redesign)'],
      ['Tenants ปัจจุบัน', 'arjaro, more, metaherb, renunakhon, phonphisai, huaikoeng (6 production tenants)'],
      ['Database Size (typical)', '~50-500 MB ต่อ tenant (ขึ้นกับปริมาณ transaction)'],
      ['Concurrent Users Supported', 'ออกแบบรองรับ 50+ concurrent users ต่อ tenant'],
      ['Realtime Topics', 'requisition-changed, wo-status, sop-execution, ipc-result, qc-entry, line-clearance'],
      ['External Integrations', 'VMI Vendor (webhook), IoT API spec (มี), Reporting Backend (.NET DevExpress)'],
      ['CI/CD', 'GitHub Actions (planned) — ปัจจุบัน build ด้วย docker compose build ใน local'],
      ['Build Time', '~5-10 นาทีต่อ tenant container'],
      ['Container Restart Time', '~30-60 วินาที (zero-downtime via rolling update)'],
    ];
    let r7 = 4;
    appendix.forEach((a) => {
      a.forEach((v, i) => (s7.getRow(r7).getCell(i + 1).value = v));
      r7++;
    });
    bordered(s7, 4, r7 - 1, 2);

    r7 += 2;
    styleHeader(s7, r7, ['Generated', '']);
    s7.mergeCells(r7, 1, r7, 2);
    r7++;
    s7.getRow(r7).getCell(1).value = 'Generated at';
    s7.getRow(r7).getCell(1).font = { bold: true };
    s7.getRow(r7).getCell(2).value = new Date().toISOString();
    r7++;
    s7.getRow(r7).getCell(1).value = 'Generated by';
    s7.getRow(r7).getCell(1).font = { bold: true };
    s7.getRow(r7).getCell(2).value = 'Herbal Medicine ERP — /api/admin/system-tor';

    // ────────────── Build buffer + return ──────────────
    const buffer = await wb.xlsx.writeBuffer();
    const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `herbal-erp-tor-${yyyymmdd}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
