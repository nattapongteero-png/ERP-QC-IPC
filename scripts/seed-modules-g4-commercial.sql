-- =====================================================================
-- Group 4: Purchasing / Sales / Accounting / Cost — consistent with items,
--          vendors(1..3), customers(1..5), gl_accounts, work_orders.
-- Insert order: PO -> SO -> deliveries -> AP/AR invoices -> journals ->
--               costs -> PO-sourced GRNs.
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---- wipe (keep vendors/customers master) ----
DELETE FROM landed_cost_lines;        DELETE FROM landed_cost_headers;
DELETE FROM work_order_costs;         DELETE FROM item_cost_layers;
DELETE FROM standard_costs;
DELETE FROM ar_invoice_lines;         DELETE FROM ar_invoices;
DELETE FROM ap_invoice_lines;         DELETE FROM ap_invoices;
DELETE FROM journal_lines;            DELETE FROM journal_entries;
DELETE FROM sales_deliveries;         DELETE FROM sales_order_lines;  DELETE FROM sales_orders;
DELETE FROM approved_vendor_list;
DELETE FROM purchase_order_lines;     DELETE FROM purchase_orders;
-- PO-sourced GRNs (created here, after POs exist)
DELETE FROM goods_receipt_lines WHERE grn_id IN (SELECT id FROM goods_receipts WHERE source_type='po');
DELETE FROM goods_receipts WHERE source_type='po';

-- =====================================================================
-- PURCHASING
-- =====================================================================
INSERT INTO purchase_orders
 (id, po_number, vendor_id, status, order_date, expected_date, total_amount, currency, payment_terms, notes, created_by, approved_by, approved_at, created_at, updated_at) VALUES
 (1, 'PO-202606-000001', 1, 'received', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), 0, 'THB', 'Net 30', 'สั่งซื้อวัตถุดิบสมุนไพร', 5, 1, NOW(), NOW(), NOW()),
 (2, 'PO-202606-000002', 1, 'approved', NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY), 0, 'THB', 'Net 30', 'สั่งซื้อสารสกัดกระชายขาว (จาก PR4)', 5, 1, NOW(), NOW(), NOW()),
 (3, 'PO-202606-000003', 3, 'sent', NOW(), DATE_ADD(NOW(), INTERVAL 10 DAY), 0, 'THB', 'Net 15', 'สั่งซื้อบรรจุภัณฑ์', 5, 1, NOW(), NOW(), NOW()),
 (4, 'PO-202606-000004', 2, 'draft', NOW(), DATE_ADD(NOW(), INTERVAL 21 DAY), 0, 'THB', 'Net 30', 'ร่างใบสั่งซื้อสมุนไพรอินทรีย์', 5, NULL, NULL, NOW(), NOW());

INSERT INTO purchase_order_lines
 (po_id, item_id, quantity, received_quantity, unit, unit_price, total_price, expected_date, created_at) VALUES
 (1, 1,  100, 100, 'kg', 350,  35000,  DATE_ADD(NOW(), INTERVAL 7 DAY), NOW()),
 (1, 2,  80,  80,  'kg', 420,  33600,  DATE_ADD(NOW(), INTERVAL 7 DAY), NOW()),
 (2, 3,  30,  0,   'kg', 1500, 45000,  DATE_ADD(NOW(), INTERVAL 14 DAY), NOW()),
 (3, 36, 50,  0,   'box', 800, 40000,  DATE_ADD(NOW(), INTERVAL 10 DAY), NOW()),
 (3, 37, 20,  0,   'box', 1200,24000,  DATE_ADD(NOW(), INTERVAL 10 DAY), NOW()),
 (4, 15, 60,  0,   'kg', 280,  16800,  DATE_ADD(NOW(), INTERVAL 21 DAY), NOW());
UPDATE purchase_orders p SET total_amount=(SELECT COALESCE(SUM(total_price),0) FROM purchase_order_lines l WHERE l.po_id=p.id) WHERE p.id<=4;

