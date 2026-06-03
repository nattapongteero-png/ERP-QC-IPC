# Feature Specification: Goods Receipt & Incoming Inspection

**Feature Branch**: `020-goods-receipt`
**Created**: 2026-06-02
**Status**: Draft
**Input**: Unified goods receipt + incoming inspection workflow covering raw materials (from PO) and finished goods (from production WO), with GRN auto-numbering, category-specific checklists, auto-linked QC samples, triple independence, e-signature, and a quarantine gate before releasing stock for use.

---

## Background & Problem Statement

The current system records goods entering the warehouse in two disconnected places:

- **Raw materials** arrive via the Purchase Order receive action — lots land in `quarantine` status, but the receiver does not run a structured checklist (COA check, label match, condition, weight) and the resulting QC sample is registered manually in a separate screen later.
- **Finished goods** are recorded on the Production Output page — also into quarantine — but again no formal receipt document, no checklist, no auto-link to a QC sample.

As a result:
1. There is **no unified "pending receipt" view** for the warehouse + QA team — supervisors don't know what is waiting.
2. There is **no formal Goods Receipt Note (GRN) document** with a stable number that compliance auditors expect (PIC/S Annex 1 §5; 21 CFR 211.84).
3. **Incoming inspection is informal** — operators may forget to verify the COA or to register a QC sample, so a lot may be released without proper testing.
4. **Receiver and QA roles are not separated by the system** — the same user can record the receipt AND release it to stock, which violates GMP segregation of duties.
5. **No quarantine aging visibility** — lots can sit in quarantine for weeks unnoticed.

This feature consolidates and formalizes the receipt-and-inspection flow without disrupting upstream PO and Production modules.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Raw Material GRN with Checklist & Auto-QC Sample (Priority: P1)

A warehouse receiver accepts a delivery of an active pharmaceutical ingredient against a Purchase Order. They open the PO, click "Create GRN", and the system generates a new Goods Receipt Note `GRN-2026-00001` with one line per PO item. The receiver enters the actual quantity, vendor lot number, manufacturing date, expiry date, and uploads/attaches the supplier's Certificate of Analysis. They then run through a 4-item raw-material checklist (COA matches the lot, expiry > shelf-life floor, packaging intact, weight tolerance ±2%). They electronically sign the checklist. The system automatically creates a QC sample linked to the GRN line and the new inventory lot, and notifies QA. The lot is in `quarantine` and not available for withdrawal.

**Why this priority**: This is the entry point for every raw material — getting this right protects every downstream batch.

**Independent Test**: With a single open PO, a warehouse user can produce a numbered GRN, a checklist record, an inventory lot in quarantine, and a linked QC sample — verifiable end-to-end without involving finished-goods flow or QA approval.

**Acceptance Scenarios**:

1. **Given** an approved PO with 2 lines, **When** the receiver creates a GRN, **Then** the GRN has 2 receipt lines pre-populated with item, expected quantity, and unit from the PO.
2. **Given** a GRN line in `created` status, **When** the receiver enters actual quantity 99.5 kg against expected 100 kg (tolerance 2%), **Then** the system accepts it and marks the line variance as within tolerance.
3. **Given** the receiver attempts to enter actual quantity 90 kg (10% short), **When** they save, **Then** the system flags the line as `quantity_variance` and requires a written reason before the checklist can proceed.
4. **Given** the raw-material checklist has 4 mandatory items, **When** the receiver tries to electronically sign with only 3 items checked, **Then** the system blocks signing and lists the missing items.
5. **Given** a completed checklist on a raw material line, **When** the receiver signs, **Then** the system creates exactly one QC sample with the GRN line ID, the new lot ID, and status `registered`; the linked lot remains `quarantine`.
6. **Given** a brand-new lot is created from this GRN line, **When** another user attempts to withdraw from it via Material Withdrawal, **Then** the system blocks the withdrawal with reason "lot is in quarantine — pending QC release".

---

### User Story 2 — Finished Goods GRN from Production Work Order (Priority: P1)

A production supervisor finishes a packaging run on Work Order `WO-2026-0042`. They open the WO, click "Receive into Stock", and the system creates a GRN of type `finished_goods` referencing the WO. Lines are pre-populated from the WO's expected finished-goods output. The supervisor records the actual yield, batch number (matching the WO), and runs a 5-item finished-goods checklist (label correct, packaging integrity, weight per unit, count per pack, theoretical-vs-actual yield within tolerance). They sign. A QC sample is auto-created and a finished-goods lot is placed in quarantine.

