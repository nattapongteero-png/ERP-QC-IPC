/**
 * Equipment Types
 * Phase 10: Equipment Enhancement
 */

// Equipment status values
export type EquipmentStatus = 'active' | 'maintenance' | 'calibration' | 'inactive';

// Cleaning status values
export type CleaningStatus = 'clean' | 'dirty' | 'in_use' | 'out_of_service';

// Maintenance record type
export type MaintenanceType = 'preventive' | 'corrective' | 'calibration';

// Maintenance record status
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

// Equipment entity
export interface Equipment {
  id: number;
  code: string;
  name: string;
  type?: string | null;
  location?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  serialNumber?: string | null;
  installationDate?: string | null;
  lastMaintenanceDate?: string | null;
  nextMaintenanceDate?: string | null;
  lastCalibrationDate?: string | null;
  nextCalibrationDate?: string | null;
  cleaningStatus?: string | null;
  status: string;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

// Maintenance record entity
export interface MaintenanceRecord {
  id: number;
  equipmentId: number;
  equipmentName?: string;
  type: MaintenanceType;
  description?: string | null;
  scheduledDate?: string | null;
  completedDate?: string | null;
  performedBy?: number | null;
  performedByName?: string | null;
  cost?: number | null;
  notes?: string | null;
  status: MaintenanceStatus;
  createdAt: string | Date;
  updatedAt: string | Date;
}

// Schedule calibration input
export interface ScheduleCalibrationInput {
  equipmentId: number;
  scheduledDate: string;
  description?: string;
  assignedTo?: number;
}

// Overdue calibration result
export interface OverdueCalibration {
  equipmentId: number;
  equipmentName: string;
  equipmentType: string;
  lastCalibrationDate?: string | null;
  nextCalibrationDate?: string | null;
  daysOverdue: number;
}

// Equipment needing calibration alert
export interface CalibrationAlert {
  equipmentId: number;
  equipmentName: string;
  equipmentType: string;
  nextCalibrationDate: string;
  daysUntil: number;
}

// Update equipment status input
export interface UpdateEquipmentStatusInput {
  equipmentId: number;
  newStatus: EquipmentStatus;
  userId: number;
  reason?: string;
}

// Update cleaning status input
export interface UpdateCleaningStatusInput {
  equipmentId: number;
  cleaningStatus: CleaningStatus;
  userId: number;
}

// Equipment list params
export interface EquipmentListParams {
  status?: EquipmentStatus;
  cleaningStatus?: CleaningStatus;
  type?: string;
  isActive?: boolean;
}

// Create maintenance record input
export interface CreateMaintenanceRecordInput {
  equipmentId: number;
  type: MaintenanceType;
  description?: string;
  scheduledDate?: string;
  completedDate?: string;
  performedBy?: number;
  cost?: number;
  notes?: string;
  status?: MaintenanceStatus;
}

// Complete calibration input
export interface CompleteCalibrationInput {
  equipmentId: number;
  userId: number;
  calibrationIntervalDays?: number; // Default 365 days if not specified
}
