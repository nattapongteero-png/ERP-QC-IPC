// Inventory Module Types
// Item master data and inventory-related types

export type ConfidentialityLevel = 'public' | 'internal' | 'confidential';

export interface Item {
  id: number;
  code: string;
  nameTh: string;
  nameEn?: string | null;
  type: string;
  category?: string | null;
  primaryUnit: string;
  secondaryUnit?: string | null;
  conversionRate?: number | null;
  shelfLifeDays?: number | null;
  storageCondition?: string | null;
  minStock?: number | null;
  maxStock?: number | null;
  reorderPoint?: number | null;
  onHand: number;
  onHandCost: number;
  quarantineQty: number;
  isLotControlled: boolean;
  isFEFO: boolean;
  isActive: boolean;
  // BOM Confidentiality Protection fields
  confidentialityLevel: ConfidentialityLevel;
  defaultConfidential: boolean;
  // VMI fields
  tppCode?: string | null;
  tppName?: string | null;
  ttmtCode?: string | null;
  ttmtName?: string | null;
  vmiSyncEnabled: boolean;
  lastVmiSyncAt?: string | null;
  // Product fields
  strength?: string | null;
  // Cost fields
  currentWAC?: number | null;
  lastPurchaseCost?: number | null;
  lastPurchaseDate?: string | null;
  lastPurchasePoId?: number | null;
  lastProductionCost?: number | null;
  lastProductionDate?: string | null;
  lastProductionWoId?: number | null;
  sgaAllocationRate?: number | null;
  standardCost?: number | null;
  createdAt: string;
  updatedAt: string;
}
