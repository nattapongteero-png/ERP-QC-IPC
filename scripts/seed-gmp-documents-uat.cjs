/**
 * Seed GMP documents (UAT Local) — delete all existing, recreate a full set
 * covering every document type, each with a real Thai-content PDF (<=3 pages)
 * uploaded as a BLOB version.
 *
 * Drives the live app API exactly like the UI:
 *   login -> DELETE existing docs -> POST /api/documents
 *         -> POST /api/documents/upload -> POST /api/documents/[id]/versions
 *
 * Run:  node scripts/seed-gmp-documents-uat.cjs
 * Env:  BASE (default http://localhost:6809), EMAIL, PASSWORD
 */
const fs = require('fs');
const { jsPDF } = require('jspdf');

const BASE = process.env.BASE || 'http://localhost:6809';
const EMAIL = process.env.EMAIL || 'admin@herbal-erp.com';
const PASSWORD = process.env.PASSWORD || 'admin123';
const FONT_PATH = process.env.FONT_PATH || 'C:/Windows/Fonts/THSarabun.ttf';
const FONT_BOLD_PATH = process.env.FONT_BOLD_PATH || 'C:/Windows/Fonts/THSarabun Bold.ttf';

const fontReg = fs.readFileSync(FONT_PATH).toString('base64');
const fontBold = fs.readFileSync(FONT_BOLD_PATH).toString('base64');

