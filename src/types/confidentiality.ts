/**
 * BOM Confidentiality Types
 * Feature: BOM Confidentiality Protection (014-unit-cost)
 */

export type ConfidentialityLevel = 'public' | 'internal' | 'confidential';
export type ConfidentialityOverride = 'inherit' | 'public' | 'confidential';

// Confidential Access Group
export interface ConfidentialAccessGroup {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  memberCount?: number;
}

export interface ConfidentialAccessGroupCreate {
  code: string;
  name: string;
  description?: string;
}

export interface ConfidentialAccessGroupUpdate {
  code?: string;
  name?: string;
  description?: string;
}

// Group Member
export interface ConfidentialAccessGroupMember {
  id: number;
  groupId: number;
  userId: number;
  addedAt?: string | Date;
  addedBy?: number;
  // Joined fields
  userName?: string;
  userEmail?: string;
}

// BOM Access Grant
export interface BOMConfidentialAccess {
  id: number;
  bomId: number;
  userId?: number | null;
  groupId?: number | null;
  grantedBy: number;
  grantedAt?: string | Date;
  // Joined fields
  userName?: string;
  userEmail?: string;
  groupName?: string;
  groupCode?: string;
  grantedByName?: string;
}

export interface BOMConfidentialAccessCreate {
  bomId: number;
  userId?: number;
  groupId?: number;
}

// Filtered BOM Line (for API response)
export interface FilteredBOMLine {
  id: number;
  sequence: number;
  isConfidential: boolean;
  isHidden: boolean;
  placeholder?: string;
  // Original fields (undefined if hidden)
  itemId?: number;
  itemCode?: string;
  itemName?: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  totalCost?: number;
  isOptional?: boolean;
  notes?: string;
  confidentialityOverride?: ConfidentialityOverride;
}

// BOM Confidentiality Info (metadata in response)
export interface BOMConfidentialityInfo {
  hasConfidentialItems: boolean;
  visibleLineCount: number;
  totalLineCount: number;
  userHasFullAccess: boolean;
}

// System setting for bypass roles
export interface ConfidentialBypassRolesSetting {
  roles: string[];
}
