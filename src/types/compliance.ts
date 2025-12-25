/**
 * Compliance Dashboard Types
 * Phase 11: GMP Compliance Dashboard (Tasks T1101-T1103)
 *
 * Types for compliance overview, chapter coverage, and gap analysis
 */

// ============================================
// GMP Chapter Mapping
// ============================================

export const GMP_CHAPTERS = {
  1: { name: 'ระบบบริหารคุณภาพ', nameEn: 'Quality Management System' },
  2: { name: 'บุคลากร', nameEn: 'Personnel' },
  3: { name: 'อาคารสถานที่และเครื่องมือ', nameEn: 'Premises and Equipment' },
  4: { name: 'การสุขาภิบาลและสุขอนามัย', nameEn: 'Sanitation and Hygiene' },
  5: { name: 'เอกสารและข้อมูล', nameEn: 'Documentation' },
  6: { name: 'การดำเนินการผลิต', nameEn: 'Production Operations' },
  7: { name: 'การควบคุมคุณภาพ', nameEn: 'Quality Control' },
  8: { name: 'การจ้างผลิตและจ้างตรวจวิเคราะห์', nameEn: 'Contract Manufacturing' },
  9: { name: 'ข้อร้องเรียนและการเรียกคืน', nameEn: 'Complaints and Recalls' },
  10: { name: 'การตรวจสอบตนเอง', nameEn: 'Self-Inspection' },
} as const;

export type GMPChapterNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// ============================================
// Compliance Requirement
// ============================================

export interface ComplianceRequirement {
  id: string;
  description: string;
  isMet: boolean;
  evidence?: string;
}

// ============================================
// Compliance Gap
// ============================================

export interface ComplianceGap {
  requirementId: string;
  requirement: string;
  chapter: GMPChapterNumber;
  chapterName: string;
  currentStatus: string;
  affectedRecords: Array<{
    type: string;
    id: number;
    reference: string;
  }>;
  remediation: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================
// Chapter Coverage
// ============================================

export interface ChapterCoverage {
  chapter: GMPChapterNumber;
  name: string;
  nameEn: string;
  score: number; // 0-100
  requirements: ComplianceRequirement[];
  gaps: ComplianceGap[];
  metCount: number;
  totalCount: number;
}

// ============================================
// Compliance Overview
// ============================================

export interface ComplianceOverview {
  overallScore: number; // 0-100
  totalRequirements: number;
  metRequirements: number;
  gapCount: number;
  byChapter: ChapterCoverage[];
  lastUpdated: string;
}

// ============================================
// Gaps With Drilldown Params
// ============================================

export interface GapsWithDrilldownParams {
  chapterFilter?: GMPChapterNumber;
  priorityFilter?: 'low' | 'medium' | 'high' | 'critical';
}
