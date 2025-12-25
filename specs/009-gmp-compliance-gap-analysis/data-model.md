# Data Model: GMP Compliance Gap Analysis

**Feature**: 009-gmp-compliance-gap-analysis
**Date**: 2025-12-22
**Database**: Drizzle ORM (SQLite for tests, MySQL for production)

## Entity Overview

| Module | New Tables | Relationships |
|--------|------------|---------------|
| Document Control | 3 | documents → document_versions → document_approvals |
| CAPA Management | 3 | capa → capa_actions → capa_effectiveness |
| Change Control | 2 | change_requests → change_approvals |
| Complaints | 2 | complaints → complaint_investigations |
| Recalls | 3 | recalls → recall_notifications → recall_reconciliation |
| Sanitation | 3 | sanitation_schedules, sanitation_logs, pest_control_logs |
| Stability | 4 | stability_protocols → stability_studies → stability_samples → (quality_tests) |
| Internal Audit | 3 | audit_plans → audits → audit_findings |
| Contracts | 2 | manufacturing_contracts, contract_batches |
| PQR | 2 | pqr_reports, pqr_metrics |

**Total**: 27 new tables

---

## Module 1: Document Control (หมวด 5)

### documents

Master document records (SOPs, policies, forms, work instructions).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | Unique identifier |
| documentNumber | text | unique, not null | Document ID (e.g., SOP-QA-001) |
| title | text | not null | Document title |
| typeId | integer | FK → document_types | SOP, Policy, Form, WI |
| departmentId | integer | FK → hr_org_units | Owning department |
| currentVersionId | integer | FK → document_versions | Active version |
| status | text | enum | draft, active, obsolete, archived |
| retentionYears | integer | default 7 | Record retention period |
| createdBy | integer | FK → users | |
| createdAt | text | timestamp | |
| updatedAt | text | timestamp | |

### document_versions

Version history for each document.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| documentId | integer | FK → documents | Parent document |
| versionNumber | text | not null | e.g., "1.0", "1.1", "2.0" |
| content | text | | Document content (markdown/HTML) |
| filePath | text | | Attached file path |
| changeDescription | text | | What changed in this version |
| status | text | enum | draft, pending_approval, approved, rejected, superseded |
| effectiveDate | text | | When this version becomes active |
| obsoleteDate | text | | When this version became obsolete |
| createdBy | integer | FK → users | |
| createdAt | text | timestamp | |

### document_approvals

Approval signatures for document versions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| versionId | integer | FK → document_versions | |
| approverId | integer | FK → users | Who needs to approve |
| approvalRole | text | | author, reviewer, approver |
| status | text | enum | pending, approved, rejected |
| comments | text | | Approval comments |
| signedAt | text | | Timestamp of signature |
| delegatedFrom | integer | FK → users | If approved via delegation |

### document_types

Document type master data.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| code | text | unique | SOP, POL, FORM, WI, SPEC |
| name | text | not null | Display name |
| prefix | text | | Document number prefix |
| approvalChain | text | JSON | Required approver roles |
| reviewPeriodMonths | integer | | Periodic review interval |

---

## Module 2: CAPA Management (หมวด 1)

### capa