-- approved vendor list
INSERT INTO approved_vendor_list (item_id, vendor_id, approval_date, expiry_date, is_preferred, created_at) VALUES
 (1, 1, NOW(), DATE_ADD(NOW(), INTERVAL 365 DAY), 1, NOW()),
 (2, 1, NOW(), DATE_ADD(NOW(), INTERVAL 365 DAY), 1, NOW()),
 (3, 2, NOW(), DATE_ADD(NOW(), INTERVAL 365 DAY), 1, NOW()),
 (36, 3, NOW(), DATE_ADD(NOW(), INTERVAL 365 DAY), 1, NOW());

-- =====================================================================
-- SALES (FG to customers) + deliveries from FG lots
-- =====================================================================
INSERT INTO sales_orders
 (id, so_number, customer_name, customer_contact, status, order_date, required_date, total_amount, currency, payment_terms, source, created_by, approved_by, created_at, updated_at) VALUES
 (1, 'SO-202606-000001', 'โรงพยาบาลไทยสมุนไพร', 'ฝ่ายจัดซื้อ', 'delivered', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), 0, 'THB', 'Net 30', 'direct', 6, 1, NOW(), NOW()),
 (2, 'SO-202606-000002', 'คลินิกแพทย์แผนไทยรุ่งเรือง', 'คุณหมอ', 'confirmed', NOW(), DATE_ADD(NOW(), INTERVAL 10 DAY), 0, 'THB', 'Net 15', 'direct', 6, 1, NOW(), NOW()),
 (3, 'SO-202606-000003', 'ร้านขายยาสุขภาพดี', 'เจ้าของร้าน', 'draft', NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY), 0, 'THB', 'Cash', 'direct', 6, NULL, NOW(), NOW());

INSERT INTO sales_order_lines
 (id, so_id, item_id, lot_id, quantity, allocated_quantity, shipped_quantity, unit, unit_price, total_price, unit_cost, total_cost, margin_amount, margin_percent, created_at) VALUES
 (1, 1, 59, NULL, 100, 100, 100, 'pcs', 250, 25000, 120, 12000, 13000, 52.00, NOW()),
 (2, 1, 9,  10,   200, 200, 200, 'bottle', 180, 36000, 95, 19000, 17000, 47.22, NOW()),
 (3, 2, 11, 12,   150, 150, 0,   'bottle', 200, 30000, 110, 16500, 13500, 45.00, NOW()),
 (4, 3, 10, NULL, 100, 0,   0,   'bottle', 170, 17000, NULL, NULL, NULL, NULL, NOW());
UPDATE sales_orders s SET total_amount=(SELECT COALESCE(SUM(total_price),0) FROM sales_order_lines l WHERE l.so_id=s.id) WHERE s.id<=3;

-- deliveries for the delivered SO 1
INSERT INTO sales_deliveries
 (so_id, so_line_id, item_id, lot_id, lot_number, quantity, unit, delivery_date, delivery_number, status, created_by, created_at) VALUES
 (1, 2, 9, 10, 'LOT-FG0001-2604', 200, 'bottle', NOW(), 'DNV-202606-000001', 'delivered', 6, NOW());

-- =====================================================================
-- ACCOUNTING — AP (from received PO 1) + AR (from delivered SO 1) + journals
-- =====================================================================
-- AP invoice from PO 1 (received): subtotal 68600, VAT 7% = 4802
INSERT INTO ap_invoices
 (id, invoice_number, vendor_id, purchase_order_id, invoice_date, due_date, received_date, description, subtotal, vat_amount, wht_amount, total_amount, paid_amount, currency, status, created_by, created_at, updated_at) VALUES
 (1, 'AP-VINV-2026-001', 1, 1, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), 'ค่าวัตถุดิบสมุนไพรตาม PO-000001', 68600, 4802, 0, 73402, 0, 'THB', 'approved', 5, NOW(), NOW()),
 (2, 'AP-VINV-2026-002', 3, 3, NOW(), DATE_ADD(NOW(), INTERVAL 15 DAY), NOW(), 'ค่าบรรจุภัณฑ์', 64000, 4480, 0, 68480, 0, 'THB', 'draft', 5, NOW(), NOW());
