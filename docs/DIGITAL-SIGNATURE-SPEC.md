# TH-ESIGN-SPEC-001 — Manufacturing Control Implementation Profile (Addendum)

**Document ID:** TH-ESIGN-SPEC-001-MFG
**Version:** 1.1 Addendum
**Applies to:** On-screen electronic signatures inside manufacturing control processes (operator/supervisor/QA sign-offs)
**Primary legal anchors:** ETA Sections 7–10, 25–28; Royal Decree on Security Techniques; ETDA e-sign guideline; ETS Digital ID authentication requirements. 

---

## 1. Manufacturing Control Scope Extension

### 1.1 In-scope manufacturing records (“manufacturing controlled records”)

MFG-SCP-001: The system SHALL support electronic signing and record control for these record classes:

* **Production execution**: Work order execution, routing steps, operation confirmations, yields/scrap.
* **Electronic Batch Record (EBR)/Device History Record**: step-by-step records, sign-offs, attachments.
* **Quality controls**: in-process checks, QC sampling, test results entry approval, batch disposition (accept/reject/hold).
* **Line clearance / setup verification / changeover checks**
* **Material control**: issuance, dispensing/weighing, consumption, lot genealogy, substitutions approvals.
* **Equipment logs**: usage logs, cleaning, maintenance sign-offs, calibration due/complete records.
* **Exception handling**: deviations, nonconformances, rework, CAPA initiation/approval (if used in your plant process).

### 1.2 Legal equivalence model (explicit)

MFG-SCP-002: For manufacturing records that require “writing/signature/original” equivalence, the implementation SHALL satisfy:

* **No denial of legal effect** just because it’s electronic (ETA Section 7). 
* **Writing equivalence**: accessible + usable for later reference without altered meaning (ETA Section 8). 
* **Signature equivalence**: method identifies signatory + indicates approval, and is reliable/appropriate (ETA Section 9). 
* **Original equivalence**: integrity assured from final form + displayable later (ETA Section 10). 

---

## 2. Manufacturing-Specific Definitions

* **Shop-floor shared terminal:** a workstation used by multiple operators across shifts/lines.
* **Step / Operation:** a manufacturing instruction unit requiring completion confirmation.
* **Hold point:** a step where progression is blocked until required approval(s) are completed.
* **Genealogy:** traceability chain linking product lot/batch to material lots, equipment, operators, and parameters.
* **“Signing meaning”:** what the signature asserts (Performed / Verified / Reviewed / Approved / Released / Witnessed).

---

## 3. Manufacturing Signature Policy Model (Criticality-based)

Manufacturing control requires step-level decisions. So we MUST formalize **criticality tiers**.

MFG-POL-001: The system SHALL classify each signable event into one of these tiers:

* **Tier A (High):** product release, QA disposition, critical parameter overrides, rework authorization, line clearance for regulated lines, recipe/master data approval.
* **Tier B (Medium):** in-process verification, second-person checks, equipment clearance, sampling sign-off, deviation approval.
* **Tier C (Low):** routine acknowledgements, non-critical confirmations.

MFG-POL-002: The system SHALL map tiers to **signature types + authentication strength**:

* Tier A → e-sign Type 2/3 controls (reliable signature characteristics + strongest authentication) 
* Tier B → strong Type 2 controls
* Tier C → Type 1 may be acceptable *if risk assessment approves*, but still must meet ETA Section 9 (identify + approval + appropriate reliability). 

MFG-POL-003: For Type 2/3, the system SHOULD implement multi-factor authentication aligned to ETDA guidance (ETDA guideline explicitly notes MFA considerations for higher types; and it discusses stylus signing + access control in automated workflow systems). 
MFG-POL-004: If using an IdP, authentication assurance SHOULD be aligned to ETS Digital Identity Part 3 (AAL concept and requirements for IdPs). ([ETDA][1])

---

## 4. Manufacturing Control Requirements (New / Strengthened)

### 4.1 Step execution & hold points (MES/EBR core)

MFG-STEP-001: The system SHALL support **step-level electronic sign-off** with:

