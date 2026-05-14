export interface BOMConfigRoom {
  id: number;
  phase: string;
  roomCode: string;
  roomName: string;
  roomNameTh: string;
  sequence: number;
  isRequired: boolean;
}

export interface BOMConfigEquipment {
  id: number;
  equipmentId: number;
  phase: string;
  equipmentCode: string;
  equipmentName: string;
  equipmentNameTh: string;
  sequence: number;
  isRequired: boolean;
}

export interface BOMConfigEnvironmental {
  id: number;
  phase: string;
  conditionName: string;
  temperatureMin: number;
  temperatureMax: number;
  humidityMax: number;
  monitoringIntervalMinutes: number;
}

export interface BOMConfigSOPStep {
  id: number;
  sequence: number;
  stepName: string;
  stepNameTh: string;
  instructions: string;
  instructionsTh: string;
  parameters: Record<string, number> | null;
  equipmentIds: number[] | null;
  requiresVerification: boolean;
}

export interface BOMConfigPackagingQC {
  id: number;
  criteriaName: string;
  weightMin: number;
  weightMax: number;
  sampleSize: number;
  maxFailures: number;
  checkIntervalMinutes: number;
}

export interface BOMConfigResponse {
  bomId: number;
  rooms: BOMConfigRoom[];
  equipment: BOMConfigEquipment[];
  environmentalConditions: BOMConfigEnvironmental[];
  sopSteps: BOMConfigSOPStep[];
  packagingQC: BOMConfigPackagingQC[];
}
