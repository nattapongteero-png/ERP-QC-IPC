/**
 * Seed demo data: 4 UAT work orders, each demonstrating one GMP-document
 * linkage combination on the SOP Execution screen.
 *
 * There are THREE independent document links surfaced on SOP execution:
 *   1. Template-level  -> sop_step_templates.gmp_document_id   (NEW column)
 *   2. Sub-step level   -> sop_template_steps.gmp_document_id   (existing)
 *   3. IPC level        -> ipc_criteria.gmp_document_id         (existing)
 *
 * Sub-step (2) and IPC (3) links are already seeded for the whole dataset by
 * scripts/link-gmp-docs-sop-ipc-uat.cjs. This script only sets the missing
 * template-level link (1) on the templates that are used by EXACTLY ONE of the
 * four demo work orders, so each WO cleanly shows its named combination.
 *
 * Demo mapping (templates 4 & 17 are each used by a single WO — verified):
 *   WO 20 (WO2606109427)  -> Template doc        : tmpl 17 SOP-OTHER-01 -> SOP-2606-0018 (doc 30)
 *   WO 21 (WO2606107057)  -> Sub-step doc only   : (no template doc added; sub-step docs already present)
 *   WO 16 (WO2606101005)  -> IPC doc             : (ipc_criteria.gmp_document_id already set; no template doc)
 *   WO 17 (WO2606108923)  -> Template + IPC doc  : tmpl 4 SOP-MILL-01 -> SOP-2606-0005 (doc 17) + existing IPC docs
 *
 * Idempotent: pure UPDATEs keyed by template_id. Safe to re-run.
 *
 * Run (writes SQL, applied by the shell wrapper or piped to mysql):
 *   node scripts/seed-sop-template-doc-demo-uat.cjs > scripts/_sop-template-doc-demo.sql
 */

// templateId -> documentId (documents.id). These document rows already exist in
// UAT (created by link-gmp-docs-sop-ipc-uat.cjs / seed-gmp-documents-uat.cjs).
const TEMPLATE_DOC_LINKS = [
  // WO 20 — Template-doc demo. SOP-OTHER-01 (tmpl 17) is used only by WO 20.
  { templateId: 17, documentId: 30, note: 'WO20 SOP-OTHER-01 -> SOP-2606-0018' },
  // WO 17 — Template + IPC demo. SOP-MILL-01 (tmpl 4) is used only by WO 17.
  { templateId: 4, documentId: 17, note: 'WO17 SOP-MILL-01 -> SOP-2606-0005 (Milling)' },
];

const lines = [];
lines.push('-- seed-sop-template-doc-demo-uat: template-level GMP doc links');
lines.push('SET NAMES utf8mb4;');
for (const l of TEMPLATE_DOC_LINKS) {
  lines.push(
    `UPDATE sop_step_templates SET gmp_document_id=${l.documentId} ` +
    `WHERE id=${l.templateId}; -- ${l.note}`,
  );
}
// Verification select (printed to stderr-friendly comment block)
lines.push('-- verify:');
lines.push(
  "SELECT id, code, name_th, gmp_document_id FROM sop_step_templates " +
  'WHERE id IN (4, 17) ORDER BY id;',
);

process.stdout.write(lines.join('\n') + '\n');
