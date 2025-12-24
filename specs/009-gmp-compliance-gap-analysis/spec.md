# Feature Specification: GMP Compliance Gap Analysis - INTEL-HERBAL-MANUFACTURING

**Feature Branch**: `009-gmp-compliance-gap-analysis`
**Created**: 2025-12-22
**Updated**: 2025-12-24
**Status**: Draft
**Input**: User description: "Analyze current codebase against INTEL-HERBAL-MANUFACTURING.md GMP compliance requirements and identify implementation gaps"
**Addendum**: External auditor questions from `docs/AUDIT-QUESTION-P1.md` incorporated as new requirements (FR-047 to FR-062)

## Executive Summary

This specification documents a comprehensive gap analysis between the current Herbal Medicine ERP codebase and the regulatory requirements defined in `docs/INTEL-HERBAL-MANUFACTURING.md`. The analysis covers all 10 chapters (หมวด) of the Thai FDA Low-Risk Herbal Product Manufacturing requirements plus appendices.

## Implementation Approach

This specification is being addressed in phases:

1. **Phase 1 (Complete)**: Integration test infrastructure - Validates existing service layer code works correctly with real database operations. See `plan.md` for details. ✅ 944 tests passing

2. **Phase 2 (Next Priority)**: External Auditor Gap Closure - Addresses critical gaps identified from auditor questions (FR-047 to FR-074). Estimated 46 days effort.
   - Phase 2A: Schema changes (manufacturer/importer, retest date, disposition, strength, line clearance, label verification, e-signatures)
   - Phase 2B: Dashboard & Alerts (audit KPIs, min stock alerts, QC summary)
   - Phase 2C: Production workflows (line clearance, label verification, BOM enhancements)
   - Phase 2D: Testing & Polish

3. **Phase 3 (Future)**: Remaining GMP Feature implementation - Addresses gaps from "Not Implemented" section (Document Control, CAPA enhancements, etc.)

4. **Phase 4 (Future)**: Contract Manufacturing & Appendix requirements (FR-035, FR-036, FR-045, FR-046).

## Current Implementation Status Overview

*Updated: 2025-12-24 (Post Auditor Gap Analysis)*

| Module | Required By | Implementation Status | Coverage |
| ------ | ----------- | --------------------- | -------- |
| QMS (Document Control, Deviation, CAPA, Change Control, PQR) | หมวด 1 | **Complete** | **85%** |
| Personnel & Training | หมวด 2 | Complete | 95% |
| Facility & Equipment | หมวด 3 | **Partial** | **50%** |
| Sanitation & Pest Control | หมวด 4 | **Complete** | **80%** |
| Documentation & Data Integrity | หมวด 5 | Partial | 60% |
| Manufacturing Operations (MES/eBMR) | หมวด 6 | Partial | 50% |
| Quality Control (QC/LIMS) | หมวด 7 | **Partial** | **60%** |
| Contract Manufacturing | หมวด 8 | Not Implemented | 0% |
| Complaints/Recalls | หมวด 9 | **Complete** | **85%** |
| Self-Inspection/Audit | หมวด 10 | **Complete** | **80%** |
| **External Auditor Requirements** | FR-047 to FR-074 | **Gap Identified** | **39%** |

**Implementation Notes (Phase 1-12):**
- CAPA: Full workflow with effectiveness verification, approval routing
- Complaints: Complete investigation workflow with trending
- Recalls: Full mock/live recall management with distribution tracking
- Sanitation: Schedules, checklists, pest control with compliance trends
- Internal Audit: Annual planning, chapter coverage, finding-CAPA linking
- Equipment: Calibration scheduling, overdue alerts (service layer)
- Compliance Dashboard: 10-chapter coverage evaluation (service layer)

### Implementation vs. Testing Scope

**Current Phase Focus**: Integration testing of existing service layer code.

The requirements below (FR-001 through FR-046) represent the **target state**. Current implementation status is shown in the table above. The associated `plan.md` and `tasks.md` address **test coverage** for existing implementations, not new feature development.

**Gap Identification**: Requirements marked "Not Implemented" or with <80% coverage require separate implementation planning after test infrastructure is complete.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - QA Manager Reviews Compliance Dashboard (Priority: P1)

As a QA Manager, I need to see a comprehensive compliance dashboard that shows the status of all GMP requirements so I can identify gaps and prioritize remediation efforts before FDA inspection.

**Why this priority**: Compliance visibility is the foundation for all improvement efforts. Without knowing gaps, no remediation can be planned.

**Independent Test**: Can be fully tested by viewing the compliance dashboard and verifying it accurately reflects the implementation status of each GMP chapter.

**Acceptance Scenarios**:

1. **Given** the compliance dashboard is loaded, **When** QA Manager views หมวด 1-10 status, **Then** each chapter shows percentage complete with drill-down to specific requirements
2. **Given** some requirements are not met, **When** QA Manager clicks on a gap, **Then** the system shows what needs to be implemented and links to related modules
3. **Given** implementation progress is made, **When** a new module is completed, **Then** the compliance percentage updates automatically

