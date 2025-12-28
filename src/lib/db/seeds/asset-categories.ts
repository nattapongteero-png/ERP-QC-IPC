/**
 * Asset Category Seed Data
 * Feature: 010-accounting-module-integration
 * User Story 7: Manage Fixed Assets and Depreciation
 *
 * Thai Revenue Code depreciation rates for fixed assets.
 * Reference: Section 65 of the Thai Revenue Code
 */

// Asset category configuration based on Thai Revenue Code
export interface AssetCategoryConfig {
  code: string;
  nameTh: string;
  nameEn: string;
  defaultUsefulLifeMonths: number;
  defaultDepreciationMethod: 'straight_line' | 'declining_balance';
  maxDepreciationRate: number; // Max rate per Thai Revenue Code (percentage)
  assetGLAccountCode: string;
  depreciationExpenseGLAccountCode: string;
  accumulatedDepreciationGLAccountCode: string;
}

/**
 * Thai Revenue Code Asset Categories
 *
 * Depreciation rates per Thai Revenue Code Section 65:
 * - Buildings: 5% per year (20 years)
 * - Machinery & Equipment: 20% per year (5 years)
 * - Vehicles: 20% per year (5 years)
 * - Furniture & Fixtures: 20% per year (5 years)
 * - Computers & IT: 33.33% per year (3 years)
 * - Tools & Equipment: 20% per year (5 years)
 * - Laboratory Equipment: 20% per year (5 years)
 * - Manufacturing Equipment: 20% per year (5 years)
 * - Leasehold Improvements: Useful life = lease term
 * - Intangible Assets: 10 years (software, patents, etc.)
 */
export const ASSET_CATEGORIES: AssetCategoryConfig[] = [
  {
    code: 'LAND',
    nameTh: 'ที่ดิน',
    nameEn: 'Land',
    defaultUsefulLifeMonths: 0, // Land is not depreciated
    defaultDepreciationMethod: 'straight_line',
    maxDepreciationRate: 0,
    assetGLAccountCode: '1200', // Fixed Assets - Land
    depreciationExpenseGLAccountCode: '5999', // No depreciation
    accumulatedDepreciationGLAccountCode: '1299', // No accumulated depreciation
  },
  {
    code: 'BUILDING',
    nameTh: 'อาคารและสิ่งปลูกสร้าง',
    nameEn: 'Buildings and Structures',
    defaultUsefulLifeMonths: 240, // 20 years
    defaultDepreciationMethod: 'straight_line',
    maxDepreciationRate: 5,
    assetGLAccountCode: '1210', // Fixed Assets - Buildings
    depreciationExpenseGLAccountCode: '5300', // Depreciation Expense
    accumulatedDepreciationGLAccountCode: '1219', // Accumulated Depreciation - Buildings
  },
  {
    code: 'MACHINERY',
    nameTh: 'เครื่องจักรและอุปกรณ์',
    nameEn: 'Machinery and Equipment',
    defaultUsefulLifeMonths: 60, // 5 years
    defaultDepreciationMethod: 'straight_line',
    maxDepreciationRate: 20,
    assetGLAccountCode: '1220', // Fixed Assets - Machinery
    depreciationExpenseGLAccountCode: '5300', // Depreciation Expense
    accumulatedDepreciationGLAccountCode: '1229', // Accumulated Depreciation - Machinery
  },
  {
    code: 'VEHICLE',
    nameTh: 'ยานพาหนะ',
    nameEn: 'Vehicles',
    defaultUsefulLifeMonths: 60, // 5 years
    defaultDepreciationMethod: 'straight_line',
    maxDepreciationRate: 20,
    assetGLAccountCode: '1230', // Fixed Assets - Vehicles
    depreciationExpenseGLAccountCode: '5300', // Depreciation Expense
    accumulatedDepreciationGLAccountCode: '1239', // Accumulated Depreciation - Vehicles
  },
  {
    code: 'FURNITURE',
    nameTh: 'เครื่องตกแต่งและเฟอร์นิเจอร์',
    nameEn: 'Furniture and Fixtures',
    defaultUsefulLifeMonths: 60, // 5 years
    defaultDepreciationMethod: 'straight_line',
    maxDepreciationRate: 20,
    assetGLAccountCode: '1240', // Fixed Assets - Furniture
    depreciationExpenseGLAccountCode: '5300', // Depreciation Expense
    accumulatedDepreciationGLAccountCode: '1249', // Accumulated Depreciation - Furniture
  },
  {
    code: 'COMPUTER',
    nameTh: 'คอมพิวเตอร์และอุปกรณ์ IT',
    nameEn: 'Computers and IT Equipment',
    defaultUsefulLifeMonths: 36, // 3 years
    defaultDepreciationMethod: 'straight_line',
    maxDepreciationRate: 33.33,
    assetGLAccountCode: '1250', // Fixed Assets - Computers
    depreciationExpenseGLAccountCode: '5300', // Depreciation Expense
    accumulatedDepreciationGLAccountCode: '1259', // Accumulated Depreciation - Computers
  },
  {
    code: 'LAB_EQUIPMENT',
    nameTh: 'อุปกรณ์ห้องปฏิบัติการ',
    nameEn: 'Laboratory Equipment',
    defaultUsefulLifeMonths: 60, // 5 years
    defaultDepreciationMethod: 'straight_line',
    maxDepreciationRate: 20,
    assetGLAccountCode: '1260', // Fixed Assets - Lab Equipment
    depreciationExpenseGLAccountCode: '5300', // Depreciation Expense
    accumulatedDepreciationGLAccountCode: '1269', // Accumulated Depreciation - Lab Equipment
  },
  {
    code: 'MFG_EQUIPMENT',
    nameTh: 'อุปกรณ์การผลิต',
    nameEn: 'Manufacturing Equipment',
    defaultUsefulLifeMonths: 60, // 5 years
    defaultDepreciationMethod: 'straight_line',
    maxDepreciationRate: 20,
    assetGLAccountCode: '1270', // Fixed Assets - Manufacturing Equipment
    depreciationExpenseGLAccountCode: '5300', // Depreciation Expense
    accumulatedDepreciationGLAccountCode: '1279', // Accumulated Depreciation - Mfg Equipment
  },
  {
    code: 'TOOLS',
    nameTh: 'เครื่องมือและอุปกรณ์',
    nameEn: 'Tools and Equipment',
    defaultUsefulLifeMonths: 60, // 5 years
    defaultDepreciationMethod: 'straight_line',
    maxDepreciationRate: 20,
    assetGLAccountCode: '1280', // Fixed Assets - Tools
    depreciationExpenseGLAccountCode: '5300', // Depreciation Expense
    accumulatedDepreciationGLAccountCode: '1289', // Accumulated Depreciation - Tools
  },
  {
    code: 'LEASEHOLD',
    nameTh: 'ส่วนปรับปรุงสิทธิการเช่า',
    nameEn: 'Leasehold Improvements',
    defaultUsefulLifeMonths: 60, // 5 years (or lease term)
    defaultDepreciationMethod: 'straight_line',
    maxDepreciationRate: 20,
    assetGLAccountCode: '1290', // Fixed Assets - Leasehold Improvements
    depreciationExpenseGLAccountCode: '5300', // Depreciation Expense
    accumulatedDepreciationGLAccountCode: '1299', // Accumulated Depreciation - Leasehold
  },
  {
    code: 'INTANGIBLE',
    nameTh: 'สินทรัพย์ไม่มีตัวตน',
    nameEn: 'Intangible Assets',
    defaultUsefulLifeMonths: 120, // 10 years
    defaultDepreciationMethod: 'straight_line',
    maxDepreciationRate: 10,
    assetGLAccountCode: '1300', // Intangible Assets
    depreciationExpenseGLAccountCode: '5310', // Amortization Expense
    accumulatedDepreciationGLAccountCode: '1309', // Accumulated Amortization
  },
];

