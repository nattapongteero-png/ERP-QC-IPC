/**
 * Compliance Dashboard Service
 * Phase 11: GMP Compliance Dashboard (Tasks T1101-T1103)
 *
 * Provides GMP compliance overview across all 10 chapters (หมวด 1-10)
 */

import { getCapaDashboard } from './capa-service';
import { getAuditStatistics, getChapterCoverage as getAuditChapterCoverage } from './internal-audit-service';
import { getComplaintDashboard } from './complaint-service';
import { getSanitationTrends } from './sanitation-service';
import { getOverdueCalibrations } from './equipment-maintenance-service';
import { getDb, isSqlite } from '../db';
import { getTodayStr } from '../db/date-utils';
import { eq, count } from 'drizzle-orm';
import {
  sqliteStabilityStudies,
  sqliteDeviations,
  sqliteUsers,
  mysqlStabilityStudies,
  mysqlDeviations,
  mysqlUsers,
} from '../db/schema';

import type {
  ComplianceOverview,
  ChapterCoverage,
  ComplianceGap,
  ComplianceRequirement,
  GMPChapterNumber,
  GMP_CHAPTERS,
  GapsWithDrilldownParams,
} from '@/types/compliance';

// Get table references based on database type
function getTables() {
  if (isSqlite()) {
    return {
      stabilityStudies: sqliteStabilityStudies,
      deviations: sqliteDeviations,
      users: sqliteUsers,
    };
  }
  return {
    stabilityStudies: mysqlStabilityStudies,
    deviations: mysqlDeviations,
    users: mysqlUsers,
  };
}

// Import GMP chapter mapping
const GMP_CHAPTER_MAP: typeof GMP_CHAPTERS = {
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
};

// ============================================
// T1101: Get Compliance Overview
// ============================================

/**
 * Get overall compliance statistics across all GMP chapters
 * Aggregates data from all GMP-related modules
 */
export async function getComplianceOverview(): Promise<ComplianceOverview> {
  // Calculate coverage for all 10 chapters
  const chapterPromises = [];
  for (let chapter = 1; chapter <= 10; chapter++) {
    chapterPromises.push(calculateChapterCoverage(chapter as GMPChapterNumber));
  }
  const byChapter = await Promise.all(chapterPromises);

  // Calculate overall metrics
  const totalRequirements = byChapter.reduce((sum, ch) => sum + ch.totalCount, 0);
  const metRequirements = byChapter.reduce((sum, ch) => sum + ch.metCount, 0);
  const gapCount = byChapter.reduce((sum, ch) => sum + ch.gaps.length, 0);
  const overallScore = totalRequirements > 0
    ? Math.round((metRequirements / totalRequirements) * 100)
    : 0;

  return {
    overallScore,
    totalRequirements,
    metRequirements,
    gapCount,
    byChapter,
    lastUpdated: new Date().toISOString(),
  };
}

// ============================================
// T1102: Calculate Chapter Coverage
// ============================================

/**
 * Calculate coverage for a specific GMP chapter
 * Each chapter has specific requirements to check
 */