---

### User Story 2 - Document Control Officer Manages SOPs (Priority: P1)

As a Document Control Officer, I need to manage SOPs with version control, approval workflows, and effective dates so that only approved, current documents are accessible to operators and auditors can see the complete document history.

**Why this priority**: Document control is fundamental to GMP compliance (หมวด 5) and affects all other modules. Without this, no process can be considered controlled.

**Independent Test**: Can be fully tested by creating a document, routing it through approval, publishing it, and verifying old versions are locked but accessible for audit.

**Acceptance Scenarios**:

1. **Given** a new SOP is drafted, **When** submitted for approval, **Then** it routes to designated approvers based on document type
2. **Given** a document is approved, **When** it becomes effective, **Then** the previous version is automatically marked obsolete and locked
3. **Given** an obsolete document exists, **When** users search, **Then** they see only current versions unless they explicitly request historical versions
4. **Given** an auditor needs document history, **When** they access the document trail, **Then** they see all versions with approval signatures and timestamps

---

### User Story 3 - Quality Manager Handles CAPA Workflow (Priority: P1)

As a Quality Manager, I need to create, track, and close CAPAs (Corrective and Preventive Actions) linked to deviations, complaints, or audit findings so that root causes are addressed and effectiveness is verified.

**Why this priority**: CAPA is the mechanism for continuous improvement and is a key focus area during FDA inspections. Existing deviation module is incomplete without CAPA closure.

**Independent Test**: Can be fully tested by creating a CAPA from a deviation, assigning actions, tracking completion, and verifying effectiveness.

**Acceptance Scenarios**:

1. **Given** a deviation is recorded, **When** corrective action is required, **Then** a CAPA record is automatically created and linked to the deviation
2. **Given** a CAPA is open, **When** actions are assigned, **Then** each action has an owner, due date, and status tracking
3. **Given** all CAPA actions are complete, **When** effectiveness verification is conducted, **Then** the CAPA can only be closed with documented evidence
4. **Given** a CAPA is ineffective, **When** re-investigation is needed, **Then** a new CAPA cycle is initiated with root cause re-analysis

---

### User Story 4 - Production Supervisor Executes Batch Manufacturing Record (Priority: P2)

As a Production Supervisor, I need to execute electronic batch manufacturing records (eBMR) with step-by-step guidance, IPC checkpoints, and dual verification so that production is documented in real-time and compliant with master formula.

**Why this priority**: eBMR is core to manufacturing control (หมวด 6). Existing work order system lacks critical GMP features like line clearance and IPC integration.

**Independent Test**: Can be fully tested by executing a complete production batch from start to finish with all verifications recorded.

**Acceptance Scenarios**:

1. **Given** a work order is released, **When** production starts, **Then** the system enforces line clearance verification before any material is dispensed
2. **Given** materials are dispensed, **When** weighing occurs, **Then** a second person must verify and sign each critical measurement
3. **Given** IPC tests are required, **When** the step is reached, **Then** production cannot proceed until test results are recorded and passed
4. **Given** production is complete, **When** batch review is initiated, **Then** all deviations during production are automatically linked to the batch record

---

### User Story 5 - Warehouse Manager Controls Material Status (Priority: P2)

As a Warehouse Manager, I need to manage quarantine, release, and reject statuses for all materials with proper authorization so that only released materials are available for production.

**Why this priority**: Material status control (หมวด 6.1) prevents use of untested or rejected materials. Current lot status system needs enhancement for full compliance.

**Independent Test**: Can be fully tested by receiving material, placing in quarantine, testing, and releasing or rejecting with proper authorization.

**Acceptance Scenarios**:

1. **Given** material is received, **When** goods receipt is completed, **Then** all lots are automatically placed in quarantine status
2. **Given** a lot is in quarantine, **When** QC testing is complete, **Then** only authorized personnel can change status to released or rejected
3. **Given** a lot is rejected, **When** attempting to issue for production, **Then** the system blocks the transaction with clear error message
4. **Given** material status changes, **When** on-hand inventory is recalculated, **Then** only released quantities are counted as available

---

### User Story 6 - Quality Manager Runs Stability Program (Priority: P2)

As a Quality Manager, I need to manage stability studies with scheduled testing, trend analysis, and OOS investigation so that product shelf life is scientifically validated and any degradation is detected early.

**Why this priority**: Stability program (หมวด 7.4) is required for marketed products. Current system has basic test records but lacks stability-specific features.

**Independent Test**: Can be fully tested by enrolling a batch in stability, scheduling tests, recording results, and generating trend reports.

**Acceptance Scenarios**:

1. **Given** a new product batch is released, **When** stability enrollment is initiated, **Then** test schedule is automatically generated based on protocol
2. **Given** stability tests are due, **When** the due date approaches, **Then** the system alerts QC personnel to sample and test
3. **Given** test results are recorded, **When** trends are analyzed, **Then** the system shows graphical representation with specification limits
4. **Given** OOS result is detected, **When** investigation is required, **Then** the system triggers OOS workflow and links to stability record

