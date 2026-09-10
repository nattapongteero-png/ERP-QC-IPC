import FIXTURES from './data/wo-fixtures.json';

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
  { id: 1, code: 'FG-CAP-001', nameTh: 'ฟ้าทะลายโจรแคปซูล 400 mg', category: 'capsule', type: 'finished_goods' },
  { id: 2, code: 'FG-TAB-002', nameTh: 'ขมิ้นชันเม็ด 500 mg', category: 'tablet', type: 'finished_goods' },
  { id: 3, code: 'RM-HRB-010', nameTh: 'ผงฟ้าทะลายโจร', category: 'herb', type: 'raw_material' },
  { id: 4, code: 'FG-POW-004', nameTh: 'ผงขิงชงดื่ม', category: 'powder', type: 'finished_goods' },
  { id: 5, code: 'PK-BOT-020', nameTh: 'ขวดแก้วสีชา 100 ml', category: 'bottle', type: 'packaging' },
  { id: 6, code: 'CS-GLV-001', nameTh: 'ถุงมือไนไตรล์', category: 'ppe', type: 'consumable' },
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

/**
 * The SOP steps, as a copy the demo is allowed to change.
 *
 * Everything else here answers from a frozen capture, which is right for a
 * screen you only read. The SOP screen is one you *work*: start a step, record
 * it, have someone else verify it. Answering "ok" to those without moving
 * anything leaves the reviewer clicking a button that visibly does nothing, so
 * this one endpoint keeps state for the length of the visit. Reloading the page
 * puts it back to the captured run.
 */
const SOP_STEPS: Record<string, unknown>[] = JSON.parse(
  JSON.stringify((FIXTURES.sopExecution as { data: unknown[] }).data),
) as Record<string, unknown>[];

/** Who the demo is acting as. GMP forbids verifying your own work, so the
 *  demo carries two people and a switch — see main.tsx. */
export const DEMO_PEOPLE = [
  { id: 1, name: 'สมชาย ผลิตดี', role: 'ผู้ปฏิบัติงาน' },
  { id: 3, name: 'QC Manager', role: 'ผู้ตรวจสอบ' },
] as const;

let actingId: number = DEMO_PEOPLE[0].id;
const actingListeners = new Set<() => void>();
export function setDemoActor(id: number) {
  if (id === actingId) return;
  actingId = id;
  actingListeners.forEach((fn) => fn());
}
export function getDemoActor() {
  return DEMO_PEOPLE.find((p) => p.id === actingId) ?? DEMO_PEOPLE[0];
}
export function subscribeDemoActor(fn: () => void) {
  actingListeners.add(fn);
  return () => actingListeners.delete(fn);
}

const nowIso = () => new Date().toISOString();
let nextTestId = 9000;