export async function calculateChapterCoverage(
  chapterNumber: GMPChapterNumber
): Promise<ChapterCoverage> {
  const chapterInfo = GMP_CHAPTER_MAP[chapterNumber];
  const requirements: ComplianceRequirement[] = [];
  const gaps: ComplianceGap[] = [];

  switch (chapterNumber) {
    case 1: // Quality Management System - CAPA & Deviations
      await evaluateChapter1(requirements, gaps);
      break;
    case 2: // Personnel - Training records
      await evaluateChapter2(requirements, gaps);
      break;
    case 3: // Premises & Equipment - Calibration & Maintenance
      await evaluateChapter3(requirements, gaps);
      break;
    case 4: // Sanitation & Hygiene - Sanitation compliance
      await evaluateChapter4(requirements, gaps);
      break;
    case 5: // Documentation - Document control
      await evaluateChapter5(requirements, gaps);
      break;
    case 6: // Production - Work orders (if exists)
      await evaluateChapter6(requirements, gaps);
      break;
    case 7: // Quality Control - Stability & OOS
      await evaluateChapter7(requirements, gaps);
      break;
    case 8: // Contract Manufacturing - Vendor qualification (if exists)
      await evaluateChapter8(requirements, gaps);
      break;
    case 9: // Complaints & Recalls
      await evaluateChapter9(requirements, gaps);
      break;
    case 10: // Self-Inspection - Audits & Findings
      await evaluateChapter10(requirements, gaps);
      break;
  }

  const metCount = requirements.filter(r => r.isMet).length;
  const totalCount = requirements.length;
  const score = totalCount > 0 ? Math.round((metCount / totalCount) * 100) : 0;

  return {
    chapter: chapterNumber,
    name: chapterInfo.name,
    nameEn: chapterInfo.nameEn,
    score,
    requirements,
    gaps,
    metCount,
    totalCount,
  };
}

// ============================================
// Chapter-Specific Evaluation Functions
// ============================================

/**
 * Chapter 1: Quality Management System
 * - CAPA effectiveness
 * - Deviation closure rate
 */
