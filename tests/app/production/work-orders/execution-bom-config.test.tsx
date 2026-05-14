/**
 * BOMConfigReferencePanel Tests
 * @vitest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, params?: Record<string, any>) => {
      const translations: Record<string, string> = {
        'bomConfiguration.title': 'BOM Configuration',
        'bomConfiguration.summary': 'BOM Configuration Summary',
        'bomConfiguration.rooms': 'Rooms',
        'bomConfiguration.equipment': 'Equipment',
        'bomConfiguration.environmentalConditions': 'Environmental Conditions',
        'bomConfiguration.sopSteps': 'SOP Steps',
        'bomConfiguration.packagingQC': 'Packaging QC Criteria',
        'bomConfiguration.noConfig': 'No BOM configuration found',
        'bomConfiguration.requirements': 'BOM Requirements',
        'bomConfiguration.temperatureRange': 'Temperature',
        'bomConfiguration.humidityMax': 'Max Humidity',
        'bomConfiguration.monitoringInterval': 'Monitoring Interval',
        'bomConfiguration.weightMin': 'Min Weight',
        'bomConfiguration.weightMax': 'Max Weight',
        'bomConfiguration.sampleSize': 'Sample Size',
        'bomConfiguration.maxFailures': 'Max Failures',
        'bomConfiguration.checkInterval': 'Check Interval',
        'bomConfiguration.parameters': 'Parameters',
        'bomConfiguration.instructions': 'Instructions',
        'bomConfiguration.everyMinutes': `every ${params?.minutes || ''} minutes`,
        'bomConfiguration.step': `Step ${params?.sequence || ''}`,
      };
      return translations[key] || key;
    };
    return t;
  },
  useLocale: () => 'en',
}));

const fullBomConfig = {
  bomId: 1,
  rooms: [
    { id: 1, phase: 'pre_production', roomCode: 'MFG-01', roomName: 'Manufacturing Room 1', roomNameTh: 'ห้องผลิต 1', sequence: 1, isRequired: true },
    { id: 2, phase: 'production', roomCode: 'MFG-02', roomName: 'Manufacturing Room 2', roomNameTh: 'ห้องผลิต 2', sequence: 1, isRequired: true },
  ],
  equipment: [
    { id: 1, equipmentId: 101, phase: 'pre_production', equipmentCode: 'SCL-01', equipmentName: 'Scale', equipmentNameTh: 'เครื่องชั่ง', sequence: 1, isRequired: true },
    { id: 2, equipmentId: 102, phase: 'production', equipmentCode: 'MIX-01', equipmentName: 'Mixer', equipmentNameTh: 'เครื่องผสม', sequence: 1, isRequired: true },
  ],
  environmentalConditions: [
    { id: 1, phase: 'production', conditionName: 'Room Temp', temperatureMin: 20, temperatureMax: 25, humidityMax: 60, monitoringIntervalMinutes: 30 },
  ],
  sopSteps: [
    { id: 1, sequence: 1, stepName: 'Weighing', stepNameTh: 'ชั่งน้ำหนัก', instructions: 'Weigh materials', instructionsTh: 'ชั่งวัตถุดิบ', parameters: { temperature: 25 }, equipmentIds: [1], requiresVerification: true },
    { id: 2, sequence: 2, stepName: 'Mixing', stepNameTh: 'ผสม', instructions: 'Mix ingredients', instructionsTh: 'ผสมส่วนผสม', parameters: { speed: 200, duration: 60 }, equipmentIds: [2], requiresVerification: true },
  ],
  packagingQC: [
    { id: 1, criteriaName: 'Standard Weight', weightMin: 495, weightMax: 505, sampleSize: 10, maxFailures: 1, checkIntervalMinutes: 30 },
  ],
};

const emptyBomConfig = {
  bomId: 1,
  rooms: [],
  equipment: [],
  environmentalConditions: [],
  sopSteps: [],
  packagingQC: [],
};

let mockBomConfigData: any = fullBomConfig;

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: any) => {
    if (queryKey[0] === 'wo-bom-config') {
      return { data: mockBomConfigData, isLoading: false };
    }
    return { data: null, isLoading: false };
  },
}));

import BOMConfigReferencePanel from '@/components/production/BOMConfigReferencePanel';

describe('BOMConfigReferencePanel', () => {
  beforeEach(() => {
    mockBomConfigData = fullBomConfig;
    vi.clearAllMocks();
  });

  it('renders all 5 config types when all data exists', () => {
    render(<BOMConfigReferencePanel workOrderId={1} defaultExpanded={true} />);
    expect(screen.getByText('Rooms')).toBeInTheDocument();
    expect(screen.getByText('Equipment')).toBeInTheDocument();
    expect(screen.getByText('Environmental Conditions')).toBeInTheDocument();
    expect(screen.getByText('SOP Steps')).toBeInTheDocument();
    expect(screen.getByText('Packaging QC Criteria')).toBeInTheDocument();
  });

  it('shows empty state when no config data', () => {
    mockBomConfigData = emptyBomConfig;
    render(<BOMConfigReferencePanel workOrderId={1} defaultExpanded={true} />);
    expect(screen.getByText('No BOM configuration found')).toBeInTheDocument();
  });

  it('filters rooms/equipment by phase', () => {
    render(
      <BOMConfigReferencePanel
        workOrderId={1}
        phase="pre_production"
        showOnly={['rooms', 'equipment']}
        defaultExpanded={true}
      />
    );
    expect(screen.getByText(/MFG-01/)).toBeInTheDocument();
    expect(screen.getByText(/SCL-01/)).toBeInTheDocument();
    expect(screen.queryByText(/MFG-02/)).not.toBeInTheDocument();
    expect(screen.queryByText(/MIX-01/)).not.toBeInTheDocument();
  });

  it('renders partial data - only rooms', () => {
    mockBomConfigData = { ...emptyBomConfig, rooms: fullBomConfig.rooms };
    render(<BOMConfigReferencePanel workOrderId={1} defaultExpanded={true} />);
    expect(screen.getByText('Rooms')).toBeInTheDocument();
    expect(screen.queryByText('Equipment')).not.toBeInTheDocument();
    expect(screen.queryByText('SOP Steps')).not.toBeInTheDocument();
  });

  it('toggles collapse/expand', () => {
    render(<BOMConfigReferencePanel workOrderId={1} defaultExpanded={false} />);
    expect(screen.queryByText('Rooms')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('bom-config-toggle'));
    expect(screen.getByText('Rooms')).toBeInTheDocument();
  });

  it('shows SOP step parameters', () => {
    render(
      <BOMConfigReferencePanel
        workOrderId={1}
        showOnly={['sopSteps']}
        defaultExpanded={true}
      />
    );
    expect(screen.getByText(/Weighing/)).toBeInTheDocument();
    expect(screen.getByText(/Mixing/)).toBeInTheDocument();
    expect(screen.getByText(/temperature/i)).toBeInTheDocument();
  });

  it('shows packaging QC criteria', () => {
    render(
      <BOMConfigReferencePanel
        workOrderId={1}
        showOnly={['packagingQC']}
        defaultExpanded={true}
      />
    );
    expect(screen.getByText(/495/)).toBeInTheDocument();
    expect(screen.getByText(/505/)).toBeInTheDocument();
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });
});