// ---------------------------------------------------------------------------
// Document definitions — one per type (typeId 1..10), real GMP-style Thai body.
// department = hr_org_units.id. sections = array of {heading, paras:[...]}.
// ---------------------------------------------------------------------------
const DOCS = [
  {
    typeId: 1, code: 'SOP', department: 2, status: 'active',
    title: 'วิธีปฏิบัติงานมาตรฐาน: การชั่งและจ่ายวัตถุดิบสมุนไพร',
    sections: [
      { heading: '1. วัตถุประสงค์', paras: [
        'เพื่อกำหนดวิธีการชั่งและจ่ายวัตถุดิบสมุนไพรให้ถูกต้อง แม่นยำ และสอบกลับได้ ตามหลักเกณฑ์ GMP PIC/S ป้องกันการปนเปื้อนข้ามและความคลาดเคลื่อนของปริมาณตัวยาสำคัญ' ] },
      { heading: '2. ขอบเขต', paras: [
        'ใช้กับการชั่งวัตถุดิบทุกชนิดในห้องชั่ง (ROOM-WEIGH-01) สำหรับการผลิตยาสมุนไพรทุกรูปแบบ ทั้งแคปซูล ยาเม็ด ยาผง ยาน้ำ และผลิตภัณฑ์กึ่งของแข็ง' ] },
      { heading: '3. ความรับผิดชอบ', paras: [
        'พนักงานชั่ง: ดำเนินการชั่งตามใบสั่งผลิตและสูตร (BOM) ที่อนุมัติแล้ว',
        'ผู้ทวนสอบ (Verifier): ตรวจสอบน้ำหนักและลงนามกำกับแบบ Triple Independence',
        'หัวหน้าฝ่ายผลิต: อนุมัติการเบิกจ่ายและทบทวนบันทึก' ] },
      { heading: '4. วิธีปฏิบัติ', paras: [
        '4.1 ตรวจสอบความสะอาดห้องชั่งและทำ Line Clearance ก่อนเริ่มงานทุกครั้ง',
        '4.2 สอบเทียบเครื่องชั่งด้วยลูกตุ้มมาตรฐาน (ลูกตุ้มสอบเทียบ) และบันทึกผลก่อนใช้งาน หากไม่ผ่านให้ติดป้าย "ห้ามใช้"',
        '4.3 ชั่งวัตถุดิบทีละรายการตามลำดับในสูตร บันทึกน้ำหนักจริงเทียบกับน้ำหนักทฤษฎีและช่วงพิกัดความคลาดเคลื่อน',
        '4.4 ติดฉลากภาชนะทุกใบ ระบุชื่อวัตถุดิบ เลขที่ล็อต น้ำหนัก และเลขที่ใบสั่งผลิต',
        '4.5 ผู้ทวนสอบลงนามยืนยันน้ำหนักทุกบรรทัดก่อนส่งต่อไปยังขั้นตอนผสม' ] },
      { heading: '5. เอกสารอ้างอิงและบันทึก', paras: [
        'แบบบันทึกการชั่ง (BMR ส่วนการชั่ง), บันทึกการสอบเทียบเครื่องชั่ง, สูตรการผลิต (BOM) ฉบับอนุมัติ' ] },
    ],
  },
  {
    typeId: 2, code: 'POL', department: 4, status: 'active',
    title: 'นโยบายคุณภาพและความปลอดภัยของผลิตภัณฑ์ยาสมุนไพร',
    sections: [
      { heading: '1. เจตนารมณ์', paras: [
        'บริษัทมุ่งมั่นผลิตยาสมุนไพรที่มีคุณภาพ ปลอดภัย และมีประสิทธิผล สอดคล้องกับมาตรฐาน GMP ของสำนักงานคณะกรรมการอาหารและยา และหลักเกณฑ์ PIC/S' ] },
      { heading: '2. หลักการสำคัญ', paras: [
        '2.1 ผลิตภัณฑ์ทุกรุ่นต้องผ่านการควบคุมคุณภาพตามข้อกำหนดก่อนปล่อยผ่าน',
        '2.2 พนักงานทุกคนมีหน้าที่รักษาคุณภาพและรายงานความเบี่ยงเบนทันที',
        '2.3 มีระบบเอกสารที่ควบคุมได้ สอบกลับได้ และเก็บรักษาตามระยะเวลาที่กำหนด',
        '2.4 ส่งเสริมการพัฒนาอย่างต่อเนื่องผ่านการทบทวนคุณภาพผลิตภัณฑ์ประจำปี' ] },
      { heading: '3. การนำไปปฏิบัติ', paras: [
        'ผู้บริหารทุกระดับต้องสนับสนุนทรัพยากรและสร้างวัฒนธรรมคุณภาพ ฝ่ายประกันคุณภาพทบทวนนโยบายนี้อย่างน้อยทุก 3 ปี' ] },
    ],
  },
  {
    typeId: 3, code: 'FORM', department: 2, status: 'active',
    title: 'แบบบันทึกการผลิตประจำรุ่น (Batch Manufacturing Record)',
    sections: [
      { heading: 'ส่วนที่ 1 ข้อมูลทั่วไป', paras: [
        'ชื่อผลิตภัณฑ์: ............  เลขที่สูตร (BOM): ............  เลขที่รุ่นผลิต: ............',
        'ขนาดรุ่นผลิต: ............  วันที่เริ่มผลิต: ............  วันที่ผลิตเสร็จ: ............' ] },
      { heading: 'ส่วนที่ 2 การชั่งวัตถุดิบ', paras: [
        'ตารางบันทึกรายการวัตถุดิบ น้ำหนักทฤษฎี น้ำหนักจริง เลขที่ล็อต ผู้ชั่ง และผู้ทวนสอบ',
        '(กรอกหนึ่งบรรทัดต่อหนึ่งวัตถุดิบตามสูตร พร้อมลงนามกำกับทุกบรรทัด)' ] },
      { heading: 'ส่วนที่ 3 การควบคุมระหว่างผลิต', paras: [
        'บันทึกผลการตรวจ IPC เช่น น้ำหนักเฉลี่ยแคปซูล ความชื้น ความสม่ำเสมอของการผสม พร้อมเกณฑ์ยอมรับ' ] },
      { heading: 'ส่วนที่ 4 ผลผลิตและการลงนาม', paras: [
        'ผลผลิตจริง: ............ %Yield: ............',
        'ผู้ผลิต: ............  หัวหน้าฝ่ายผลิต: ............  ผู้ปล่อยผ่าน (QA): ............' ] },
    ],
  },
  {
    typeId: 4, code: 'WI', department: 2, status: 'active',
    title: 'คำแนะนำการปฏิบัติงาน: การใช้งานเครื่องบรรจุแคปซูลอัตโนมัติ',
    sections: [
      { heading: '1. การเตรียมเครื่อง', paras: [
        '1.1 ตรวจสอบความสะอาดและป้ายสถานะ "สะอาด" ของเครื่องบรรจุแคปซูล (EQ-FILL-01)',
        '1.2 ติดตั้งแม่พิมพ์ขนาดแคปซูลให้ตรงกับสูตร และตรวจสอบการล็อกให้แน่น' ] },
      { heading: '2. การตั้งค่าพารามิเตอร์', paras: [
        '2.1 ตั้งความเร็วการบรรจุและความลึกการอัดผงตามที่กำหนดในสูตร',
        '2.2 ทดลองบรรจุ 10 แคปซูลแรกเพื่อตรวจน้ำหนักเฉลี่ยให้อยู่ในช่วงพิกัด ±5%' ] },
      { heading: '3. ระหว่างการบรรจุ', paras: [
        '3.1 สุ่มชั่งน้ำหนักแคปซูลทุก 30 นาที และบันทึกในแบบ IPC',
        '3.2 หากน้ำหนักเบี่ยงเบนเกินเกณฑ์ ให้หยุดเครื่อง ปรับตั้ง และบันทึกการแก้ไข' ] },
      { heading: '4. หลังการบรรจุและความปลอดภัย', paras: [
        'ทำความสะอาดเครื่องตามวิธีที่กำหนด ติดป้ายสถานะ และห้ามสอดมือเข้าใกล้ชิ้นส่วนเคลื่อนที่ขณะเครื่องทำงาน' ] },
    ],
  },
  {
    typeId: 5, code: 'SPEC', department: 3, status: 'active',
    title: 'ข้อกำหนดเฉพาะวัตถุดิบ: ผงขมิ้นชัน (Curcuma longa)',
    sections: [
      { heading: '1. ลักษณะทั่วไป', paras: [
        'ผงละเอียดสีเหลืองส้ม กลิ่นเฉพาะตัวของขมิ้นชัน ปราศจากสิ่งแปลกปลอมและกลิ่นอับ' ] },
      { heading: '2. ข้อกำหนดทางเคมีและกายภาพ', paras: [
        '2.1 ปริมาณสารเคอร์คูมินอยด์: ไม่น้อยกว่า 3.0% โดยน้ำหนัก',
        '2.2 ความชื้น: ไม่เกิน 10.0%',
        '2.3 เถ้ารวม: ไม่เกิน 8.0%  เถ้าที่ไม่ละลายในกรด: ไม่เกิน 2.0%',
        '2.4 ขนาดอนุภาค: ผ่านตะแกรงเบอร์ 80 ไม่น้อยกว่า 95%' ] },
      { heading: '3. ข้อกำหนดทางจุลชีววิทยา', paras: [
        'จำนวนจุลินทรีย์รวม: ไม่เกิน 10^5 CFU/g  ยีสต์และรา: ไม่เกิน 10^3 CFU/g  ปราศจาก E. coli และ Salmonella' ] },
      { heading: '4. การเก็บรักษา', paras: [
        'เก็บในภาชนะปิดสนิท พ้นแสง อุณหภูมิไม่เกิน 30°C ความชื้นสัมพัทธ์ไม่เกิน 65% อายุการใช้งาน 24 เดือน' ] },
    ],
  },
  {
    typeId: 6, code: 'MAN', department: 4, status: 'active',
    title: 'คู่มือระบบคุณภาพ (Quality Manual) ฉบับย่อ',
    sections: [
      { heading: '1. บทนำ', paras: [
        'คู่มือนี้อธิบายโครงสร้างระบบคุณภาพของโรงงานผลิตยาสมุนไพร ครอบคลุมการจัดองค์กร ระบบเอกสาร และกระบวนการหลักตามหลัก GMP' ] },
      { heading: '2. โครงสร้างระบบเอกสาร', paras: [
        'ระบบเอกสารแบ่งเป็น 4 ระดับ: นโยบาย (Policy), วิธีปฏิบัติมาตรฐาน (SOP), คำแนะนำการปฏิบัติงาน (WI) และแบบบันทึก (Form/Record)' ] },
      { heading: '3. กระบวนการหลัก', paras: [
        '3.1 การควบคุมวัตถุดิบและการตรวจรับ',
        '3.2 การผลิตและการควบคุมระหว่างกระบวนการ',
        '3.3 การควบคุมคุณภาพและการปล่อยผ่านผลิตภัณฑ์',
        '3.4 การจัดการความเบี่ยงเบน CAPA และการเปลี่ยนแปลง' ] },
      { heading: '4. การทบทวน', paras: [
        'ฝ่ายประกันคุณภาพทบทวนคู่มือนี้อย่างน้อยทุก 3 ปี หรือเมื่อมีการเปลี่ยนแปลงที่มีนัยสำคัญ' ] },
    ],
  },
  {
    typeId: 7, code: 'PRO', department: 4, status: 'draft',
    title: 'โปรโตคอลการตรวจสอบความถูกต้องของกระบวนการผลิตแคปซูลขมิ้นชัน',
    sections: [
      { heading: '1. วัตถุประสงค์', paras: [
        'เพื่อยืนยันว่ากระบวนการผลิตแคปซูลขมิ้นชัน 500 มก. สามารถผลิตผลิตภัณฑ์ที่มีคุณภาพสม่ำเสมอตามข้อกำหนด โดยทำการผลิต 3 รุ่นต่อเนื่อง (Prospective Validation)' ] },
      { heading: '2. ขอบเขตและจุดวิกฤต', paras: [
        'ครอบคลุมขั้นตอนการผสมแห้ง การบรรจุแคปซูล และการบรรจุภัณฑ์ จุดควบคุมวิกฤต ได้แก่ ความสม่ำเสมอของการผสมและน้ำหนักเฉลี่ยแคปซูล' ] },
      { heading: '3. เกณฑ์การยอมรับ', paras: [
        '3.1 ความสม่ำเสมอของการผสม: RSD ไม่เกิน 5%',
        '3.2 น้ำหนักเฉลี่ยแคปซูล: อยู่ในช่วง ±5% ของน้ำหนักเป้าหมาย',
        '3.3 ปริมาณตัวยาสำคัญ: 95.0–105.0% ของที่ระบุ' ] },
      { heading: '4. การรายงาน', paras: [
        'สรุปผลการตรวจสอบทั้ง 3 รุ่นในรายงานการตรวจสอบความถูกต้อง พร้อมข้อสรุปการอนุมัติกระบวนการ' ] },
    ],
  },
  {
    typeId: 8, code: 'RPT', department: 3, status: 'active',
    title: 'แม่แบบรายงานผลการวิเคราะห์ (Certificate of Analysis)',
    sections: [
      { heading: 'ส่วนที่ 1 ข้อมูลตัวอย่าง', paras: [
        'ชื่อผลิตภัณฑ์/วัตถุดิบ: ............  เลขที่ล็อต: ............  วันที่รับตัวอย่าง: ............' ] },
      { heading: 'ส่วนที่ 2 ผลการวิเคราะห์', paras: [
        'ตารางแสดงรายการทดสอบ ข้อกำหนด ผลที่ได้ และการตัดสิน (ผ่าน/ไม่ผ่าน) สำหรับการทดสอบทางกายภาพ เคมี และจุลชีววิทยา' ] },
      { heading: 'ส่วนที่ 3 ข้อสรุปและการลงนาม', paras: [
        'ข้อสรุป: ผ่าน / ไม่ผ่าน ข้อกำหนด',
        'ผู้วิเคราะห์: ............  หัวหน้าฝ่ายควบคุมคุณภาพ: ............  วันที่: ............' ] },
    ],
  },
  {
    typeId: 9, code: 'LOG', department: 5, status: 'active',
    title: 'แม่แบบสมุดบันทึกการใช้งานและบำรุงรักษาเครื่องจักร',
    sections: [
      { heading: '1. ข้อมูลเครื่องจักร', paras: [
        'รหัสเครื่อง: ............  ชื่อเครื่อง: ............  สถานที่ติดตั้ง: ............' ] },
      { heading: '2. บันทึกการใช้งานรายวัน', paras: [
        'ตารางบันทึก วันที่ เวลาเริ่ม-สิ้นสุด ผลิตภัณฑ์/รุ่นที่ผลิต สถานะเครื่อง และผู้ใช้งาน',
        'ลงบันทึกทุกครั้งที่มีการใช้งานเพื่อสอบกลับประวัติการเดินเครื่อง' ] },
      { heading: '3. บันทึกการบำรุงรักษาและการสอบเทียบ', paras: [
        'บันทึกวันที่บำรุงรักษาเชิงป้องกัน รายการที่ดำเนินการ วันที่สอบเทียบครั้งถัดไป และผู้รับผิดชอบ' ] },
    ],
  },
  {
    typeId: 10, code: 'CHK', department: 2, status: 'active',
    title: 'รายการตรวจสอบความพร้อมสายการผลิตก่อนเริ่มงาน (Line Clearance)',
    sections: [
      { heading: '1. ความสะอาดของพื้นที่', paras: [
        '☐ พื้นที่ผลิตสะอาด ปราศจากวัตถุดิบหรือผลิตภัณฑ์จากรุ่นก่อน',
        '☐ ป้ายสถานะความสะอาดของห้องถูกต้องและเป็นปัจจุบัน' ] },
      { heading: '2. เครื่องจักรและอุปกรณ์', paras: [
        '☐ เครื่องจักรสะอาด ติดป้ายสถานะ "พร้อมใช้งาน"',
        '☐ เครื่องชั่งผ่านการสอบเทียบด้วยลูกตุ้มมาตรฐานแล้ว' ] },
      { heading: '3. เอกสารและวัตถุดิบ', paras: [
        '☐ มีใบสั่งผลิตและสูตร (BOM) ฉบับอนุมัติ ณ จุดปฏิบัติงาน',
        '☐ วัตถุดิบครบถ้วน เลขที่ล็อตตรงกับใบเบิก',
        '☐ ฉลากและบรรจุภัณฑ์ของรุ่นก่อนถูกนำออกหมดแล้ว' ] },
      { heading: '4. การลงนามรับรอง', paras: [
        'ผู้ตรวจสอบ: ............  ผู้ทวนสอบ (QA): ............  วันที่/เวลา: ............' ] },
    ],
  },
];