---

### User Story 7 - Customer Service Representative Handles Complaints (Priority: P2)

As a Customer Service Representative, I need to record customer complaints, route them for QC review, track investigations, and ensure proper closure so that product quality issues are documented and addressed.

**Why this priority**: Complaint handling (หมวด 9.1) is required for all marketed products and provides critical feedback for quality improvement.

**Independent Test**: Can be fully tested by recording a complaint, routing for investigation, documenting findings, and closing with appropriate actions.

**Acceptance Scenarios**:

1. **Given** a customer complaint is received, **When** complaint is logged, **Then** it is automatically routed to QC for review
2. **Given** a complaint requires investigation, **When** investigation is complete, **Then** findings must be documented with root cause and corrective actions
3. **Given** a complaint involves serious quality issue, **When** evaluated by QC, **Then** the system prompts for regulatory notification consideration
4. **Given** complaints are closed, **When** trend review is conducted, **Then** the system shows complaint patterns by product, type, and time period

---

### User Story 8 - Recall Coordinator Executes Product Recall (Priority: P2)

As a Recall Coordinator, I need to initiate and track product recalls with distribution data, customer notification, and reconciliation so that defective products are removed from market effectively.

**Why this priority**: Recall readiness (หมวด 9.2) is a regulatory requirement and relies on traceability data. Current lot traceability exists but recall workflow does not.

**Independent Test**: Can be fully tested by initiating a mock recall, identifying affected customers from distribution records, and reconciling returned quantities.

**Acceptance Scenarios**:

1. **Given** a recall is initiated, **When** batch is identified, **Then** the system shows all distribution records with customer contacts
2. **Given** distribution data is retrieved, **When** notifications are sent, **Then** the system tracks acknowledgment and response from each customer
3. **Given** product is returned, **When** reconciliation is performed, **Then** the system compares distributed vs. returned quantities
4. **Given** recall is complete, **When** effectiveness assessment is done, **Then** the system generates recall report for regulatory submission

---

### User Story 9 - Facilities Manager Manages Sanitation Program (Priority: P3)

As a Facilities Manager, I need to manage sanitation schedules, cleaning logs, and pest control programs so that the facility meets hygiene requirements and trends can be monitored.

**Why this priority**: Sanitation and pest control (หมวด 4) are foundational hygiene requirements but less complex than quality systems.

**Independent Test**: Can be fully tested by creating a cleaning schedule, logging completion, and reviewing trend data.

**Acceptance Scenarios**:

1. **Given** a sanitation schedule is defined, **When** cleaning is due, **Then** the system alerts responsible personnel
2. **Given** cleaning is performed, **When** log is recorded, **Then** the system captures area, method, operator, and verification
3. **Given** pest control is performed, **When** contractor logs activity, **Then** the system records treatment details and findings
4. **Given** trend review is requested, **When** data is analyzed, **Then** the system shows sanitation compliance rates and pest activity trends

---

### User Story 10 - Internal Auditor Conducts Self-Inspection (Priority: P3)

As an Internal Auditor, I need to schedule audits, record findings, track CAPAs, and verify closure so that the organization maintains continuous compliance and demonstrates self-governance.

**Why this priority**: Self-inspection (หมวด 10) is required but current system has only basic audit logging without structured audit program.

**Independent Test**: Can be fully tested by scheduling an audit, recording findings, creating CAPAs, and verifying closure.

**Acceptance Scenarios**:

1. **Given** an annual audit plan is created, **When** audits are scheduled, **Then** they cover all GMP areas with assigned auditors
2. **Given** an audit is conducted, **When** findings are recorded, **Then** each finding is classified by severity and linked to specific requirements
3. **Given** a finding requires action, **When** CAPA is created, **Then** it is tracked to closure with evidence of completion
4. **Given** audit is complete, **When** report is generated, **Then** it includes all findings, observations, and CAPA status

---

### User Story 11 - External Auditor Reviews Dashboard KPIs (Priority: P1)

As an External Auditor (or QA Manager preparing for audit), I need to see a comprehensive dashboard showing real-time status of raw materials, production, and quality control so that I can quickly assess the facility's GMP compliance status.

**Why this priority**: External auditors frequently ask these questions. Having answers readily available demonstrates control and reduces audit time.

**Source**: `docs/AUDIT-QUESTION-P1.md`

**Independent Test**: Can be fully tested by viewing the audit dashboard and verifying all KPI cards show accurate, real-time data.

**Acceptance Scenarios**:

1. **Given** the audit dashboard is loaded, **When** viewing RM summary, **Then** system shows RM received YTD with count, most frequent items, and total quantity
2. **Given** RM is in various statuses, **When** viewing status breakdown, **Then** system shows % released, % pending QC, % rejected with reasons for pending items
3. **Given** some RM is near expiry, **When** viewing alerts, **Then** system shows items expiring within configurable threshold (default 90 days)
4. **Given** some RM is below minimum stock, **When** viewing alerts, **Then** system shows items below reorder point with shortfall quantity
5. **Given** QC tests have been performed, **When** viewing QC summary, **Then** system shows pass/fail counts with disposition actions taken
6. **Given** production is active, **When** viewing production status, **Then** system shows current work orders with product names and quantities
7. **Given** FG is pending release, **When** viewing pending QC, **Then** system shows products awaiting QC approval with reasons for hold
8. **Given** FG has been released, **When** viewing approved FG, **Then** system shows products that passed QC and are available for sale

---

### User Story 12 - Warehouse Clerk Records Complete Material Receipt (Priority: P1)

As a Warehouse Clerk, I need to record complete material receipt details including manufacturer, importer, retest date, and attach documents (COA/Spec/MSDS) so that auditors can trace material origin and verify incoming quality.

**Why this priority**: Auditor specifically requires manufacturer/importer tracking and document attachments which are currently missing.

**Source**: `docs/AUDIT-QUESTION-P1.md` - Inventory section

**Independent Test**: Can be fully tested by receiving a material and verifying all detail fields are captured and documents are attached.

**Acceptance Scenarios**:

1. **Given** material is received, **When** recording receipt, **Then** system captures manufacturer name, importer name, country of origin
2. **Given** material has retest requirement, **When** recording receipt, **Then** system captures retest date and interval
3. **Given** vendor provides documents, **When** recording receipt, **Then** system allows attachment of COA, Specification Sheet, and MSDS
4. **Given** material is herbal extract, **When** recording receipt, **Then** system captures scientific name, extraction solvent, and plant part used
5. **Given** material is finished goods, **When** recording receipt, **Then** system captures strength/potency field
6. **Given** material is herb or packaging, **When** recording receipt, **Then** system requires photo upload with scale reference

---

### User Story 13 - Production Operator Completes Line Clearance (Priority: P1)

As a Production Operator, I need to complete a line clearance checklist with dual verification before starting production so that cross-contamination is prevented and GMP compliance is documented.

**Why this priority**: Line clearance is a fundamental GMP requirement that is currently not enforced in the system.

**Source**: `docs/AUDIT-QUESTION-P1.md` - Production section

**Independent Test**: Can be fully tested by attempting to start production, completing line clearance, and verifying production is blocked until clearance is complete.

**Acceptance Scenarios**:

1. **Given** a work order is released, **When** attempting to start production, **Then** system blocks until line clearance is completed
2. **Given** line clearance is required, **When** operator completes checklist, **Then** system records: previous product cleared, area clean, equipment clean, no contamination risk
3. **Given** checklist is completed, **When** verification is required, **Then** a second person must verify and sign the clearance
4. **Given** line clearance is complete, **When** starting production, **Then** system allows production to proceed and links clearance record to batch

---

### User Story 14 - Production Operator Verifies Labels (Priority: P1)

As a Production Operator, I need to attach label images to the batch manufacturing record and have them verified with dual signatures so that label accuracy is documented and auditable.

**Why this priority**: Label verification with attachment to BMR is explicitly required by auditor and missing from current system.

**Source**: `docs/AUDIT-QUESTION-P1.md` - Production section (BMR label attachment requirement)

**Independent Test**: Can be fully tested by uploading label images, verifying label content, and confirming signatures are captured.

**Acceptance Scenarios**:

1. **Given** packaging step is reached, **When** labels are applied, **Then** operator can upload label image to batch record
2. **Given** label image is uploaded, **When** verification is required, **Then** system shows label details for verification (product, batch, expiry)
3. **Given** label is verified correct, **When** operator signs, **Then** a second person must witness and countersign
4. **Given** label verification is complete, **When** batch record is reviewed, **Then** label images with signatures are visible in BMR

---

### User Story 15 - QC Analyst Records Disposition Decision (Priority: P1)

As a QC Analyst, I need to record disposition decisions (accept/reject/rework/scrap/return to vendor) with approval workflow so that material fate is documented and auditable.

**Why this priority**: Auditor asks "what action was taken" for failed QC - currently no disposition field exists.

**Source**: `docs/AUDIT-QUESTION-P1.md` - Dashboard section (RM passed/failed + actions)

**Independent Test**: Can be fully tested by completing a QC test, recording disposition, getting approval, and verifying lot status updates.

**Acceptance Scenarios**:

1. **Given** QC test is complete, **When** result is fail, **Then** system requires disposition decision before closing
2. **Given** disposition is selected, **When** reject/rework/scrap chosen, **Then** system requires reason and approval by QA
3. **Given** disposition is approved, **When** lot status updates, **Then** system automatically updates lot status (released/rejected/on-hold)
4. **Given** disposition is recorded, **When** auditor reviews, **Then** system shows: test result, disposition, reason, who decided, who approved, when