Corrective and Preventive Action records.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| capaNumber | text | unique, not null | Auto-generated (CAPA-YYMM-####) |
| title | text | not null | Brief description |
| sourceType | text | enum | deviation, complaint, audit_finding, other |
| sourceId | integer | | FK to source table |
| deviationId | integer | FK → deviations | If source is deviation |
| complaintId | integer | FK → complaints | If source is complaint |
| auditFindingId | integer | FK → audit_findings | If source is audit |
| type | text | enum | corrective, preventive, both |
| priority | text | enum | low, medium, high, critical |
| status | text | enum | open, investigation, action_pending, verification, closed, cancelled |
| rootCauseAnalysis | text | | Investigation findings |
| rootCauseCategory | text | | 5-why category |
| dueDate | text | | Target completion date |
| closedDate | text | | Actual close date |
| ownerId | integer | FK → users | Responsible person |
| createdBy | integer | FK → users | |
| createdAt | text | timestamp | |
| updatedAt | text | timestamp | |

### capa_actions

Individual action items within a CAPA.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| capaId | integer | FK → capa | Parent CAPA |
| actionNumber | integer | | Sequence within CAPA |
| description | text | not null | Action to take |
| actionType | text | enum | immediate, corrective, preventive |
| assigneeId | integer | FK → users | Person responsible |
| dueDate | text | | Target date |
| status | text | enum | pending, in_progress, completed, overdue |
| completionNotes | text | | How action was completed |
| completedAt | text | | Actual completion |
| verifiedBy | integer | FK → users | Who verified |
| verifiedAt | text | | Verification timestamp |

### capa_effectiveness

Effectiveness verification records.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| capaId | integer | FK → capa | |
| checkNumber | integer | | 1, 2, 3... for multiple checks |
| checkDate | text | | When verification performed |
| verifierId | integer | FK → users | Who performed check |
| criteria | text | | What was evaluated |
| result | text | enum | effective, not_effective, partial |
| evidence | text | | Evidence/documentation |
| followUpRequired | integer | boolean | Needs additional action |
| notes | text | | |

---

## Module 3: Change Control (หมวด 1)

### change_requests

Change control records.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| changeNumber | text | unique | CC-YYMM-#### |
| title | text | not null | Brief description |
| changeType | text | enum | process, equipment, document, supplier, formula, other |
| description | text | | Detailed change description |
| justification | text | | Why change is needed |
| impactAssessment | text | | Areas/products affected |
| riskAssessment | text | | Risk evaluation |
| status | text | enum | draft, pending_review, approved, rejected, implemented, closed |
| priority | text | enum | low, medium, high, urgent |
| requesterId | integer | FK → users | |
| ownerId | integer | FK → users | Change owner |
| targetDate | text | | Planned implementation |
| implementedDate | text | | Actual implementation |
| createdAt | text | timestamp | |
| updatedAt | text | timestamp | |

### change_approvals

Approval signatures for change requests.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| changeId | integer | FK → change_requests | |
| approverId | integer | FK → users | |
| role | text | | qa, production, regulatory, management |
| status | text | enum | pending, approved, rejected |
| comments | text | | |
| signedAt | text | | |

---

## Module 4: Complaints (หมวด 9)

### complaints

Customer complaint records.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| complaintNumber | text | unique | COMP-YYMM-#### |
| receivedDate | text | not null | When complaint received |
| source | text | enum | customer, distributor, regulatory, internal |
| customerName | text | | Complainant name |
| customerContact | text | | Phone/email |
| productId | integer | FK → items | Product complained about |
| lotId | integer | FK → inventory_lots | Specific lot if known |
| category | text | enum | quality, efficacy, safety, packaging, labeling, other |
| severity | text | enum | minor, major, critical |
| description | text | not null | Complaint details |
| status | text | enum | received, under_investigation, resolved, closed |
| regulatoryReportRequired | integer | boolean | Needs FDA notification |
| regulatoryReportDate | text | | Date reported to FDA |
| capaId | integer | FK → capa | Linked CAPA if created |
| recallRequired | integer | boolean | Triggered recall |
| recallId | integer | FK → recalls | Linked recall |
| closedDate | text | | |
| closedBy | integer | FK → users | |
| createdBy | integer | FK → users | |
| createdAt | text | timestamp | |
| updatedAt | text | timestamp | |

### complaint_investigations

Investigation records for complaints.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| complaintId | integer | FK → complaints | |
| investigatorId | integer | FK → users | |
| startDate | text | | |
| completionDate | text | | |
| batchRecordReview | text | | Findings from BMR |
| retainSampleTest | text | | Results from reference sample |
| rootCause | text | | Determined cause |
| conclusion | text | | Investigation conclusion |
| recommendation | text | | Recommended actions |

---

## Module 5: Recalls (หมวด 9)

### recalls

Product recall records.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| recallNumber | text | unique | RCL-YYMM-#### |
| initiatedDate | text | not null | |
| recallClass | text | enum | class_i, class_ii, class_iii | FDA classification |
| reason | text | not null | Why recall initiated |
| productId | integer | FK → items | |
| affectedLots | text | JSON | Array of lot IDs |
| status | text | enum | initiated, in_progress, completed, closed |
| distributedQuantity | real | | Total distributed |
| returnedQuantity | real | | Total returned |
| reconciledQuantity | real | | Accounted for |
| effectivenessRate | real | | % reconciled |
| regulatoryReportDate | text | | Date reported to FDA |
| closureDate | text | | |
| coordinatorId | integer | FK → users | Recall coordinator |
| complaintId | integer | FK → complaints | Source complaint |
| createdBy | integer | FK → users | |
| createdAt | text | timestamp | |
| updatedAt | text | timestamp | |

### recall_notifications

Customer notification tracking.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| recallId | integer | FK → recalls | |
| customerId | integer | FK → customers | |
| customerName | text | | Denormalized for reporting |
| contactInfo | text | | Phone/email |
| quantityDistributed | real | | Qty sent to this customer |
| notificationMethod | text | enum | phone, email, fax, courier |
| notifiedAt | text | | When notified |
| acknowledgedAt | text | | When customer acknowledged |
| responseStatus | text | enum | pending, acknowledged, returning, returned, unresponsive |
| quantityReturned | real | | Qty returned by customer |
| notes | text | | |

### recall_reconciliation

Reconciliation of returned products.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| recallId | integer | FK → recalls | |
| lotId | integer | FK → inventory_lots | |
| distributedQty | real | | Total distributed |
| returnedQty | real | | Returned to warehouse |
| destroyedQty | real | | Destroyed in field |
| accountedQty | real | | Other accounted |
| unaccountedQty | real | | Cannot locate |
| reconciliationNotes | text | | |
| verifiedBy | integer | FK → users | |
| verifiedAt | text | | |

---

## Module 6: Sanitation (หมวด 4)

### sanitation_schedules

Recurring sanitation schedule definitions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| name | text | not null | Schedule name |
| areaType | text | enum | production, warehouse, lab, office |
| areaId | integer | | Specific room/area |
| equipmentId | integer | FK → equipment | If equipment-specific |
| frequency | text | enum | daily, weekly, monthly, quarterly |
| dayOfWeek | integer | | For weekly (0=Sun) |
| dayOfMonth | integer | | For monthly |
| method | text | | Cleaning method/SOP |
| verificationRequired | integer | boolean | Needs supervisor check |
| isActive | integer | boolean | |
| createdAt | text | timestamp | |

### sanitation_logs

Actual cleaning completion records.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| scheduleId | integer | FK → sanitation_schedules | |
| scheduledDate | text | | Expected date |
| performedDate | text | | Actual date |
| performedBy | integer | FK → users | Operator |
| method | text | | Method used |
| chemicalsUsed | text | | Cleaning agents |
| status | text | enum | completed, partial, missed |
| verifiedBy | integer | FK → users | Supervisor |
| verifiedAt | text | | |
| deviationId | integer | FK → deviations | If deviation raised |
| notes | text | | |
| createdAt | text | timestamp | |

### pest_control_logs

Pest control activity records.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| serviceDate | text | not null | |
| contractorName | text | | Pest control company |
| technicianName | text | | Who performed service |
| serviceType | text | enum | routine, emergency, follow_up |
| areasServiced | text | JSON | List of areas |
| treatmentMethod | text | | Chemicals/traps used |
| findingsCount | integer | | Pest activity level |
| findings | text | | Details of findings |
| recommendations | text | | Actions recommended |
| followUpRequired | integer | boolean | |
| followUpDate | text | | |
| verifiedBy | integer | FK → users | |
| createdAt | text | timestamp | |

---

## Module 7: Stability Program (หมวด 7)

### stability_protocols

Protocol templates for stability testing.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| protocolNumber | text | unique | STAB-PROT-### |
| name | text | not null | Protocol name |
| productId | integer | FK → items | Product type |
| studyType | text | enum | long_term, accelerated, intermediate |
| storageCondition | text | | e.g., "25°C/60%RH" |
| timepoints | text | JSON | [0, 1, 2, 3, 6, 9, 12, 18, 24, 36] months |
| testsRequired | text | JSON | Array of test spec IDs |
| status | text | enum | draft, approved, obsolete |
| approvedBy | integer | FK → users | |
| approvedAt | text | | |
| createdAt | text | timestamp | |

### stability_studies

Individual stability study instances.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| studyNumber | text | unique | STAB-YYMM-#### |
| protocolId | integer | FK → stability_protocols | |
| lotId | integer | FK → inventory_lots | Enrolled lot |
| startDate | text | not null | Study start |
| endDate | text | | Planned end |
| status | text | enum | active, completed, cancelled, on_hold |
| chamberLocation | text | | Storage chamber ID |
| notes | text | | |
| createdBy | integer | FK → users | |
| createdAt | text | timestamp | |

### stability_samples

Samples enrolled in stability study.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| studyId | integer | FK → stability_studies | |
| sampleNumber | text | | Unique sample ID |
| timepoint | integer | | Months from start |
| scheduledDate | text | | When testing due |
| actualDate | text | | When tested |
| status | text | enum | pending, sampled, tested, skipped |
| qualityTestId | integer | FK → quality_tests | Link to test results |
| oosDetected | integer | boolean | Out of spec |
| oosInvestigationId | integer | FK → deviations | OOS investigation |
| sampledBy | integer | FK → users | |
| notes | text | | |

### stability_trends

Pre-calculated trend data for visualization.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| studyId | integer | FK → stability_studies | |
| testParameter | text | | e.g., "Assay", "Dissolution" |
| dataPoints | text | JSON | [{month: 0, value: 100}, ...] |
| trendSlope | real | | Calculated degradation rate |
| projectedFailureMonth | integer | | When spec may fail |
| lastUpdated | text | timestamp | |

---

## Module 8: Internal Audit (หมวด 10)

### audit_plans

Annual audit planning.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| planYear | integer | not null | e.g., 2025 |
| name | text | | "2025 Annual GMP Audit Plan" |
| status | text | enum | draft, approved, in_progress, completed |
| approvedBy | integer | FK → users | |
| approvedAt | text | | |
| createdBy | integer | FK → users | |
| createdAt | text | timestamp | |

### audits

Individual audit events.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| auditNumber | text | unique | AUD-YYMM-#### |
| planId | integer | FK → audit_plans | |
| auditType | text | enum | internal, external, regulatory |
| scope | text | | Areas/processes covered |
| gmpChapters | text | JSON | Array of หมวด covered [1,2,3...] |
| scheduledDate | text | | Planned date |
| actualDate | text | | Conducted date |
| leadAuditorId | integer | FK → users | |
| auditTeam | text | JSON | Array of auditor user IDs |
| status | text | enum | scheduled, in_progress, completed, cancelled |
| summary | text | | Audit summary |
| reportPath | text | | Path to audit report |
| closedDate | text | | |
| createdAt | text | timestamp | |

### audit_findings

Findings from audits.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| auditId | integer | FK → audits | |
| findingNumber | text | | F-001, F-002 within audit |
| category | text | enum | observation, minor, major, critical |
| gmpChapter | integer | | หมวด reference (1-10) |
| gmpRequirement | text | | Specific requirement violated |
| description | text | not null | Finding description |
| evidence | text | | Supporting evidence |
| areaOwner | integer | FK → users | Responsible person |
| capaRequired | integer | boolean | Needs CAPA |
| capaId | integer | FK → capa | Linked CAPA |
| status | text | enum | open, capa_assigned, closed |
| closedDate | text | | |
| closedBy | integer | FK → users | |
| createdAt | text | timestamp | |

---

## Module 9: Contract Manufacturing (หมวด 8)

### manufacturing_contracts

Contract records with external manufacturers/labs.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| contractNumber | text | unique | |
| contractorName | text | not null | |
| contractorType | text | enum | manufacturer, laboratory, both |
| scope | text | | What's contracted |
| effectiveDate | text | | Contract start |
| expirationDate | text | | Contract end |
| status | text | enum | active, expired, terminated |
| qualityAgreementPath | text | | QA agreement document |
| lastAuditDate | text | | When last audited |
| nextAuditDue | text | | When next audit due |
| contactPerson | text | | |
| contactEmail | text | | |
| contactPhone | text | | |
| notes | text | | |
| createdAt | text | timestamp | |

### contract_batches

Batches performed by contractors.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| contractId | integer | FK → manufacturing_contracts | |
| lotId | integer | FK → inventory_lots | |
| activityType | text | enum | manufacturing, testing, packaging |
| activityDescription | text | | |
| performedDate | text | | |
| certificatePath | text | | COA/certificate path |
| verifiedBy | integer | FK → users | |
| createdAt | text | timestamp | |

---

## Module 10: PQR (หมวด 1)

### pqr_reports

Annual Product Quality Review reports.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| reportNumber | text | unique | PQR-YYYY-### |
| productId | integer | FK → items | |
| reviewYear | integer | not null | Year being reviewed |
| periodStart | text | | Review period start |
| periodEnd | text | | Review period end |
| status | text | enum | draft, under_review, approved |
| batchesProduced | integer | | Count of batches |
| deviationCount | integer | | Total deviations |
| capaCount | integer | | Total CAPAs |
| complaintCount | integer | | Total complaints |
| oosCount | integer | | Total OOS |
| recallCount | integer | | Total recalls |
| stabilityStatus | text | | Stability summary |
| conclusions | text | | Review conclusions |
| recommendations | text | | Actions for improvement |
| approvedBy | integer | FK → users | |
| approvedAt | text | | |
| createdBy | integer | FK → users | |
| createdAt | text | timestamp | |

### pqr_metrics

Detailed metrics for PQR (auto-calculated).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| pqrId | integer | FK → pqr_reports | |
| metricType | text | | deviation_rate, capa_closure, oosRate |
| metricValue | real | | Calculated value |
| target | real | | Target threshold |
| status | text | enum | pass, fail, warning |
| details | text | JSON | Supporting data |
| calculatedAt | text | timestamp | |

---

## Relationships Diagram

```
EXISTING                           NEW MODULES
─────────                          ───────────
deviations ─────────────────────→ capa
                                   ├── capa_actions
                                   └── capa_effectiveness

inventory_lots ─────────────────→ recalls
                                   ├── recall_notifications
                                   └── recall_reconciliation

quality_tests ←─────────────────── stability_samples
                                   ↑
                                   stability_studies
                                   ↑
                                   stability_protocols

users ──────────────────────────→ documents
                                   ├── document_versions
                                   └── document_approvals

complaints ──────────────────────→ capa
            └──────────────────→ recalls

audits ──────────────────────────→ audit_findings ──→ capa

items ───────────────────────────→ pqr_reports
```

## Indexes Required

```sql
-- Document Control
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_document_versions_document ON document_versions(documentId);
CREATE INDEX idx_document_versions_status ON document_versions(status);

-- CAPA
CREATE INDEX idx_capa_status ON capa(status);
CREATE INDEX idx_capa_source ON capa(sourceType, sourceId);
CREATE INDEX idx_capa_due_date ON capa(dueDate);
CREATE INDEX idx_capa_actions_capa ON capa_actions(capaId);
CREATE INDEX idx_capa_actions_status ON capa_actions(status);

-- Complaints/Recalls
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_product ON complaints(productId);
CREATE INDEX idx_recalls_status ON recalls(status);
CREATE INDEX idx_recall_notifications_recall ON recall_notifications(recallId);

-- Sanitation
CREATE INDEX idx_sanitation_schedules_active ON sanitation_schedules(isActive);
CREATE INDEX idx_sanitation_logs_date ON sanitation_logs(scheduledDate);

-- Stability
CREATE INDEX idx_stability_studies_status ON stability_studies(status);
CREATE INDEX idx_stability_samples_study ON stability_samples(studyId);
CREATE INDEX idx_stability_samples_status ON stability_samples(status);

-- Audits
CREATE INDEX idx_audits_status ON audits(status);
CREATE INDEX idx_audit_findings_audit ON audit_findings(auditId);
CREATE INDEX idx_audit_findings_status ON audit_findings(status);
```

## Migration Notes

1. Add foreign keys after base tables created
2. Seed document_types with standard types (SOP, POL, FORM, WI, SPEC)
3. Seed stability protocol templates for common products
4. Run stability trend calculation as background job

---

# Phase 2: External Auditor Requirements (FR-047 to FR-074)

**Added**: 2025-12-24
**Purpose**: Schema additions to address auditor questions from `docs/AUDIT-QUESTION-P1.md`

## Column Additions to Existing Tables

### inventory_lots (Additional Columns)

| Field | Type | Constraints | Description | FR Reference |
|-------|------|-------------|-------------|--------------|
| manufacturerName | text | | Manufacturer name (free text) | FR-055 |
| manufacturerId | integer | FK → vendors | Optional link to vendor record | FR-055 |
| importerName | text | | Importer name (free text) | FR-055 |
| importerId | integer | FK → vendors | Optional link to vendor record | FR-055 |
| countryOfOrigin | text | | ISO country code or name | FR-055 |
| retestDate | text | | Next retest due date | FR-056 |
| retestIntervalMonths | integer | | Recurrence interval | FR-056 |
| lastRetestDate | text | | When last retested | FR-056 |
| retestStatus | text | enum | not_required, pending, scheduled, completed, overdue | FR-056 |

### items (Additional Columns)

| Field | Type | Constraints | Description | FR Reference |
|-------|------|-------------|-------------|--------------|
| strength | text | | Potency/concentration for FG | FR-059 |

### quality_tests (Additional Columns)

| Field | Type | Constraints | Description | FR Reference |
|-------|------|-------------|-------------|--------------|
| disposition | text | enum | pending, accept, reject, rework, scrap, return_to_vendor, conditional_release | FR-067 |
| dispositionBy | integer | FK → users | Who decided disposition | FR-067 |
| dispositionAt | text | timestamp | When disposition decided | FR-067 |
| dispositionReason | text | | Reason for non-accept disposition | FR-068 |
| dispositionApprovedBy | integer | FK → users | Who approved disposition | FR-067 |
| dispositionApprovedAt | text | timestamp | When approved | FR-067 |

### bom_lines (Additional Columns)

| Field | Type | Constraints | Description | FR Reference |
|-------|------|-------------|-------------|--------------|
| percentageInFormula | real | | % of total formula | FR-063 |
| weighedQty | real | | Actual quantity weighed | FR-063 |
| weighedBy | integer | FK → users | Who weighed | FR-063 |
| verifiedBy | integer | FK → users | Who verified weighing | FR-063 |
| verifiedAt | text | timestamp | Verification timestamp | FR-063 |

### work_orders (Additional Columns)

| Field | Type | Constraints | Description | FR Reference |
|-------|------|-------------|-------------|--------------|
| lineClearanceRequired | integer | boolean | Whether line clearance needed | FR-062 |
| lineClearanceStatus | text | enum | pending, cleared, failed | FR-062 |
| lineClearanceBy | integer | FK → users | Who verified line clearance | FR-062 |
| lineClearanceAt | text | timestamp | When cleared | FR-062 |
| lineClearanceChecklistId | integer | FK → line_clearance_checklists | Link to checklist | FR-062 |

---

## New Tables (Phase 2)

### line_clearance_checklists

Pre-production line clearance verification records.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| workOrderId | integer | FK → work_orders | Associated work order |
| checklistItems | text | JSON | Array of {code, label, checked, checkedBy, checkedAt} |
| previousProductCleared | integer | boolean | Previous product/materials removed |
| areaClean | integer | boolean | Production area cleaned |
| equipmentClean | integer | boolean | Equipment cleaned and verified |
| noContaminationRisk | integer | boolean | No contamination risk identified |
| labelsRemoved | integer | boolean | Previous batch labels removed |
| docsReady | integer | boolean | Batch documentation ready |
| performedBy | integer | FK → users | Operator who completed |
| performedAt | text | timestamp | When completed |
| verifiedBy | integer | FK → users | Verifier who approved |
| verifiedAt | text | timestamp | When verified |
| verifierSignatureId | integer | FK → electronic_signatures | E-signature reference |
| status | text | enum | pending, completed, rejected |
| notes | text | | Additional notes |
| createdAt | text | timestamp | |

### label_verifications

BMR label attachment and verification records. Label images are stored using the existing `attachments` table with `moduleName='label_verification'`.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| workOrderId | integer | FK → work_orders | Associated work order |
| batchRecordId | integer | FK → batch_records | Associated batch record step |
| labelType | text | enum | product_label, batch_label, carton_label, shipper_label |
| productName | text | | Verified product name on label |
| batchNumber | text | | Verified batch number on label |
| expiryDate | text | | Verified expiry date on label |
| isCorrect | integer | boolean | Whether label content is correct |
| operatorId | integer | FK → users | Operator who uploaded/verified |
| operatorSignatureId | integer | FK → electronic_signatures | Operator e-signature |
| witnessId | integer | FK → users | Witness who countersigned |
| witnessSignatureId | integer | FK → electronic_signatures | Witness e-signature |
| status | text | enum | pending, verified, rejected |
| rejectionReason | text | | Reason if rejected |
| createdAt | text | timestamp | |
| verifiedAt | text | timestamp | |

**Note**: Label images are stored in the existing `attachments` table (BLOB storage) using `moduleName='label_verification'` and `entityId=labelVerificationId`. Use the reusable `DocumentAttachment` component for upload/display.

### electronic_signatures

21 CFR Part 11 compliant electronic signature records.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| entityType | text | not null | line_clearance, label_verification, disposition, document, capa |
| entityId | integer | not null | ID of the signed entity |
| action | text | not null | perform, verify, approve, witness, reject |
| userId | integer | FK → users, not null | Who signed |
| username | text | not null | Username captured at sign time |
| fullName | text | not null | Full name captured at sign time |
| title | text | | Job title at sign time |
| signedAt | text | not null | ISO timestamp of signature |
| meaning | text | not null | Statement of meaning (e.g., "I verify this label is correct") |
| passwordVerified | integer | boolean, not null | Whether password was verified |
| signatureHash | text | not null | SHA-256(entityType|entityId|action|userId|signedAt) |
| ipAddress | text | | IP address of signer |
| userAgent | text | | Browser/client info |
| createdAt | text | timestamp | |

**Indexes**:
```sql
CREATE INDEX idx_esig_entity ON electronic_signatures(entityType, entityId);
CREATE INDEX idx_esig_user ON electronic_signatures(userId);
CREATE INDEX idx_esig_signed_at ON electronic_signatures(signedAt);
```

### Lot Documents (Using Existing attachments Table)

Documents attached to inventory lots (COA, Spec, MSDS) use the **existing `attachments` table** with BLOB storage.

**Storage Pattern**:
- `moduleName`: `'inventory_lot'`
- `entityId`: The lot ID
- `category`: `'coa'` | `'specification'` | `'msds'` | `'photo'`

**Existing attachments Table Structure** (already in schema):
| Field | Type | Description |
|-------|------|-------------|
| id | integer | PK, auto |
| moduleName | text | `'inventory_lot'` for lot documents |
| entityId | integer | Lot ID |
| category | text | Document type (coa, specification, msds, photo) |
| fileName | text | Original file name |
| fileData | blob | File content (LONGBLOB in MySQL) |
| fileSize | integer | File size in bytes |
| mimeType | text | File MIME type |
| uploadedBy | integer | FK → users |
| createdAt | timestamp | |

**UI Component**: Use the reusable `DocumentAttachment` component:
```tsx
<DocumentAttachment
  moduleName="inventory_lot"
  entityId={lotId}
  title="Lot Documents"
  categories={['coa', 'specification', 'msds', 'photo']}
/>
```

**No new table required** - This approach reuses existing infrastructure for consistency.

### stock_alert_rules

Configurable alert thresholds for inventory monitoring.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | integer | PK, auto | |
| itemId | integer | FK → items | Item-specific rule (null for global) |
| alertType | text | enum | expiry, min_stock, retest |
| thresholdDays | integer | | Days before event for alert |
| thresholdQty | real | | Quantity threshold for stock |
| notifyRoles | text | JSON | Array of role names to notify |
| isActive | integer | boolean | Whether rule is active |
| createdBy | integer | FK → users | |
| createdAt | text | timestamp | |
| updatedAt | text | timestamp | |

---

## Relationships Diagram (Phase 2 Additions)

```
EXISTING                           PHASE 2 ADDITIONS
─────────                          ─────────────────

work_orders ─────────────────────→ line_clearance_checklists
     │                                    │
     └────────────────────────────→ label_verifications
                                          │
                                          ↓
                                   electronic_signatures ←─── quality_tests (disposition)

inventory_lots ───────────────────→ attachments (moduleName='inventory_lot')
                                   (existing table, no new table needed)

label_verifications ──────────────→ attachments (moduleName='label_verification')
                                   (for label images, using existing BLOB storage)

items ────────────────────────────→ stock_alert_rules
```

---

## Phase 2 Indexes

```sql
-- Line Clearance
CREATE INDEX idx_line_clearance_wo ON line_clearance_checklists(workOrderId);
CREATE INDEX idx_line_clearance_status ON line_clearance_checklists(status);

-- Label Verification
CREATE INDEX idx_label_verify_wo ON label_verifications(workOrderId);
CREATE INDEX idx_label_verify_status ON label_verifications(status);

-- Electronic Signatures (see above)

-- Attachments (existing table - ensure these indexes exist)
-- Note: These may already exist in the base schema
CREATE INDEX IF NOT EXISTS idx_attachments_module_entity ON attachments(moduleName, entityId);

-- Stock Alerts
CREATE INDEX idx_stock_alerts_item ON stock_alert_rules(itemId);
CREATE INDEX idx_stock_alerts_type ON stock_alert_rules(alertType);

-- Disposition on quality_tests
CREATE INDEX idx_quality_tests_disposition ON quality_tests(disposition);

-- Retest on inventory_lots
CREATE INDEX idx_inventory_lots_retest ON inventory_lots(retestDate, retestStatus);
```

---

## Phase 2 Migration Notes

1. **inventory_lots columns**: Add columns with NULL default, backfill not required
2. **items.strength**: Add column with NULL default
3. **quality_tests columns**: Add disposition columns with 'pending' default
4. **bom_lines columns**: Add columns with NULL default (historical records won't have verification)
5. **work_orders columns**: Add lineClearance columns, existing WOs default to not required
6. **New tables**: Create in order: electronic_signatures first (referenced by others), then line_clearance_checklists, label_verifications, stock_alert_rules
7. **Seed data**: Add default stock_alert_rules for common thresholds (90 days expiry, 30 days retest)
8. **No lot_documents table needed**: Use existing `attachments` table with `moduleName='inventory_lot'`
9. **No filesystem storage**: All files stored as BLOB in `attachments.fileData` column
10. **Label images**: Use existing `attachments` table with `moduleName='label_verification'`
