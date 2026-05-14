# QC + COA Module Design — Herbal Medicine ERP

**Date**: 2026-04-30
**Author**: Claude Opus 4.7 (research-driven design)
**Status**: Draft for review

## 1. Standards & References

ออกแบบตามมาตรฐานสากลที่บังคับใช้กับโรงงานยา/สมุนไพร:

- **ISO/IEC 17025:2017** — Laboratory competence (single most important standard for COA-issuing labs)
- **FDA 21 CFR Part 11** — Electronic records & signatures (audit trail, e-signature, access control)
- **FDA 21 CFR Part 211 Subpart I** — Laboratory controls (pharmaceutical cGMP)
- **WHO Model Certificate of Analysis** (TRS 1010, Annex 4) — fields template
- **WHO Quality Control Methods for Medicinal Plant Materials** — herbal-specific tests
- **USP <1010>** — Analytical data treatment / **USP <1080>** — COA for excipients
- **IPEC-PQG Pharmaceutical Excipient COA Guideline** — industry best practice
- **Ph.Eur 2.8.20 / Thai Herbal Pharmacopoeia** — herbal monographs

## 2. Architecture Overview

3 โมดูลทำงานร่วมกัน + reuse ของเดิม:

```
┌────────────────────────────────────────────────────────────────┐
│ EXISTING: ipc_criteria (test master) + quality_tests (results) │
└────────────────────────────────────────────────────────────────┘
                            ▲                  ▲
                            │ reuse            │ reuse
                            │                  │
   ┌────────────────────────┴───┐  ┌──────────┴──────────────────┐
   │ NEW: QC Standalone Module  │  │ EXISTING: WO Production    │
   │  /quality/qc-entry         │  │  /production/work-orders   │
   │  - Sample lifecycle        │  │  (อยู่แล้ว, ไม่แตะ)          │
   │  - 3-tier review           │  │                            │
   │  - OOS workflow            │  │                            │
   └────────────────┬───────────┘  └────────────────────────────┘
                    │ Released sample
                    ▼
   ┌────────────────────────────┐
   │ NEW: COA Module            │
   │  /quality/coa              │
   │  - Generate from QC data   │
   │  - Template editor         │
   │  - PDF render (Puppeteer)  │
   │  - QR verify public route  │
   └────────────────┬───────────┘
                    │
   ┌────────────────▼───────────┐
   │ NEW: Public Verify Portal  │
   │  /coa/verify/{coaNumber}   │
   │  (no login, customer-facing)│
   └────────────────────────────┘
```

## 3. Module 1: QC Standalone (LIMS-style)

### 3.1 Sample Lifecycle

Sample = unit of work for QC. Source can be ANY of:

| Source Type | Use Case |
|---|---|
| `raw_material_lot` | Incoming RM inspection (no WO yet) |
| `work_order_batch` | In-process / FG sample from WO |
| `customer_return` | Customer complaint / quality issue |
| `stability` | Stability study sample |
| `purchased_herb` | Sample of herbs received from suppliers |
| `outgoing_shipment` | QC of herbs going to customers (THIS IS THE COA-DRIVING ONE) |

**State machine**:
```
draft → registered → testing → reviewed → approved → released
                                       └→ rejected → quarantine
                                       └→ oos → investigation → (re-test or fail)
```

### 3.2 Database Schema