* step ID, operation name, work center/line, order/batch ID
* presented instruction version (see 4.2)
* timestamp and time source
* signer identity + role
* **signing meaning** (Performed / Verified / Approved / Released, etc.)
* result/status (Pass/Fail/Hold)
* attachments (photos, checklists) if applicable

MFG-STEP-002: The system SHALL enforce **hold points** such that downstream steps cannot be executed until required signatures are completed.

MFG-STEP-003: The system SHALL support **sequential signatures** (Operator → Supervisor → QA) for Tier A/B operations.

### 4.2 Work instruction / recipe / master data version control

MFG-WI-001: The system SHALL ensure the operator signs against the **exact instruction/recipe version** used at execution time.

MFG-WI-002: Instruction/recipe changes SHALL be controlled by:

* versioning
* approval workflow (Tier A, usually)
* effective date/time
* link to impacted products/lines

MFG-WI-003: The evidence bundle SHALL include the instruction/recipe version reference (or a hash of the presented content) to support “integrity from final form” and traceability. 

### 4.3 Automatic vs manual data capture (prevent “paper-on-screen” risk)

MFG-DATA-001: Where process parameters come from equipment/PLC/SCADA, the system SHOULD auto-capture them and mark them as **system-sourced**.

MFG-DATA-002: Manual entries SHALL be controlled with:

* format and range validation
* unit enforcement
* reason codes for out-of-range values
* “entered by” identity + timestamp
* optional second-person verification for Tier B/A steps

MFG-DATA-003: The system SHALL clearly indicate in records whether each value was:

* machine captured
* manually entered
* manually corrected (see 4.4)

### 4.4 Corrections, changes, and overrides (append-only principle)

MFG-CHG-001: The system SHALL NOT allow overwriting critical manufacturing record fields without preserving history.

MFG-CHG-002: For any correction/override to a recorded value, the system SHALL capture:

* previous value (immutable)
* new value
* who changed it
* when changed
* why changed (reason code + free-text)
* link to deviation/nonconformance if applicable
* required co-signature if Tier A/B

This supports integrity expectations and makes alteration detectable (reliable method / reliable signature traits). 

### 4.5 Shared shop-floor terminals (high-risk operational reality)

MFG-TERM-001: Shared terminals SHALL enforce:

* individual login (no shared accounts)
* fast re-authentication (badge/PIN/biometric as per your policy)
* automatic session timeout
* explicit user switch

MFG-TERM-002: The system SHALL prevent “walk-away signing” by requiring user presence confirmation at signing time (e.g., re-enter PIN, FIDO, or equivalent) for Tier A/B.

MFG-TERM-003: Local device controls SHOULD include kiosk mode, restricted ports, and tamper-resistant settings (mapped to “Access control” and “Physical/Environmental security” expectations under the Royal Decree). 

### 4.6 Time synchronization (sequence matters in manufacturing)

MFG-TIME-001: All manufacturing systems participating in a controlled record (MES, e-sign, historian, DMS) SHALL use synchronized time (e.g., centralized NTP) and record the time source.

This is critical for audit trail reliability and reconstructing “who did what when”.

### 4.7 Offline / intermittent connectivity (shop-floor resilience)

MFG-OFF-001: If offline operation is required, the system SHALL:

* queue events locally with tamper-evident storage
* prevent backdating
* enforce re-auth for queued approvals upon reconnect (Tier A/B)
* reconcile sequence numbers and publish complete audit trails after reconnect

### 4.8 Batch/lot genealogy and traceability (manufacturing must-have)

MFG-TRC-001: The system SHALL record genealogy links:

* finished lot/batch → consumed material lots
* equipment IDs used (and status)
* operators and approvers
* recipe version
* key process parameters and alarms (as applicable)

MFG-TRC-002: The system SHALL provide exportable traceability reports per batch/lot for audits and investigations.

### 4.9 Equipment lifecycle controls (maintenance/calibration)

MFG-EQP-001: Equipment records SHALL support sign-offs for:

* maintenance completion
* calibration completion
* cleaning/line clearance (if used)
* “fit for use” release to production