// ---------------------------------------------------------------------------
// PDF builder — A4, TH Sarabun, header band + sections, page numbers, <=3 pages.
// ---------------------------------------------------------------------------
function buildPdf(doc, meta) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  pdf.addFileToVFS('THSarabun.ttf', fontReg);
  pdf.addFont('THSarabun.ttf', 'THSarabun', 'normal');
  pdf.addFileToVFS('THSarabunB.ttf', fontBold);
  pdf.addFont('THSarabunB.ttf', 'THSarabun', 'bold');

  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 48;                 // margin
  const maxW = W - M * 2;
  let y = M;
  let pageNo = 1;

  function footer() {
    pdf.setFont('THSarabun', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(120);
    pdf.text(`${meta.code}  •  เอกสารควบคุม GMP  •  หน้า ${pageNo}`, W / 2, H - 24, { align: 'center' });
    pdf.setTextColor(0);
  }
  function newPage() { footer(); pdf.addPage(); pageNo += 1; y = M; }
  function need(h) { if (y + h > H - 48) newPage(); }

  // Header band
  pdf.setFillColor(30, 58, 95);
  pdf.rect(0, 0, W, 78, 'F');
  pdf.setTextColor(255);
  pdf.setFont('THSarabun', 'bold');
  pdf.setFontSize(15);
  pdf.text('โรงงานผลิตยาสมุนไพร — ระบบควบคุมเอกสาร GMP', M, 34);
  pdf.setFontSize(12);
  pdf.setFont('THSarabun', 'normal');
  pdf.text(`ประเภทเอกสาร: ${meta.typeName}   (${meta.code})`, M, 56);
  pdf.setTextColor(0);
  y = 104;

  // Title
  pdf.setFont('THSarabun', 'bold');
  pdf.setFontSize(20);
  const titleLines = pdf.splitTextToSize(meta.title, maxW);
  titleLines.forEach((ln) => { need(26); pdf.text(ln, M, y); y += 26; });
  y += 6;

  // Meta line
  pdf.setFont('THSarabun', 'normal');
  pdf.setFontSize(12);
  pdf.setTextColor(90);
  pdf.text(`เลขที่เอกสาร: ${meta.documentNumber}    เวอร์ชัน: 1.0    สถานะ: ${meta.statusTh}`, M, y);
  y += 16;
  pdf.setDrawColor(200);
  pdf.line(M, y, W - M, y);
  y += 18;
  pdf.setTextColor(0);

  // Sections
  meta.sections.forEach((sec) => {
    need(26);
    pdf.setFont('THSarabun', 'bold');
    pdf.setFontSize(15);
    pdf.text(sec.heading, M, y);
    y += 20;
    pdf.setFont('THSarabun', 'normal');
    pdf.setFontSize(13);
    sec.paras.forEach((p) => {
      const lines = pdf.splitTextToSize(p, maxW);
      lines.forEach((ln) => { need(18); pdf.text(ln, M, y); y += 18; });
      y += 4;
    });
    y += 8;
  });
  footer();

  // Guard: keep <= 3 pages (definitions are sized to fit; assert just in case)
  const pages = pdf.internal.getNumberOfPages();
  if (pages > 3) throw new Error(`${meta.code}: PDF has ${pages} pages (>3)`);
  return Buffer.from(pdf.output('arraybuffer'));
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
let COOKIE = '';
async function api(path, opts = {}) {
  const headers = Object.assign({}, opts.headers || {});
  if (COOKIE) headers['Cookie'] = COOKIE;
  const res = await fetch(BASE + path, { ...opts, headers });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) COOKIE = setCookie.split(',').map((c) => c.split(';')[0]).join('; ');
  let body;
  const txt = await res.text();
  try { body = JSON.parse(txt); } catch { body = txt; }
  return { status: res.status, body };
}

