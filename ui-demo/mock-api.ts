/**
 * Stand-in for the API the screen calls at runtime.
 *
 * The sample rows are shaped like the real payloads (`data.documents`, the
 * fields GmpDocumentSelect reads), so the components take the same paths they
 * would in the app — a demo that mocks the *shape* wrong tests nothing.
 */
const GMP_DOCUMENTS = [
  { id: 1, documentNumber: 'SOP-QC-001', title: 'วิธีทดสอบความแข็งของเม็ดยา', status: 'active', currentVersionId: 1 },
  { id: 2, documentNumber: 'SOP-QC-002', title: 'วิธีทดสอบความกร่อน (Friability)', status: 'active', currentVersionId: 2 },
  { id: 3, documentNumber: 'SOP-QC-014', title: 'การสุ่มตัวอย่างระหว่างการผลิต', status: 'active', currentVersionId: 3 },
  { id: 4, documentNumber: 'SOP-QC-021', title: 'การทดสอบการกระจายตัวของยาเม็ด', status: 'draft', currentVersionId: 4 },
  { id: 5, documentNumber: 'WI-QC-007', title: 'วิธีใช้เครื่องชั่งวิเคราะห์', status: 'active', currentVersionId: 5 },
];

/**
 * IPC criteria the screen reads back — only the tare rows matter, since that
 * is the one list the form fetches. It starts empty on purpose: the empty
 * state and the "create one here" flow are the part worth reviewing, and a
 * pre-filled list would hide both.
 */
const IPC_CRITERIA: {
  id: number; code: string; name: string; criteriaType: string;
  unit: string | null; specification: string | null;
}[] = [];
let nextCriteriaId = 900;

/** Products the test-panel screen offers, shaped like /api/items. */
const ITEMS = [
  { id: 1, code: 'FG-CAP-001', nameTh: 'ฟ้าทะลายโจรแคปซูล 400 mg', category: 'capsule' },
  { id: 2, code: 'FG-TAB-002', nameTh: 'ขมิ้นชันเม็ด 500 mg', category: 'tablet' },
  { id: 3, code: 'RM-HRB-010', nameTh: 'ผงฟ้าทะลายโจร', category: 'herb' },
  { id: 4, code: 'FG-POW-004', nameTh: 'ผงขิงชงดื่ม', category: 'powder' },
];

/**
 * Criteria the panel screen picks from. `specification` carries the stage the
 * screen filters on, and the two rows the filter is meant to drop — a tare
 * reference and an in-process criterion — are here so the filtering can be
 * seen working rather than taken on trust.
 */
const CRITERIA = [
  { id: 11, code: 'IPC-ID-004', name: 'Identification', nameTh: 'การพิสูจน์เอกลักษณ์', criteriaType: 'pass_fail', specification: '{"type":"pass_fail","stage":"raw_material"}' },
  { id: 12, code: 'IPC-MC-006', name: 'Moisture Content', nameTh: 'ความชื้น', criteriaType: 'numeric', specification: '{"type":"numeric","stage":"raw_material"}' },
  { id: 13, code: 'IPC-AP-003', name: 'Appearance', nameTh: 'ลักษณะภายนอก', criteriaType: 'visual', specification: '{"type":"visual","stage":"fg_release"}' },
  { id: 14, code: 'IPC-UD-005', name: 'Uniformity of Dosage Units', nameTh: 'ความสม่ำเสมอของขนาดยา', criteriaType: 'multi_point', specification: '{"type":"multi_point","stage":"fg_release"}' },
  { id: 15, code: 'IPC-MB-009', name: 'Microbial Limit', nameTh: 'ปริมาณเชื้อจุลินทรีย์', criteriaType: 'numeric', specification: '{"type":"numeric","stage":"fg_release"}' },
  // Dropped by the screen's filter — in-process criteria belong to the BOM.
  { id: 16, code: 'IPC-HD-002', name: 'Hardness Test', nameTh: 'ความแข็งของเม็ดยา', criteriaType: 'numeric', specification: '{"type":"numeric","stage":"ipc"}' },
  // Dropped too: a reference value, and an instrument check.
  { id: 17, code: 'IPC-TARE-01', name: 'Empty Capsule Tare', nameTh: 'น้ำหนักแคปซูลเปล่า', criteriaType: 'tare', specification: '{"type":"tare","stage":"ipc"}' },
  { id: 18, code: 'IPC-CAL-01', name: 'Balance Calibration', nameTh: 'เทียบสอบเครื่องชั่ง', criteriaType: 'calibration', specification: null },
];

