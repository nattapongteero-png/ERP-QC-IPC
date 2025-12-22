-- Migration: Add Employee Personal Data Fields
-- Feature: 007-hr-personnel-management
-- Date: 2024-12-22
--
-- This migration adds enhanced personal data fields to the hr_employees table
-- Note: For SQLite/development environments, schema-sync will auto-add these columns
-- For MySQL/production, run this migration manually or via the schema-sync process

-- MySQL Migration Script
-- Run these statements on MySQL production databases

-- Add personal identification fields
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `thai_cid` VARCHAR(255) NULL COMMENT 'Encrypted Thai Citizen ID';
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `thai_cid_hash` VARCHAR(64) NULL COMMENT 'SHA-256 hash for uniqueness checking';
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `date_of_birth` DATE NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `gender` ENUM('male', 'female', 'other') NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `blood_type` ENUM('A', 'B', 'O', 'AB', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'unknown') NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `religion` VARCHAR(50) NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `marital_status` ENUM('single', 'married', 'divorced', 'widowed') NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `nationality_code` VARCHAR(3) DEFAULT 'TH';

-- Add photo fields
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `photo_url` VARCHAR(500) NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `photo_thumbnail_url` VARCHAR(500) NULL;

-- Add government ID fields
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `sso_number` VARCHAR(20) NULL COMMENT 'Social Security Number';
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `tax_id` VARCHAR(20) NULL COMMENT 'Tax Identification Number';

-- Add current address fields
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `address_line1` VARCHAR(255) NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `address_line2` VARCHAR(255) NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `sub_district` VARCHAR(100) NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `district` VARCHAR(100) NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `province` VARCHAR(100) NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `postal_code` VARCHAR(10) NULL;

-- Add permanent address fields
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `permanent_address_line1` VARCHAR(255) NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `permanent_address_line2` VARCHAR(255) NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `permanent_sub_district` VARCHAR(100) NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `permanent_district` VARCHAR(100) NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `permanent_province` VARCHAR(100) NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `permanent_postal_code` VARCHAR(10) NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `use_same_address` TINYINT(1) DEFAULT 0;

-- Add emergency contact fields
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `emergency_contact_name` VARCHAR(100) NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `emergency_contact_relation` VARCHAR(50) NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `emergency_contact_phone` VARCHAR(20) NULL;

-- Add banking information fields (encrypted)
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `bank_name` VARCHAR(100) NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `bank_branch` VARCHAR(100) NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `bank_account_number` VARCHAR(255) NULL COMMENT 'Encrypted bank account number';
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `bank_account_name` VARCHAR(100) NULL;

-- Add education fields
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `education_level` ENUM('below_high_school', 'high_school', 'vocational', 'diploma', 'bachelor', 'master', 'doctorate') NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `education_field` VARCHAR(100) NULL;
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `education_institution` VARCHAR(200) NULL;

-- Add military status
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `military_status` ENUM('exempted', 'completed', 'reserved', 'not_applicable') NULL;

-- Add medical notes (encrypted for sensitive health info)
ALTER TABLE `hr_employees` ADD COLUMN IF NOT EXISTS `medical_notes` TEXT NULL COMMENT 'Allergies, chronic conditions, etc.';

-- Create index for Thai CID hash (for uniqueness checking)
CREATE INDEX IF NOT EXISTS `idx_hr_employees_thai_cid_hash` ON `hr_employees`(`thai_cid_hash`);

-- ====================================
-- SQLite Migration Script (Alternative)
-- ====================================
-- SQLite uses different syntax. These are for reference only.
-- The schema-sync utility handles SQLite automatically.
--
-- ALTER TABLE "hr_employees" ADD COLUMN "thai_cid" TEXT;
-- ALTER TABLE "hr_employees" ADD COLUMN "thai_cid_hash" TEXT;
-- ALTER TABLE "hr_employees" ADD COLUMN "date_of_birth" TEXT;
-- ALTER TABLE "hr_employees" ADD COLUMN "gender" TEXT;
-- ALTER TABLE "hr_employees" ADD COLUMN "blood_type" TEXT;
-- (... etc - schema-sync handles this automatically)

-- ====================================
-- Post-Migration Notes
-- ====================================
-- 1. Set EMPLOYEE_DATA_ENCRYPTION_KEY environment variable before using encryption
-- 2. Existing employees will have NULL values for new fields
-- 3. Photo uploads require write access to public/uploads/employees directory
-- 4. Thai CID validation includes checksum verification
-- 5. Sensitive fields (thai_cid, bank_account_number) are stored encrypted