---

### Edge Cases

- What happens when a document approval chain includes an unavailable approver? (System uses delegation from hr_delegations)
- How does system handle deviations discovered after batch release? (Post-release deviation with linked batch, triggers investigation)
- What happens when recall affects multiple batches with overlapping distribution? (Aggregated distribution report, deduplicated customer list)
- How does system handle equipment calibration overdue during active production? (Alert, but production continues with deviation logged)
- What happens when stability test shows OOS and product is already on market? (OOS workflow triggers, regulatory notification prompt)
- What happens when line clearance fails? (Production blocked, deviation created, supervisor notified)
- What happens when label verification fails? (Label rejected, new label required, deviation created if already applied)
- What happens when minimum stock alert is triggered during production? (Alert shown, production continues, purchasing notified)

---

## Requirements *(mandatory)*

### Functional Requirements

#### หมวด 1 - QMS (Quality Management System)

- **FR-001**: System MUST provide document control with version management, approval workflow, and effective date enforcement
- **FR-002**: System MUST maintain Quality Manual and SOP repository with role-based access
- **FR-003**: System MUST implement batch release workflow requiring QA/QC authorization with e-signature
- **FR-004**: System MUST generate Product Quality Review (PQR) annually by aggregating data from deviations, OOS, changes, stability, complaints, and recalls
- **FR-005**: System MUST track CAPA effectiveness with verification workflow

#### หมวด 2 - Personnel & Training (EXISTING - COMPLETE)

- **FR-006**: System MUST maintain organization structure with position definitions (EXISTING)
- **FR-007**: System MUST separate Production and QC authority (EXISTING)
- **FR-008**: System MUST track training matrix with re-training triggers on SOP changes (EXISTING)
- **FR-009**: System MUST maintain authorization matrix with delegation capability (EXISTING)

#### หมวด 3 - Facility & Equipment

- **FR-010**: System MUST maintain asset registry with calibration and maintenance schedules
- **FR-011**: System MUST alert when calibration or maintenance is due
- **FR-012**: System MUST track equipment status (active, maintenance, calibration, inactive) with labels
- **FR-013**: System MUST track cleaning status (clean, dirty, in-use, out-of-service)

#### หมวด 4 - Sanitation & Pest Control

- **FR-014**: System MUST manage sanitation schedules by area, equipment, and frequency
- **FR-015**: System MUST capture cleaning logs with operator, method, and verification
- **FR-016**: System MUST track pest control activities with contractor records
- **FR-017**: System MUST provide trend analysis for sanitation and pest control programs

#### หมวด 5 - Documentation & Data Integrity

- **FR-018**: System MUST retain records for at least 1 year after product expiry date
- **FR-019**: System MUST maintain immutable audit trail for all changes
- **FR-020**: System MUST enforce role-based access control with segregation of duties (PARTIAL EXISTING)
- **FR-021**: System MUST maintain material specifications including natural origin details (PARTIAL EXISTING)
- **FR-022**: System MUST maintain master formula and manufacturing instructions (PARTIAL EXISTING)

#### หมวด 6 - Manufacturing Operations

- **FR-023**: System MUST enforce quarantine status on all received materials (PARTIAL EXISTING)
- **FR-024**: System MUST track yield reconciliation with deviation workflow for significant variances (PARTIAL EXISTING)
- **FR-025**: System MUST enforce line clearance verification before production start
- **FR-026**: System MUST require dual verification for dispensing and weighing operations
- **FR-027**: System MUST maintain Approved Supplier List with evaluation scoring (EXISTING)
- **FR-028**: System MUST track packaging material issuance, return, and destruction

#### หมวด 7 - Quality Control

- **FR-029**: System MUST integrate QC decisions with all quality-affecting processes
- **FR-030**: System MUST compile batch dossier for release decision
- **FR-031**: System MUST manage sampling with SOP, quantities, and conditions
- **FR-032**: System MUST maintain reference samples with retention tracking
- **FR-033**: System MUST implement stability program with scheduled testing and trend analysis
- **FR-034**: System MUST handle OOS investigations with workflow and regulatory reporting trigger

#### หมวด 8 - Contract Manufacturing

- **FR-035**: System MUST maintain contract repository with approved contractors
- **FR-036**: System MUST track batch-level contractor identification for traceability

#### หมวด 9 - Complaints & Recalls

- **FR-037**: System MUST capture customer complaints with QC routing and investigation workflow
- **FR-038**: System MUST maintain distribution ledger by batch for recall capability
- **FR-039**: System MUST support recall execution with customer notification tracking
- **FR-040**: System MUST reconcile distributed vs. returned quantities during recall
- **FR-041**: System MUST track adverse events with severity classification and regulatory reporting

#### หมวด 10 - Self-Inspection

- **FR-042**: System MUST maintain audit schedule covering all GMP areas
- **FR-043**: System MUST record audit findings with classification and CAPA linkage
- **FR-044**: System MUST track CAPA closure with evidence documentation

