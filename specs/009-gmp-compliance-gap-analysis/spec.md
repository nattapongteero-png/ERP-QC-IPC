# Feature Specification: GMP Compliance Gap Analysis - INTEL-HERBAL-MANUFACTURING

**Feature Branch**: `009-gmp-compliance-gap-analysis`
**Created**: 2025-12-22
**Status**: Draft
**Input**: User description: "Analyze current codebase against INTEL-HERBAL-MANUFACTURING.md GMP compliance requirements and identify implementation gaps"

## Executive Summary

This specification documents a comprehensive gap analysis between the current Herbal Medicine ERP codebase and the regulatory requirements defined in `docs/INTEL-HERBAL-MANUFACTURING.md`. The analysis covers all 10 chapters (หมวด) of the Thai FDA Low-Risk Herbal Product Manufacturing requirements plus appendices.

## Current Implementation Status Overview

*Updated: 2025-12-24 (Post Phase 12 Verification)*

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

**Implementation Notes (Phase 1-12):**
- CAPA: Full workflow with effectiveness verification, approval routing
- Complaints: Complete investigation workflow with trending
- Recalls: Full mock/live recall management with distribution tracking
- Sanitation: Schedules, checklists, pest control with compliance trends
- Internal Audit: Annual planning, chapter coverage, finding-CAPA linking
- Equipment: Calibration scheduling, overdue alerts (service layer)
- Compliance Dashboard: 10-chapter coverage evaluation (service layer)

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

### Edge Cases

- What happens when a document approval chain includes an unavailable approver? (System uses delegation from hr_delegations)
- How does system handle deviations discovered after batch release? (Post-release deviation with linked batch, triggers investigation)
- What happens when recall affects multiple batches with overlapping distribution? (Aggregated distribution report, deduplicated customer list)
- How does system handle equipment calibration overdue during active production? (Alert, but production continues with deviation logged)
- What happens when stability test shows OOS and product is already on market? (OOS workflow triggers, regulatory notification prompt)

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
| Batch Records | Work orders with basic BMR | Missing line clearance, IPC enforcement, dual verification |
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
