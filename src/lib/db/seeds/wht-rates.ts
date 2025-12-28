/**
 * Withholding Tax (WHT) Rate Configuration
 * Following Thai Revenue Department Regulations
 *
 * This file contains WHT rates for various payment types as specified by
 * the Thai Revenue Department. Rates apply to payments made to vendors/suppliers.
 *
 * Reference: Thailand Revenue Code Section 50
 *
 * Feature: 010-accounting-module-integration
 * User Story 6: Manage VAT and Withholding Tax
 */

/**
 * WHT Certificate Types
 * - PND 3 (ภ.ง.ด.3): For payments to individuals
 * - PND 53 (ภ.ง.ด.53): For payments to juristic persons (companies)
 */
export type WHTCertificateType = 'pnd3' | 'pnd53';

/**
 * WHT Rate Configuration Interface
 */
export interface WHTRateConfig {
  code: string;
  nameTh: string;
  nameEn: string;
  rateIndividual: number;    // Rate for PND 3 (individuals)
  rateJuristicPerson: number; // Rate for PND 53 (companies)
  description: string;
}

/**
 * Standard Thai Withholding Tax Rates
 * Based on Thai Revenue Department regulations
 */
export const WHT_RATES: WHTRateConfig[] = [
  {
    code: 'SERVICE',
    nameTh: 'ค่าบริการ',
    nameEn: 'Service Fees',
    rateIndividual: 3,
    rateJuristicPerson: 3,
    description: 'General service fees, consulting, etc.',
  },
  {
    code: 'RENT',
    nameTh: 'ค่าเช่าทรัพย์สิน',
    nameEn: 'Property Rental',
    rateIndividual: 5,
    rateJuristicPerson: 5,
    description: 'Rental payments for property, equipment, vehicles',
  },
  {
    code: 'TRANSPORT',
    nameTh: 'ค่าขนส่ง',
    nameEn: 'Transportation',
    rateIndividual: 1,
    rateJuristicPerson: 1,
    description: 'Transportation and logistics services',
  },
  {
    code: 'ADVERTISING',
    nameTh: 'ค่าโฆษณา',
    nameEn: 'Advertising',
    rateIndividual: 2,
    rateJuristicPerson: 2,
    description: 'Advertising and promotional services',
  },
  {
    code: 'PROFESSIONAL',
    nameTh: 'ค่าวิชาชีพอิสระ',
    nameEn: 'Professional Fees',
    rateIndividual: 3,
    rateJuristicPerson: 3,
    description: 'Legal, accounting, architecture, engineering services',
  },
  {
    code: 'CONTRACT',
    nameTh: 'ค่าจ้างทำของ',
    nameEn: 'Contract Work',
    rateIndividual: 3,
    rateJuristicPerson: 3,
    description: 'Contract work, subcontracting',
  },
  {
    code: 'INSURANCE_PREMIUM',
    nameTh: 'เบี้ยประกันภัย',
    nameEn: 'Insurance Premium',
    rateIndividual: 1,
    rateJuristicPerson: 1,
    description: 'Non-life insurance premiums',
  },
  {
    code: 'PRIZE',
    nameTh: 'รางวัล/ชิงโชค',
    nameEn: 'Prize/Lottery',
    rateIndividual: 5,
    rateJuristicPerson: 0, // Not applicable for juristic persons
    description: 'Prizes, lucky draws, competitions',
  },
  {
    code: 'ENTERTAINMENT',
    nameTh: 'ค่าแสดง',
    nameEn: 'Entertainment/Performance',
    rateIndividual: 5,
    rateJuristicPerson: 3,
    description: 'Entertainment, performance, shows',
  },
  {
    code: 'GOODS_SALE',
    nameTh: 'ซื้อสินค้า',
    nameEn: 'Purchase of Goods',
    rateIndividual: 0.75, // Only applies to government entities
    rateJuristicPerson: 0.75,
    description: 'Purchase of goods (for government entities only)',
  },
];

/**
 * VAT rate for Thailand (7%)
 */
export const THAI_VAT_RATE = 7;

/**
 * WHT minimum threshold (no WHT for payments under this amount)
 * Per Thai Revenue Code, WHT applies to payments of 1,000 THB or more
 */
export const WHT_MINIMUM_THRESHOLD = 1000;

/**
 * Get WHT rate by code and certificate type
 * @param code - WHT type code (e.g., 'SERVICE', 'RENT')
 * @param certificateType - 'pnd3' for individuals, 'pnd53' for companies
 * @returns WHT rate as percentage or undefined if not found
 */
export function getWHTRate(code: string, certificateType: WHTCertificateType): number | undefined {
  const rate = WHT_RATES.find(r => r.code === code);
  if (!rate) return undefined;

  return certificateType === 'pnd3' ? rate.rateIndividual : rate.rateJuristicPerson;
}

/**
 * Get WHT rate config by code
 * @param code - WHT type code
 * @returns WHT rate configuration or undefined
 */
export function getWHTRateConfig(code: string): WHTRateConfig | undefined {
  return WHT_RATES.find(r => r.code === code);
}

/**
 * Get all WHT rate codes for dropdown selection
 * @returns Array of code and name pairs
 */
export function getWHTRateOptions(): Array<{ code: string; nameTh: string; nameEn: string }> {
  return WHT_RATES.map(r => ({
    code: r.code,
    nameTh: r.nameTh,
    nameEn: r.nameEn,
  }));
}

/**
 * Calculate WHT amount
 * @param amount - Payment amount before WHT
 * @param whtTypeCode - WHT type code
 * @param certificateType - Certificate type (pnd3 or pnd53)
 * @returns Object with WHT amount and net payment
 */
export function calculateWHTFromConfig(
  amount: number,
  whtTypeCode: string,
  certificateType: WHTCertificateType
): { whtRate: number; whtAmount: number; netPayment: number } | null {
  // No WHT for amounts below threshold
  if (amount < WHT_MINIMUM_THRESHOLD) {
    return { whtRate: 0, whtAmount: 0, netPayment: amount };
  }

  const rate = getWHTRate(whtTypeCode, certificateType);
  if (rate === undefined) {
    return null;
  }

  const whtAmount = (amount * rate) / 100;
  return {
    whtRate: rate,
    whtAmount: Math.round(whtAmount * 100) / 100, // Round to 2 decimal places
    netPayment: Math.round((amount - whtAmount) * 100) / 100,
  };
}

/**
 * WHT type mapping for PND forms
 * Maps internal codes to Revenue Department form field codes
 */
export const WHT_PND_TYPE_MAPPING: Record<string, { pnd3TypeNo: string; pnd53TypeNo: string }> = {
  SERVICE: { pnd3TypeNo: '6', pnd53TypeNo: '6' },
  RENT: { pnd3TypeNo: '5', pnd53TypeNo: '5' },
  TRANSPORT: { pnd3TypeNo: '7', pnd53TypeNo: '7' },
  ADVERTISING: { pnd3TypeNo: '8', pnd53TypeNo: '8' },
  PROFESSIONAL: { pnd3TypeNo: '3', pnd53TypeNo: '3' },
  CONTRACT: { pnd3TypeNo: '6', pnd53TypeNo: '6' },
  INSURANCE_PREMIUM: { pnd3TypeNo: '9', pnd53TypeNo: '9' },
  PRIZE: { pnd3TypeNo: '4', pnd53TypeNo: '4' },
  ENTERTAINMENT: { pnd3TypeNo: '2', pnd53TypeNo: '2' },
  GOODS_SALE: { pnd3TypeNo: '10', pnd53TypeNo: '10' },
};
