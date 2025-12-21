/**
 * HR Lookup Tables Auto-Seeder
 *
 * Automatically seeds default values into HR lookup tables
 * (org_units, positions, training_courses, app_roles, app_permissions)
 * if they are empty. This runs during server startup after schema sync.
 */

import { sql } from 'drizzle-orm';
import { useSqlite, getSqliteDb, getMysqlDb } from './index';
import * as schema from './schema';

// Default Organization Units (โครงสร้างองค์กร - โรงงานผลิตยาสมุนไพร ของรัฐ)
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
  // Division level (ฝ่าย)
  {
    code: 'DIV-001',
    name: 'ฝ่ายบริหารงานทั่วไป',
    nameEn: 'General Administration Division',
    type: 'division',
    parentCode: 'ORG-001',
    isGmpCritical: false,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DIV-002',
    name: 'ฝ่ายวิจัยและพัฒนา',
    nameEn: 'Research & Development Division',
    type: 'division',
    parentCode: 'ORG-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DIV-003',
    name: 'ฝ่ายผลิต',
    nameEn: 'Production Division',
    type: 'division',
    parentCode: 'ORG-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DIV-004',
    name: 'ฝ่ายควบคุมคุณภาพ',
    nameEn: 'Quality Control Division',
    type: 'division',
    parentCode: 'ORG-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DIV-005',
    name: 'ฝ่ายประกันคุณภาพ',
    nameEn: 'Quality Assurance Division',
    type: 'division',
    parentCode: 'ORG-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DIV-006',
    name: 'ฝ่ายคลังพัสดุและจัดซื้อ',
    nameEn: 'Warehouse & Procurement Division',
    type: 'division',
    parentCode: 'ORG-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DIV-007',
    name: 'ฝ่ายวิชาการและทะเบียน',
    nameEn: 'Technical & Registration Division',
    type: 'division',
    parentCode: 'ORG-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  // Department level (กลุ่มงาน/แผนก)
  {
    code: 'DEPT-001',
    name: 'กลุ่มงานบุคคลและธุรการ',
    nameEn: 'HR & Administrative Section',
    type: 'department',
    parentCode: 'DIV-001',
    isGmpCritical: false,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-002',
    name: 'กลุ่มงานการเงินและบัญชี',
    nameEn: 'Finance & Accounting Section',
    type: 'department',
    parentCode: 'DIV-001',
    isGmpCritical: false,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-003',
    name: 'กลุ่มงานวิจัยสมุนไพร',
    nameEn: 'Herbal Research Section',
    type: 'department',
    parentCode: 'DIV-002',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-004',
    name: 'กลุ่มงานพัฒนาตำรับยา',
    nameEn: 'Drug Formulation Development Section',
    type: 'department',
    parentCode: 'DIV-002',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-005',
    name: 'กลุ่มงานผลิตยาสมุนไพร',
    nameEn: 'Herbal Drug Manufacturing Section',
    type: 'department',
    parentCode: 'DIV-003',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-006',
    name: 'กลุ่มงานบรรจุและแปรรูป',
    nameEn: 'Packaging & Processing Section',
    type: 'department',
    parentCode: 'DIV-003',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-007',
    name: 'กลุ่มงานวิเคราะห์เคมี',
    nameEn: 'Chemical Analysis Section',
    type: 'department',
    parentCode: 'DIV-004',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-008',
    name: 'กลุ่มงานจุลชีววิทยา',
    nameEn: 'Microbiology Section',
    type: 'department',
    parentCode: 'DIV-004',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-009',
    name: 'กลุ่มงานพฤกษศาสตร์',
    nameEn: 'Botanical Section',
    type: 'department',
    parentCode: 'DIV-004',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-010',
    name: 'กลุ่มงานระบบคุณภาพ',
    nameEn: 'Quality System Section',
    type: 'department',
    parentCode: 'DIV-005',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-011',
    name: 'กลุ่มงานตรวจสอบภายใน',
    nameEn: 'Internal Audit Section',
    type: 'department',
    parentCode: 'DIV-005',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-012',
    name: 'กลุ่มงานคลังวัตถุดิบสมุนไพร',
    nameEn: 'Herbal Raw Material Warehouse Section',
    type: 'department',
    parentCode: 'DIV-006',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-013',
    name: 'กลุ่มงานคลังผลิตภัณฑ์สำเร็จรูป',
    nameEn: 'Finished Product Warehouse Section',
    type: 'department',
    parentCode: 'DIV-006',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-014',
    name: 'กลุ่มงานจัดซื้อจัดจ้าง',
    nameEn: 'Procurement Section',
    type: 'department',
    parentCode: 'DIV-006',
    isGmpCritical: false,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-015',
    name: 'กลุ่มงานทะเบียนและกฎหมาย',
    nameEn: 'Registration & Legal Section',
    type: 'department',
    parentCode: 'DIV-007',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-016',
    name: 'กลุ่มงานเภสัชสนเทศ',
    nameEn: 'Drug Information Section',
    type: 'department',
    parentCode: 'DIV-007',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
];

// Default Positions (ตำแหน่งงาน - โครงสร้างราชการ/รัฐวิสาหกิจ)
const defaultPositions = [
  // ผู้บริหาร (Executive)
  { code: 'POS-001', title: 'ผู้อำนวยการโรงงาน', titleEn: 'Factory Director', orgUnitCode: 'ORG-001', jobGrade: 'E1', isGmpCritical: true },
  { code: 'POS-002', title: 'รองผู้อำนวยการโรงงาน', titleEn: 'Deputy Factory Director', orgUnitCode: 'ORG-001', jobGrade: 'E2', isGmpCritical: true },

  // ฝ่ายบริหารงานทั่วไป (General Administration)
  { code: 'POS-010', title: 'หัวหน้าฝ่ายบริหารงานทั่วไป', titleEn: 'Head of General Administration', orgUnitCode: 'DIV-001', jobGrade: 'M1', isGmpCritical: false },
  { code: 'POS-011', title: 'หัวหน้ากลุ่มงานบุคคลและธุรการ', titleEn: 'Head of HR & Admin Section', orgUnitCode: 'DEPT-001', jobGrade: 'S1', isGmpCritical: false },
  { code: 'POS-012', title: 'นักทรัพยากรบุคคล', titleEn: 'HR Specialist', orgUnitCode: 'DEPT-001', jobGrade: 'P1', isGmpCritical: false },
  { code: 'POS-013', title: 'เจ้าพนักงานธุรการ', titleEn: 'Administrative Officer', orgUnitCode: 'DEPT-001', jobGrade: 'T1', isGmpCritical: false },
  { code: 'POS-014', title: 'หัวหน้ากลุ่มงานการเงินและบัญชี', titleEn: 'Head of Finance & Accounting Section', orgUnitCode: 'DEPT-002', jobGrade: 'S1', isGmpCritical: false },
  { code: 'POS-015', title: 'นักวิชาการเงินและบัญชี', titleEn: 'Finance & Accounting Specialist', orgUnitCode: 'DEPT-002', jobGrade: 'P1', isGmpCritical: false },

  // ฝ่ายวิจัยและพัฒนา (R&D)
  { code: 'POS-020', title: 'หัวหน้าฝ่ายวิจัยและพัฒนา', titleEn: 'Head of R&D Division', orgUnitCode: 'DIV-002', jobGrade: 'M1', isGmpCritical: true },
  { code: 'POS-021', title: 'หัวหน้ากลุ่มงานวิจัยสมุนไพร', titleEn: 'Head of Herbal Research Section', orgUnitCode: 'DEPT-003', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-022', title: 'นักวิจัยสมุนไพร', titleEn: 'Herbal Researcher', orgUnitCode: 'DEPT-003', jobGrade: 'P1', isGmpCritical: true },
  { code: 'POS-023', title: 'แพทย์แผนไทย', titleEn: 'Thai Traditional Medicine Doctor', orgUnitCode: 'DEPT-003', jobGrade: 'P1', isGmpCritical: true },
  { code: 'POS-024', title: 'หัวหน้ากลุ่มงานพัฒนาตำรับยา', titleEn: 'Head of Formulation Development Section', orgUnitCode: 'DEPT-004', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-025', title: 'เภสัชกรพัฒนาตำรับ', titleEn: 'Formulation Pharmacist', orgUnitCode: 'DEPT-004', jobGrade: 'P1', isGmpCritical: true },

  // ฝ่ายผลิต (Production)
  { code: 'POS-030', title: 'หัวหน้าฝ่ายผลิต', titleEn: 'Head of Production Division', orgUnitCode: 'DIV-003', jobGrade: 'M1', isGmpCritical: true },
  { code: 'POS-031', title: 'เภสัชกรควบคุมการผลิต', titleEn: 'Production Pharmacist', orgUnitCode: 'DIV-003', jobGrade: 'P1', isGmpCritical: true },
  { code: 'POS-032', title: 'หัวหน้ากลุ่มงานผลิตยาสมุนไพร', titleEn: 'Head of Herbal Manufacturing Section', orgUnitCode: 'DEPT-005', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-033', title: 'นักวิทยาศาสตร์การผลิต', titleEn: 'Production Scientist', orgUnitCode: 'DEPT-005', jobGrade: 'P1', isGmpCritical: true },
  { code: 'POS-034', title: 'เจ้าพนักงานผลิต', titleEn: 'Production Technician', orgUnitCode: 'DEPT-005', jobGrade: 'T1', isGmpCritical: true },
  { code: 'POS-035', title: 'หัวหน้ากลุ่มงานบรรจุและแปรรูป', titleEn: 'Head of Packaging Section', orgUnitCode: 'DEPT-006', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-036', title: 'เจ้าพนักงานบรรจุ', titleEn: 'Packaging Technician', orgUnitCode: 'DEPT-006', jobGrade: 'T1', isGmpCritical: true },

  // ฝ่ายควบคุมคุณภาพ (Quality Control)
  { code: 'POS-040', title: 'หัวหน้าฝ่ายควบคุมคุณภาพ', titleEn: 'Head of Quality Control Division', orgUnitCode: 'DIV-004', jobGrade: 'M1', isGmpCritical: true },
  { code: 'POS-041', title: 'เภสัชกรควบคุมคุณภาพ', titleEn: 'QC Pharmacist', orgUnitCode: 'DIV-004', jobGrade: 'P1', isGmpCritical: true },
  { code: 'POS-042', title: 'หัวหน้ากลุ่มงานวิเคราะห์เคมี', titleEn: 'Head of Chemical Analysis Section', orgUnitCode: 'DEPT-007', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-043', title: 'นักวิทยาศาสตร์การแพทย์ (เคมี)', titleEn: 'Medical Scientist (Chemistry)', orgUnitCode: 'DEPT-007', jobGrade: 'P1', isGmpCritical: true },
  { code: 'POS-044', title: 'เจ้าพนักงานวิทยาศาสตร์การแพทย์', titleEn: 'Medical Science Technician', orgUnitCode: 'DEPT-007', jobGrade: 'T1', isGmpCritical: true },
  { code: 'POS-045', title: 'หัวหน้ากลุ่มงานจุลชีววิทยา', titleEn: 'Head of Microbiology Section', orgUnitCode: 'DEPT-008', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-046', title: 'นักวิทยาศาสตร์การแพทย์ (จุลชีววิทยา)', titleEn: 'Medical Scientist (Microbiology)', orgUnitCode: 'DEPT-008', jobGrade: 'P1', isGmpCritical: true },
  { code: 'POS-047', title: 'หัวหน้ากลุ่มงานพฤกษศาสตร์', titleEn: 'Head of Botanical Section', orgUnitCode: 'DEPT-009', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-048', title: 'นักวิทยาศาสตร์ (พฤกษศาสตร์)', titleEn: 'Botanist', orgUnitCode: 'DEPT-009', jobGrade: 'P1', isGmpCritical: true },

  // ฝ่ายประกันคุณภาพ (Quality Assurance)
  { code: 'POS-050', title: 'หัวหน้าฝ่ายประกันคุณภาพ', titleEn: 'Head of Quality Assurance Division', orgUnitCode: 'DIV-005', jobGrade: 'M1', isGmpCritical: true },
  { code: 'POS-051', title: 'เภสัชกรประกันคุณภาพ', titleEn: 'QA Pharmacist', orgUnitCode: 'DIV-005', jobGrade: 'P1', isGmpCritical: true },
  { code: 'POS-052', title: 'หัวหน้ากลุ่มงานระบบคุณภาพ', titleEn: 'Head of Quality System Section', orgUnitCode: 'DEPT-010', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-053', title: 'เจ้าหน้าที่ระบบคุณภาพ', titleEn: 'Quality System Officer', orgUnitCode: 'DEPT-010', jobGrade: 'P1', isGmpCritical: true },
  { code: 'POS-054', title: 'เจ้าหน้าที่ควบคุมเอกสาร', titleEn: 'Document Controller', orgUnitCode: 'DEPT-010', jobGrade: 'T1', isGmpCritical: true },
  { code: 'POS-055', title: 'หัวหน้ากลุ่มงานตรวจสอบภายใน', titleEn: 'Head of Internal Audit Section', orgUnitCode: 'DEPT-011', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-056', title: 'ผู้ตรวจสอบภายใน', titleEn: 'Internal Auditor', orgUnitCode: 'DEPT-011', jobGrade: 'P1', isGmpCritical: true },

  // ฝ่ายคลังพัสดุและจัดซื้อ (Warehouse & Procurement)
  { code: 'POS-060', title: 'หัวหน้าฝ่ายคลังพัสดุและจัดซื้อ', titleEn: 'Head of Warehouse & Procurement Division', orgUnitCode: 'DIV-006', jobGrade: 'M1', isGmpCritical: true },
  { code: 'POS-061', title: 'หัวหน้ากลุ่มงานคลังวัตถุดิบสมุนไพร', titleEn: 'Head of Herbal Material Warehouse Section', orgUnitCode: 'DEPT-012', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-062', title: 'เจ้าพนักงานพัสดุ (วัตถุดิบ)', titleEn: 'Material Technician (Raw Material)', orgUnitCode: 'DEPT-012', jobGrade: 'T1', isGmpCritical: true },
  { code: 'POS-063', title: 'หัวหน้ากลุ่มงานคลังผลิตภัณฑ์สำเร็จรูป', titleEn: 'Head of Finished Product Warehouse Section', orgUnitCode: 'DEPT-013', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-064', title: 'เจ้าพนักงานพัสดุ (ผลิตภัณฑ์)', titleEn: 'Material Technician (Finished Product)', orgUnitCode: 'DEPT-013', jobGrade: 'T1', isGmpCritical: true },
  { code: 'POS-065', title: 'หัวหน้ากลุ่มงานจัดซื้อจัดจ้าง', titleEn: 'Head of Procurement Section', orgUnitCode: 'DEPT-014', jobGrade: 'S1', isGmpCritical: false },
  { code: 'POS-066', title: 'นักวิชาการพัสดุ', titleEn: 'Procurement Specialist', orgUnitCode: 'DEPT-014', jobGrade: 'P1', isGmpCritical: false },

  // ฝ่ายวิชาการและทะเบียน (Technical & Registration)
  { code: 'POS-070', title: 'หัวหน้าฝ่ายวิชาการและทะเบียน', titleEn: 'Head of Technical & Registration Division', orgUnitCode: 'DIV-007', jobGrade: 'M1', isGmpCritical: true },
  { code: 'POS-071', title: 'หัวหน้ากลุ่มงานทะเบียนและกฎหมาย', titleEn: 'Head of Registration & Legal Section', orgUnitCode: 'DEPT-015', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-072', title: 'เภสัชกรทะเบียนยา', titleEn: 'Drug Registration Pharmacist', orgUnitCode: 'DEPT-015', jobGrade: 'P1', isGmpCritical: true },
  { code: 'POS-073', title: 'นิติกร', titleEn: 'Legal Officer', orgUnitCode: 'DEPT-015', jobGrade: 'P1', isGmpCritical: false },
  { code: 'POS-074', title: 'หัวหน้ากลุ่มงานเภสัชสนเทศ', titleEn: 'Head of Drug Information Section', orgUnitCode: 'DEPT-016', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-075', title: 'เภสัชกรเภสัชสนเทศ', titleEn: 'Drug Information Pharmacist', orgUnitCode: 'DEPT-016', jobGrade: 'P1', isGmpCritical: true },
];

// Default Training Courses (หลักสูตรอบรม - โรงงานผลิตยาสมุนไพร)
const defaultTrainingCourses = [
  // GMP สมุนไพร (Herbal GMP)
  {
    code: 'TRN-GMP-001',
    name: 'หลักเกณฑ์และวิธีการที่ดีในการผลิตยาจากสมุนไพร (GMP)',
    nameEn: 'Good Manufacturing Practice for Herbal Medicines',
    description: 'อบรมพื้นฐาน GMP สำหรับการผลิตยาสมุนไพรตามมาตรฐาน WHO และ อย.',
    category: 'GMP',
    validityDays: 365,
    isMandatory: true,
    durationHours: 8,
  },
  {
    code: 'TRN-GMP-002',
    name: 'การทบทวน GMP ประจำปี',
    nameEn: 'Annual GMP Refresher',
    description: 'อบรมทบทวน GMP สำหรับยาสมุนไพรประจำปี',
    category: 'GMP',
    validityDays: 365,
    isMandatory: true,
    durationHours: 4,
  },
  {
    code: 'TRN-GMP-003',
    name: 'สุขอนามัยส่วนบุคคลและการป้องกันการปนเปื้อน',
    nameEn: 'Personal Hygiene & Contamination Prevention',
    description: 'อบรมเรื่องสุขอนามัยและการป้องกันการปนเปื้อนข้ามในการผลิตยาสมุนไพร',
    category: 'GMP',
    validityDays: 365,
    isMandatory: true,
    durationHours: 2,
  },
  {
    code: 'TRN-GMP-004',
    name: 'การแต่งกายและขั้นตอนการเข้าพื้นที่ผลิต',
    nameEn: 'Gowning Procedure',
    description: 'ขั้นตอนการแต่งกายและการเข้าพื้นที่ผลิตยาสมุนไพร',
    category: 'GMP',
    validityDays: 365,
    isMandatory: true,
    durationHours: 2,
  },

  // GACP (Good Agricultural and Collection Practice)
  {
    code: 'TRN-GACP-001',
    name: 'หลักเกณฑ์และวิธีการที่ดีในการเพาะปลูกและเก็บเกี่ยวสมุนไพร (GACP)',
    nameEn: 'Good Agricultural and Collection Practice',
    description: 'มาตรฐานการเพาะปลูกและเก็บเกี่ยวสมุนไพรตามหลัก GACP',
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

  // การจัดทำเอกสาร (Documentation)
  {
    code: 'TRN-DOC-001',
    name: 'การจัดทำเอกสาร GDP',
    nameEn: 'Good Documentation Practice',
    description: 'หลักการจัดทำและควบคุมเอกสารตามมาตรฐาน GMP สมุนไพร',
    category: 'Documentation',
    validityDays: 365,
    isMandatory: true,
    durationHours: 4,
  },
  {
    code: 'TRN-DOC-002',
    name: 'Batch Record และการจัดการความเบี่ยงเบน',
    nameEn: 'Batch Record & Deviation Handling',
    description: 'การกรอกบันทึกการผลิตยาสมุนไพรและการจัดการความเบี่ยงเบน',
    category: 'Documentation',
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
      return (result[0] as any[])[0]?.count === 0;
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
            await db.run(sql.raw(`UPDATE "${tableName}" SET parent_id = ${parentId} WHERE id = ${id}`));
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
      (result[0] as any[]).forEach((row: any) => {
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
  const isSqlite = useSqlite();
  console.log(`[HR Seed] Starting HR tables seeding for ${isSqlite ? 'SQLite' : 'MySQL'}...`);

  const orgUnitsSeeded = await seedOrgUnits(isSqlite);
  const positionsSeeded = await seedPositions(isSqlite);
  const trainingCoursesSeeded = await seedTrainingCourses(isSqlite);
  const appRolesSeeded = await seedAppRoles(isSqlite);
  const appPermissionsSeeded = await seedAppPermissions(isSqlite);

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