**Why this priority**: Without a formal FG receipt, dispatch teams cannot see what is available and audit trail to the WO is broken.

**Independent Test**: From a WO marked "packaging complete", a production user can create a numbered GRN with a finished-goods lot in quarantine and an auto-created QC sample — independent of raw-material flow.

**Acceptance Scenarios**:

1. **Given** a WO in `packaging_complete` state with expected yield 10,000 capsules, **When** the supervisor creates the GRN, **Then** one line is pre-populated for the finished good with expected qty 10,000.
2. **Given** actual yield 9,650 (3.5% short) against an allowed FG tolerance of 5%, **When** the supervisor saves, **Then** the line is accepted without variance flag.
3. **Given** actual yield 9,200 (8% short), **When** the supervisor saves, **Then** a `yield_variance` flag is set and a deviation reason is required.
4. **Given** the FG checklist is fully checked and signed, **When** the supervisor confirms, **Then** a finished-goods lot is created in `quarantine` and a QC sample is auto-created linked to the GRN line.
5. **Given** a WO already has a GRN with all of its expected output recorded, **When** the supervisor tries to create a second GRN on the same WO, **Then** the system warns "WO already fully received" and requires explicit override.

---

### User Story 3 — QA Approval & Release to Stock (Priority: P1)

A QA officer opens the Incoming Inspection Dashboard, sees one GRN line waiting for QA decision (checklist passed, QC sample tested with all results within spec). They review the GRN, the checklist signature, and the QC test results, then click "Release to Stock" with their electronic signature. The system flips the inventory lot status from `quarantine` to `released`, increases the item's available-on-hand count, decreases the quarantine count, writes an audit trail entry, and marks the GRN line as `released_to_stock`. If instead they click "Reject", the lot moves to `rejected` status and a deviation is auto-created.

**Why this priority**: Without QA gate, raw materials can be used before testing — the single biggest compliance risk this feature addresses.

**Independent Test**: Given a GRN with checklist signed and QC sample marked `passed`, a QA user can transition the lot from quarantine to released in one signed action — verifiable by checking the lot status and the item's `onHand` calculation.

**Acceptance Scenarios**:

1. **Given** a GRN line with checklist signed and QC sample with status `approved`, **When** the QA officer signs "Release to Stock", **Then** the linked lot status changes to `released` and the GRN line status changes to `released_to_stock`.
2. **Given** the QA officer who signs the release is the same user who signed the receiver's checklist, **When** they attempt to release, **Then** the system blocks with "Triple Independence violation: Receiver and QA Approver must be different users" — even if the user has Admin role.
3. **Given** a QC sample with one or more test results outside spec (status `failed`), **When** the QA officer opens the GRN line, **Then** the "Release to Stock" action is disabled and only "Reject" is available.
4. **Given** a QA officer clicks "Reject" on a GRN line with a written reason, **When** they sign, **Then** the lot status changes to `rejected`, a deviation record is auto-created with the reason and a link back to the GRN, and the GRN line moves to `rejected`.
5. **Given** a released GRN line, **When** a user opens Material Withdrawal, **Then** the lot is now selectable (no longer in quarantine).

---

### User Story 4 — Pending-Receipt and Pending-QC Dashboards (Priority: P2)

A warehouse supervisor opens the GRN dashboard at the start of the shift and sees three buckets: "Pending checklist" (4 GRNs awaiting receiver signature), "Pending QA" (7 GRN lines with checklist done and QC sample tested, waiting for QA review), and "Quarantine aging" (2 lots in quarantine for more than 14 days). They can click any row to drill into the GRN detail. A separate "Incoming Inspection" page presents the same data filtered to QC's perspective: samples linked to GRN lines, grouped by item, with test status indicators.

**Why this priority**: Solves the "we don't know what's waiting" problem. Important for daily operations but not blocking — it's a visibility layer on top of P1 data.

**Independent Test**: After several GRNs in mixed states exist (some pending, some released, some rejected), the dashboard must display correct counts and allow filtering by status, item, supplier, and age.

**Acceptance Scenarios**:

1. **Given** 4 GRNs in `created` state and 7 GRN lines in `qc_pending` state, **When** the supervisor opens the dashboard, **Then** the two top tiles show "4 Pending Checklist" and "7 Pending QA".
2. **Given** a lot has been in `quarantine` status for 15 days, **When** the supervisor opens the Quarantine Aging tile, **Then** the lot appears with its age in days and a warning icon (threshold 14 days).
3. **Given** a user filters by supplier "Vendor A", **When** they apply the filter, **Then** only GRNs whose source PO is from Vendor A are shown.
4. **Given** a QA officer opens the Incoming Inspection page, **When** they search by item code "RM-CAP-001", **Then** all GRN lines for that item with their QC sample status appear in a single view.