MFG-EQP-002: If equipment is overdue calibration, the system SHALL block its selection for Tier A production steps (or require deviation + Tier A approval).

---

## 5. Evidence Bundle Extension for Manufacturing

Your previous “Evidence Bundle” concept is correct — for manufacturing, it must be richer.

MFG-EVID-001: Evidence Bundle for each **batch/lot** SHALL include:

* finalized batch/lot record (EBR)
* step signatures + meanings
* instruction/recipe version references (or hashes)
* material lots consumed + genealogy map
* equipment IDs + status at time of use
* alarms/events relevant to the batch (if captured)
* audit trail across all signature events

MFG-EVID-002: The system SHALL support “batch record finalization” to meet **original equivalence**: integrity assured from final form + displayable later. 

MFG-EVID-003: For high criticality, the system SHOULD apply a cryptographic seal/digital signature to the finalized batch record so later alteration is detectable (reliable method expectation). 

---

## 6. Security Techniques Mapping (manufacturing context)

Manufacturing systems are often “operational technology (OT)” + IT mixed. Your implementation MUST map controls to the Royal Decree’s security technique model:

MFG-SEC-001: The organization SHALL define which manufacturing transactions fall under **Strict/Medium/Basic** levels and apply controls accordingly. 

MFG-SEC-002: At minimum, controls SHALL cover the Royal Decree’s required control families (administrative security, infrastructure, asset management, personnel security, physical/environmental security, operations, access control, secure development/maintenance, incident management, continuity, audit/compliance). 

MFG-SEC-003: CIA requirements (confidentiality, integrity, availability) SHALL be addressed explicitly for shop-floor devices and back-end systems. 

---

## 7. Manufacturing Signature Policy Matrix (Template)

Use this table to configure your system quickly. (You can adjust by risk.)

| Manufacturing Control Point                 | Tier | Required Signatures                     | Signing Meaning      | Suggested Auth                    |
| ------------------------------------------- | ---: | --------------------------------------- | -------------------- | --------------------------------- |
| Line clearance before run                   |    A | Operator + Supervisor/QA                | Verified / Approved  | MFA, re-auth at sign              |
| Dispensing / Weighing critical materials    |  A/B | Operator + Checker                      | Performed / Verified | MFA for checker                   |
| Critical process parameter override         |    A | Supervisor + QA                         | Approved             | Strongest auth                    |
| In-process QC check (IPC)                   |    B | Operator (and Checker if needed)        | Performed / Verified | Medium-strong auth                |
| Batch record finalization                   |    A | QA release                              | Released             | Strongest auth, seal final record |
| Maintenance completion affecting production |    B | Maintenance + Production/QA (as policy) | Completed / Verified | Medium auth                       |
| Calibration completion                      |  A/B | Metrology + QA (if required)            | Completed / Approved | Strong auth                       |

Legal anchor: signatures must identify signatory and indicate approval with appropriate reliability. 

---

## 8. What I Changed vs the Original Generic Spec (Gap Closure)

These were the main gaps for manufacturing, now covered:

1. **Step-level signing meaning + hold points** (critical in MES/EBR).
2. **Shared terminal controls** (prevent wrong-person signing).
3. **Data corrections as append-only with reasons** (common audit finding).
4. **Genealogy + equipment status recorded with signatures** (core manufacturing traceability).
5. **Offline tolerance** (real shop-floor condition).
6. **Batch finalization + sealing** for “original record” integrity. 

---

# Next step (optional, but very practical)

If you paste (or describe) your actual manufacturing flow (e.g., **Line clearance → Setup → Run → IPC → Packaging → QA release**), I can generate a **complete requirement matrix**:

* REQ ID → workflow step → signature type → auth strength → evidence bundle fields → test cases (UAT) → audit report outputs.

That matrix is usually what teams use to implement and validate retrofits in MES/DMS workflows.

[1]: https://www.etda.or.th/getattachment/Regulator/DigitalID/law/%28Translation%29-ETS-DID-Part3-Authentication_V01-22F.pdf.aspx?lang=th-TH "DIGITAL IDENTITY – AUTHENTICATION REQUIREMENTS"