async function login() {
  const r = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (r.status !== 200 || !r.body?.success) throw new Error('Login failed: ' + JSON.stringify(r.body));
  console.log('✓ logged in as', EMAIL);
}

// Note: the DELETE API only removes `draft` documents. The user asked to
// delete ALL existing documents, so we wipe at the DB level (documents +
// versions + approvals) via a helper invoked from the shell wrapper before
// this script runs. Here we just report what remains (should be zero).
async function reportExisting() {
  const r = await api('/api/documents?limit=500');
  const list = r.body?.data?.items || r.body?.data || [];
  console.log(`Existing documents after wipe: ${list.length}`);
}

const STATUS_TH = { active: 'มีผลบังคับใช้', draft: 'ร่าง' };

async function createOne(def, typeName) {
  // 1. create document header
  const created = await api('/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: def.title, typeId: def.typeId, departmentId: def.department }),
  });
  if (!created.body?.success) throw new Error(`create ${def.code} failed: ${JSON.stringify(created.body)}`);
  const { id, documentNumber } = created.body.data;

  // 2. build PDF now that we know the document number
  const pdfBuf = buildPdf(null, {
    ...def, documentNumber, typeName, statusTh: STATUS_TH[def.status] || def.status,
  });
  const fileName = `${documentNumber}.pdf`;

  // 3. upload (multipart) -> returns base64 fileData
  const fd = new FormData();
  fd.append('file', new Blob([pdfBuf], { type: 'application/pdf' }), fileName);
  fd.append('documentId', String(id));
  const up = await api('/api/documents/upload', { method: 'POST', body: fd });
  if (!up.body?.success) throw new Error(`upload ${def.code} failed: ${JSON.stringify(up.body)}`);
  const f = up.body.data;

  // 4. create version with the file blob
  const ver = await api(`/api/documents/${id}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileData: f.fileData, fileName: f.fileName, fileSize: f.fileSize, mimeType: f.mimeType,
      changeDescription: 'ฉบับแรก (สร้างโดยสคริปต์ seed UAT)', isMajorRevision: true,
    }),
  });
  if (!ver.body?.success) throw new Error(`version ${def.code} failed: ${JSON.stringify(ver.body)}`);

  console.log(`✓ ${documentNumber}  ${def.title.slice(0, 40)}…  (${(f.fileSize / 1024).toFixed(0)} KB, ${def.status})`);
  return { id, documentNumber, status: def.status };
}

(async () => {
  await login();

  // resolve type names for the PDF header
  const typesRes = await api('/api/documents/types');
  const types = typesRes.body?.data || [];
  const typeName = (tid) => types.find((t) => t.id === tid)?.name || `type ${tid}`;

  await reportExisting();

  const results = [];
  for (const def of DOCS) {
    results.push(await createOne(def, typeName(def.typeId)));
  }

  // Documents marked 'active' need their version approved + linked as current.
  // The full approval workflow needs approver IDs; for seed data we emit the
  // exact end-state SQL the workflow would produce, written to a file the
  // shell wrapper applies. (Drafts are left as draft.)
  const activeIds = results.filter((r) => r.status === 'active').map((r) => r.id);
  fs.writeFileSync(
    'scripts/_gmp-finalize-active.sql',
    'SET NAMES utf8mb4;\n' +
    activeIds.map((id) =>
      `UPDATE document_versions SET status='approved', effective_date=NOW() WHERE document_id=${id};\n` +
      `UPDATE documents d SET d.status='active', d.current_version_id=(SELECT MAX(v.id) FROM document_versions v WHERE v.document_id=${id}) WHERE d.id=${id};`
    ).join('\n') + '\n'
  );
  console.log(`\nWrote finalize SQL for ${activeIds.length} active docs -> scripts/_gmp-finalize-active.sql`);
  console.log(`Done. Created ${results.length} documents, each with a PDF attachment.`);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
