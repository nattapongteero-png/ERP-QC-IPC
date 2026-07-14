/**
 * Factory / company identity printed on formal documents (QC reports, COAs).
 *
 * Sourced from env so a site can set its real values at deploy time without a
 * code change. Everything is optional and defaults to empty — a printed GMP
 * document must never carry a placeholder licence number (a document handed to
 * a regulator or customer with a fake licence is a compliance problem, not a
 * cosmetic one). Callers must therefore treat empty as "omit the line".
 *
 * Set in .env (NEXT_PUBLIC_* so the print components can read them client-side):
 *   NEXT_PUBLIC_FACTORY_NAME_TH
 *   NEXT_PUBLIC_FACTORY_NAME_EN
 *   NEXT_PUBLIC_FACTORY_ADDRESS
 *   NEXT_PUBLIC_FACTORY_LICENSE_NO
 */

export interface FactoryInfo {
  nameTh: string;
  nameEn: string;
  address: string;
  /** GMP manufacturing licence number. Empty when not configured — do not print. */
  licenseNo: string;
}

export function getFactoryInfo(): FactoryInfo {
  return {
    nameTh: process.env.NEXT_PUBLIC_FACTORY_NAME_TH || 'โรงงานผลิตยาสมุนไพร',
    nameEn: process.env.NEXT_PUBLIC_FACTORY_NAME_EN || 'Herbal Medicine Manufacturing',
    address: process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '',
    licenseNo: process.env.NEXT_PUBLIC_FACTORY_LICENSE_NO || '',
  };
}