function applySopAction(body: Record<string, unknown>, method: string) {
  const step = SOP_STEPS.find((s) => s.id === Number(body.executionId));
  if (!step) return { success: true, data: {} };
  const actor = getDemoActor();

  // PATCH is the verify call; it carries no action of its own.
  const action = method === 'PATCH' ? 'verify' : String(body.action ?? '');
  switch (action) {
    case 'start':
      step.status = 'in_progress';
      step.startedAt = nowIso();
      step.operatorId = actor.id;
      step.operatorName = actor.name;
      break;
    case 'complete':
      step.status = 'completed';
      step.isCompleted = true;
      step.completedAt = nowIso();
      step.operatorId = step.operatorId ?? actor.id;
      step.operatorName = step.operatorName ?? actor.name;
      if (body.actualParameters !== undefined) step.actualParameters = body.actualParameters;
      if (body.notes !== undefined) step.notes = body.notes;
      break;
    case 'verify':
      step.status = 'verified';
      step.verifiedAt = nowIso();
      step.verifierId = actor.id;
      step.verifierName = actor.name;
      break;
    case 'record_ipc': {
      // The screen will not let a step close until its IPC criteria carry a
      // result, so acknowledging this without recording anything leaves the
      // reviewer stuck at "ต้องกรอก IPC" with no way forward.
      //
      // The verdict is not invented: pass/fail criteria are read straight off
      // what was ticked, and a numeric one is judged against the min/max the
      // captured criterion already carries.
      const results = (body.ipcResults ?? []) as Array<{
        criteriaId: number;
        numericValues?: (number | null)[];
        sampleResults?: (string | null)[];
        textValue?: string;
      }>;
      const linked = (step.linkedIPC ?? []) as Record<string, unknown>[];
      for (const r of results) {
        const c = linked.find((l) => Number(l.criteriaId) === Number(r.criteriaId));
        if (!c) continue;
        const samples: Record<string, unknown>[] = [];
        let verdict: 'pass' | 'fail' = 'pass';
        const fail = () => { verdict = 'fail'; };

        if (r.sampleResults) {
          r.sampleResults.forEach((v, i) => {
            samples.push({ sampleNumber: i + 1, testRound: 1, numericValue: null, textValue: null, result: v });
            if (v === 'fail') fail();
          });
        } else if (r.numericValues) {
          const min = c.minValue as number | null;
          const max = c.maxValue as number | null;
          r.numericValues.forEach((v, i) => {
            const bad = v == null || (min != null && v < min) || (max != null && v > max);
            samples.push({ sampleNumber: i + 1, testRound: 1, numericValue: v, textValue: null, result: bad ? 'fail' : 'pass' });
            if (bad) fail();
          });
        } else if (r.textValue !== undefined) {
          samples.push({ sampleNumber: 1, testRound: 1, numericValue: null, textValue: r.textValue, result: 'pass' });
        }

        nextTestId += 1;
        c.recordedTestId = nextTestId;
        c.recordedStatus = verdict;
        c.recordedSamples = samples;
        c.recordedTestedByName = actor.name;
        c.recordedTestDate = nowIso();
      }
      break;
    }
    default:
      // add_ipc_round, confirm_substeps — acknowledged, not modelled.
      break;
  }
  return { success: true, data: step };
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

export function installMockApi() {
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    // The shell's own calls — a session so MainLayout renders, and an empty
    // notification list so the bell draws without a badge.
    if (url.includes('/api/auth/session')) {
      // Whoever the demo bar is currently acting as — the SOP screen compares
      // this id against a step's operator to enforce GMP dual control.
      const actor = getDemoActor();
      return json({
        success: true,
        data: {
          user: {
            id: actor.id,
            name: actor.name,
            email: actor.id === 3 ? 'qc@herbal-erp.com' : 'production@herbal-erp.com',
            role: 'admin',
          },
        },
      });
    }
    if (url.includes('/api/notifications')) {
      return json({ success: true, count: 0, items: [], data: { items: [] } });
    }
    /* ── QC entry ────────────────────────────────────────────────
       Same arrangement as the work order screens: the application's own
       pages, handed a frozen copy of what the server answered for five real
       QC samples. Writes are acknowledged so the screens stay responsive,
       but a static site has nowhere to keep them. */
    if (url.includes('/api/quality/qc-samples')) {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method !== 'GET') return json({ success: true, data: {} });
      const oos = url.match(/\/qc-samples\/(\d+)\/oos/);
      const byId = (map: unknown, id: string) => (map as Record<string, unknown>)?.[id];
      if (oos) return json(byId(FIXTURES.qcOosBySample, oos[1]) ?? { success: true, data: [] });
      const one = url.match(/\/qc-samples\/(\d+)/);
      if (one) return json(byId(FIXTURES.qcSampleById, one[1]) ?? { success: false, error: 'not found' });
      return json(FIXTURES.qcSamples);
    }
    if (url.includes('/api/quality/incoming-inspection/pending-qa')) {
      return json(FIXTURES.qcPendingQa ?? { items: [], total: 0 });
    }
    if (url.includes('/api/quality/coa')) {
      return json({ success: true, data: { items: [] } });
    }
    if (url.includes('/api/quality/oos')) {
      return json({ success: true, data: {} });
    }
    if (url.includes('/api/attachments')) {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method !== 'GET') return json({ success: true, data: {} });
      return json({ success: true, data: [] });
    }

    // One document — the SOP the operator opens from a step.
    const docHit = url.match(/\/api\/documents\/(\d+)/);
    if (docHit) {
      const doc = (FIXTURES.documentById as Record<string, unknown>)[docHit[1]];
      if (doc) return json(doc);
    }
    if (url.includes('/api/documents')) {
      // Real SOP documents, so the titles on the step cards are the ones the
      // work order actually references.
      const captured = FIXTURES.documents?.data?.documents;
      return json({ data: { documents: captured?.length ? captured : GMP_DOCUMENTS } });
    }

    /* ── Work order screens ──────────────────────────────────────────
       The SOP execution and IPC screens in this demo are the application's
       own pages, not replicas. They are handed a frozen copy of what the
       server answered for one real work order, so what a reviewer clicks
       through is the shipped screen against a shipped payload. Writes are
       acknowledged but not kept — a static demo has nowhere to keep them. */
    const woHit = url.match(/\/api\/production\/work-orders\/\d+\/([a-z-]+)/);
    if (woHit) {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method !== 'GET') {
        if (woHit[1] === 'sop-execution') {
          const sent = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
          return json(applySopAction(sent, method));
        }
        return json({ success: true, data: {} });
      }
      switch (woHit[1]) {
        case 'detail':
          return json(FIXTURES.detail);
        // Not the {success, data} envelope the others use — the banner reads
        // `materialIds` straight off the body, and crashes on the envelope.
        case 'blocked-phases':
          return json({ materialIds: [] });
        case 'execution-summary':
          return json(FIXTURES.executionSummary);
        case 'sop-execution':
          return json({ success: true, data: SOP_STEPS });
        case 'bom-config':
          return json(FIXTURES.bomConfig);
        case 'ipc':
          return json(
            url.includes('action=bom-config') ? FIXTURES.ipcBomConfig : FIXTURES.ipcTests,
          );
        default:
          return json({ success: true, data: [] });
      }
    }
    // Three lists the work order detail screen asks for on the way in. Nothing
    // in the eBMR document reads them, but an unanswered call falls through to
    // a real network request that a static host answers with its own 404 page —
    // so the screen would sit in its loading state.
    if (
      url.includes('/api/quality/deviations') ||
      url.includes('/api/quality/specs') ||
      url.includes('/api/inventory/lots')
    ) {
      return json({ success: true, data: [] });
    }

    // Two more the work order detail screen calls on its way in. Unanswered,
    // they reach the network and a static host returns its own 404 page.
    if (url.includes('/api/master-data/production-rooms')) {
      return json({ success: true, data: [] });
    }
    if (url.includes('/api/material-withdrawal/')) {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method !== 'GET') return json({ success: true, data: {} });
      return json({ success: true, data: { requests: [], total: 0 } });
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
      // Real panel rows when the capture has them — the demo's four hand-made
      // rows show far less than the screen actually holds.
      const captured = FIXTURES.qcTestPanels?.data?.items;
      return json({
        success: true,
        data: { items: captured?.length ? [...captured, ...TEST_PANELS] : TEST_PANELS },
      });
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
      // The work order screens read this list to label each criterion's linked
      // GMP document, so the captured rows go first.
      const captured = (FIXTURES.ipcCriteria?.data ?? []) as typeof CRITERIA;
      return json({ success: true, data: [...captured, ...CRITERIA, ...IPC_CRITERIA] });
    }
    return real(input as RequestInfo, init);
  };
}