```sql
-- Sample registration
CREATE TABLE qc_samples (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sample_number VARCHAR(50) UNIQUE NOT NULL,  -- e.g. "QC-2026-0001"
  source_type ENUM('raw_material_lot','work_order_batch','customer_return',
                   'stability','purchased_herb','outgoing_shipment','other') NOT NULL,
  source_ref_id INT,            -- FK to relevant table (lot/wo/etc)
  source_ref_text VARCHAR(255), -- free text when source_ref_id not set
  product_id INT NOT NULL,      -- FK items.id (test panel resolution)
  lot_number VARCHAR(100),      -- batch/lot identifier
  manufacture_date DATE,
  expiry_date DATE,
  retest_date DATE,
  quantity_received DECIMAL(15,3),
  unit VARCHAR(20),
  storage_conditions TEXT,
  customer_id INT,              -- if outgoing, FK customers
  sales_order_ref VARCHAR(50),  -- if outgoing, link SO
  received_date DATE NOT NULL,
  received_by INT NOT NULL,     -- FK users
  status ENUM('draft','registered','testing','reviewed','approved',
              'released','rejected','quarantine','oos') DEFAULT 'draft',
  notes TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_status (status),
  INDEX idx_product_lot (product_id, lot_number)
);

-- Per-test result lines
CREATE TABLE qc_sample_tests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sample_id INT NOT NULL REFERENCES qc_samples(id) ON DELETE CASCADE,
  criteria_id INT NOT NULL REFERENCES ipc_criteria(id),  -- reuse master
  sequence INT NOT NULL,        -- display order on COA
  -- Spec snapshot at test time (template may change later)
  spec_min DECIMAL(15,4),
  spec_max DECIMAL(15,4),
  spec_target DECIMAL(15,4),
  spec_text VARCHAR(500),       -- for non-numeric specs (e.g. "Pass identification")
  unit VARCHAR(20),
  test_method VARCHAR(255),     -- e.g. "USP <11>", "Ph.Eur 2.8.20", "In-house SOP-XXX"
  -- Actual result
  numeric_result DECIMAL(15,4),
  text_result TEXT,
  result_status ENUM('pending','pass','fail','retest','na') DEFAULT 'pending',
  -- Audit
  tested_by INT REFERENCES users(id),
  tested_at DATETIME,
  reviewed_by INT REFERENCES users(id),
  reviewed_at DATETIME,
  notes TEXT,
  attachment_path VARCHAR(500), -- chromatogram / photo
  INDEX idx_sample (sample_id)
);

-- Default test panels per product type
CREATE TABLE qc_test_panels (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT,               -- specific product OR null = applies to all
  product_category VARCHAR(50), -- 'herb', 'capsule', 'powder', etc.
  criteria_id INT NOT NULL REFERENCES ipc_criteria(id),
  is_required BOOLEAN DEFAULT TRUE,
  sequence INT,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE (product_id, criteria_id)
);

-- OOS investigation (FDA Part 211.192)
CREATE TABLE qc_oos_investigations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sample_test_id INT NOT NULL REFERENCES qc_sample_tests(id),
  initiated_by INT NOT NULL,
  initiated_at DATETIME NOT NULL,
  phase1_lab_error_check TEXT,   -- analyst hypothesis
  phase2_root_cause TEXT,
  classification ENUM('lab_error','manufacturing_error','undetermined'),
  retest_authorized BOOLEAN DEFAULT FALSE,
  closed_by INT,
  closed_at DATETIME,
  conclusion TEXT,
  capa_id INT REFERENCES capa(id)
);

-- Sample disposition (3-tier sign-off per 21 CFR Part 11)
CREATE TABLE qc_sample_signatures (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sample_id INT NOT NULL REFERENCES qc_samples(id) ON DELETE CASCADE,
  role ENUM('analyst','reviewer','approver','qa_release') NOT NULL,
  user_id INT NOT NULL REFERENCES users(id),
  signed_at DATETIME NOT NULL,
  signature_meaning VARCHAR(50), -- 'Tested', 'Reviewed', 'Approved', 'Released'
  notes TEXT,
  -- 21 CFR Part 11: meaning + auditable link
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  UNIQUE (sample_id, role)
);
```

### 3.3 UI Pages

```
/quality/qc-entry            → Sample list + register new
/quality/qc-entry/[id]       → Sample detail (test results entry)
/quality/qc-entry/[id]/oos   → OOS investigation form
/quality/test-panels         → Test panel master (per product/category)
```

**Sample list features**:
- Filter by status, date range, source type, product
- Quick action buttons: Test / Review / Release / Reject
- Status badges (color-coded)
- Search by sample number / lot number / product name

**Sample detail layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ [Header] Sample QC-2026-0001 · Status: Testing              │
│ Product: ขมิ้นชันแคปซูล 500mg · Lot: BG-2026-0070          │
└─────────────────────────────────────────────────────────────┘
┌─ Source Info ──────────┐  ┌─ Receipt Info ────────────┐
│ Type: WO Batch         │  │ Received: 30/4/2026       │
│ Ref: WO2604297175      │  │ By: Somrak               │
│ Qty: 100 capsules      │  │ Storage: Ambient          │
└────────────────────────┘  └──────────────────────────┘

┌─ Test Results (8 tests) ──────────────────────────────────┐
│ # │ Test Name      │ Method  │ Spec       │ Result │ Status │
│ 1 │ Description    │ Visual  │ Brown caps │ Brown  │ ✓ Pass │
│ 2 │ Loss on Drying │ USP<731>│ NMT 7%     │ 5.2%   │ ✓ Pass │
│ 3 │ Total Ash      │ USP<561>│ NMT 14%    │ 11.8%  │ ✓ Pass │
│ 4 │ Heavy Metals   │ ICP-MS  │ NMT 10ppm  │ 2.1ppm │ ✓ Pass │
│ 5 │ Curcumin       │ HPLC    │ NLT 3.0%   │ 4.2%   │ ✓ Pass │
│ ...                                                       │
└──────────────────────────────────────────────────────────┘

