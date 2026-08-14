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
const IPC_CRITERIA: { id: number; code: string; name: string; criteriaType: string }[] = [];
let nextCriteriaId = 900;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

export function installMockApi() {
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (url.includes('/api/documents')) {
      return json({ data: { documents: GMP_DOCUMENTS } });
    }
    if (url.includes('/api/master-data/ipc-criteria')) {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'POST') {
        const sent = JSON.parse(String(init?.body ?? '{}'));
        // A tare created from the Multi-Point section has to come back out of
        // the list, or the demo could not show it being linked.
        if (sent.criteriaType === 'tare') {
          const row = {
            id: (nextCriteriaId += 1),
            code: String(sent.code ?? ''),
            name: String(sent.name ?? ''),
            criteriaType: 'tare',
          };
          IPC_CRITERIA.push(row);
          return json({ success: true, data: row });
        }
        // Saving the criterion itself is the one thing the demo cannot honour.
        return json({ success: true, data: { id: 999 } });
      }
      if (method !== 'GET') return json({ success: true, data: { id: 999 } });
      return json({ success: true, data: IPC_CRITERIA });
    }
    return real(input as RequestInfo, init);
  };
}