INSERT INTO ap_invoice_lines (ap_invoice_id, line_number, description, item_id, gl_account_id, quantity, unit_price, amount, vat_amount, created_at) VALUES
 (1, 1, 'ผงขมิ้นชัน 100kg', 1, 12, 100, 350, 35000, 2450, NOW()),
 (1, 2, 'ผงฟ้าทะลายโจร 80kg', 2, 12, 80, 420, 33600, 2352, NOW()),
 (2, 1, 'ซองฟอยล์ + ขวดแก้ว', 36, 15, 1, 64000, 64000, 4480, NOW());

-- AR invoice from delivered SO 1: subtotal 61000, VAT 4270
INSERT INTO ar_invoices
 (id, invoice_number, tax_invoice_number, customer_id, sales_order_id, invoice_date, due_date, description, subtotal, vat_amount, total_amount, paid_amount, currency, status, created_by, created_at, updated_at) VALUES
 (1, 'AR-INV-2026-001', 'TAX-2026-000001', 1, 1, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 'ขายสินค้าสำเร็จรูปตาม SO-000001', 61000, 4270, 65270, 0, 'THB', 'posted', 6, NOW(), NOW()),
 (2, 'AR-INV-2026-002', 'TAX-2026-000002', 2, 2, NOW(), DATE_ADD(NOW(), INTERVAL 15 DAY), 'ขายแคปซูลกระชายขาว', 30000, 2100, 32100, 0, 'THB', 'draft', 6, NOW(), NOW());
INSERT INTO ar_invoice_lines (ar_invoice_id, line_number, description, item_id, gl_account_id, quantity, unit_price, amount, vat_amount, lot_id, created_at) VALUES
 (1, 1, 'ลูกประคบสมุนไพร 100 ชิ้น', 59, 71, 100, 250, 25000, 1750, NULL, NOW()),
 (1, 2, 'แคปซูลขมิ้นชัน 200 ขวด', 9, 71, 200, 180, 36000, 2520, 10, NOW()),
 (2, 1, 'แคปซูลกระชายขาว 150 ขวด', 11, 71, 150, 200, 30000, 2100, NULL, NOW());

-- Journal entries (posted): AP receipt + AR sale
INSERT INTO journal_entries
 (id, entry_number, entry_date, description, source_type, source_id, status, total_debit, total_credit, posted_by, posted_at, created_by, created_at, updated_at) VALUES
 (1, 'JE-202606-000001', NOW(), 'รับวัตถุดิบตาม PO-000001', 'PO_RECEIPT', 1, 'posted', 73402, 73402, 1, NOW(), 5, NOW(), NOW()),
 (2, 'JE-202606-000002', NOW(), 'ขายสินค้าตาม SO-000001', 'SO_SHIPMENT', 1, 'posted', 65270, 65270, 1, NOW(), 6, NOW(), NOW()),
 (3, 'JE-202606-000003', NOW(), 'บันทึกต้นทุนขาย SO-000001', 'SO_SHIPMENT', 1, 'posted', 31000, 31000, 1, NOW(), 6, NOW(), NOW());
INSERT INTO journal_lines (journal_entry_id, line_number, gl_account_id, debit, credit, description, created_at) VALUES
 -- JE1: Dr Raw Materials 68600 + Input VAT 4802 / Cr AP 73402
 (1, 1, 12, 68600, 0, 'วัตถุดิบ', NOW()), (1, 2, 19, 4802, 0, 'ภาษีซื้อ', NOW()), (1, 3, 45, 0, 73402, 'เจ้าหนี้การค้า', NOW()),
 -- JE2: Dr AR 65270 / Cr Sales 61000 + Output VAT 4270
 (2, 1, 8, 65270, 0, 'ลูกหนี้การค้า', NOW()), (2, 2, 71, 0, 61000, 'รายได้จากการขาย', NOW()), (2, 3, 52, 0, 4270, 'ภาษีขาย', NOW()),
 -- JE3: Dr COGS 31000 / Cr Finished Goods 31000
 (3, 1, 77, 31000, 0, 'ต้นทุนขาย', NOW()), (3, 2, 14, 0, 31000, 'สินค้าสำเร็จรูป', NOW());

