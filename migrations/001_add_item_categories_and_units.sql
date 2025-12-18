-- Migration: Add item_categories and item_units lookup tables
-- Date: 2024-12-19
-- Description: Create lookup tables for item categories and units of measurement

-- Create item_categories table
CREATE TABLE IF NOT EXISTS item_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name_th VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  description VARCHAR(500),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create item_units table
CREATE TABLE IF NOT EXISTS item_units (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name_th VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  symbol VARCHAR(20),
  description VARCHAR(500),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed data for item_categories
INSERT INTO item_categories (code, name_th, name_en, description, sort_order) VALUES
  ('herb', 'สมุนไพร', 'Herb', 'วัตถุดิบจากพืชสมุนไพร', 1),
  ('extract', 'สารสกัด', 'Extract', 'สารสกัดจากพืชหรือสมุนไพร', 2),
  ('excipient', 'สารช่วย', 'Excipient', 'สารช่วยในการผลิตยา', 3),
  ('capsule', 'แคปซูล', 'Capsule', 'เปลือกแคปซูลสำหรับบรรจุยา', 4),
  ('tablet', 'เม็ดยา', 'Tablet', 'ยาเม็ดสำเร็จรูป', 5),
  ('liquid', 'ของเหลว', 'Liquid', 'สารในรูปแบบของเหลว', 6),
  ('bottle', 'ขวด', 'Bottle', 'ขวดบรรจุภัณฑ์', 7),
  ('label', 'ฉลาก', 'Label', 'ฉลากสินค้า', 8),
  ('box', 'กล่อง', 'Box', 'กล่องบรรจุภัณฑ์', 9),
  ('pouch', 'ซอง', 'Pouch', 'ซองบรรจุภัณฑ์', 10),
  ('cap', 'ฝา', 'Cap', 'ฝาปิดขวด', 11),
  ('insert', 'ใบแทรก', 'Insert', 'เอกสารแทรกในบรรจุภัณฑ์', 12),
  ('other', 'อื่นๆ', 'Other', 'หมวดหมู่อื่นๆ', 99)
ON DUPLICATE KEY UPDATE
  name_th = VALUES(name_th),
  name_en = VALUES(name_en),
  description = VALUES(description),
  sort_order = VALUES(sort_order);

-- Seed data for item_units
INSERT INTO item_units (code, name_th, name_en, symbol, description, sort_order) VALUES
  ('kg', 'กิโลกรัม', 'Kilogram', 'kg', 'หน่วยน้ำหนักมาตรฐาน', 1),
  ('g', 'กรัม', 'Gram', 'g', 'หน่วยน้ำหนัก', 2),
  ('mg', 'มิลลิกรัม', 'Milligram', 'mg', 'หน่วยน้ำหนักขนาดเล็ก', 3),
  ('L', 'ลิตร', 'Liter', 'L', 'หน่วยปริมาตรมาตรฐาน', 4),
  ('mL', 'มิลลิลิตร', 'Milliliter', 'mL', 'หน่วยปริมาตรขนาดเล็ก', 5),
  ('pcs', 'ชิ้น', 'Pieces', 'pcs', 'หน่วยนับเป็นชิ้น', 6),
  ('bottle', 'ขวด', 'Bottle', 'btl', 'หน่วยนับเป็นขวด', 7),
  ('box', 'กล่อง', 'Box', 'box', 'หน่วยนับเป็นกล่อง', 8),
  ('pack', 'แพ็ค', 'Pack', 'pk', 'หน่วยนับเป็นแพ็ค', 9),
  ('roll', 'ม้วน', 'Roll', 'roll', 'หน่วยนับเป็นม้วน', 10),
  ('sheet', 'แผ่น', 'Sheet', 'sht', 'หน่วยนับเป็นแผ่น', 11),
  ('set', 'ชุด', 'Set', 'set', 'หน่วยนับเป็นชุด', 12),
  ('bag', 'ถุง', 'Bag', 'bag', 'หน่วยนับเป็นถุง', 13),
  ('drum', 'ถัง', 'Drum', 'drm', 'หน่วยนับเป็นถังใหญ่', 14),
  ('can', 'กระป๋อง', 'Can', 'can', 'หน่วยนับเป็นกระป๋อง', 15),
  ('tube', 'หลอด', 'Tube', 'tube', 'หน่วยนับเป็นหลอด', 16),
  ('capsule', 'แคปซูล', 'Capsule', 'cap', 'หน่วยนับเป็นแคปซูล', 17),
  ('tablet', 'เม็ด', 'Tablet', 'tab', 'หน่วยนับเป็นเม็ด', 18)
ON DUPLICATE KEY UPDATE
  name_th = VALUES(name_th),
  name_en = VALUES(name_en),
  symbol = VALUES(symbol),
  description = VALUES(description),
  sort_order = VALUES(sort_order);
