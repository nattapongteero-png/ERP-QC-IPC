# Feature Specification: Scale Pre-Use Verification

**Feature Branch**: `021-scale-verification`
**Created**: 2026-06-03
**Status**: Draft
**Input**: Before every weighing operation in production, the operator must verify the scale/balance is reading accurately by placing a certified standard weight (ลูกตุ้มเหล็ก) on it. The reading is compared against the weight's certified value; pass/fail decides whether the operator can proceed with the actual material weighing. The system blocks material weighing until a valid verification exists.

---

## Background & Problem Statement

GMP standards (PIC/S Annex 15, 21 CFR 211.68(a), WHO TRS 1019 §17) require that weighing equipment is verified before each use — not only at the periodic annual calibration. The current ERP has:

- A periodic-calibration framework (`equipment.lastCalibrationDate` / `nextCalibrationDate`) — annual cadence, scheduled by maintenance.
- A material-weighing workflow (`work_order_materials` with `weighedQty`, `weighedBy`, `verifiedBy`) — operator records the actual weight of dispensed raw materials with dual control.

But **no link** between the two. An operator can weigh a kilo of API ingredient on a scale whose accuracy hasn't been checked since the last annual calibration, and the system has no record of, and no block on, that gap.

Auditors expect to see, for any given weighing record:

1. *Which* scale was used.
2. *What* standard weight was placed on it that day/shift.
3. *Who* signed the verification, with timestamp.
4. *Whether* the reading was within tolerance (typically ±0.1 % of the certified weight).
5. *That the actual material weighing happened after a passing verification, not before.*

This feature adds that layer.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Operator verifies a scale with a standard weight before dispensing (Priority: P1)

A production operator arrives at the dispensing area for Work Order WO-2026-0042. The recipe calls for 5.000 kg of API "Curcumin Extract" to be weighed on Scale `BAL-001`. Before touching the raw material, the operator opens the scale-verification screen, selects `BAL-001`, picks the certified test weight `SW-001` (1000.0000 g, certificate valid until 2027-04-15), places it on the scale, reads `1000.05 g`, and enters that value. The system computes a 0.005 % deviation, well inside the ±0.1 % tolerance, marks the check as **PASS**, captures the operator's electronic signature, and unlocks the weighing UI for that scale for the next 8 hours. The operator proceeds to weigh the curcumin extract.

**Why this priority**: This is the core compliance gate — without it the feature has no value.

**Independent Test**: With one seeded scale, one certified standard weight, and one operator, complete the verification flow and observe that (a) a `scale_verifications` row is recorded with PASS status, (b) the scale becomes selectable in the material-weighing screen, (c) the audit trail records the event.

**Acceptance Scenarios**:

1. **Given** a scale `BAL-001` with no verification today, **When** the operator places 1000.0000 g certified weight and the scale reads 1000.05 g, **Then** the system computes deviation 0.005 %, marks check PASS, and the verification is valid for the next 8 hours on `BAL-001`.
2. **Given** the operator reads 1002.0 g (0.20 % deviation), **When** they save, **Then** the system marks FAIL, blocks weighing on `BAL-001`, and prompts to notify maintenance.
3. **Given** a verification exists from 9 hours ago on `BAL-001`, **When** the operator tries to weigh a material, **Then** the system blocks with "Verification expired — please re-verify".
4. **Given** the operator tries to use standard weight `SW-001` whose certificate expired yesterday, **When** they select it, **Then** the system shows a hard warning "Certificate expired" and refuses to record the verification.
5. **Given** the verification is signed, **When** the auditor later opens the material-weighing record for that batch, **Then** they can navigate to the scale verification used and see operator, time, weight ID, deviation %.

---

### User Story 2 — Material weighing is gated by verification (Priority: P1)

The same operator opens the Material Weighing page on WO-2026-0042. The page checks: "Does Scale `BAL-001` have a passing verification within the last 8 hours?". Yes → weighing form unlocked. No → form is disabled and a banner displays "Please verify scale before weighing" with a button to jump to the verification page. After verification, the operator returns and the form is unlocked.

**Why this priority**: Soft enforcement isn't compliance. The gate has to be at the UI + service layer (defense in depth), or operators will skip it.

**Independent Test**: Toggle the verification state (none / expired / failed / passed) and observe the weighing form's enabled/disabled state and the API's rejection of writes when the gate is closed.

**Acceptance Scenarios**:

1. **Given** no scale verification today, **When** the operator opens material-weighing, **Then** the "Save weighing" button is disabled and a banner says "Scale verification required".
2. **Given** a passing verification 2 hours ago, **When** the operator submits a weighing, **Then** the API accepts it and stores `verification_id` on the weighing record.
3. **Given** a verification 10 hours ago, **When** the operator attempts to submit, **Then** the API rejects 409 `VERIFICATION_EXPIRED` and the UI re-prompts.
4. **Given** a FAIL verification on the scale, **When** the operator tries to use the same scale, **Then** the system blocks and recommends a different scale.

---

### User Story 3 — Standard weights master & certificate tracking (Priority: P2)

A QC manager maintains the registry of certified standard weights. Each weight has: identifier (e.g., `SW-001`), denomination (e.g., 1000.0000 g), accuracy class (E1 / E2 / F1), certificate number, certificate issue date, certificate expiry date, last external recalibration date. When a certificate is within 30 days of expiry, the dashboard shows a warning.

**Why this priority**: Without good master data, the verification step has nothing to compare against. P2 because the system can self-seed defaults so the P1 flow works.

**Independent Test**: Create three standard weights with various certificate expiry dates and confirm (a) only valid ones are selectable in the verification screen, (b) expiring-soon weights are flagged, (c) expired ones are blocked.

**Acceptance Scenarios**:

1. **Given** standard weight `SW-001` with certificate expiry 2027-04-15 (today 2026-06-03), **When** an operator opens the selector, **Then** the weight appears as available.
2. **Given** weight `SW-002` with certificate expiry 2026-06-15 (12 days), **When** opened, **Then** it appears with a yellow "Expiring soon" badge.
3. **Given** weight `SW-003` with certificate expiry 2026-05-01 (past), **When** the operator picks it, **Then** the system blocks recording verification with that weight.

---

### User Story 4 — Verification history & audit report (Priority: P3)

An internal auditor wants the verification history for `BAL-001` over the past month. They open the scale detail page → "Verification history" → see a table of every verification with operator, weight used, reading, deviation %, pass/fail, and a click-through to the e-signature record. They can also export the period to CSV/Excel for the regulator.

**Why this priority**: Audit story. Daily ops don't need it; auditors do.

**Independent Test**: Trigger 5 verifications across two days, then verify the history view lists them in correct order with all five fields visible.

**Acceptance Scenarios**:

1. **Given** five verifications on `BAL-001` this month, **When** the auditor opens the scale's history, **Then** all five rows appear in descending time order.
2. **Given** the auditor clicks a single row, **When** the e-signature page opens, **Then** they see the signer's full name, role, signed-at timestamp, and the SHA-256 signature hash.
3. **Given** the auditor exports the filtered range, **When** the file downloads, **Then** it contains columns: scaleCode, verifiedAt, operator, weightId, certifiedValue, actualReading, deviationPercent, result.

---

### Edge Cases

- **Operator places wrong weight**: Selects a 100 g weight but enters reading from a 1000 g measurement. System catches huge deviation (>10×) → marks FAIL with explanation.
- **Scale rejected during day**: A scale FAILS mid-shift. System marks `BAL-001` as `out_of_service`. Operators get "Scale out of service" until maintenance flips it back.
- **Two scales same code**: `scaleCode` unique constraint blocks duplicates.
- **Verification done on wrong scale**: Operator selects `BAL-001` but uses `BAL-002`. System can't detect; relies on dual operator sign (US2 dual-control already in material weighing).
- **Weight certificate expires mid-day**: Verification started 09:00 (valid), certificate expires 12:00. Existing verification valid until its 8-hour TTL. New verifications after 12:00 blocked.
- **Time zone (DST)**: Validity window stored as absolute UTC timestamp.
- **Verification expires while weighing one BOM**: Operator weighs 8 of 10 items, then TTL expires. System allows the final 2 items but flags the BOM record `weighed_after_expiry=true` for QA review.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Standard Weights Master

- **FR-001**: System MUST maintain a registry of certified standard weights with: code (unique), denomination value, denomination unit, accuracy class (E1/E2/F1/F2/M1), certificate number, certificate issuer, issue date, expiry date, owner department, isActive flag.
- **FR-002**: System MUST prevent recording a verification using a standard weight whose certificate has expired.
- **FR-003**: System MUST flag standard weights with certificates expiring within 30 days as "Expiring soon".
- **FR-004**: Standard weights MUST be administrable by users with `quality:scales:configure` permission.

#### Scale Equipment Linkage