---

### User Story 5 — Receipt History & Audit Trail (Priority: P3)

An auditor needs to reconstruct what happened to a specific raw-material lot. They open the lot detail page, see a "Received via GRN-2026-00012" link, and click through to view the GRN header (PO reference, supplier, receiver, date), the checklist with each item's pass/fail and the receiver's e-signature, the linked QC sample and its test results, and the QA approval signature with timestamp. Every status change appears in the audit trail with the user and time.

**Why this priority**: Compliance and traceability. Important for audits but not a daily operation.

**Independent Test**: Pick any released lot — the auditor must be able to reach the original GRN, the checklist, the QC sample, and the two e-signatures in fewer than 4 clicks.

**Acceptance Scenarios**:

1. **Given** a released lot, **When** the auditor opens its detail page, **Then** a "Source GRN" link is visible and clickable.
2. **Given** a GRN detail page, **When** the auditor scrolls to the History section, **Then** every status transition (created → checklist_done → qc_pending → released_to_stock) is listed with timestamp and acting user.
3. **Given** an e-signed checklist, **When** the auditor clicks the signature record, **Then** the signed payload, signer name, IP/device, and timestamp are shown, and the payload's integrity hash can be verified.
4. **Given** a GRN that was rejected, **When** the auditor reviews it, **Then** the deviation record is linked and the rejection reason is visible.

---

### Edge Cases

- **Partial receipt of a PO**: PO orders 100 kg, only 60 kg delivered. GRN records 60 kg and the PO line remains partially received. A later GRN can be created for the remainder.
- **Over-receipt against PO**: Receiver records 105 kg against a 100 kg PO line. System flags `over_receipt` and requires explicit override with reason; the over-receipt is recorded as variance but not blocked.
- **Vendor lot number duplicate**: If the same vendor lot number is recorded twice for the same item from the same supplier within 90 days, the system warns "Possible duplicate receipt" but does not block.
- **Expiry-date too short**: If the manufacturing-date and shelf-life leave less than the item's minimum-remaining-shelf-life (e.g., 6 months), the system flags the line and requires a written reason before the checklist can proceed.
- **QC sample never tested**: If a GRN line is in `qc_pending` for more than 30 days with no test results, the system raises a daily warning in the dashboard.
- **GRN created in error before any data entry**: A GRN in `created` state with no actual quantities entered can be cancelled by the original creator within 24 hours, with reason; after that it requires QA override.
- **Lot rejected after release (post-market)**: Out of scope for this feature — handled by Recall module.
- **WO that produces multiple SKUs**: One GRN may contain multiple finished-goods lines, one per SKU.
- **Receiver enters wrong PO**: While GRN is still in `created` state, the receiver may detach and re-link to the correct PO. After checklist signing, the link is immutable.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Goods Receipt Note (GRN) lifecycle

- **FR-001**: System MUST generate a unique GRN number in the format `GRN-YYYY-NNNNN` (5-digit zero-padded sequence) on creation. The sequence resets on January 1 of each year.
- **FR-002**: A GRN MUST be of exactly one type: `raw_material` (sourced from a PO) or `finished_goods` (sourced from a Work Order).
- **FR-003**: Each GRN MUST reference exactly one source document — a Purchase Order for raw materials or a Work Order for finished goods.
- **FR-004**: A GRN MUST have one or more receipt lines, each representing one item-lot combination being received.
- **FR-005**: Each receipt line MUST capture: item, expected quantity, actual quantity, unit of measure, vendor lot number (raw material) or batch number (finished goods), manufacturing date, expiry date, and variance amount.
- **FR-006**: System MUST enforce a state machine on each GRN line: `created` → `checklist_done` → `qc_pending` → `qc_approved` → `released_to_stock`, with branches to `rejected` (from `qc_pending` or `qc_approved`) and `cancelled` (from `created` only).
- **FR-007**: The header GRN status MUST be derived from its lines: `in_progress` if any line is not yet in a terminal state; `released` when all lines are `released_to_stock`; `partially_released` if at least one line is `released_to_stock` and at least one is `rejected` or `cancelled`; `rejected` if all lines are `rejected`.

#### Checklist

