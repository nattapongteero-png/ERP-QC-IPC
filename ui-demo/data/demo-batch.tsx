import * as React from 'react';
import type { RecordableCriterion } from '@/components/ipc-recording/IPCRecordDialog';
import type { RecordedIPCCriterion } from '@/components/ipc-recording/IPCRoundHistory';

/**
 * The one batch every demo screen describes.
 *
 * Both the IPC screen and the SOP execution screen read from here, so the two
 * cannot disagree about which topics belong to which step, or which of them
 * has already been recorded — a mismatch a reviewer would read as a bug in the
 * design rather than in the fixture.
 */
export const WORK_ORDER = {
  woNumber: 'WO-2568-0142',
  batchNumber: 'B25-0142',
  productName: 'ฟ้าทะลายโจรแคปซูล 400 mg',
  plannedQuantity: 50000,
  sopCode: 'SOP-PRD-014 rev.3',
};

// ── Sample criteria ────────────────────────────────────────────────
// Each entry is what one saved IPC criterion turns into on screen. They are
// spread across the recording layouts on purpose: the point of the review is
// to see that each authoring choice produces its own recording surface.

const critical = (c: RecordableCriterion): RecordableCriterion => c;

const CAPSULE_WEIGHT: RecordableCriterion = critical({
  criteriaId: 501,
  criteriaType: 'multi_point',
  stage: 'ipc',
  formData: {
    code: 'IPC-WV-001',
    name: 'ความสม่ำเสมอของน้ำหนักแคปซูล (Weight Variation)',
    unit: 'mg',
    sampleSize: 20,
    dosageForm: 'capsule',
    isCritical: true,
    isActive: true,
    tolerancePercent: 0,
  },
  specPayload: {
    type: 'multi_point',
    tareMode: 'bulk',
    tareCount: '10',
    tareLabel: 'ชั่งแคปซูลเปล่า เบอร์ 0',
    pointCount: '20',
    pointLabel: 'ตัวอย่าง',
    perPointTarget: '400',
    perPointTolerance: '7.5',
    aggregateRule: 'all_pass',
    aggregateLimit: '',
    tareSourceCode: '',
  },
  calculatedMinMax: { min: 370, max: 430 },
  acceptanceMath: { sampleSize: 20, allowedFail: 2, mustPass: 18 },
  multiStageEnabled: false,
  stages: [],
});

const TARE_LINKED: RecordableCriterion = {
  criteriaId: 502,
  criteriaType: 'multi_point',
  stage: 'ipc',
  formData: {
    code: 'IPC-WV-002',
    name: 'น้ำหนักยาสุทธิต่อแคปซูล (หัก Tare จากเกณฑ์ที่ผูกไว้)',
    unit: 'mg',
    sampleSize: 10,
    dosageForm: 'capsule',
    isCritical: false,
    isActive: true,
    tolerancePercent: 0,
  },
  specPayload: {
    type: 'multi_point',
    tareMode: 'per_unit',
    tareCount: '10',
    tareLabel: 'น้ำหนักแคปซูลเปล่า',
    pointCount: '10',
    pointLabel: 'ตัวอย่าง',
    perPointTarget: '400',
    perPointTolerance: '5',
    aggregateRule: 'all_pass',
    aggregateLimit: '',
    tareSourceCode: 'IPC-TARE-01',
  },
  calculatedMinMax: { min: 380, max: 420 },
  acceptanceMath: { sampleSize: 10, allowedFail: 1, mustPass: 9 },
  multiStageEnabled: false,
  stages: [],
};

const HARDNESS: RecordableCriterion = {
  criteriaId: 503,
  criteriaType: 'numeric',
  stage: 'ipc',
  formData: {
    code: 'IPC-HD-002',
    name: 'ความแข็งของเม็ดยา (Hardness)',
    unit: 'kp',
    sampleSize: 10,
    dosageForm: 'tablet',
    isCritical: false,
    isActive: true,
    specTarget: 8,
    specTolerancePercent: 25,
    tolerancePercent: 10,
  },
  specPayload: null,
  calculatedMinMax: { min: 6, max: 10 },
  acceptanceMath: { sampleSize: 10, allowedFail: 1, mustPass: 9 },
  multiStageEnabled: false,
  stages: [],
};