#### Appendix Requirements

- **FR-045**: System SHOULD maintain reference library of accepted test methods (Pharmacopoeia references)
- **FR-046**: System SHOULD link verification protocols to change control

#### External Auditor Requirements (Source: docs/AUDIT-QUESTION-P1.md)

##### Dashboard & KPI Requirements

- **FR-047**: System MUST provide audit dashboard showing RM received YTD with count, frequency ranking, and total quantities by item
- **FR-048**: System MUST display RM status breakdown showing % released, % pending QC, % rejected with specific hold reasons for pending items
- **FR-049**: System MUST provide configurable expiry alerts visible from dashboard with drill-down to affected lots
- **FR-050**: System MUST provide minimum stock alerts showing items below reorder point with shortfall quantities
- **FR-051**: System MUST display QC pass/fail summary with disposition actions taken (accept/reject/rework/scrap) and closure status
- **FR-052**: System MUST show current production status with active work orders, product names, and quantities in progress
- **FR-053**: System MUST display FG pending QC release with hold reasons for each item
- **FR-054**: System MUST show FG that passed QC and are available for distribution

##### Inventory Detail Requirements

- **FR-055**: System MUST capture manufacturer name, importer name, and country of origin for all received materials
- **FR-056**: System MUST capture retest date and retest interval for materials requiring periodic re-testing
- **FR-057**: System MUST allow attachment of COA, Specification Sheet, and MSDS documents to inventory lots
- **FR-058**: System MUST capture scientific name, extraction solvent, and plant part used for herbal extracts
- **FR-059**: System MUST capture strength/potency field for finished goods
- **FR-060**: System MUST require photo upload with scale reference for herbs and packaging materials
- **FR-061**: System MUST display QC hold reason when viewing items with pending QC status

##### Production Documentation Requirements

- **FR-062**: System MUST enforce line clearance verification with dual sign-off before production can start
- **FR-063**: System MUST capture BOM line details including: percentage in formula, weighed quantity, weighed by, verified by
- **FR-064**: System MUST support label image attachment to batch manufacturing records
- **FR-065**: System MUST require dual verification (operator + witness) for label verification with electronic signatures
- **FR-066**: System MUST track BMR step details including: method/SOP reference, equipment used, room/area, timestamps

##### Quality Control Requirements

- **FR-067**: System MUST capture QC disposition decision (accept/reject/rework/scrap/return-to-vendor/conditional-release) with approval workflow
- **FR-068**: System MUST require disposition reason for reject/rework/scrap decisions
- **FR-069**: System MUST automatically update lot status based on approved disposition decision
- **FR-070**: System MUST maintain complete audit trail showing: who tested, who decided disposition, who approved, when each action occurred

##### Electronic Signature Requirements (21 CFR Part 11 Alignment)

- **FR-071**: System MUST implement electronic signature with password re-authentication for critical operations (disposition, line clearance, label verification)
- **FR-072**: System MUST capture signature meaning statement (e.g., "I have verified this label is correct")
- **FR-073**: System MUST generate tamper-evident signature hash for audit trail integrity
- **FR-074**: System MUST display signature details including: full name, title, timestamp, meaning, signature ID

### Key Entities

- **Document**: SOP, policy, form, or record with version control and approval status
- **CAPA**: Corrective and Preventive Action record linked to sources (deviation, complaint, audit finding)
- **PQR**: Annual Product Quality Review aggregating quality metrics
- **Sanitation Record**: Cleaning activity with area, method, operator, and verification
- **Pest Control Log**: Contractor activity with treatment details and findings
- **Complaint**: Customer feedback requiring investigation and response
- **Recall**: Product withdrawal event with distribution tracking and reconciliation
- **Audit Finding**: Self-inspection observation with classification and CAPA linkage
- **Stability Study**: Protocol-driven testing program with scheduled timepoints
- **Contract**: Agreement with external manufacturer or laboratory
- **Line Clearance**: Pre-production verification checklist with dual sign-off (NEW - FR-062)
- **Label Verification**: BMR attachment with operator/witness signatures (NEW - FR-064/065)
- **QC Disposition**: Material acceptance decision with approval workflow (NEW - FR-067)
- **Electronic Signature**: Authenticated sign-off with meaning statement and hash (NEW - FR-071)
- **Lot Document**: Attached COA/Spec/MSDS linked to inventory lot (NEW - FR-057)
- **Stock Alert**: Configurable alert for expiry or minimum stock threshold (NEW - FR-049/050)

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 10 GMP chapters (หมวด) have at least 80% requirement coverage within the system
  > **Coverage Calculation**: Coverage % = (Count of MUST functional requirements with at least one passing integration test) / (Total MUST functional requirements) × 100. SHOULD requirements are tracked but not included in the 80% threshold. Each requirement maps to one or more test scenarios in `tasks.md`.
