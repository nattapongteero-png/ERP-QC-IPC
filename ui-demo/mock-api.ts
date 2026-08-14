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

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

export function installMockApi() {
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (url.includes('/api/documents')) {
      return json({ data: { documents: GMP_DOCUMENTS } });
    }
    // Saving is the one thing the demo cannot honour; say so rather than fail.
    if (url.includes('/api/master-data/ipc-criteria')) {
      if ((init?.method ?? 'GET').toUpperCase() !== 'GET') {
        return json({ success: true, data: { id: 999 } });
      }
      return json({ data: null });
    }
    return real(input as RequestInfo, init);
  };
}