const MOISTURE: RecordableCriterion = {
  criteriaId: 504,
  criteriaType: 'numeric',
  stage: 'ipc',
  formData: {
    code: 'IPC-MC-006',
    name: 'ความชื้น (Loss on Drying)',
    unit: '%',
    sampleSize: 1,
    dosageForm: 'powder',
    isCritical: false,
    isActive: true,
    specTarget: 5,
    specTolerancePercent: 40,
    tolerancePercent: 0,
  },
  specPayload: null,
  calculatedMinMax: { min: 3, max: 7 },
  acceptanceMath: { sampleSize: 1, allowedFail: 0, mustPass: 1 },
  multiStageEnabled: false,
  stages: [],
};

const SEALING: RecordableCriterion = {
  criteriaId: 505,
  criteriaType: 'pass_fail',
  stage: 'ipc',
  formData: {
    code: 'IPC-SL-008',
    name: 'ความเรียบร้อยของการปิดผนึกซอง',
    unit: null,
    sampleSize: 5,
    dosageForm: 'capsule',
    isCritical: false,
    isActive: true,
    tolerancePercent: 0,
  },
  specPayload: {
    type: 'pass_fail',
    passDefinition: 'รอยผนึกต่อเนื่องตลอดแนว ไม่มีรอยรั่ว ไม่มีผงติดในแนวผนึก',
    failDefinition: 'พบรอยรั่ว รอยย่น หรือผงติดในแนวผนึกแม้เพียงจุดเดียว',
    defaultExpected: 'pass',
  },
  calculatedMinMax: null,
  acceptanceMath: { sampleSize: 5, allowedFail: 0, mustPass: 5 },
  multiStageEnabled: false,
  stages: [],
};

const APPEARANCE: RecordableCriterion = {
  criteriaId: 506,
  criteriaType: 'visual',
  stage: 'ipc',
  formData: {
    code: 'IPC-AP-003',
    name: 'ลักษณะภายนอกของแคปซูล',
    unit: null,
    sampleSize: 5,
    dosageForm: 'capsule',
    isCritical: false,
    isActive: true,
    tolerancePercent: 0,
  },
  specPayload: {
    type: 'visual',
    description: 'ตรวจด้วยตาเปล่าภายใต้แสงสว่างไม่น้อยกว่า 500 lux',
    checklist: ['สีสม่ำเสมอทั้งเม็ด', 'ไม่มีรอยบุบหรือแตก', 'ฝาปิดสนิทไม่หลวม', 'ไม่มีผงยาติดผิวนอก'],
    referenceImage: '',
  },
  calculatedMinMax: null,
  acceptanceMath: { sampleSize: 5, allowedFail: 0, mustPass: 5 },
  multiStageEnabled: false,
  stages: [],
};

/**
 * One topic already recorded, and failed — so the review can see the history
 * block, the retest the plan allows, and (on the critical topic) the refusal.
 */
const RECORDED_FAIL: RecordedIPCCriterion = {
  criteriaId: 503,
  criteriaType: 'numeric',
  unit: 'kp',
  sampleSize: 10,
  isCriteriaCritical: false,
  recordedTestId: 9001,
  recordedStatus: 'fail',
  recordedTestedByName: 'สมชาย ผลิตดี',
  recordedTestDate: '2026-08-18T09:24:00.000Z',
  recordedAcceptanceStages: null,
  maxRetestRounds: 2,
  recordedSamples: [
    { sampleNumber: 1, testRound: 1, numericValue: 8.2, textValue: null, result: 'pass' },
    { sampleNumber: 2, testRound: 1, numericValue: 7.6, textValue: null, result: 'pass' },
    { sampleNumber: 3, testRound: 1, numericValue: 5.4, textValue: null, result: 'fail' },
    { sampleNumber: 4, testRound: 1, numericValue: 8.9, textValue: null, result: 'pass' },
    { sampleNumber: 5, testRound: 1, numericValue: 5.1, textValue: null, result: 'fail' },
    { sampleNumber: 6, testRound: 1, numericValue: 7.9, textValue: null, result: 'pass' },
  ],
};