- **FR-008**: System MUST present a category-specific checklist when the receiver opens a GRN line — one checklist template for `raw_material`, one for `finished_goods`.
- **FR-009**: The raw-material checklist MUST include at minimum: (a) Certificate of Analysis matches the delivered lot, (b) supplier-stated expiry date and the receipt date together leave at least the item's required remaining shelf life, (c) outer packaging intact and undamaged, (d) actual weight or count is within ±2% of expected.
- **FR-010**: The finished-goods checklist MUST include at minimum: (a) product label is correct and legible, (b) packaging integrity verified (no defects), (c) weight per unit within tolerance, (d) count per pack matches specification, (e) actual yield within ±5% of theoretical yield.
- **FR-011**: System MUST NOT allow electronic signing of a checklist while any mandatory item is unchecked.
- **FR-012**: Each checklist item MUST capture a pass/fail boolean and optional remarks.
- **FR-013**: Checklist templates MUST be administrable — an authorized user can add/remove/edit items per category without code changes.

#### Quantity variance & tolerance

- **FR-014**: System MUST flag a `quantity_variance` on a receipt line when actual quantity differs from expected by more than the configured tolerance per category (default: 2% for raw materials, 5% for finished goods).
- **FR-015**: When a variance is flagged, the receiver MUST provide a written reason before the checklist can be signed.
- **FR-016**: Over-receipt (actual > expected) MUST be accepted but recorded as positive variance with a required reason.
- **FR-017**: Tolerances MUST be configurable per category, mirroring the existing Packaging Tolerances pattern.

#### Quarantine gate

- **FR-018**: Every receipt line MUST create or update an inventory lot in `quarantine` status — never directly in `released`.
- **FR-019**: System MUST prevent any material withdrawal, transfer, or production consumption from a lot whose status is `quarantine`, `under_test`, `rejected`, or `blocked`.
- **FR-020**: A lot status MUST change to `released` only via the QA approval action on its source GRN line.

#### QC sample auto-creation & linkage

- **FR-021**: When a receiver signs a checklist, the system MUST automatically create exactly one QC sample per receipt line, with status `registered`, linked to: the GRN line, the new inventory lot, the item, and the relevant default test panel for that item.
- **FR-022**: If a default test panel for the item does not exist, the system MUST still create the QC sample but flag it for QC manager attention.
- **FR-023**: System MUST display the link between GRN line ↔ QC sample ↔ inventory lot on all three detail pages.
- **FR-024**: A receipt line MUST move from `checklist_done` to `qc_pending` when its QC sample reaches status `registered`, and from `qc_pending` to `qc_approved` when its QC sample reaches status `approved`.

#### Triple Independence & e-signature

- **FR-025**: System MUST enforce that the user who signs the receiver checklist on a line is NOT the same user who signs the QA "Release to Stock" action on that line. This rule applies regardless of role — Admin role does NOT bypass it.
- **FR-026**: Every signature event MUST be recorded as an electronic signature with: user, timestamp, IP/device fingerprint, signed payload, and an integrity hash.
- **FR-027**: System MUST require a permission `inventory:goods_receipt:receive` for creating GRNs, `inventory:goods_receipt:checklist` for signing checklists, and `quality:incoming:approve` for QA release. These permissions MUST be assignable via existing HR role configuration.

#### Dashboards & visibility

- **FR-028**: System MUST provide a Goods Receipt Dashboard showing four tiles: Pending Checklist count, Pending QA count, Released Today count, and Quarantine Aging count (lots in quarantine > 14 days).
- **FR-029**: System MUST provide an Incoming Inspection page for QC, listing all GRN lines in `qc_pending` or `qc_approved` status with their QC sample, test results, and a one-click drill-through to the GRN.
- **FR-030**: Both dashboards MUST support filtering by status, item, supplier or work order, date range, and assigned user.
- **FR-031**: System MUST surface a daily warning when any QC sample linked to a GRN line has been in `registered` or `testing` status for more than 30 days.

#### Audit & history

- **FR-032**: System MUST record every status transition of a GRN line into the audit trail with user, timestamp, prior status, new status, and reason (when applicable).
- **FR-033**: The lot detail page MUST display a "Source GRN" link for any lot whose origin was a goods receipt.
- **FR-034**: Rejection of a GRN line MUST automatically create a deviation record linked back to the GRN, with the rejection reason and QC test result reference.

#### Reporting

- **FR-035**: System MUST produce three reports: (a) Pending Receipts report (GRNs not yet signed), (b) Pending QC report (lines waiting QA decision with sample status), (c) Quarantine Aging report (lots in quarantine grouped by age band: 0–7 days, 8–14 days, 15+ days).