/**
 * Get depreciation method display name
 */
export function getDepreciationMethodName(method: 'straight_line' | 'declining_balance'): {
  th: string;
  en: string;
} {
  const methods = {
    straight_line: { th: 'วิธีเส้นตรง', en: 'Straight Line' },
    declining_balance: { th: 'วิธียอดลดลง', en: 'Declining Balance' },
  };
  return methods[method] || methods.straight_line;
}

/**
 * Calculate monthly depreciation amount using straight line method
 */
export function calculateStraightLineDepreciation(
  acquisitionCost: number,
  salvageValue: number,
  usefulLifeMonths: number
): number {
  if (usefulLifeMonths <= 0) return 0;
  const depreciableAmount = acquisitionCost - salvageValue;
  return depreciableAmount / usefulLifeMonths;
}

/**
 * Calculate monthly depreciation amount using declining balance method
 */
export function calculateDecliningBalanceDepreciation(
  netBookValue: number,
  annualRate: number
): number {
  const monthlyRate = annualRate / 12 / 100;
  return netBookValue * monthlyRate;
}

/**
 * Get asset category by code
 */
export function getAssetCategoryConfig(code: string): AssetCategoryConfig | undefined {
  return ASSET_CATEGORIES.find(c => c.code === code);
}

/**
 * Get all asset category options for dropdown
 */
export function getAssetCategoryOptions(): Array<{
  code: string;
  nameTh: string;
  nameEn: string;
  usefulLifeYears: number;
  maxRate: number;
}> {
  return ASSET_CATEGORIES.map(c => ({
    code: c.code,
    nameTh: c.nameTh,
    nameEn: c.nameEn,
    usefulLifeYears: c.defaultUsefulLifeMonths / 12,
    maxRate: c.maxDepreciationRate,
  }));
}

/**
 * Thai Revenue Code asset depreciation reference
 */
export const THAI_DEPRECIATION_REFERENCE = {
  legalBasis: 'Section 65 bis and 65 ter of the Thai Revenue Code',
  methods: ['straight_line', 'declining_balance'],
  rules: [
    'Land cannot be depreciated',
    'Buildings: max 5% per year (20 years)',
    'Machinery, vehicles, furniture: max 20% per year (5 years)',
    'Computers and IT: max 33.33% per year (3 years)',
    'Intangible assets: based on useful life, typically 10 years',
    'Leasehold improvements: amortized over lease term',
  ],
};
