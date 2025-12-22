/**
 * HR Lookup Tables Auto-Seeder
 *
 * Automatically seeds default values into HR lookup tables
 * (org_units, positions, training_courses, app_roles, app_permissions)
 * if they are empty. This runs during server startup after schema sync.
 */

import { sql } from 'drizzle-orm';
import { isSqlite, getSqliteDb, getMysqlDb } from './index';
import * as schema from './schema';

/**
 * Organization Units aligned with Thai GMP (หลักเกณฑ์วิธีการที่ดีในการผลิตยา)
 *
 * Key requirements per Thai FDA GMP:
 * - Production Unit must be independent
 * - Quality Control Unit must be independent from Production
 * - Quality Assurance Unit provides oversight
 * - Engineering/Maintenance for equipment qualification
 * - Clear organizational structure with defined responsibilities
 */
const defaultOrgUnits = [
  // Organization level (หน่วยงาน)
  {
    code: 'ORG-001',
    name: 'โรงงานผลิตยาสมุนไพร',
    nameEn: 'Government Herbal Medicine Factory',
    type: 'company',
    parentId: null,
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },

  // ===== GMP Core Divisions (ฝ่ายหลักตาม GMP) =====
  // ฝ่ายผลิต - Production Division (ต้องเป็นอิสระจาก QC)
  {
    code: 'DIV-PROD',
    name: 'ฝ่ายผลิต',
    nameEn: 'Production Division',
    type: 'division',
    parentCode: 'ORG-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  // ฝ่ายควบคุมคุณภาพ - QC Division (ต้องเป็นอิสระจากฝ่ายผลิต ตาม GMP)
  {
    code: 'DIV-QC',
    name: 'ฝ่ายควบคุมคุณภาพ',
    nameEn: 'Quality Control Division',
    type: 'division',
    parentCode: 'ORG-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  // ฝ่ายประกันคุณภาพ - QA Division (กำกับดูแลระบบคุณภาพ)
  {
    code: 'DIV-QA',
    name: 'ฝ่ายประกันคุณภาพ',
    nameEn: 'Quality Assurance Division',
    type: 'division',
    parentCode: 'ORG-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  // ฝ่ายวิศวกรรมและซ่อมบำรุง - Engineering (Qualification/Validation support)
  {
    code: 'DIV-ENG',
    name: 'ฝ่ายวิศวกรรมและซ่อมบำรุง',
    nameEn: 'Engineering & Maintenance Division',
    type: 'division',
    parentCode: 'ORG-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  // ฝ่ายคลังสินค้า - Warehouse Division
  {
    code: 'DIV-WH',
    name: 'ฝ่ายคลังสินค้า',
    nameEn: 'Warehouse Division',
    type: 'division',
    parentCode: 'ORG-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },

  // ===== Support Divisions (ฝ่ายสนับสนุน) =====
  {
    code: 'DIV-RD',
    name: 'ฝ่ายวิจัยและพัฒนา',
    nameEn: 'Research & Development Division',
    type: 'division',
    parentCode: 'ORG-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DIV-REG',
    name: 'ฝ่ายทะเบียนและวิชาการ',
    nameEn: 'Regulatory Affairs Division',
    type: 'division',
    parentCode: 'ORG-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DIV-ADMIN',
    name: 'ฝ่ายบริหารงานทั่วไป',
    nameEn: 'General Administration Division',
    type: 'division',
    parentCode: 'ORG-001',
    isGmpCritical: false,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DIV-PROC',
    name: 'ฝ่ายจัดซื้อ',
    nameEn: 'Procurement Division',
    type: 'division',
    parentCode: 'ORG-001',
    isGmpCritical: false,
    effectiveFrom: '2020-01-01',
  },

  // ===== Production Sections (กลุ่มงานผลิต) =====
  {
    code: 'SEC-PROD-MFG',
    name: 'กลุ่มงานผลิตยา',
    nameEn: 'Drug Manufacturing Section',
    type: 'department',
    parentCode: 'DIV-PROD',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'SEC-PROD-PKG',
    name: 'กลุ่มงานบรรจุ',
    nameEn: 'Packaging Section',
    type: 'department',
    parentCode: 'DIV-PROD',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'SEC-PROD-IPC',
    name: 'กลุ่มงานควบคุมระหว่างกระบวนการผลิต',
    nameEn: 'In-Process Control Section',
    type: 'department',
    parentCode: 'DIV-PROD',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },

  // ===== QC Sections (กลุ่มงานควบคุมคุณภาพ) =====
  {
    code: 'SEC-QC-CHEM',
    name: 'กลุ่มงานวิเคราะห์เคมี',
    nameEn: 'Chemical Analysis Section',
    type: 'department',
    parentCode: 'DIV-QC',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'SEC-QC-MICRO',
    name: 'กลุ่มงานจุลชีววิทยา',
    nameEn: 'Microbiology Section',
    type: 'department',
    parentCode: 'DIV-QC',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'SEC-QC-HERB',
    name: 'กลุ่มงานพิสูจน์เอกลักษณ์สมุนไพร',
    nameEn: 'Herbal Identification Section',
    type: 'department',
    parentCode: 'DIV-QC',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'SEC-QC-STAB',
    name: 'กลุ่มงานศึกษาความคงสภาพ',
    nameEn: 'Stability Study Section',
    type: 'department',
    parentCode: 'DIV-QC',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },

  // ===== QA Sections (กลุ่มงานประกันคุณภาพ) =====
  {
    code: 'SEC-QA-SYS',
    name: 'กลุ่มงานระบบคุณภาพ',
    nameEn: 'Quality System Section',
    type: 'department',
    parentCode: 'DIV-QA',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'SEC-QA-VAL',
    name: 'กลุ่มงานตรวจสอบความถูกต้อง',
    nameEn: 'Validation Section',
    type: 'department',
    parentCode: 'DIV-QA',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'SEC-QA-DOC',
    name: 'กลุ่มงานควบคุมเอกสาร',
    nameEn: 'Document Control Section',
    type: 'department',
    parentCode: 'DIV-QA',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'SEC-QA-AUDIT',
    name: 'กลุ่มงานตรวจสอบภายใน',
    nameEn: 'Internal Audit Section',
    type: 'department',
    parentCode: 'DIV-QA',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },

  // ===== Engineering Sections =====
  {
    code: 'SEC-ENG-MAINT',
    name: 'กลุ่มงานซ่อมบำรุง',
    nameEn: 'Maintenance Section',
    type: 'department',
    parentCode: 'DIV-ENG',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'SEC-ENG-CAL',
    name: 'กลุ่มงานสอบเทียบ',
    nameEn: 'Calibration Section',
    type: 'department',
    parentCode: 'DIV-ENG',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'SEC-ENG-UTIL',
    name: 'กลุ่มงานระบบสาธารณูปโภค',
    nameEn: 'Utilities Section',
    type: 'department',
    parentCode: 'DIV-ENG',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },

  // ===== Warehouse Sections =====
  {
    code: 'SEC-WH-RM',
    name: 'กลุ่มงานคลังวัตถุดิบ',
    nameEn: 'Raw Material Warehouse Section',
    type: 'department',
    parentCode: 'DIV-WH',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'SEC-WH-PM',
    name: 'กลุ่มงานคลังวัสดุบรรจุ',
    nameEn: 'Packaging Material Warehouse Section',
    type: 'department',
    parentCode: 'DIV-WH',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'SEC-WH-FG',
    name: 'กลุ่มงานคลังผลิตภัณฑ์สำเร็จรูป',
    nameEn: 'Finished Goods Warehouse Section',
    type: 'department',
    parentCode: 'DIV-WH',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'SEC-WH-QUAR',
    name: 'กลุ่มงานพื้นที่กักกัน',
    nameEn: 'Quarantine Area Section',
    type: 'department',
    parentCode: 'DIV-WH',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },

  // ===== R&D Sections =====
  {
    code: 'SEC-RD-FORM',
    name: 'กลุ่มงานพัฒนาตำรับยา',
    nameEn: 'Formulation Development Section',
    type: 'department',
    parentCode: 'DIV-RD',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'SEC-RD-HERB',
    name: 'กลุ่มงานวิจัยสมุนไพร',
    nameEn: 'Herbal Research Section',
    type: 'department',
    parentCode: 'DIV-RD',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },

  // ===== Regulatory Sections =====
  {
    code: 'SEC-REG-REG',
    name: 'กลุ่มงานทะเบียนยา',
    nameEn: 'Drug Registration Section',
    type: 'department',
    parentCode: 'DIV-REG',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'SEC-REG-DI',
    name: 'กลุ่มงานเภสัชสนเทศ',
    nameEn: 'Drug Information Section',
    type: 'department',
    parentCode: 'DIV-REG',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },

  // ===== Admin Sections =====
  {
    code: 'SEC-ADMIN-HR',
    name: 'กลุ่มงานบุคคลและฝึกอบรม',
    nameEn: 'HR & Training Section',
    type: 'department',
    parentCode: 'DIV-ADMIN',
    isGmpCritical: false,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'SEC-ADMIN-FIN',
    name: 'กลุ่มงานการเงินและบัญชี',
    nameEn: 'Finance & Accounting Section',
    type: 'department',
    parentCode: 'DIV-ADMIN',
    isGmpCritical: false,
    effectiveFrom: '2020-01-01',
  },
];

/**
 * Positions aligned with Thai GMP Key Personnel Requirements
 *
 * Per Thai FDA GMP (หลักเกณฑ์วิธีการที่ดีในการผลิตยา):
 * - ผู้มีหน้าที่ปฏิบัติการ (Authorized Person/QP) - Must be pharmacist, responsible for batch release
 * - หัวหน้าฝ่ายผลิต (Head of Production) - Must be qualified, independent from QC
 * - หัวหน้าฝ่ายควบคุมคุณภาพ (Head of QC) - Must be qualified, independent from Production
 * - หัวหน้าฝ่ายประกันคุณภาพ (Head of QA) - Oversight of quality system
 *
 * Key Personnel cannot hold dual positions that create conflicts of interest
 */
const defaultPositions = [
  // ===== GMP Key Personnel (บุคลากรหลักตาม GMP) =====
  // ผู้อำนวยการโรงงาน (Site Director)
  { code: 'POS-EXEC-001', title: 'ผู้อำนวยการโรงงาน', titleEn: 'Site Director', orgUnitCode: 'ORG-001', jobGrade: 'E1', isGmpCritical: true },
  { code: 'POS-EXEC-002', title: 'รองผู้อำนวยการโรงงาน', titleEn: 'Deputy Site Director', orgUnitCode: 'ORG-001', jobGrade: 'E2', isGmpCritical: true },

  // ผู้มีหน้าที่ปฏิบัติการ (Authorized Person/Qualified Person) - GMP Critical
  // Must be pharmacist, responsible for batch release per Thai FDA regulation
  { code: 'POS-AP-001', title: 'ผู้มีหน้าที่ปฏิบัติการ (QP)', titleEn: 'Authorized Person (Qualified Person)', orgUnitCode: 'ORG-001', jobGrade: 'E2', isGmpCritical: true },

  // ===== Production Division (ฝ่ายผลิต) - Independent from QC =====
  // หัวหน้าฝ่ายผลิต - GMP Key Personnel
  { code: 'POS-PROD-001', title: 'หัวหน้าฝ่ายผลิต', titleEn: 'Head of Production', orgUnitCode: 'DIV-PROD', jobGrade: 'M1', isGmpCritical: true },
  { code: 'POS-PROD-002', title: 'เภสัชกรควบคุมการผลิต', titleEn: 'Production Pharmacist', orgUnitCode: 'DIV-PROD', jobGrade: 'P1', isGmpCritical: true },

  // กลุ่มงานผลิตยา (Drug Manufacturing Section)
  { code: 'POS-PROD-010', title: 'หัวหน้ากลุ่มงานผลิตยา', titleEn: 'Head of Manufacturing Section', orgUnitCode: 'SEC-PROD-MFG', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-PROD-011', title: 'นักวิทยาศาสตร์การผลิต', titleEn: 'Production Scientist', orgUnitCode: 'SEC-PROD-MFG', jobGrade: 'P1', isGmpCritical: true },
  { code: 'POS-PROD-012', title: 'เจ้าพนักงานผลิต', titleEn: 'Production Technician', orgUnitCode: 'SEC-PROD-MFG', jobGrade: 'T1', isGmpCritical: true },

  // กลุ่มงานบรรจุ (Packaging Section)
  { code: 'POS-PROD-020', title: 'หัวหน้ากลุ่มงานบรรจุ', titleEn: 'Head of Packaging Section', orgUnitCode: 'SEC-PROD-PKG', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-PROD-021', title: 'เจ้าพนักงานบรรจุ', titleEn: 'Packaging Technician', orgUnitCode: 'SEC-PROD-PKG', jobGrade: 'T1', isGmpCritical: true },

  // กลุ่มงานควบคุมระหว่างกระบวนการผลิต (In-Process Control)
  { code: 'POS-PROD-030', title: 'หัวหน้ากลุ่มงาน IPC', titleEn: 'Head of IPC Section', orgUnitCode: 'SEC-PROD-IPC', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-PROD-031', title: 'เจ้าหน้าที่ IPC', titleEn: 'IPC Officer', orgUnitCode: 'SEC-PROD-IPC', jobGrade: 'P1', isGmpCritical: true },

  // ===== Quality Control Division (ฝ่ายควบคุมคุณภาพ) - Independent from Production =====
  // หัวหน้าฝ่ายควบคุมคุณภาพ - GMP Key Personnel (Must be independent from Production Head)
  { code: 'POS-QC-001', title: 'หัวหน้าฝ่ายควบคุมคุณภาพ', titleEn: 'Head of Quality Control', orgUnitCode: 'DIV-QC', jobGrade: 'M1', isGmpCritical: true },
  { code: 'POS-QC-002', title: 'เภสัชกรควบคุมคุณภาพ', titleEn: 'QC Pharmacist', orgUnitCode: 'DIV-QC', jobGrade: 'P1', isGmpCritical: true },

  // กลุ่มงานวิเคราะห์เคมี (Chemical Analysis Section)
  { code: 'POS-QC-010', title: 'หัวหน้ากลุ่มงานวิเคราะห์เคมี', titleEn: 'Head of Chemical Analysis', orgUnitCode: 'SEC-QC-CHEM', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-QC-011', title: 'นักวิทยาศาสตร์ (เคมี)', titleEn: 'Chemist', orgUnitCode: 'SEC-QC-CHEM', jobGrade: 'P1', isGmpCritical: true },
  { code: 'POS-QC-012', title: 'เจ้าพนักงานวิทยาศาสตร์ (เคมี)', titleEn: 'Chemistry Technician', orgUnitCode: 'SEC-QC-CHEM', jobGrade: 'T1', isGmpCritical: true },

  // กลุ่มงานจุลชีววิทยา (Microbiology Section)
  { code: 'POS-QC-020', title: 'หัวหน้ากลุ่มงานจุลชีววิทยา', titleEn: 'Head of Microbiology', orgUnitCode: 'SEC-QC-MICRO', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-QC-021', title: 'นักวิทยาศาสตร์ (จุลชีววิทยา)', titleEn: 'Microbiologist', orgUnitCode: 'SEC-QC-MICRO', jobGrade: 'P1', isGmpCritical: true },
  { code: 'POS-QC-022', title: 'เจ้าพนักงานวิทยาศาสตร์ (จุลชีววิทยา)', titleEn: 'Microbiology Technician', orgUnitCode: 'SEC-QC-MICRO', jobGrade: 'T1', isGmpCritical: true },

  // กลุ่มงานพิสูจน์เอกลักษณ์สมุนไพร (Herbal Identification Section)
  { code: 'POS-QC-030', title: 'หัวหน้ากลุ่มงานพิสูจน์เอกลักษณ์สมุนไพร', titleEn: 'Head of Herbal Identification', orgUnitCode: 'SEC-QC-HERB', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-QC-031', title: 'นักวิทยาศาสตร์ (พฤกษศาสตร์)', titleEn: 'Botanist', orgUnitCode: 'SEC-QC-HERB', jobGrade: 'P1', isGmpCritical: true },

  // กลุ่มงานศึกษาความคงสภาพ (Stability Study Section)
  { code: 'POS-QC-040', title: 'หัวหน้ากลุ่มงานศึกษาความคงสภาพ', titleEn: 'Head of Stability Study', orgUnitCode: 'SEC-QC-STAB', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-QC-041', title: 'นักวิทยาศาสตร์ความคงสภาพ', titleEn: 'Stability Scientist', orgUnitCode: 'SEC-QC-STAB', jobGrade: 'P1', isGmpCritical: true },

  // ===== Quality Assurance Division (ฝ่ายประกันคุณภาพ) - Oversight =====
  // หัวหน้าฝ่ายประกันคุณภาพ - GMP Key Personnel
  { code: 'POS-QA-001', title: 'หัวหน้าฝ่ายประกันคุณภาพ', titleEn: 'Head of Quality Assurance', orgUnitCode: 'DIV-QA', jobGrade: 'M1', isGmpCritical: true },
  { code: 'POS-QA-002', title: 'เภสัชกรประกันคุณภาพ', titleEn: 'QA Pharmacist', orgUnitCode: 'DIV-QA', jobGrade: 'P1', isGmpCritical: true },

  // กลุ่มงานระบบคุณภาพ (Quality System Section)
  { code: 'POS-QA-010', title: 'หัวหน้ากลุ่มงานระบบคุณภาพ', titleEn: 'Head of Quality System', orgUnitCode: 'SEC-QA-SYS', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-QA-011', title: 'เจ้าหน้าที่ระบบคุณภาพ', titleEn: 'Quality System Officer', orgUnitCode: 'SEC-QA-SYS', jobGrade: 'P1', isGmpCritical: true },

  // กลุ่มงานตรวจสอบความถูกต้อง (Validation Section)
  { code: 'POS-QA-020', title: 'หัวหน้ากลุ่มงาน Validation', titleEn: 'Head of Validation', orgUnitCode: 'SEC-QA-VAL', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-QA-021', title: 'วิศวกร Validation', titleEn: 'Validation Engineer', orgUnitCode: 'SEC-QA-VAL', jobGrade: 'P1', isGmpCritical: true },
  { code: 'POS-QA-022', title: 'เจ้าหน้าที่ Validation', titleEn: 'Validation Officer', orgUnitCode: 'SEC-QA-VAL', jobGrade: 'P2', isGmpCritical: true },

  // กลุ่มงานควบคุมเอกสาร (Document Control Section)
  { code: 'POS-QA-030', title: 'หัวหน้ากลุ่มงานควบคุมเอกสาร', titleEn: 'Head of Document Control', orgUnitCode: 'SEC-QA-DOC', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-QA-031', title: 'เจ้าหน้าที่ควบคุมเอกสาร', titleEn: 'Document Controller', orgUnitCode: 'SEC-QA-DOC', jobGrade: 'T1', isGmpCritical: true },

  // กลุ่มงานตรวจสอบภายใน (Internal Audit Section)
  { code: 'POS-QA-040', title: 'หัวหน้ากลุ่มงานตรวจสอบภายใน', titleEn: 'Head of Internal Audit', orgUnitCode: 'SEC-QA-AUDIT', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-QA-041', title: 'ผู้ตรวจสอบภายใน', titleEn: 'Internal Auditor', orgUnitCode: 'SEC-QA-AUDIT', jobGrade: 'P1', isGmpCritical: true },

  // ===== Engineering & Maintenance Division (ฝ่ายวิศวกรรม) =====
  { code: 'POS-ENG-001', title: 'หัวหน้าฝ่ายวิศวกรรมและซ่อมบำรุง', titleEn: 'Head of Engineering & Maintenance', orgUnitCode: 'DIV-ENG', jobGrade: 'M1', isGmpCritical: true },

  // กลุ่มงานซ่อมบำรุง (Maintenance Section)
  { code: 'POS-ENG-010', title: 'หัวหน้ากลุ่มงานซ่อมบำรุง', titleEn: 'Head of Maintenance', orgUnitCode: 'SEC-ENG-MAINT', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-ENG-011', title: 'วิศวกรซ่อมบำรุง', titleEn: 'Maintenance Engineer', orgUnitCode: 'SEC-ENG-MAINT', jobGrade: 'P1', isGmpCritical: true },
  { code: 'POS-ENG-012', title: 'ช่างเทคนิค', titleEn: 'Maintenance Technician', orgUnitCode: 'SEC-ENG-MAINT', jobGrade: 'T1', isGmpCritical: true },

  // กลุ่มงานสอบเทียบ (Calibration Section)
  { code: 'POS-ENG-020', title: 'หัวหน้ากลุ่มงานสอบเทียบ', titleEn: 'Head of Calibration', orgUnitCode: 'SEC-ENG-CAL', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-ENG-021', title: 'เจ้าหน้าที่สอบเทียบ', titleEn: 'Calibration Officer', orgUnitCode: 'SEC-ENG-CAL', jobGrade: 'P1', isGmpCritical: true },

  // กลุ่มงานระบบสาธารณูปโภค (Utilities Section)
  { code: 'POS-ENG-030', title: 'หัวหน้ากลุ่มงานระบบสาธารณูปโภค', titleEn: 'Head of Utilities', orgUnitCode: 'SEC-ENG-UTIL', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-ENG-031', title: 'วิศวกรระบบสาธารณูปโภค', titleEn: 'Utilities Engineer', orgUnitCode: 'SEC-ENG-UTIL', jobGrade: 'P1', isGmpCritical: true },

  // ===== Warehouse Division (ฝ่ายคลังสินค้า) =====
  { code: 'POS-WH-001', title: 'หัวหน้าฝ่ายคลังสินค้า', titleEn: 'Head of Warehouse', orgUnitCode: 'DIV-WH', jobGrade: 'M1', isGmpCritical: true },

  // กลุ่มงานคลังวัตถุดิบ (Raw Material Warehouse)
  { code: 'POS-WH-010', title: 'หัวหน้ากลุ่มงานคลังวัตถุดิบ', titleEn: 'Head of Raw Material Warehouse', orgUnitCode: 'SEC-WH-RM', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-WH-011', title: 'เจ้าพนักงานพัสดุ (วัตถุดิบ)', titleEn: 'Material Clerk (Raw Material)', orgUnitCode: 'SEC-WH-RM', jobGrade: 'T1', isGmpCritical: true },

  // กลุ่มงานคลังวัสดุบรรจุ (Packaging Material Warehouse)
  { code: 'POS-WH-020', title: 'หัวหน้ากลุ่มงานคลังวัสดุบรรจุ', titleEn: 'Head of Packaging Material Warehouse', orgUnitCode: 'SEC-WH-PM', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-WH-021', title: 'เจ้าพนักงานพัสดุ (วัสดุบรรจุ)', titleEn: 'Material Clerk (Packaging)', orgUnitCode: 'SEC-WH-PM', jobGrade: 'T1', isGmpCritical: true },

  // กลุ่มงานคลังผลิตภัณฑ์สำเร็จรูป (Finished Goods Warehouse)
  { code: 'POS-WH-030', title: 'หัวหน้ากลุ่มงานคลังผลิตภัณฑ์สำเร็จรูป', titleEn: 'Head of Finished Goods Warehouse', orgUnitCode: 'SEC-WH-FG', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-WH-031', title: 'เจ้าพนักงานพัสดุ (ผลิตภัณฑ์)', titleEn: 'Material Clerk (Finished Goods)', orgUnitCode: 'SEC-WH-FG', jobGrade: 'T1', isGmpCritical: true },

  // กลุ่มงานพื้นที่กักกัน (Quarantine Area)
  { code: 'POS-WH-040', title: 'หัวหน้ากลุ่มงานพื้นที่กักกัน', titleEn: 'Head of Quarantine Area', orgUnitCode: 'SEC-WH-QUAR', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-WH-041', title: 'เจ้าพนักงานพื้นที่กักกัน', titleEn: 'Quarantine Clerk', orgUnitCode: 'SEC-WH-QUAR', jobGrade: 'T1', isGmpCritical: true },

  // ===== R&D Division (ฝ่ายวิจัยและพัฒนา) =====
  { code: 'POS-RD-001', title: 'หัวหน้าฝ่ายวิจัยและพัฒนา', titleEn: 'Head of R&D', orgUnitCode: 'DIV-RD', jobGrade: 'M1', isGmpCritical: true },

  // กลุ่มงานพัฒนาตำรับยา (Formulation Development)
  { code: 'POS-RD-010', title: 'หัวหน้ากลุ่มงานพัฒนาตำรับยา', titleEn: 'Head of Formulation Development', orgUnitCode: 'SEC-RD-FORM', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-RD-011', title: 'เภสัชกรพัฒนาตำรับ', titleEn: 'Formulation Pharmacist', orgUnitCode: 'SEC-RD-FORM', jobGrade: 'P1', isGmpCritical: true },

  // กลุ่มงานวิจัยสมุนไพร (Herbal Research)
  { code: 'POS-RD-020', title: 'หัวหน้ากลุ่มงานวิจัยสมุนไพร', titleEn: 'Head of Herbal Research', orgUnitCode: 'SEC-RD-HERB', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-RD-021', title: 'นักวิจัยสมุนไพร', titleEn: 'Herbal Researcher', orgUnitCode: 'SEC-RD-HERB', jobGrade: 'P1', isGmpCritical: true },
  { code: 'POS-RD-022', title: 'แพทย์แผนไทย', titleEn: 'Thai Traditional Medicine Doctor', orgUnitCode: 'SEC-RD-HERB', jobGrade: 'P1', isGmpCritical: true },

  // ===== Regulatory Affairs Division (ฝ่ายทะเบียนและวิชาการ) =====
  { code: 'POS-REG-001', title: 'หัวหน้าฝ่ายทะเบียนและวิชาการ', titleEn: 'Head of Regulatory Affairs', orgUnitCode: 'DIV-REG', jobGrade: 'M1', isGmpCritical: true },

  // กลุ่มงานทะเบียนยา (Drug Registration)
  { code: 'POS-REG-010', title: 'หัวหน้ากลุ่มงานทะเบียนยา', titleEn: 'Head of Drug Registration', orgUnitCode: 'SEC-REG-REG', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-REG-011', title: 'เภสัชกรทะเบียนยา', titleEn: 'Drug Registration Pharmacist', orgUnitCode: 'SEC-REG-REG', jobGrade: 'P1', isGmpCritical: true },

  // กลุ่มงานเภสัชสนเทศ (Drug Information)
  { code: 'POS-REG-020', title: 'หัวหน้ากลุ่มงานเภสัชสนเทศ', titleEn: 'Head of Drug Information', orgUnitCode: 'SEC-REG-DI', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-REG-021', title: 'เภสัชกรเภสัชสนเทศ', titleEn: 'Drug Information Pharmacist', orgUnitCode: 'SEC-REG-DI', jobGrade: 'P1', isGmpCritical: true },

  // ===== General Administration Division (ฝ่ายบริหารงานทั่วไป) =====
  { code: 'POS-ADMIN-001', title: 'หัวหน้าฝ่ายบริหารงานทั่วไป', titleEn: 'Head of General Administration', orgUnitCode: 'DIV-ADMIN', jobGrade: 'M1', isGmpCritical: false },

  // กลุ่มงานบุคคลและฝึกอบรม (HR & Training)
  { code: 'POS-ADMIN-010', title: 'หัวหน้ากลุ่มงานบุคคลและฝึกอบรม', titleEn: 'Head of HR & Training', orgUnitCode: 'SEC-ADMIN-HR', jobGrade: 'S1', isGmpCritical: false },
  { code: 'POS-ADMIN-011', title: 'นักทรัพยากรบุคคล', titleEn: 'HR Specialist', orgUnitCode: 'SEC-ADMIN-HR', jobGrade: 'P1', isGmpCritical: false },
  { code: 'POS-ADMIN-012', title: 'เจ้าหน้าที่ฝึกอบรม', titleEn: 'Training Officer', orgUnitCode: 'SEC-ADMIN-HR', jobGrade: 'P1', isGmpCritical: false },
  { code: 'POS-ADMIN-013', title: 'เจ้าพนักงานธุรการ', titleEn: 'Administrative Officer', orgUnitCode: 'SEC-ADMIN-HR', jobGrade: 'T1', isGmpCritical: false },

  // กลุ่มงานการเงินและบัญชี (Finance & Accounting)
  { code: 'POS-ADMIN-020', title: 'หัวหน้ากลุ่มงานการเงินและบัญชี', titleEn: 'Head of Finance & Accounting', orgUnitCode: 'SEC-ADMIN-FIN', jobGrade: 'S1', isGmpCritical: false },
  { code: 'POS-ADMIN-021', title: 'นักวิชาการเงินและบัญชี', titleEn: 'Finance & Accounting Specialist', orgUnitCode: 'SEC-ADMIN-FIN', jobGrade: 'P1', isGmpCritical: false },

  // ===== Procurement Division (ฝ่ายจัดซื้อ) =====
  { code: 'POS-PROC-001', title: 'หัวหน้าฝ่ายจัดซื้อ', titleEn: 'Head of Procurement', orgUnitCode: 'DIV-PROC', jobGrade: 'M1', isGmpCritical: false },
  { code: 'POS-PROC-010', title: 'นักวิชาการพัสดุ', titleEn: 'Procurement Specialist', orgUnitCode: 'DIV-PROC', jobGrade: 'P1', isGmpCritical: false },
  { code: 'POS-PROC-011', title: 'เจ้าพนักงานพัสดุ', titleEn: 'Procurement Officer', orgUnitCode: 'DIV-PROC', jobGrade: 'T1', isGmpCritical: false },
];

/**
 * Training Courses aligned with Thai GMP Requirements
 *
 * Per Thai FDA GMP (หลักเกณฑ์วิธีการที่ดีในการผลิตยา):
 * - All personnel must receive GMP training appropriate to their role
 * - Training records must be maintained
 * - Annual refresher training required
 * - Specific training for key GMP systems (Validation, CAPA, Change Control, etc.)
 */
const defaultTrainingCourses = [
  // ===== GMP Core Training (หลักสูตร GMP หลัก) =====
  {
    code: 'TRN-GMP-001',
    name: 'หลักเกณฑ์และวิธีการที่ดีในการผลิตยาจากสมุนไพร (GMP)',
    nameEn: 'Good Manufacturing Practice for Herbal Medicines',
    description: 'อบรมพื้นฐาน GMP สำหรับการผลิตยาสมุนไพรตามมาตรฐาน Thai FDA และ WHO',
    category: 'GMP',
    validityDays: 365,
    isMandatory: true,
    durationHours: 8,
  },
  {
    code: 'TRN-GMP-002',
    name: 'การทบทวน GMP ประจำปี',
    nameEn: 'Annual GMP Refresher',
    description: 'อบรมทบทวน GMP สำหรับยาสมุนไพรประจำปี (บังคับตามข้อกำหนด อย.)',
    category: 'GMP',
    validityDays: 365,
    isMandatory: true,
    durationHours: 4,
  },
  {
    code: 'TRN-GMP-003',
    name: 'สุขลักษณะส่วนบุคคลและการป้องกันการปนเปื้อนข้าม',
    nameEn: 'Personal Hygiene & Cross-Contamination Prevention',
    description: 'สุขลักษณะส่วนบุคคลและการป้องกันการปนเปื้อนข้ามตามข้อกำหนด GMP',
    category: 'GMP',
    validityDays: 365,
    isMandatory: true,
    durationHours: 2,
  },
  {
    code: 'TRN-GMP-004',
    name: 'การแต่งกายและขั้นตอนการเข้าพื้นที่ผลิต',
    nameEn: 'Gowning Procedure & Clean Room Entry',
    description: 'ขั้นตอนการแต่งกายและการเข้าพื้นที่สะอาดตามข้อกำหนด GMP',
    category: 'GMP',
    validityDays: 365,
    isMandatory: true,
    durationHours: 2,
  },
  {
    code: 'TRN-GMP-005',
    name: 'บทบาทและความรับผิดชอบของบุคลากรหลัก GMP',
    nameEn: 'GMP Key Personnel Roles & Responsibilities',
    description: 'บทบาทและความรับผิดชอบของ QP, หัวหน้าผลิต, หัวหน้า QC ตาม GMP',
    category: 'GMP',
    validityDays: 365,
    isMandatory: false,
    durationHours: 4,
  },

  // ===== Quality Assurance Systems (ระบบประกันคุณภาพ) =====
  {
    code: 'TRN-QA-001',
    name: 'ระบบคุณภาพเภสัชภัณฑ์ (PQS)',
    nameEn: 'Pharmaceutical Quality System (PQS)',
    description: 'ระบบคุณภาพเภสัชภัณฑ์ตาม ICH Q10 และข้อกำหนด GMP',
    category: 'Quality Assurance',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },
  {
    code: 'TRN-QA-002',
    name: 'CAPA - การแก้ไขและการป้องกัน',
    nameEn: 'Corrective and Preventive Action (CAPA)',
    description: 'ระบบ CAPA การวิเคราะห์สาเหตุราก และการดำเนินการแก้ไข/ป้องกัน',
    category: 'Quality Assurance',
    validityDays: 365,
    isMandatory: true,
    durationHours: 4,
  },
  {
    code: 'TRN-QA-003',
    name: 'การควบคุมการเปลี่ยนแปลง (Change Control)',
    nameEn: 'Change Control Management',
    description: 'ระบบควบคุมการเปลี่ยนแปลงตามข้อกำหนด GMP',
    category: 'Quality Assurance',
    validityDays: 365,
    isMandatory: true,
    durationHours: 4,
  },
  {
    code: 'TRN-QA-004',
    name: 'การจัดการความเบี่ยงเบน (Deviation Handling)',
    nameEn: 'Deviation Management',
    description: 'การจัดการความเบี่ยงเบนและ OOS/OOT ตามข้อกำหนด GMP',
    category: 'Quality Assurance',
    validityDays: 365,
    isMandatory: true,
    durationHours: 4,
  },
  {
    code: 'TRN-QA-005',
    name: 'การจัดการข้อร้องเรียนและการเรียกคืนผลิตภัณฑ์',
    nameEn: 'Complaint Handling & Product Recall',
    description: 'ระบบจัดการข้อร้องเรียนและการเรียกคืนผลิตภัณฑ์ตาม GMP',
    category: 'Quality Assurance',
    validityDays: 365,
    isMandatory: false,
    durationHours: 4,
  },
  {
    code: 'TRN-QA-006',
    name: 'การตรวจสอบภายใน (Self-Inspection)',
    nameEn: 'GMP Self-Inspection / Internal Audit',
    description: 'การตรวจสอบภายในและการเตรียมรับการตรวจ GMP จาก อย.',
    category: 'Quality Assurance',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },
  {
    code: 'TRN-QA-007',
    name: 'การทบทวนคุณภาพผลิตภัณฑ์ (PQR)',
    nameEn: 'Product Quality Review (PQR) / Annual Product Review (APR)',
    description: 'การจัดทำและทบทวนรายงานคุณภาพผลิตภัณฑ์ประจำปี',
    category: 'Quality Assurance',
    validityDays: 365,
    isMandatory: false,
    durationHours: 4,
  },

  // ===== Validation (การตรวจสอบความถูกต้อง) =====
  {
    code: 'TRN-VAL-001',
    name: 'หลักการตรวจสอบความถูกต้อง (Validation Principles)',
    nameEn: 'Validation Principles & Concepts',
    description: 'หลักการตรวจสอบความถูกต้องตามข้อกำหนด GMP และ EU Annex 15',
    category: 'Validation',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },
  {
    code: 'TRN-VAL-002',
    name: 'การตรวจสอบความถูกต้องกระบวนการผลิต (Process Validation)',
    nameEn: 'Process Validation',
    description: 'การตรวจสอบความถูกต้องกระบวนการผลิตยาสมุนไพร',
    category: 'Validation',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },
  {
    code: 'TRN-VAL-003',
    name: 'การตรวจสอบความถูกต้องการทำความสะอาด (Cleaning Validation)',
    nameEn: 'Cleaning Validation',
    description: 'การตรวจสอบความถูกต้องการทำความสะอาดเครื่องมือและอุปกรณ์',
    category: 'Validation',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },
  {
    code: 'TRN-VAL-004',
    name: 'การตรวจสอบความถูกต้องวิธีวิเคราะห์ (Method Validation)',
    nameEn: 'Analytical Method Validation',
    description: 'การตรวจสอบความถูกต้องวิธีวิเคราะห์ตาม ICH Q2',
    category: 'Validation',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },
  {
    code: 'TRN-VAL-005',
    name: 'การรับรองเครื่องมือ (Equipment Qualification)',
    nameEn: 'Equipment Qualification (IQ/OQ/PQ)',
    description: 'การรับรองเครื่องมือ IQ/OQ/PQ ตามข้อกำหนด GMP',
    category: 'Validation',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },
  {
    code: 'TRN-VAL-006',
    name: 'การตรวจสอบความถูกต้องระบบคอมพิวเตอร์ (CSV)',
    nameEn: 'Computer System Validation (CSV)',
    description: 'การตรวจสอบความถูกต้องระบบคอมพิวเตอร์ตาม GAMP 5',
    category: 'Validation',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },

  // ===== Documentation (การจัดทำเอกสาร) =====
  {
    code: 'TRN-DOC-001',
    name: 'การจัดทำเอกสาร GMP (Good Documentation Practice)',
    nameEn: 'Good Documentation Practice (GDP)',
    description: 'หลักการจัดทำและควบคุมเอกสารตามข้อกำหนด GMP',
    category: 'Documentation',
    validityDays: 365,
    isMandatory: true,
    durationHours: 4,
  },
  {
    code: 'TRN-DOC-002',
    name: 'Batch Record และการปล่อยผลิตภัณฑ์',
    nameEn: 'Batch Record Review & Batch Release',
    description: 'การกรอกและทบทวน Batch Record และการปล่อยผลิตภัณฑ์โดย QP',
    category: 'Documentation',
    validityDays: 365,
    isMandatory: false,
    durationHours: 4,
  },
  {
    code: 'TRN-DOC-003',
    name: 'Data Integrity (ALCOA+)',
    nameEn: 'Data Integrity (ALCOA+)',
    description: 'ความสมบูรณ์ของข้อมูลตามหลัก ALCOA+ และข้อกำหนด FDA/EMA',
    category: 'Documentation',
    validityDays: 365,
    isMandatory: true,
    durationHours: 4,
  },

  // ===== GACP (Good Agricultural and Collection Practice) =====
  {
    code: 'TRN-GACP-001',
    name: 'หลักเกณฑ์และวิธีการที่ดีในการเพาะปลูกและเก็บเกี่ยวสมุนไพร (GACP)',
    nameEn: 'Good Agricultural and Collection Practice (GACP)',
    description: 'มาตรฐานการเพาะปลูกและเก็บเกี่ยวสมุนไพรตามหลัก GACP ของ WHO',
    category: 'GACP',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },
  {
    code: 'TRN-GACP-002',
    name: 'การควบคุมคุณภาพวัตถุดิบสมุนไพร',
    nameEn: 'Herbal Raw Material Quality Control',
    description: 'การตรวจสอบและควบคุมคุณภาพวัตถุดิบสมุนไพรตั้งแต่แหล่งที่มา',
    category: 'GACP',
    validityDays: 365,
    isMandatory: false,
    durationHours: 4,
  },

  // สมุนไพรวิทยา (Herbal Science)
  {
    code: 'TRN-HRB-001',
    name: 'ความรู้เบื้องต้นเกี่ยวกับสมุนไพรไทย',
    nameEn: 'Introduction to Thai Medicinal Herbs',
    description: 'พื้นฐานความรู้เกี่ยวกับสมุนไพรไทยและการใช้ประโยชน์ทางยา',
    category: 'Herbal',
    validityDays: 365,
    isMandatory: true,
    durationHours: 8,
  },
  {
    code: 'TRN-HRB-002',
    name: 'การพิสูจน์เอกลักษณ์สมุนไพร',
    nameEn: 'Herbal Identification & Authentication',
    description: 'วิธีการพิสูจน์เอกลักษณ์สมุนไพรด้วยลักษณะทางพฤกษศาสตร์และเคมี',
    category: 'Herbal',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },
  {
    code: 'TRN-HRB-003',
    name: 'ตำรับยาสมุนไพรในบัญชียาหลักแห่งชาติ',
    nameEn: 'Herbal Formulations in National Essential Drug List',
    description: 'ความรู้เกี่ยวกับตำรับยาสมุนไพรในบัญชียาหลักแห่งชาติ',
    category: 'Herbal',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },
  {
    code: 'TRN-HRB-004',
    name: 'การแพทย์แผนไทยเบื้องต้น',
    nameEn: 'Basic Thai Traditional Medicine',
    description: 'พื้นฐานการแพทย์แผนไทยและหลักการใช้ยาสมุนไพร',
    category: 'Herbal',
    validityDays: 365,
    isMandatory: false,
    durationHours: 16,
  },

  // การควบคุมคุณภาพ (Quality Control)
  {
    code: 'TRN-QC-001',
    name: 'การควบคุมคุณภาพยาสมุนไพร',
    nameEn: 'Herbal Medicine Quality Control',
    description: 'พื้นฐานการควบคุมคุณภาพยาสมุนไพรตามมาตรฐานเภสัชตำรับ',
    category: 'Quality',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },
  {
    code: 'TRN-QC-002',
    name: 'การตรวจวิเคราะห์สารสำคัญในสมุนไพร',
    nameEn: 'Active Compound Analysis in Herbs',
    description: 'เทคนิคการวิเคราะห์สารสำคัญในสมุนไพรด้วยเครื่องมือวิทยาศาสตร์',
    category: 'Quality',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },
  {
    code: 'TRN-QC-003',
    name: 'การตรวจหาสารปนเปื้อนในสมุนไพร',
    nameEn: 'Contaminant Testing in Herbal Materials',
    description: 'การตรวจหาโลหะหนัก ยาฆ่าแมลง และเชื้อจุลินทรีย์ในสมุนไพร',
    category: 'Quality',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },

  // ความปลอดภัย (Safety)
  {
    code: 'TRN-SAF-001',
    name: 'ความปลอดภัยในการทำงาน',
    nameEn: 'Occupational Safety',
    description: 'หลักสูตรความปลอดภัยในการทำงานพื้นฐาน',
    category: 'Safety',
    validityDays: 365,
    isMandatory: true,
    durationHours: 4,
  },
  {
    code: 'TRN-SAF-002',
    name: 'การจัดการสารเคมีและตัวทำละลาย',
    nameEn: 'Chemical & Solvent Handling',
    description: 'การจัดการสารเคมีและตัวทำละลายที่ใช้ในการสกัดสมุนไพรอย่างปลอดภัย',
    category: 'Safety',
    validityDays: 365,
    isMandatory: false,
    durationHours: 4,
  },
  {
    code: 'TRN-SAF-003',
    name: 'การดับเพลิงและการอพยพ',
    nameEn: 'Fire Fighting & Evacuation',
    description: 'ทักษะการดับเพลิงและการอพยพในกรณีฉุกเฉิน',
    category: 'Safety',
    validityDays: 365,
    isMandatory: true,
    durationHours: 4,
  },

  // การผลิต (Production)
  {
    code: 'TRN-PRD-001',
    name: 'กระบวนการสกัดสมุนไพร',
    nameEn: 'Herbal Extraction Process',
    description: 'เทคนิคการสกัดสารสำคัญจากสมุนไพรด้วยวิธีต่างๆ',
    category: 'Production',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },
  {
    code: 'TRN-PRD-002',
    name: 'กระบวนการผลิตยาแคปซูลสมุนไพร',
    nameEn: 'Herbal Capsule Manufacturing',
    description: 'ขั้นตอนการผลิตยาแคปซูลสมุนไพร',
    category: 'Production',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },
  {
    code: 'TRN-PRD-003',
    name: 'กระบวนการผลิตยาเม็ดสมุนไพร',
    nameEn: 'Herbal Tablet Manufacturing',
    description: 'ขั้นตอนการผลิตยาเม็ดสมุนไพร',
    category: 'Production',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },
  {
    code: 'TRN-PRD-004',
    name: 'กระบวนการผลิตยาน้ำสมุนไพร',
    nameEn: 'Herbal Liquid Manufacturing',
    description: 'ขั้นตอนการผลิตยาน้ำและยาหยอดจากสมุนไพร',
    category: 'Production',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },
  {
    code: 'TRN-PRD-005',
    name: 'การใช้เครื่องจักรในการผลิตยาสมุนไพร',
    nameEn: 'Herbal Production Equipment Operation',
    description: 'การใช้งานเครื่องจักรในการผลิตยาสมุนไพร',
    category: 'Production',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },

  // คลังสินค้า (Warehouse)
  {
    code: 'TRN-WH-001',
    name: 'การจัดการคลังสมุนไพรตามมาตรฐาน GMP',
    nameEn: 'GMP Herbal Warehouse Management',
    description: 'การจัดการคลังวัตถุดิบสมุนไพรและผลิตภัณฑ์ตามมาตรฐาน GMP',
    category: 'Warehouse',
    validityDays: 365,
    isMandatory: false,
    durationHours: 4,
  },
  {
    code: 'TRN-WH-002',
    name: 'FEFO และการจัดการ Lot สมุนไพร',
    nameEn: 'FEFO & Herbal Lot Management',
    description: 'หลักการ First Expired First Out และการจัดการ Lot สำหรับวัตถุดิบสมุนไพร',
    category: 'Warehouse',
    validityDays: 365,
    isMandatory: false,
    durationHours: 2,
  },
  {
    code: 'TRN-WH-003',
    name: 'การจัดเก็บและรักษาคุณภาพสมุนไพร',
    nameEn: 'Herbal Storage & Quality Preservation',
    description: 'วิธีการจัดเก็บสมุนไพรให้คงคุณภาพ ควบคุมอุณหภูมิ ความชื้น และป้องกันแมลง',
    category: 'Warehouse',
    validityDays: 365,
    isMandatory: false,
    durationHours: 4,
  },
];

// Default App Roles (บทบาทในระบบ - โรงงานผลิตยาสมุนไพร ของรัฐ)
const defaultAppRoles = [
  { code: 'ADMIN', name: 'ผู้ดูแลระบบ', nameEn: 'System Administrator', description: 'สิทธิ์เต็มในการจัดการระบบ' },
  { code: 'DIRECTOR', name: 'ผู้อำนวยการ', nameEn: 'Director', description: 'ผู้อำนวยการโรงงาน - อนุมัติและดูรายงานทั้งหมด' },
  { code: 'DEPUTY_DIRECTOR', name: 'รองผู้อำนวยการ', nameEn: 'Deputy Director', description: 'รองผู้อำนวยการ - อนุมัติและดูรายงาน' },
  { code: 'DIV_HEAD', name: 'หัวหน้าฝ่าย', nameEn: 'Division Head', description: 'หัวหน้าฝ่าย - จัดการงานในฝ่าย' },
  { code: 'SECTION_HEAD', name: 'หัวหน้ากลุ่มงาน', nameEn: 'Section Head', description: 'หัวหน้ากลุ่มงาน - จัดการงานในกลุ่มงาน' },
  { code: 'PHARMACIST', name: 'เภสัชกร', nameEn: 'Pharmacist', description: 'เภสัชกร - ควบคุมและรับรองคุณภาพยา' },
  { code: 'SCIENTIST', name: 'นักวิทยาศาสตร์', nameEn: 'Scientist', description: 'นักวิทยาศาสตร์ - วิจัยและวิเคราะห์' },
  { code: 'TECHNICIAN', name: 'เจ้าพนักงาน', nameEn: 'Technician', description: 'เจ้าพนักงาน - ปฏิบัติงานตามหน้าที่' },
  { code: 'QC_MANAGER', name: 'หัวหน้าควบคุมคุณภาพ', nameEn: 'QC Manager', description: 'การจัดการควบคุมคุณภาพ' },
  { code: 'QC_ANALYST', name: 'ผู้วิเคราะห์คุณภาพ', nameEn: 'QC Analyst', description: 'งานวิเคราะห์และทดสอบคุณภาพ' },
  { code: 'QA_MANAGER', name: 'หัวหน้าประกันคุณภาพ', nameEn: 'QA Manager', description: 'การจัดการประกันคุณภาพ' },
  { code: 'QA_OFFICER', name: 'เจ้าหน้าที่ประกันคุณภาพ', nameEn: 'QA Officer', description: 'งานประกันคุณภาพ' },
  { code: 'PROD_MANAGER', name: 'หัวหน้าผลิต', nameEn: 'Production Manager', description: 'การจัดการผลิต' },
  { code: 'PROD_OPERATOR', name: 'พนักงานผลิต', nameEn: 'Production Operator', description: 'ปฏิบัติงานผลิต' },
  { code: 'WH_MANAGER', name: 'หัวหน้าคลัง', nameEn: 'Warehouse Manager', description: 'การจัดการคลังสินค้า' },
  { code: 'WH_STAFF', name: 'พนักงานคลัง', nameEn: 'Warehouse Staff', description: 'ปฏิบัติงานคลังสินค้า' },
  { code: 'HR_ADMIN', name: 'ผู้ดูแลบุคคล', nameEn: 'HR Administrator', description: 'การจัดการข้อมูลบุคลากร' },
  { code: 'VIEWER', name: 'ผู้ดูรายงาน', nameEn: 'Report Viewer', description: 'ดูรายงานอย่างเดียว' },
  { code: 'PROCUREMENT', name: 'พนักงานจัดซื้อ', nameEn: 'Procurement Staff', description: 'งานจัดซื้อจัดจ้าง' },
  { code: 'REGISTRATION', name: 'พนักงานทะเบียน', nameEn: 'Registration Staff', description: 'งานทะเบียนยาและใบอนุญาต' },
  { code: 'RD_RESEARCHER', name: 'นักวิจัย', nameEn: 'R&D Researcher', description: 'งานวิจัยและพัฒนาตำรับยา' },
];

// Default App Permissions (สิทธิ์ในระบบ)
const defaultAppPermissions = [
  // HR Permissions
  { code: 'hr:read', name: 'HR View', module: 'HR', description: 'View HR data' },
  { code: 'hr:write', name: 'HR Edit', module: 'HR', description: 'Edit HR data' },
  { code: 'hr:admin', name: 'HR Admin', module: 'HR', description: 'Full HR administration' },
  { code: 'hr:health_staff', name: 'HR Health Staff', module: 'HR', description: 'Manage health records' },

  // Production Permissions
  { code: 'production:read', name: 'Production View', module: 'Production', description: 'View production data' },
  { code: 'production:write', name: 'Production Edit', module: 'Production', description: 'Edit production data' },
  { code: 'production:approve', name: 'Production Approve', module: 'Production', description: 'Approve production records' },

  // Quality Permissions
  { code: 'quality:read', name: 'Quality View', module: 'Quality', description: 'View quality data' },
  { code: 'quality:write', name: 'Quality Edit', module: 'Quality', description: 'Edit quality data' },
  { code: 'quality:approve', name: 'Quality Approve', module: 'Quality', description: 'Approve quality records' },

  // Inventory Permissions
  { code: 'inventory:read', name: 'Inventory View', module: 'Inventory', description: 'View inventory data' },
  { code: 'inventory:write', name: 'Inventory Edit', module: 'Inventory', description: 'Edit inventory data' },
  { code: 'inventory:adjust', name: 'Inventory Adjust', module: 'Inventory', description: 'Adjust inventory' },

  // Purchasing Permissions
  { code: 'purchasing:read', name: 'Purchasing View', module: 'Purchasing', description: 'View purchasing data' },
  { code: 'purchasing:write', name: 'Purchasing Edit', module: 'Purchasing', description: 'Create/edit purchase orders' },
  { code: 'purchasing:approve', name: 'Purchasing Approve', module: 'Purchasing', description: 'Approve purchase orders' },

  // Sales Permissions
  { code: 'sales:read', name: 'Sales View', module: 'Sales', description: 'View sales data' },
  { code: 'sales:write', name: 'Sales Edit', module: 'Sales', description: 'Create/edit sales orders' },
];

/**
 * Check if a table is empty
 */
async function isTableEmpty(tableName: string, isSqlite: boolean): Promise<boolean> {
  try {
    if (isSqlite) {
      const db = getSqliteDb();
      const result = await db.all(sql.raw(`SELECT COUNT(*) as count FROM "${tableName}"`));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (result[0] as any)?.count === 0;
    } else {
      const db = await getMysqlDb();
      const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM \`${tableName}\``));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (result[0] as unknown as any[])[0]?.count === 0;
    }
  } catch {
    console.log(`[HR Seed] Could not check table ${tableName}, will attempt to seed`);
    return true;
  }
}

/**
 * Seed organization units if table is empty
 */
async function seedOrgUnits(isSqlite: boolean): Promise<number> {
  const tableName = 'hr_org_units';
  const isEmpty = await isTableEmpty(tableName, isSqlite);

  if (!isEmpty) {
    console.log(`[HR Seed] Table ${tableName} already has data, skipping seed`);
    return 0;
  }

  console.log(`[HR Seed] Seeding ${tableName} with ${defaultOrgUnits.length} default values...`);

  try {
    const orgUnitTable = isSqlite ? schema.sqliteHROrgUnits : schema.mysqlHROrgUnits;
    const db = isSqlite ? getSqliteDb() : await getMysqlDb();

    // First pass: insert all org units without parent references
    const codeToIdMap: Record<string, number> = {};

    for (const orgUnit of defaultOrgUnits) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (db as any).insert(orgUnitTable).values({
        code: orgUnit.code,
        name: orgUnit.name,
        nameEn: orgUnit.nameEn,
        type: orgUnit.type,
        parentId: null, // Set to null initially
        isGmpCritical: orgUnit.isGmpCritical,
        effectiveFrom: new Date(orgUnit.effectiveFrom),
        isActive: true,
      });

      // Get the inserted ID
      if (isSqlite) {
        codeToIdMap[orgUnit.code] = result.lastInsertRowid as number;
      } else {
        codeToIdMap[orgUnit.code] = result[0].insertId as number;
      }
    }

    // Second pass: update parent IDs
    for (const orgUnit of defaultOrgUnits) {
      if ('parentCode' in orgUnit && orgUnit.parentCode) {
        const parentId = codeToIdMap[orgUnit.parentCode];
        const id = codeToIdMap[orgUnit.code];
        if (parentId && id) {
          if (isSqlite) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (db as any).run(sql.raw(`UPDATE "${tableName}" SET parent_id = ${parentId} WHERE id = ${id}`));
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (db as any).execute(sql.raw(`UPDATE \`${tableName}\` SET parent_id = ${parentId} WHERE id = ${id}`));
          }
        }
      }
    }

    console.log(`[HR Seed] Successfully seeded ${defaultOrgUnits.length} organization units`);
    return defaultOrgUnits.length;
  } catch (error) {
    console.error(`[HR Seed] Failed to seed ${tableName}:`, error);
    return 0;
  }
}

/**
 * Seed positions if table is empty
 */
async function seedPositions(isSqlite: boolean): Promise<number> {
  const tableName = 'hr_positions';
  const isEmpty = await isTableEmpty(tableName, isSqlite);

  if (!isEmpty) {
    console.log(`[HR Seed] Table ${tableName} already has data, skipping seed`);
    return 0;
  }

  // First, get org unit ID mapping
  const orgUnitMap: Record<string, number> = {};
  try {
    if (isSqlite) {
      const db = getSqliteDb();
      const result = await db.all(sql.raw(`SELECT id, code FROM "hr_org_units"`));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.forEach((row: any) => {
        orgUnitMap[row.code] = row.id;
      });
    } else {
      const db = await getMysqlDb();
      const result = await db.execute(sql.raw(`SELECT id, code FROM \`hr_org_units\``));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result[0] as unknown as any[]).forEach((row: any) => {
        orgUnitMap[row.code] = row.id;
      });
    }
  } catch (error) {
    console.error(`[HR Seed] Could not get org units for positions seed:`, error);
    return 0;
  }

  console.log(`[HR Seed] Seeding ${tableName} with ${defaultPositions.length} default values...`);

  try {
    const positionsTable = isSqlite ? schema.sqliteHRPositions : schema.mysqlHRPositions;
    const db = isSqlite ? getSqliteDb() : await getMysqlDb();

    for (const position of defaultPositions) {
      const orgUnitId = orgUnitMap[position.orgUnitCode];
      if (!orgUnitId) {
        console.warn(`[HR Seed] Org unit ${position.orgUnitCode} not found for position ${position.code}`);
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).insert(positionsTable).values({
        code: position.code,
        title: position.title,
        titleEn: position.titleEn,
        orgUnitId: orgUnitId,
        jobGrade: position.jobGrade,
        isGmpCritical: position.isGmpCritical,
        isActive: true,
      });
    }

    console.log(`[HR Seed] Successfully seeded ${defaultPositions.length} positions`);
    return defaultPositions.length;
  } catch (error) {
    console.error(`[HR Seed] Failed to seed ${tableName}:`, error);
    return 0;
  }
}

/**
 * Seed training courses if table is empty
 */
async function seedTrainingCourses(isSqlite: boolean): Promise<number> {
  const tableName = 'hr_training_courses';
  const isEmpty = await isTableEmpty(tableName, isSqlite);

  if (!isEmpty) {
    console.log(`[HR Seed] Table ${tableName} already has data, skipping seed`);
    return 0;
  }

  console.log(`[HR Seed] Seeding ${tableName} with ${defaultTrainingCourses.length} default values...`);

  try {
    const coursesTable = isSqlite ? schema.sqliteHRTrainingCourses : schema.mysqlHRTrainingCourses;
    const db = isSqlite ? getSqliteDb() : await getMysqlDb();

    for (const course of defaultTrainingCourses) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).insert(coursesTable).values({
        code: course.code,
        name: course.name,
        nameEn: course.nameEn,
        description: course.description,
        category: course.category,
        validityDays: course.validityDays,
        isMandatory: course.isMandatory,
        durationHours: course.durationHours,
        isActive: true,
      });
    }

    console.log(`[HR Seed] Successfully seeded ${defaultTrainingCourses.length} training courses`);
    return defaultTrainingCourses.length;
  } catch (error) {
    console.error(`[HR Seed] Failed to seed ${tableName}:`, error);
    return 0;
  }
}

/**
 * Seed app roles if table is empty
 */
async function seedAppRoles(isSqlite: boolean): Promise<number> {
  const tableName = 'hr_app_roles';
  const isEmpty = await isTableEmpty(tableName, isSqlite);

  if (!isEmpty) {
    console.log(`[HR Seed] Table ${tableName} already has data, skipping seed`);
    return 0;
  }

  console.log(`[HR Seed] Seeding ${tableName} with ${defaultAppRoles.length} default values...`);

  try {
    const rolesTable = isSqlite ? schema.sqliteHRAppRoles : schema.mysqlHRAppRoles;
    const db = isSqlite ? getSqliteDb() : await getMysqlDb();

    for (const role of defaultAppRoles) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).insert(rolesTable).values({
        code: role.code,
        name: role.name,
        description: role.description,
        isActive: true,
      });
    }

    console.log(`[HR Seed] Successfully seeded ${defaultAppRoles.length} app roles`);
    return defaultAppRoles.length;
  } catch (error) {
    console.error(`[HR Seed] Failed to seed ${tableName}:`, error);
    return 0;
  }
}

/**
 * Seed app permissions if table is empty
 */
async function seedAppPermissions(isSqlite: boolean): Promise<number> {
  const tableName = 'hr_app_permissions';
  const isEmpty = await isTableEmpty(tableName, isSqlite);

  if (!isEmpty) {
    console.log(`[HR Seed] Table ${tableName} already has data, skipping seed`);
    return 0;
  }

  console.log(`[HR Seed] Seeding ${tableName} with ${defaultAppPermissions.length} default values...`);

  try {
    const permissionsTable = isSqlite ? schema.sqliteHRAppPermissions : schema.mysqlHRAppPermissions;
    const db = isSqlite ? getSqliteDb() : await getMysqlDb();

    for (const permission of defaultAppPermissions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).insert(permissionsTable).values({
        code: permission.code,
        name: permission.name,
        module: permission.module,
        description: permission.description,
      });
    }

    console.log(`[HR Seed] Successfully seeded ${defaultAppPermissions.length} app permissions`);
    return defaultAppPermissions.length;
  } catch (error) {
    console.error(`[HR Seed] Failed to seed ${tableName}:`, error);
    return 0;
  }
}

/**
 * Seed all HR lookup tables if they are empty
 * This function is called during server startup after schema sync
 */
export async function seedHRTables(): Promise<{
  orgUnitsSeeded: number;
  positionsSeeded: number;
  trainingCoursesSeeded: number;
  appRolesSeeded: number;
  appPermissionsSeeded: number;
}> {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const usingSqlite = isSqlite();
  console.log(`[HR Seed] Starting HR tables seeding for ${usingSqlite ? 'SQLite' : 'MySQL'}...`);

  const orgUnitsSeeded = await seedOrgUnits(usingSqlite);
  const positionsSeeded = await seedPositions(usingSqlite);
  const trainingCoursesSeeded = await seedTrainingCourses(usingSqlite);
  const appRolesSeeded = await seedAppRoles(usingSqlite);
  const appPermissionsSeeded = await seedAppPermissions(usingSqlite);

  console.log(`[HR Seed] HR tables seeding complete.`);
  console.log(`[HR Seed] Org units: ${orgUnitsSeeded}, Positions: ${positionsSeeded}, Courses: ${trainingCoursesSeeded}, Roles: ${appRolesSeeded}, Permissions: ${appPermissionsSeeded}`);

  return {
    orgUnitsSeeded,
    positionsSeeded,
    trainingCoursesSeeded,
    appRolesSeeded,
    appPermissionsSeeded,
  };
}