---

### Key Entities *(include if feature involves data)*

- **Goods Receipt (GRN)** — Header document for an incoming-stock event. Identified by `grnNumber` in format `GRN-YYYY-NNNNN`. Belongs to exactly one source (a PO or a WO). Carries the overall status, receiver-user, creation timestamp, and supplier or work-order reference.
- **Goods Receipt Line** — One line per item-lot combination on the GRN. Carries: item reference, expected quantity (from source document), actual quantity, unit, vendor lot number or batch number, manufacturing date, expiry date, variance amount, variance reason, line status (per state machine), and the IDs of the created inventory lot and QC sample.
- **Goods Receipt Checklist** — A checklist instance attached to a GRN line. References a checklist-template version, contains the per-item pass/fail and remarks, and records the electronic-signature reference once signed.
- **Checklist Template** — Master-data definition of which items must be verified per category (`raw_material` vs `finished_goods`). Versioned so historical signed checklists remain reproducible.
- **Receipt-QC Link** — Resolved on the receipt line itself by storing the auto-created QC sample's ID. No separate link table is required, but for reporting the relationship must be queryable in both directions.
- **Receipt Tolerance** — Configurable per category (raw material default 2%, finished goods default 5%), mirroring the existing packaging tolerances pattern.

Relationships:

- GRN 1 ↔ N Receipt Line
- Receipt Line 1 ↔ 1 Checklist
- Receipt Line 1 ↔ 1 Inventory Lot (created or updated)
- Receipt Line 1 ↔ 1 QC Sample (auto-created)
- Receipt Line N ↔ 1 source PO Line or WO Output

Re-used existing entities (not re-modeled): Purchase Order, Work Order, Inventory Lot, QC Sample, Electronic Signature, Audit Trail Entry, Deviation, Item, Vendor, Warehouse.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A warehouse receiver can complete the receipt of a single-line PO — from "Create GRN" to "Checklist Signed" — in under 3 minutes, including filling actual quantity, vendor lot, and dates.
- **SC-002**: A QA officer can find every line waiting for their decision on a single dashboard tile without leaving the page; clicking a row drills into the GRN in one click.
- **SC-003**: Zero lots can transition to a usable stock state without an associated electronically-signed QA release event. Verified by post-deployment audit query: any lot with `status='released'` must have a corresponding GRN line in `released_to_stock` status with a non-null QA signature ID.
- **SC-004**: 95% of incoming receipts have their QC sample registered automatically — no manual QC entry step. Measured by querying QC samples created in the 30 days post-launch and counting those with a non-null GRN line reference.
- **SC-005**: Average time a lot spends in quarantine drops by at least 30% within 60 days of launch, attributable to dashboard visibility of pending-QA queue.
- **SC-006**: Zero Triple Independence violations after launch — every release event has receiver-user ≠ QA-user. Verified by audit query.
- **SC-007**: Auditors can reach the e-signature record for any released lot in 3 clicks or fewer (lot detail → GRN link → checklist signature).
- **SC-008**: 100% of GRN numbers are unique and gap-free within a calendar year — no duplicate, no skipped sequence.

---

## Assumptions

- **PO and WO data are already trustworthy** — this feature reads existing PO lines and WO outputs without revalidating them.
- **HR permission model is the source of truth** for role-based access to GRN actions. New permissions slot into the existing pattern used by Material Withdrawal and Packaging Issuance.
- **A default QC test panel exists per item** for the auto-QC-sample feature to be useful. If absent, the QC sample is still created but flagged.
- **Electronic Signature infrastructure** (existing `electronic_signatures` table and `ElectronicSignatureDialog` component) is sufficient for the two new signing points (checklist + release).
- **No retroactive data migration** — historical lots that pre-date this feature stay as-is and do not get back-filled GRNs.
- **Single physical warehouse layout** is sufficient for now — multi-warehouse routing of quarantine vs released stock is out of scope.
- **No supplier-side data integration** — Certificate of Analysis is attached as a file by the receiver; the system does not auto-fetch from supplier portals.

---

## Out of Scope

- Vendor evaluation or rating based on GRN history.
- Automatic recall handling for already-released lots later found defective.
- Mobile-app-specific UI — the web UI is responsive but no native mobile build is included.
- Integration with shipment-tracking or ASN (Advance Shipment Notice) systems.
- Multi-warehouse quarantine routing.
- Print formatting for GRN documents beyond the standard A4 PDF — barcode labels and integration with label printers are deferred.