const CRITICAL_EXHAUSTED: RecordedIPCCriterion = {
  criteriaId: 501,
  criteriaType: 'multi_point',
  unit: 'mg',
  sampleSize: 20,
  isCriteriaCritical: true,
  recordedTestId: 9002,
  recordedStatus: 'fail',
  recordedTestedByName: 'สมชาย ผลิตดี',
  recordedTestDate: '2026-08-18T11:02:00.000Z',
  recordedAcceptanceStages: null,
  maxRetestRounds: 0,
  recordedSamples: [
    { sampleNumber: 1, testRound: 1, numericValue: 402, textValue: null, result: 'pass' },
    { sampleNumber: 2, testRound: 1, numericValue: 366, textValue: null, result: 'fail' },
    { sampleNumber: 3, testRound: 1, numericValue: 398, textValue: null, result: 'pass' },
    { sampleNumber: 4, testRound: 1, numericValue: 351, textValue: null, result: 'fail' },
    { sampleNumber: 5, testRound: 1, numericValue: 341, textValue: null, result: 'fail' },
  ],
};

// ── SOP steps ──────────────────────────────────────────────────────
export type StepStatus = 'done' | 'active' | 'todo';

export interface Step {
  /** What the operator counts by — not the row id. */
  seq: number;
  /** Kept only as a reference for support, in small print. */
  refId: number;
  title: string;
  detail: string;
  status: StepStatus;
  ipc: RecordableCriterion[];
}

export const STEPS: Step[] = [
  {
    seq: 1,
    refId: 311,
    title: 'เตรียมและตรวจรับวัตถุดิบเข้าไลน์',
    detail: 'ชั่งวัตถุดิบตามสูตร ตรวจสอบเลขที่รุ่นวัตถุดิบให้ตรงกับใบเบิก',
    status: 'done',
    ipc: [],
  },
  {
    seq: 2,
    refId: 314,
    title: 'ผสมผงยาและควบคุมความชื้น',
    detail: 'ผสม 20 นาที ที่ความเร็ว 12 รอบ/นาที เก็บตัวอย่างจาก 3 ตำแหน่งในถัง',
    status: 'done',
    ipc: [MOISTURE],
  },
  {
    seq: 3,
    refId: 317,
    title: 'บรรจุแคปซูลและควบคุมน้ำหนัก',
    detail: 'เดินเครื่องบรรจุ ตรวจน้ำหนักทุก 30 นาที และเมื่อปรับตั้งเครื่องทุกครั้ง',
    status: 'active',
    ipc: [CAPSULE_WEIGHT, TARE_LINKED, HARDNESS],
  },
  {
    seq: 4,
    refId: 320,
    title: 'ตรวจสอบลักษณะภายนอกและคัดแยก',
    detail: 'คัดแคปซูลที่ผิดลักษณะออกก่อนเข้าขั้นตอนบรรจุซอง',
    status: 'todo',
    ipc: [APPEARANCE],
  },
  {
    seq: 5,
    refId: 323,
    title: 'บรรจุซองและปิดผนึก',
    detail: 'ตั้งอุณหภูมิหัวผนึก 165 °C ตรวจรอยผนึกทุกครั้งที่เปลี่ยนม้วนฟิล์ม',
    status: 'todo',
    ipc: [SEALING],
  },
];

/** Rounds already on file, keyed by criteria id. */
export const RECORDED: Record<number, RecordedIPCCriterion> = {
  501: CRITICAL_EXHAUSTED,
  503: RECORDED_FAIL,
};