-- =====================================================================
-- COST MANAGEMENT
-- =====================================================================
-- standard costs (current) for finished goods
INSERT INTO standard_costs (item_id, effective_date, material_cost, labor_cost, overhead_cost, total_cost, standard_hours, standard_labor_rate, is_current, created_by, created_at) VALUES
 (9,  NOW(), 60, 18, 12, 90,  0.05, 360, 1, 1, NOW()),
 (11, NOW(), 70, 22, 14, 106, 0.06, 360, 1, 1, NOW()),
 (50, NOW(), 50, 16, 10, 76,  0.04, 360, 1, 1, NOW()),
 (59, NOW(), 80, 24, 16, 120, 0.08, 360, 1, 1, NOW());

-- item cost layers (WAC build-up for raw materials)
INSERT INTO item_cost_layers (item_id, transaction_type, transaction_id, transaction_date, quantity_in, unit_cost, total_cost, running_qty, running_total_cost, running_wac, notes, created_by, created_at) VALUES
 (1, 'purchase_receipt', 1, NOW(), 100, 350, 35000, 100, 35000, 350.0000, 'รับจาก PO-000001', 1, NOW()),
 (2, 'purchase_receipt', 1, NOW(), 80,  420, 33600, 80,  33600, 420.0000, 'รับจาก PO-000001', 1, NOW());

-- work order costs (for completed WO 26 + in_progress WO 14)
INSERT INTO work_order_costs (work_order_id, material_cost, labor_cost, overhead_cost, total_cost, produced_quantity, unit_cost, status, completed_at, created_at, updated_at) VALUES
 (26, 42000, 12000, 8000, 62000, 500, 124.0000, 'finalized', NOW(), NOW(), NOW()),
 (14, 35000, 9000,  6000, 50000, NULL, NULL, 'in_progress', NULL, NOW(), NOW());

-- landed cost (imported herb shipment example)
INSERT INTO landed_cost_headers (id, document_number, reference_type, reference_id, vendor_id, invoice_number, invoice_date, total_amount, currency, exchange_rate, status, created_by, created_at, updated_at) VALUES
 (1, 'LC-2026-0001', 'purchase_order', 2, 2, 'IMP-INV-001', NOW(), 8500, 'THB', 1, 'posted', 5, NOW(), NOW());
INSERT INTO landed_cost_lines (landed_cost_header_id, cost_type, description, amount, allocation_basis, created_at) VALUES
 (1, 'freight', 'ค่าขนส่งระหว่างประเทศ', 5000, 'value', NOW()),
 (1, 'duty', 'ภาษีนำเข้า', 2500, 'value', NOW()),
 (1, 'insurance', 'ค่าประกันภัยขนส่ง', 1000, 'value', NOW());

-- =====================================================================
-- PO-sourced GOODS RECEIPT (deferred from G1; PO 1 received)
-- =====================================================================
INSERT INTO goods_receipts (id, grn_number, source_type, po_id, vendor_id, warehouse_id, status, receiver_user_id, received_date, notes, created_at, updated_at) VALUES
 (2, 'GRN-2026-0002', 'po', 1, 1, 1, 'released', 4, CURDATE(), 'รับวัตถุดิบตาม PO-000001', NOW(), NOW());
INSERT INTO goods_receipt_lines (grn_id, line_number, item_id, expected_quantity, actual_quantity, unit, vendor_lot_number, batch_number, status, qc_sample_creation_failed, created_at, updated_at) VALUES
 (2, 1, 1, 100, 100, 'kg', 'V-TUR-2606', 'BN-PO1-RM0001', 'released_to_stock', 0, NOW(), NOW()),
 (2, 2, 2, 80,  80,  'kg', 'V-AND-2606', 'BN-PO1-RM0002', 'released_to_stock', 0, NOW(), NOW());

SET FOREIGN_KEY_CHECKS = 1;
SELECT
 (SELECT COUNT(*) FROM purchase_orders) po, (SELECT COUNT(*) FROM sales_orders) so,
 (SELECT COUNT(*) FROM ap_invoices) ap, (SELECT COUNT(*) FROM ar_invoices) ar,
 (SELECT COUNT(*) FROM journal_entries) je, (SELECT COUNT(*) FROM standard_costs) sc,
 (SELECT COUNT(*) FROM work_order_costs) woc, (SELECT COUNT(*) FROM landed_cost_headers) lc,
 (SELECT COUNT(*) FROM goods_receipts) grn_total;