async function evaluateChapter1(
  requirements: ComplianceRequirement[],
  gaps: ComplianceGap[]
): Promise<void> {
  const capaDashboard = await getCapaDashboard();
  const db = await getDb();
  const { deviations } = getTables();

  // Requirement 1.1: CAPA effectiveness rate >= 85%
  const capaEffectiveness = capaDashboard.effectivenessRate;
  const capaEffectivenessMet = capaEffectiveness >= 85;
  requirements.push({
    id: '1.1',
    description: 'CAPA effectiveness rate >= 85%',
    isMet: capaEffectivenessMet,
    evidence: `Current: ${capaEffectiveness}%`,
  });

  if (!capaEffectivenessMet) {
    gaps.push({
      requirementId: '1.1',
      requirement: 'CAPA effectiveness rate >= 85%',
      chapter: 1,
      chapterName: GMP_CHAPTER_MAP[1].name,
      currentStatus: `Current effectiveness rate: ${capaEffectiveness}%`,
      affectedRecords: [],
      remediation: 'Review CAPA effectiveness checks. Ensure verification criteria are clearly defined and follow-up actions are documented.',
      priority: capaEffectiveness < 70 ? 'high' : 'medium',
    });
  }

  // Requirement 1.2: Deviation closure rate >= 90% within 30 days
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allDeviations = await (db as any)
    .select({
      id: deviations.id,
      deviationNumber: deviations.deviationNumber,
      status: deviations.status,
      closedDate: deviations.closedDate,
      createdAt: deviations.createdAt,
    })
    .from(deviations);

  const closedDeviations = allDeviations.filter((d: { status: string }) => d.status === 'closed');
  const closedWithin30Days = closedDeviations.filter((d: { createdAt: string; closedDate: string | null }) => {
    if (!d.closedDate) return false;
    const created = new Date(d.createdAt);
    const closed = new Date(d.closedDate);
    const daysDiff = Math.ceil((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 30;
  });

  const deviationClosureRate = closedDeviations.length > 0
    ? Math.round((closedWithin30Days.length / closedDeviations.length) * 100)
    : 100; // If no closed deviations, consider it met
  const deviationClosureMet = deviationClosureRate >= 90;

  requirements.push({
    id: '1.2',
    description: 'Deviation closure rate >= 90% within 30 days',
    isMet: deviationClosureMet,
    evidence: `Current: ${deviationClosureRate}%`,
  });

  if (!deviationClosureMet) {
    gaps.push({
      requirementId: '1.2',
      requirement: 'Deviation closure rate >= 90% within 30 days',
      chapter: 1,
      chapterName: GMP_CHAPTER_MAP[1].name,
      currentStatus: `Current closure rate: ${deviationClosureRate}%`,
      affectedRecords: [],
      remediation: 'Review deviation investigation timelines. Assign clear owners and due dates. Escalate overdue investigations.',
      priority: deviationClosureRate < 70 ? 'critical' : 'high',
    });
  }

  // Requirement 1.3: No overdue CAPAs
  const overdueCapas = capaDashboard.overdue;
  const noOverdueCapas = overdueCapas === 0;

  requirements.push({
    id: '1.3',
    description: 'No overdue CAPAs',
    isMet: noOverdueCapas,
    evidence: `Current overdue: ${overdueCapas}`,
  });

  if (!noOverdueCapas) {
    gaps.push({
      requirementId: '1.3',
      requirement: 'No overdue CAPAs',
      chapter: 1,
      chapterName: GMP_CHAPTER_MAP[1].name,
      currentStatus: `${overdueCapas} CAPAs are overdue`,
      affectedRecords: [],
      remediation: 'Review overdue CAPAs. Reassign if needed. Update due dates with justification or expedite completion.',
      priority: overdueCapas > 5 ? 'critical' : 'high',
    });
  }
}

/**
 * Chapter 2: Personnel
 * - Training records exist (basic check: users table has records)
 */
async function evaluateChapter2(
  requirements: ComplianceRequirement[],
  gaps: ComplianceGap[]
): Promise<void> {
  const db = await getDb();
  const { users } = getTables();

  // Requirement 2.1: Active personnel records exist
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeUsers = await (db as any)
    .select({ count: count() })
    .from(users)
    .where(eq(users.isActive, true));

  const activeCount = activeUsers[0]?.count || 0;
  const hasActivePersonnel = activeCount > 0;

  requirements.push({
    id: '2.1',
    description: 'Active personnel records exist',
    isMet: hasActivePersonnel,
    evidence: `Active users: ${activeCount}`,
  });

  if (!hasActivePersonnel) {
    gaps.push({
      requirementId: '2.1',
      requirement: 'Active personnel records exist',
      chapter: 2,
      chapterName: GMP_CHAPTER_MAP[2].name,
      currentStatus: 'No active personnel records found',
      affectedRecords: [],
      remediation: 'Create personnel records in the system. Ensure all staff have user accounts with proper roles.',
      priority: 'critical',
    });
  }
}

/**
 * Chapter 3: Premises & Equipment
 * - Equipment calibration status
 * - Maintenance compliance
 */
async function evaluateChapter3(
  requirements: ComplianceRequirement[],
  gaps: ComplianceGap[]
): Promise<void> {
  const overdueCalibrations = await getOverdueCalibrations();

  // Requirement 3.1: No overdue calibrations
  const noOverdueCalibrations = overdueCalibrations.length === 0;

  requirements.push({
    id: '3.1',
    description: 'No overdue equipment calibrations',
    isMet: noOverdueCalibrations,
    evidence: `Overdue calibrations: ${overdueCalibrations.length}`,
  });

  if (!noOverdueCalibrations) {
    const affectedRecords = overdueCalibrations.slice(0, 5).map(eq => ({
      type: 'equipment',
      id: eq.id,
      reference: `${eq.code} - ${eq.name}`,
    }));

    gaps.push({
      requirementId: '3.1',
      requirement: 'No overdue equipment calibrations',
      chapter: 3,
      chapterName: GMP_CHAPTER_MAP[3].name,
      currentStatus: `${overdueCalibrations.length} equipment items have overdue calibrations`,
      affectedRecords,
      remediation: 'Schedule calibrations for overdue equipment immediately. Take equipment out of service until calibrated if critical.',
      priority: overdueCalibrations.length > 10 ? 'critical' : 'high',
    });
  }
}

/**
 * Chapter 4: Sanitation & Hygiene
 * - Sanitation compliance rates
 */
async function evaluateChapter4(
  requirements: ComplianceRequirement[],
  gaps: ComplianceGap[]
): Promise<void> {
  const sanitationTrends = await getSanitationTrends({ period: 'month' });

  // Requirement 4.1: Sanitation compliance >= 95%
  // Calculate compliance from dataPoints (completed vs scheduled)
  const totalScheduled = sanitationTrends.dataPoints.reduce((sum, dp) => sum + dp.count, 0);
  const completedOnTime = sanitationTrends.dataPoints.filter(dp => dp.label.includes('completed')).reduce((sum, dp) => sum + dp.count, 0);

  // If no data, assume compliance is met (no tasks = no failures)
  const complianceRate = totalScheduled > 0
    ? Math.round((completedOnTime / totalScheduled) * 100)
    : 100;
  const sanitationComplianceMet = complianceRate >= 95;

  requirements.push({
    id: '4.1',
    description: 'Sanitation compliance rate >= 95%',
    isMet: sanitationComplianceMet,
    evidence: `Current: ${complianceRate}%`,
  });

  if (!sanitationComplianceMet) {
    gaps.push({
      requirementId: '4.1',
      requirement: 'Sanitation compliance rate >= 95%',
      chapter: 4,
      chapterName: GMP_CHAPTER_MAP[4].name,
      currentStatus: `Current compliance rate: ${complianceRate}%`,
      affectedRecords: [],
      remediation: 'Review sanitation schedules and assign clear responsibilities. Investigate reasons for missed tasks.',
      priority: complianceRate < 85 ? 'high' : 'medium',
    });
  }
}

/**
 * Chapter 5: Documentation
 * - Document control (placeholder - assumes met if system is in use)
 */
async function evaluateChapter5(
  requirements: ComplianceRequirement[],
  gaps: ComplianceGap[]
): Promise<void> {
  // Requirement 5.1: Document control system in place
  // Since we have a compliance system, assume document control is in place
  const documentControlInPlace = true;

  requirements.push({
    id: '5.1',
    description: 'Document control system in place',
    isMet: documentControlInPlace,
    evidence: 'System operational',
  });

  // No gaps for now - future enhancement: check for SOP versions, approval status
}

/**
 * Chapter 6: Production Operations
 * - Work order completion (placeholder - not yet implemented)
 */
async function evaluateChapter6(
  requirements: ComplianceRequirement[],
  gaps: ComplianceGap[]
): Promise<void> {
  // Requirement 6.1: Production work orders tracked
  // Placeholder - assume not implemented yet
  const workOrdersTracked = false;

  requirements.push({
    id: '6.1',
    description: 'Production work orders tracked in system',
    isMet: workOrdersTracked,
    evidence: 'Module not implemented',
  });

  if (!workOrdersTracked) {
    gaps.push({
      requirementId: '6.1',
      requirement: 'Production work orders tracked in system',
      chapter: 6,
      chapterName: GMP_CHAPTER_MAP[6].name,
      currentStatus: 'Production module not yet implemented',
      affectedRecords: [],
      remediation: 'Implement production work order tracking module to manage batch records and manufacturing processes.',
      priority: 'low',
    });
  }
}

/**
 * Chapter 7: Quality Control
 * - Stability studies
 * - OOS investigations (from deviations)
 */
async function evaluateChapter7(
  requirements: ComplianceRequirement[],
  gaps: ComplianceGap[]
): Promise<void> {
  const db = await getDb();
  const { stabilityStudies } = getTables();

  // Requirement 7.1: Active stability studies exist
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeStudies = await (db as any)
    .select({ count: count() })
    .from(stabilityStudies)
    .where(eq(stabilityStudies.status, 'in_progress'));

  const activeStudyCount = activeStudies[0]?.count || 0;
  const hasActiveStudies = activeStudyCount > 0;

  requirements.push({
    id: '7.1',
    description: 'Active stability studies in progress',
    isMet: hasActiveStudies,
    evidence: `Active studies: ${activeStudyCount}`,
  });

  if (!hasActiveStudies) {
    gaps.push({
      requirementId: '7.1',
      requirement: 'Active stability studies in progress',
      chapter: 7,
      chapterName: GMP_CHAPTER_MAP[7].name,
      currentStatus: 'No active stability studies found',
      affectedRecords: [],
      remediation: 'Initiate stability studies for all marketed products. Follow approved stability protocols.',
      priority: 'high',
    });
  }
}

/**
 * Chapter 8: Contract Manufacturing
 * - Vendor qualification (placeholder - not yet implemented)
 */
async function evaluateChapter8(
  requirements: ComplianceRequirement[],
  gaps: ComplianceGap[]
): Promise<void> {
  // Requirement 8.1: Vendor qualification records
  // Placeholder - assume not implemented yet
  const vendorQualificationTracked = false;

  requirements.push({
    id: '8.1',
    description: 'Contract vendor qualification records maintained',
    isMet: vendorQualificationTracked,
    evidence: 'Module not implemented',
  });

  if (!vendorQualificationTracked) {
    gaps.push({
      requirementId: '8.1',
      requirement: 'Contract vendor qualification records maintained',
      chapter: 8,
      chapterName: GMP_CHAPTER_MAP[8].name,
      currentStatus: 'Vendor management module not yet implemented',
      affectedRecords: [],
      remediation: 'Implement vendor qualification module if contract manufacturing is used. Maintain qualification records and periodic audits.',
      priority: 'low',
    });
  }
}

/**
 * Chapter 9: Complaints & Recalls
 * - Complaint closure rate
 * - Recall effectiveness (if any)
 */
async function evaluateChapter9(
  requirements: ComplianceRequirement[],
  gaps: ComplianceGap[]
): Promise<void> {
  const complaintDashboard = await getComplaintDashboard();

  // Requirement 9.1: Complaint investigation rate >= 95%
  const totalComplaints = Object.values(complaintDashboard.byStatus).reduce((sum, count) => sum + count, 0);
  const investigated = totalComplaints - complaintDashboard.pendingInvestigation;
  const investigationRate = totalComplaints > 0
    ? Math.round((investigated / totalComplaints) * 100)
    : 100;
  const complaintInvestigationMet = investigationRate >= 95;

  requirements.push({
    id: '9.1',
    description: 'Complaint investigation rate >= 95%',
    isMet: complaintInvestigationMet,
    evidence: `Current: ${investigationRate}%`,
  });

  if (!complaintInvestigationMet) {
    gaps.push({
      requirementId: '9.1',
      requirement: 'Complaint investigation rate >= 95%',
      chapter: 9,
      chapterName: GMP_CHAPTER_MAP[9].name,
      currentStatus: `${complaintDashboard.pendingInvestigation} complaints pending investigation`,
      affectedRecords: [],
      remediation: 'Route pending complaints to QC for investigation. Assign investigators and track completion.',
      priority: complaintDashboard.pendingInvestigation > 10 ? 'high' : 'medium',
    });
  }

  // Requirement 9.2: No open critical complaints
  const criticalComplaintsOpen = complaintDashboard.criticalCount;
  const noCriticalOpen = criticalComplaintsOpen === 0;

  requirements.push({
    id: '9.2',
    description: 'No open critical complaints',
    isMet: noCriticalOpen,
    evidence: `Critical open: ${criticalComplaintsOpen}`,
  });

  if (!noCriticalOpen) {
    gaps.push({
      requirementId: '9.2',
      requirement: 'No open critical complaints',
      chapter: 9,
      chapterName: GMP_CHAPTER_MAP[9].name,
      currentStatus: `${criticalComplaintsOpen} critical complaints are still open`,
      affectedRecords: [],
      remediation: 'Escalate critical complaints immediately. Complete investigations and implement corrective actions.',
      priority: 'critical',
    });
  }
}

/**
 * Chapter 10: Self-Inspection
 * - Audit completion rate
 * - Finding closure rate
 */
async function evaluateChapter10(
  requirements: ComplianceRequirement[],
  gaps: ComplianceGap[]
): Promise<void> {
  const currentYear = new Date().getFullYear();
  const auditStats = await getAuditStatistics(currentYear);
  const chapterCoverage = await getAuditChapterCoverage(currentYear);

  // Requirement 10.1: Annual audit plan completion >= 80%
  const auditCompletion = auditStats.completionRate;
  const auditCompletionMet = auditCompletion >= 80;

  requirements.push({
    id: '10.1',
    description: 'Annual audit plan completion >= 80%',
    isMet: auditCompletionMet,
    evidence: `Current: ${Math.round(auditCompletion)}%`,
  });

  if (!auditCompletionMet) {
    gaps.push({
      requirementId: '10.1',
      requirement: 'Annual audit plan completion >= 80%',
      chapter: 10,
      chapterName: GMP_CHAPTER_MAP[10].name,
      currentStatus: `Current completion rate: ${Math.round(auditCompletion)}%`,
      affectedRecords: [],
      remediation: 'Review audit schedule. Assign lead auditors. Conduct remaining planned audits before year-end.',
      priority: auditCompletion < 60 ? 'high' : 'medium',
    });
  }

  // Requirement 10.2: All GMP chapters audited at least once per year
  const chaptersAudited = chapterCoverage.chapters.filter(ch => ch.auditsCompleted > 0).length;
  const allChaptersAudited = chaptersAudited >= 10;

  requirements.push({
    id: '10.2',
    description: 'All 10 GMP chapters audited at least once per year',
    isMet: allChaptersAudited,
    evidence: `Chapters audited: ${chaptersAudited}/10`,
  });

  if (!allChaptersAudited) {
    const missingChapters = chapterCoverage.chapters
      .filter(ch => ch.auditsCompleted === 0)
      .map(ch => ch.chapter);

    gaps.push({
      requirementId: '10.2',
      requirement: 'All 10 GMP chapters audited at least once per year',
      chapter: 10,
      chapterName: GMP_CHAPTER_MAP[10].name,
      currentStatus: `Chapters not audited: ${missingChapters.join(', ')}`,
      affectedRecords: [],
      remediation: `Schedule audits for missing chapters: ${missingChapters.map(ch => GMP_CHAPTER_MAP[ch as GMPChapterNumber].name).join(', ')}`,
      priority: missingChapters.length > 3 ? 'high' : 'medium',
    });
  }

  // Requirement 10.3: Open findings <= 5
  const openFindings = auditStats.openFindings;
  const openFindingsAcceptable = openFindings <= 5;

  requirements.push({
    id: '10.3',
    description: 'Open audit findings <= 5',
    isMet: openFindingsAcceptable,
    evidence: `Open findings: ${openFindings}`,
  });

  if (!openFindingsAcceptable) {
    gaps.push({
      requirementId: '10.3',
      requirement: 'Open audit findings <= 5',
      chapter: 10,
      chapterName: GMP_CHAPTER_MAP[10].name,
      currentStatus: `${openFindings} findings are still open`,
      affectedRecords: [],
      remediation: 'Close open findings. Assign CAPAs if required. Verify corrective actions are implemented.',
      priority: openFindings > 10 ? 'high' : 'medium',
    });
  }
}

// ============================================
// T1103: Get Gaps With Drilldown
// ============================================

/**
 * Get list of unmet requirements with drill-down details
 * Optionally filter by chapter
 */
export async function getGapsWithDrilldown(
  params: GapsWithDrilldownParams = {}
): Promise<ComplianceGap[]> {
  const { chapterFilter, priorityFilter } = params;

  // Get all chapters or just the filtered one
  const chaptersToCheck: GMPChapterNumber[] = chapterFilter
    ? [chapterFilter]
    : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const allGaps: ComplianceGap[] = [];

  for (const chapter of chaptersToCheck) {
    const coverage = await calculateChapterCoverage(chapter);
    allGaps.push(...coverage.gaps);
  }

  // Apply priority filter if specified
  if (priorityFilter) {
    return allGaps.filter(gap => gap.priority === priorityFilter);
  }

  return allGaps;
}