┌─ Sign-off (21 CFR Part 11) ─────────────────────────────┐
│ Tested by   : Somrak       30/4/2026 14:23  [signed]   │
│ Reviewed by : Jiratchaya   30/4/2026 16:08  [signed]   │
│ Approved by : QC Manager   [pending]        [Sign]     │
└────────────────────────────────────────────────────────┘

[Reject Sample] [Approve & Release] [Generate COA]
```

## 4. Module 2: COA Generation

### 4.1 COA Number Format

`COA-{YEAR}-{6-digit-seq}` → `COA-2026-000123`

### 4.2 Database Schema

```sql
CREATE TABLE coa_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  coa_number VARCHAR(30) UNIQUE NOT NULL,
  sample_id INT NOT NULL REFERENCES qc_samples(id),
  template_id INT REFERENCES coa_templates(id),
  product_id INT NOT NULL,
  lot_number VARCHAR(100) NOT NULL,
  customer_id INT REFERENCES customers(id),
  sales_order_ref VARCHAR(50),
  -- Document metadata
  issue_date DATE NOT NULL,
  expiry_date DATE,
  retest_date DATE,
  manufacture_date DATE,
  conclusion ENUM('complies','does_not_comply','partial') NOT NULL,
  -- Lifecycle
  status ENUM('draft','review','approved','issued','superseded','revoked') DEFAULT 'draft',
  superseded_by INT REFERENCES coa_documents(id),
  revoke_reason TEXT,
  -- Verification
  qr_code_token VARCHAR(64) UNIQUE NOT NULL, -- random hash for public lookup
  -- Audit
  created_at DATETIME NOT NULL,
  created_by INT NOT NULL REFERENCES users(id),
  approved_at DATETIME,
  approved_by INT REFERENCES users(id),
  released_at DATETIME,
  released_by INT REFERENCES users(id),
  -- PDF cache
  pdf_path VARCHAR(500),
  pdf_generated_at DATETIME
);

CREATE TABLE coa_test_results (
  id INT PRIMARY KEY AUTO_INCREMENT,
  coa_id INT NOT NULL REFERENCES coa_documents(id) ON DELETE CASCADE,
  sample_test_id INT REFERENCES qc_sample_tests(id), -- source of truth
  sequence INT NOT NULL,
  -- Snapshot at COA issue time (immutable)
  test_name VARCHAR(255) NOT NULL,
  test_name_th VARCHAR(255),
  test_method VARCHAR(255),
  specification VARCHAR(500) NOT NULL,
  result VARCHAR(500) NOT NULL,
  result_unit VARCHAR(20),
  conclusion ENUM('conform','non_conform','na') NOT NULL,
  notes TEXT
);

CREATE TABLE coa_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  product_category VARCHAR(50),  -- 'herb','capsule','powder','liquid' or null=default
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  -- Layout config (JSON)
  header_logo_path VARCHAR(500),
  header_html TEXT,             -- company name, address, license #
  footer_html TEXT,             -- disclaimer, references
  -- Signatory roles required
  signatory_roles JSON,         -- e.g. ["analyst","qc_manager","qa_manager"]
  -- Optional sections to show/hide
  show_storage_conditions BOOLEAN DEFAULT TRUE,
  show_expiry_date BOOLEAN DEFAULT TRUE,
  show_retest_date BOOLEAN DEFAULT FALSE,
  show_qr_verify BOOLEAN DEFAULT TRUE,
  -- Languages
  language ENUM('th','en','bilingual') DEFAULT 'bilingual'
);

