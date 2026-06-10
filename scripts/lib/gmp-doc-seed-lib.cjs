/**
 * Shared helpers for seeding GMP documents via the live app API, with
 * Thai-content PDF generation (jsPDF + embedded TH Sarabun).
 *
 * Exports: makeClient(base), buildPdf(meta), STATUS_TH
 * Used by:  seed-gmp-documents-uat.cjs, link-gmp-docs-sop-ipc-uat.cjs
 */
const fs = require('fs');
const { jsPDF } = require('jspdf');

const FONT_PATH = process.env.FONT_PATH || 'C:/Windows/Fonts/THSarabun.ttf';
const FONT_BOLD_PATH = process.env.FONT_BOLD_PATH || 'C:/Windows/Fonts/THSarabun Bold.ttf';
const fontReg = fs.readFileSync(FONT_PATH).toString('base64');
const fontBold = fs.readFileSync(FONT_BOLD_PATH).toString('base64');

const STATUS_TH = { active: 'มีผลบังคับใช้', draft: 'ร่าง' };

// meta: { code, typeName, title, documentNumber, statusTh, sections:[{heading,paras[]}] }
function buildPdf(meta) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  pdf.addFileToVFS('THSarabun.ttf', fontReg);
  pdf.addFont('THSarabun.ttf', 'THSarabun', 'normal');
  pdf.addFileToVFS('THSarabunB.ttf', fontBold);
  pdf.addFont('THSarabunB.ttf', 'THSarabun', 'bold');

  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 48;
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

  pdf.setFont('THSarabun', 'bold');
  pdf.setFontSize(19);
  pdf.splitTextToSize(meta.title, maxW).forEach((ln) => { need(25); pdf.text(ln, M, y); y += 25; });
  y += 6;

  pdf.setFont('THSarabun', 'normal');
  pdf.setFontSize(12);
  pdf.setTextColor(90);
  pdf.text(`เลขที่เอกสาร: ${meta.documentNumber}    เวอร์ชัน: 1.0    สถานะ: ${meta.statusTh}`, M, y);
  y += 16;
  pdf.setDrawColor(200);
  pdf.line(M, y, W - M, y);
  y += 18;
  pdf.setTextColor(0);

  meta.sections.forEach((sec) => {
    need(26);
    pdf.setFont('THSarabun', 'bold');
    pdf.setFontSize(15);
    pdf.text(sec.heading, M, y);
    y += 20;
    pdf.setFont('THSarabun', 'normal');
    pdf.setFontSize(13);
    sec.paras.forEach((p) => {
      pdf.splitTextToSize(p, maxW).forEach((ln) => { need(18); pdf.text(ln, M, y); y += 18; });
      y += 4;
    });
    y += 8;
  });
  footer();

  const pages = pdf.internal.getNumberOfPages();
  if (pages > 3) throw new Error(`${meta.code}: PDF has ${pages} pages (>3)`);
  return Buffer.from(pdf.output('arraybuffer'));
}

function makeClient(base, email, password) {
  let COOKIE = '';
  async function api(path, opts = {}) {
    const headers = Object.assign({}, opts.headers || {});
    if (COOKIE) headers['Cookie'] = COOKIE;
    const res = await fetch(base + path, { ...opts, headers });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) COOKIE = setCookie.split(',').map((c) => c.split(';')[0]).join('; ');
    const txt = await res.text();
    let body;
    try { body = JSON.parse(txt); } catch { body = txt; }
    return { status: res.status, body };
  }
  async function login() {
    const r = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (r.status !== 200 || !r.body?.success) throw new Error('Login failed: ' + JSON.stringify(r.body));
  }
  // Create a document + upload PDF + create approved/draft version.
  // def: { typeId, title, department, status, sections, typeName }
  async function createDocWithPdf(def) {
    const created = await api('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: def.title, typeId: def.typeId, departmentId: def.department }),
    });
    if (!created.body?.success) throw new Error(`create failed: ${JSON.stringify(created.body)}`);
    const { id, documentNumber } = created.body.data;

    const pdfBuf = buildPdf({
      code: def.code, typeName: def.typeName, title: def.title, documentNumber,
      statusTh: STATUS_TH[def.status] || def.status, sections: def.sections,
    });

    const fd = new FormData();
    fd.append('file', new Blob([pdfBuf], { type: 'application/pdf' }), `${documentNumber}.pdf`);
    fd.append('documentId', String(id));
    const up = await api('/api/documents/upload', { method: 'POST', body: fd });
    if (!up.body?.success) throw new Error(`upload failed: ${JSON.stringify(up.body)}`);
    const f = up.body.data;

    const ver = await api(`/api/documents/${id}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileData: f.fileData, fileName: f.fileName, fileSize: f.fileSize, mimeType: f.mimeType,
        changeDescription: 'ฉบับแรก (สร้างโดยสคริปต์ seed UAT)', isMajorRevision: true,
      }),
    });
    if (!ver.body?.success) throw new Error(`version failed: ${JSON.stringify(ver.body)}`);
    return { id, documentNumber, sizeKb: Math.round(f.fileSize / 1024) };
  }
  return { api, login, createDocWithPdf };
}

module.exports = { makeClient, buildPdf, STATUS_TH };