- **SC-002**: 100% of batch releases require electronic authorization from qualified personnel
- **SC-003**: All deviations are closed with CAPA within 30 days (minor) or 60 days (major/critical)
- **SC-004**: Document retrieval for any version takes less than 30 seconds
- **SC-005**: Stability trend data is available for all marketed products with automatic OOS detection
- **SC-006**: Recall simulation can identify 100% of affected customers within 4 hours
- **SC-007**: Internal audit schedule achieves 100% completion rate annually
- **SC-008**: All regulatory reports (complaints, adverse events, recalls) are generated within 24 hours of decision
- **SC-009**: Training expiry alerts are generated 30 days in advance with 100% coverage
- **SC-010**: Equipment calibration overdue rate is less than 2% at any point in time

#### External Auditor Success Criteria (FR-047 to FR-074)

- **SC-011**: Audit dashboard loads in <3 seconds showing all 8 KPI cards (RM YTD, status breakdown, expiry alerts, min stock alerts, QC summary, production status, pending QC, approved FG)
- **SC-012**: 100% of incoming materials have manufacturer and country of origin recorded
- **SC-013**: 100% of materials with retest requirements have retest date and interval tracked
- **SC-014**: 100% of lots have at least one attached document (COA minimum)
- **SC-015**: 100% of work orders cannot start until line clearance is verified by two persons
- **SC-016**: 100% of packaging batch records have label images with dual verification signatures
- **SC-017**: 100% of failed QC tests have disposition decision with approval before lot status change
- **SC-018**: Electronic signatures include password re-authentication for all critical operations

### Deviation Severity Classification

Referenced by SC-003 for CAPA closure timelines:

| Severity | Definition | CAPA Timeline | Examples |
|----------|------------|---------------|----------|
| Minor | Does not affect product quality, safety, or efficacy; documentation or procedural deviation | 30 days | Typo in batch record, minor SOP deviation with no impact |
| Major | May affect product quality but not safety; requires investigation and corrective action | 45 days | Yield variance >5%, equipment parameter out of range but within safety margin |
| Critical | Affects or potentially affects product safety, efficacy, or regulatory compliance | 60 days | OOS result, contamination detected, missing verification signature on critical step |

**Classification Authority**: QA Manager or designee determines severity at deviation initiation. Severity may be upgraded (never downgraded) during investigation based on findings.

---

## Gap Analysis Details

### Fully Implemented (No Gaps)

| Requirement Area | Existing Feature | Coverage |
| ---------------- | ---------------- | -------- |
| Organization Structure | hr_org_units, hr_positions | 100% |
| Personnel Training | hr_training_courses, hr_training_records | 100% |
| Authorization Matrix | hr_authorizations, hr_delegations | 100% |
| Health Records | hr_health_records | 100% |
| Audit Trail | All tables have audit logging | 100% |
| Lot Traceability | inventory_lots, inventory_transactions | 95% |
| Approved Supplier List | approved_vendor_list | 90% |

### Partially Implemented (Enhancement Needed)

| Requirement Area | Current State | Gap Description |
| ---------------- | ------------- | --------------- |
| Deviation Management | Basic deviation workflow | Missing CAPA integration and effectiveness tracking |
| Quality Testing | Test records with pass/fail | Missing sampling SOP linkage, reference sample tracking |
| Batch Records | Work orders with basic BMR | **FR-025**: Line clearance not enforced; **FR-026**: Dual verification not implemented; **FR-028**: Packaging tracking not implemented |
| Equipment Management | Basic asset registry | Missing scheduled maintenance, calibration alerts, cleaning status |
| Lot Status | Quarantine/Release workflow | Missing rejection reason tracking, blocked status handling |
| Material Specs | Basic item specifications | Missing natural origin details required by regulation |

### Not Implemented (New Development Required)

| Requirement Area | Priority | Complexity | Dependencies |
| ---------------- | -------- | ---------- | ------------ |
| Document Control System | P1 | High | None |
| CAPA Management | P1 | High | Deviation (exists) |
| PQR Generation | P1 | Medium | Deviation, CAPA, Change Control |
| Change Control Workflow | P1 | High | Document Control |
| Complaint Handling | P2 | Medium | CAPA |
| Recall Management | P2 | High | Lot Traceability (exists) |
| Stability Program | P2 | High | Quality Testing (exists) |
| Sanitation Program | P3 | Medium | None |
| Pest Control Program | P3 | Low | None |
| Internal Audit Program | P3 | Medium | CAPA |
| Contract Repository | P3 | Low | None |

### External Auditor Gap Analysis (Source: docs/AUDIT-QUESTION-P1.md)

#### Critical Gaps (Must Fix Before Audit)