CREATE TABLE coa_signatures (
  id INT PRIMARY KEY AUTO_INCREMENT,
  coa_id INT NOT NULL REFERENCES coa_documents(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,    -- 'analyst','qc_manager','qa_manager'
  user_id INT NOT NULL REFERENCES users(id),
  user_name_snapshot VARCHAR(100),  -- preserve display name
  user_title_snapshot VARCHAR(100), -- preserve job title
  signed_at DATETIME NOT NULL,
  signature_image_path VARCHAR(500),
  signature_meaning VARCHAR(50),    -- 'Tested','Reviewed','Approved','Released'
  ip_address VARCHAR(45),
  UNIQUE (coa_id, role)
);

CREATE TABLE coa_print_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  coa_id INT NOT NULL REFERENCES coa_documents(id),
  printed_by INT NOT NULL REFERENCES users(id),
  printed_at DATETIME NOT NULL,
  print_type ENUM('preview','official','reprint','customer_email') NOT NULL,
  customer_email VARCHAR(255),  -- if emailed
  ip_address VARCHAR(45)
);
```

### 4.3 Standard COA Layout (per WHO TRS 1010 Annex 4)

```
┌──────────────────────────────────────────────────────────┐
│ [LOGO]   เมตา เฮิร์บ จำกัด                                │
│          123 ถ.สมุนไพร, จังหวัด                          │
│          เลขทะเบียนผลิตยา: G 1234/2566                   │
├──────────────────────────────────────────────────────────┤
│            CERTIFICATE OF ANALYSIS                       │
│            ใบรับรองคุณภาพ                                  │
│                                                          │
│   COA No.: COA-2026-000123     Issue Date: 30/4/2026    │
│                                Page 1 of 2               │
└──────────────────────────────────────────────────────────┘

PRODUCT INFORMATION / ข้อมูลสินค้า
┌──────────────────────────────────────────────────────────┐
│ Product Name (TH/EN) : ขมิ้นชันแคปซูล 500mg              │
│                        Curcuma longa Capsule 500mg       │
│ Product Code         : FG-6369                           │
│ Batch / Lot Number   : BG-2026-0070                      │
│ Manufacture Date     : 28 April 2026                     │
│ Expiry Date          : 27 April 2028 (24 months)         │
│ Storage Conditions   : Store below 30°C, dry place       │
│ Quantity             : 1,000 bottles × 60 capsules       │
│ Customer / PO        : ABC Pharmacy / PO-2026-0042       │
└──────────────────────────────────────────────────────────┘

TEST RESULTS / ผลการทดสอบ
┌────┬──────────────────┬──────────┬─────────────┬──────────┬──────────┐
│ #  │ Test             │ Method   │ Specification│ Result   │ Status   │
├────┼──────────────────┼──────────┼─────────────┼──────────┼──────────┤
│  1 │ Description      │ Visual   │ Brown caps. │ Conforms │ ✓ Pass   │
│  2 │ Identification   │ TLC      │ Pos. for    │ Positive │ ✓ Pass   │
│    │                  │          │ Curcumin    │          │          │
│  3 │ Loss on Drying   │ USP<731> │ NMT 7.0%    │ 5.2%     │ ✓ Pass   │
│  4 │ Total Ash        │ USP<561> │ NMT 14.0%   │ 11.8%    │ ✓ Pass   │
│  5 │ Heavy Metals     │ ICP-MS   │ NMT 10 ppm  │ 2.1 ppm  │ ✓ Pass   │
│  6 │ Microbial Count  │ USP<2021>│ <10⁵ CFU/g  │ 4×10³    │ ✓ Pass   │
│  7 │ Curcumin Assay   │ HPLC     │ NLT 3.0%    │ 4.2%     │ ✓ Pass   │
│  8 │ Disintegration   │ USP<2040>│ ≤30 min     │ 18 min   │ ✓ Pass   │
└────┴──────────────────┴──────────┴─────────────┴──────────┴──────────┘

CONCLUSION / สรุปผล
┌──────────────────────────────────────────────────────────┐
│ ✓ The above lot COMPLIES with the specifications.       │
│   ล็อตข้างต้นเป็นไปตามข้อกำหนดทุกประการ                  │
└──────────────────────────────────────────────────────────┘

APPROVALS / การลงนาม
┌─────────────────────┬────────────────────┬────────────────┐
│ Tested by           │ Reviewed by        │ Approved by    │
│                     │                    │                │
│ [signature]         │ [signature]        │ [signature]    │
│                     │                    │                │
│ Somrak K.           │ Jiratchaya P.      │ Dr. QC Manager │
│ Analyst             │ QC Reviewer        │ QA Director    │
│ 30/4/2026 14:23     │ 30/4/2026 16:08    │ 30/4/2026 17:45│
└─────────────────────┴────────────────────┴────────────────┘

References: USP 47, Ph.Eur 11, Thai Herbal Pharmacopoeia 2022
[QR Code]   Verify at: https://herbal-erp/coa/verify/COA-2026-000123