- **FR-005**: System MUST extend `production_equipment` with: `verificationIntervalHours` (default 8), `minVerificationWeightG`, `maxVerificationWeightG`, `tolerancePercent` (default 0.1).
- **FR-006**: System MUST treat any equipment with `equipmentType='scale'` or `equipmentType='balance'` as subject to verification.
- **FR-007**: For each scale, system MUST determine its "current verification" — the most recent within `verificationIntervalHours`. If none, the scale is "unverified".

#### Verification record

- **FR-008**: A scale verification record MUST capture: scaleId, standardWeightId, certifiedValue snapshot, certifiedUnit snapshot, actualReading, deviationAmount, deviationPercent, result (`pass` | `fail`), operatorUserId, signatureId, performedAt, validUntil, notes.
- **FR-009**: System MUST compute deviationPercent as `((actualReading − certifiedValue) / certifiedValue) × 100` rounded to 4 decimal places.
- **FR-010**: System MUST mark a verification `pass` when `|deviationPercent| ≤ tolerancePercent`, otherwise `fail`.
- **FR-011**: When a verification result is `fail`, System MUST set the scale's status to `out_of_service` and create a maintenance notification.
- **FR-012**: A verification MUST be e-signed by the operator, creating an `electronic_signatures` row.

#### Weighing gate

- **FR-013**: Material weighing pages MUST check for a `pass` verification with `validUntil > now()`. If absent, weighing form MUST be disabled with a call to action.
- **FR-014**: Material weighing API endpoints MUST reject writes when no valid verification exists, returning 409 `VERIFICATION_REQUIRED`.
- **FR-015**: The material weighing record MUST store `scale_verification_id`.
- **FR-016**: If a verification expires mid-weighing within a BOM session, System MUST allow completion of in-flight items but flag the BOM record `weighed_after_expiry=true` for QA review.

#### Audit & reporting

- **FR-017**: Every verification MUST be written to the audit trail.
- **FR-018**: Scale detail page MUST surface a "Verification history" tab.
- **FR-019**: System MUST provide a "Scale Verification Compliance" report per period: pass/fail counts, scales currently out of service, scales without today's verification.
- **FR-020**: Reports MUST be exportable to CSV.

#### Permissions

- **FR-021**: System MUST require `quality:scales:verify` for recording verifications.
- **FR-022**: System MUST require `quality:scales:configure` for managing standard weights and tolerances.
- **FR-023**: Both permissions MUST be assignable via existing HR role system.

#### Out of service workflow

- **FR-024**: A scale `out_of_service` MUST return to service only via a signed maintenance record AND a subsequent passing verification.
- **FR-025**: System MUST display `out_of_service` scales prominently on the dashboard.

---

### Key Entities

- **Standard Weight** — Certified test weight. Identified by `code`. Carries denomination, accuracy class, certificate info, owner.
- **Scale Equipment** — Existing `production_equipment` row with `equipmentType='scale'`. Extended with verification-interval and tolerance.
- **Scale Verification** — One row per verification event. Snapshots certified value at test time.
- **Maintenance Action (re-use)** — On FAIL → `acct_maintenance_records` row with type `verification_failure_followup`.

Relationships:
- ProductionEquipment 1 ↔ N ScaleVerification
- StandardWeight 1 ↔ N ScaleVerification
- ScaleVerification 1 ↔ 1 ElectronicSignature
- WorkOrderMaterial N ↔ 1 ScaleVerification (additive nullable FK)

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Operator completes verification (open → signed PASS) in under 60 seconds.
- **SC-002**: Zero material-weighing rows written without valid `scale_verification_id` after launch.
- **SC-003**: FAIL verification takes scale out of service within 1 second.
- **SC-004**: 100% of verifications have non-null `signatureId`.
- **SC-005**: Auditor reaches e-signature for any weighing in ≤4 clicks.
- **SC-006**: Weights with certificates ≤30 days from expiry are flagged on every dashboard.
- **SC-007**: 95% operator satisfaction (qualitative survey).

---

## Assumptions

- `production_equipment.equipmentType='scale'` already exists in seeds.
- 8-hour verification window is default policy.
- ±0.1% tolerance is default.
- Existing `electronic_signatures` infrastructure is sufficient.
- Single-point verification only (multi-point linearity out of scope).
- No bluetooth/serial integration — operator types reading.
- Operators are honest about scale identity (no auto-detection).

---

## Out of Scope

- Bluetooth/RS-232/USB direct scale data capture.
- Multi-point linearity tests.
- SPC charts of drift.
- Predictive maintenance.
- Mobile-app-specific UI.
- Auto-recalibration scheduling.