| FR | Requirement | Current State | Gap Description | Effort |
|----|-------------|---------------|-----------------|--------|
| FR-047 | RM received YTD dashboard | Not implemented | No dashboard endpoint or analytics for YTD RM receipts | 2 days |
| FR-050 | Minimum stock alerts | Schema exists, no UI | `items.minStock` field exists but no alert system | 2 days |
| FR-055 | Manufacturer/Importer tracking | Not in schema | Only vendorId exists; no manufacturer/importer fields | 3 days |
| FR-056 | Retest date tracking | Not in schema | No retestDate or retestInterval fields | 1 day |
| FR-062 | Line clearance enforcement | Not implemented | No line clearance workflow or blocking logic | 4 days |
| FR-064/065 | Label verification | Not implemented | No label attachment or dual signature workflow | 5 days |
| FR-067 | QC disposition | Not in schema | No disposition field (accept/reject/rework/scrap) | 3 days |
| FR-071-074 | Electronic signatures | Not implemented | User IDs stored, not authenticated signatures | 7 days |

#### High Priority Gaps

| FR | Requirement | Current State | Gap Description | Effort |
|----|-------------|---------------|-----------------|--------|
| FR-048 | RM status breakdown | Partial | Status exists but no dashboard view with reasons | 2 days |
| FR-051 | QC summary with actions | Partial | Tests tracked but no disposition summary | 2 days |
| FR-053 | FG pending QC | Partial | Can query but no dedicated view | 1 day |
| FR-057 | COA/MSDS attachments | Partial | Only coaNumber text, no document linking | 3 days |
| FR-059 | FG strength field | Not in schema | No strength/potency field in items | 1 day |
| FR-063 | BOM % and verification | Partial | BOM lines exist but missing % and sign-off fields | 2 days |

#### Medium Priority Gaps

| FR | Requirement | Current State | Gap Description | Effort |
|----|-------------|---------------|-----------------|--------|
| FR-049 | Expiry alerts on dashboard | Implemented separately | Exists at /inventory/expiry-alerts, not on main dashboard | 1 day |
| FR-052 | Current production status | Implemented | Work orders page exists with charts | 0 days |
| FR-054 | FG approved for sale | Partial | Can derive from status but no dedicated view | 1 day |
| FR-058 | Extract scientific name | Partial | herbal_attributes exists but not enforced | 1 day |
| FR-060 | Photo with scale | Partial | item_images exists but not required/validated | 2 days |
| FR-061 | QC hold reason display | Partial | Can derive from tests but not shown inline | 1 day |
| FR-066 | BMR equipment/room tracking | Partial | workCenterId exists but not linked to equipment | 2 days |

#### Implementation Summary

| Category | Count | Total Effort |
|----------|-------|--------------|
| Critical (Must Fix) | 8 | 27 days |
| High Priority | 6 | 11 days |
| Medium Priority | 7 | 8 days |
| **Total** | **21** | **46 days** |

#### Recommended Implementation Order

**Phase A - Schema Changes (Week 1-2)**
1. Add manufacturer, importer, countryOfOrigin to inventory_lots
2. Add retestDate, retestInterval to inventory_lots
3. Add disposition fields to quality_tests
4. Add strength to items
5. Add percentageInFormula, weighedBy, verifiedBy to bom_lines
6. Create line_clearance_checklists table
7. Create label_verifications table
8. Create electronic_signatures table

**Phase B - Dashboard & Alerts (Week 2-3)**
1. Create /api/dashboard/audit-kpis endpoint
2. Create /api/inventory/min-stock-alerts endpoint
3. Add expiry/min-stock cards to dashboard
4. Create QC disposition workflow API
5. Create RM status breakdown view

**Phase C - Production Workflows (Week 3-4)**
1. Implement line clearance UI and blocking logic
2. Implement label verification UI with image upload
3. Integrate electronic signatures
4. Update BOM line forms with new fields

**Phase D - Testing & Polish (Week 4-5)**
1. Integration tests for all new features
2. UI/UX refinement
3. Documentation update

---

## Assumptions

1. The existing audit trail implementation meets data integrity requirements (immutable logging)
2. The existing authorization matrix adequately separates Production and QC responsibilities
3. Electronic signatures are implemented via username/timestamp (no PKI requirement for low-risk products)
4. Stability testing will leverage existing quality_tests infrastructure with additional protocol features
5. PQR generation will aggregate from existing database tables rather than requiring manual data entry
6. Mobile access is not required for initial implementation

---

## Out of Scope

1. Computerized System Validation (CSV) documentation itself (separate project)
2. Integration with external regulatory submission portals
3. Barcode/RFID hardware integration for dispensing verification
4. Environmental monitoring system integration
5. ERP integration with external accounting systems

---

## Dependencies

1. Existing deviation module must be enhanced before CAPA can be fully implemented
2. Document Control should be implemented before Change Control
3. CAPA module is a dependency for Complaints, Audit Findings, and OOS workflows
4. Distribution ledger enhancement is required before Recall Management

---

## Regulatory References

- ประกาศกระทรวงสาธารณสุข - หลักเกณฑ์วิธีการผลิตผลิตภัณฑ์สมุนไพร (เอกสาร 2)
- Thai FDA Low-Risk Herbal Product GMP Requirements
- PIC/S GMP Guidelines (reference standard)