This certificate is computer-generated. Audit trail available on request.
─── End of Certificate ───
```

### 4.4 PDF Generation

**Stack**: Puppeteer (headless Chrome) + React component
- Reasons: native Thai font support, same layout in browser preview + PDF, easy to style with Tailwind
- Alternative considered: react-pdf (rejected — Thai font breaking, complex layout limitations)

**Endpoint**: `GET /api/quality/coa/[id]/pdf?type={preview|official}`
- Preview: watermark "DRAFT" if not approved, or "PREVIEW" with timestamp
- Official: only if `status='issued'`, no watermark, embeds QR code

**Caching**: PDF cached at `coa_documents.pdf_path` after first generation. Regenerate only when COA data changes (status flip, signature added).

## 5. Module 3: Public Verify Portal

### 5.1 Endpoint

`GET /coa/verify/{coa_number_or_qr_token}` — public, no auth

### 5.2 Display

Read-only minimal view showing the same data as PDF:
- COA number, status (Issued / Superseded / Revoked)
- Product info, test results, conclusion
- Signed by (names + roles + dates, but NOT signature images)
- "Download PDF" button (returns the same official PDF)
- "Last updated" timestamp

### 5.3 Security

- Rate-limit: 60 req/min per IP
- QR token = random 32-byte URL-safe (not guessable)
- Show 404 for revoked/superseded COAs (or show with warning banner)
- Logged: every verify view → `coa_verify_log` (for audit)

## 6. Implementation Phases

| Phase | Deliverable | Effort | Dep |
|---|---|---|---|
| **1** | DB schema + migration + dual-schema sync | 1 day | - |
| **2** | QC Sample CRUD + test panel master + UI list/detail | 2 days | 1 |
| **3** | 3-tier sign-off + OOS workflow + state machine | 1.5 days | 2 |
| **4** | COA generator service (data assembly from sample) | 1 day | 3 |
| **5** | COA template editor + standard default templates | 1 day | 4 |
| **6** | PDF rendering (Puppeteer setup + React component) | 1.5 days | 5 |
| **7** | Public verify portal + QR code generation | 0.5 day | 6 |
| **8** | Customer linkage + email-COA + sales order ref | 1 day | 7 |
| **9** | Audit trail viewer (per 21 CFR Part 11) | 0.5 day | 3 |
| **10** | E2E testing + GMP review + UAT | 1 day | all |

**Total: ~11 days** of focused work.

**MVP scope** (~5 days): Phases 1, 2, 4, 6, 7 — gets COA generated and printable. Templates + customer email come later.

## 7. Open Questions (Need User Confirmation)

1. **COA scope**: ออก COA ให้ FG ที่ขายลูกค้า (โรงงานเรา manufacture) เท่านั้น หรือรวมขายต่อสมุนไพรที่รับมาจาก supplier ด้วย?
2. **Test panel**: ใช้ ipc_criteria เดิมเป็น master เดียว ครอบคลุมทั้ง release test + IPC ได้ไหม? หรือต้องแยกตาราง release-test?
3. **Signatory**: 3 ระดับ (Analyst → QC Manager → QA Manager) เหมาะกับโรงงานคุณไหม? หรือมี role อื่น?
4. **Digital signature**: ใช้ password re-entry ตอน sign (เหมือน 21 CFR Part 11) หรือแค่ click + audit log?
5. **Signature image**: เก็บ image ของลายเซ็นจริง (upload ครั้งเดียวต่อ user) หรือใช้ typed name + timestamp?
6. **PDF language**: bilingual (TH+EN) ทุกใบ หรือเลือกได้ตามลูกค้า?
7. **Watermark/security**: ต้องมี holographic-style watermark, serial number, anti-tamper hash ไหม?
8. **Customer portal**: ลูกค้า login เข้ามาเห็น COA ของตัวเอง หรือแค่ public URL + QR?

## 8. Compliance Checklist

ระบบ design นี้ครอบคลุม:

- ✅ **ISO/IEC 17025**: traceability, calibration ref (เพิ่ม field method + reviewer), method validation
- ✅ **21 CFR Part 11**: e-signature with meaning, audit trail, access control, time-stamped records
- ✅ **WHO TRS 1010 Annex 4**: all 8 standard COA fields covered
- ✅ **USP <1080>**: identity, lot info, test methods, results, signatory
- ✅ **WHO QC Methods for Herbal**: LOD, ash, heavy metals, microbial, identification, assay
- ✅ **PIC/S PI 011**: validated computerized system, electronic records
- ✅ **GMP cGMP 21 CFR 211 Subpart I**: laboratory controls, OOS investigation