/** Panel rows, mutated in place so adding one in the demo shows up in the list. */
const TEST_PANELS: Record<string, unknown>[] = [
  { id: 1, productId: 1, productCode: 'FG-CAP-001', productName: 'ฟ้าทะลายโจรแคปซูล 400 mg', productCategory: null, criteriaId: 13, criteriaCode: 'IPC-AP-003', criteriaName: 'Appearance', criteriaNameTh: 'ลักษณะภายนอก', isRequired: true, sequence: 1, isActive: true },
  { id: 2, productId: 1, productCode: 'FG-CAP-001', productName: 'ฟ้าทะลายโจรแคปซูล 400 mg', productCategory: null, criteriaId: 14, criteriaCode: 'IPC-UD-005', criteriaName: 'Uniformity of Dosage Units', criteriaNameTh: 'ความสม่ำเสมอของขนาดยา', isRequired: true, sequence: 2, isActive: true },
  { id: 3, productId: null, productCode: null, productName: null, productCategory: 'herb', criteriaId: 11, criteriaCode: 'IPC-ID-004', criteriaName: 'Identification', criteriaNameTh: 'การพิสูจน์เอกลักษณ์', isRequired: true, sequence: 1, isActive: true },
  { id: 4, productId: null, productCode: null, productName: null, productCategory: 'herb', criteriaId: 12, criteriaCode: 'IPC-MC-006', criteriaName: 'Moisture Content', criteriaNameTh: 'ความชื้น', isRequired: false, sequence: 2, isActive: false },
];
let nextPanelId = 100;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

export function installMockApi() {
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (url.includes('/api/documents')) {
      return json({ data: { documents: GMP_DOCUMENTS } });
    }
    if (url.includes('/api/quality/test-panels')) {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'POST') {
        const sent = JSON.parse(String(init?.body ?? '{}'));
        const c = CRITERIA.find((x) => x.id === Number(sent.criteriaId));
        const prod = ITEMS.find((x) => x.id === Number(sent.productId));
        TEST_PANELS.push({
          id: (nextPanelId += 1),
          productId: sent.productId ?? null,
          productCode: prod?.code ?? null,
          productName: prod?.nameTh ?? null,
          productCategory: sent.productCategory || null,
          criteriaId: sent.criteriaId,
          criteriaCode: c?.code ?? null,
          criteriaName: c?.name ?? null,
          criteriaNameTh: c?.nameTh ?? null,
          isRequired: sent.isRequired ?? true,
          sequence: sent.sequence ?? 1,
          isActive: sent.isActive ?? true,
        });
        return json({ success: true, data: { id: nextPanelId } });
      }
      if (method === 'DELETE') {
        const id = Number(new URL(url, location.href).searchParams.get('id'));
        const i = TEST_PANELS.findIndex((r) => r.id === id);
        if (i >= 0) TEST_PANELS.splice(i, 1);
        return json({ success: true });
      }
      if (method === 'PUT') return json({ success: true });
      return json({ success: true, data: { items: TEST_PANELS } });
    }
    if (url.includes('/api/items')) {
      return json({ success: true, data: { items: ITEMS } });
    }
    if (url.includes('/api/master-data/ipc-criteria')) {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'POST') {
        const sent = JSON.parse(String(init?.body ?? '{}'));
        // A tare created from the Multi-Point section has to come back out of
        // the list, or the demo could not show it being linked.
        if (sent.criteriaType === 'tare') {
          // Unit and specification are kept too: the Multi-Point section reads
          // them back to describe the tare it just linked.
          const row = {
            id: (nextCriteriaId += 1),
            code: String(sent.code ?? ''),
            name: String(sent.name ?? ''),
            criteriaType: 'tare',
            unit: sent.unit ?? null,
            specification: sent.specification ?? null,
          };
          IPC_CRITERIA.push(row);
          return json({ success: true, data: row });
        }
        // Saving the criterion itself is the one thing the demo cannot honour.
        return json({ success: true, data: { id: 999 } });
      }
      if (method !== 'GET') return json({ success: true, data: { id: 999 } });
      return json({ success: true, data: [...CRITERIA, ...IPC_CRITERIA] });
    }
    return real(input as RequestInfo, init);
  };
}
