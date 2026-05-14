# BOM Configuration Display in WO Execution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display BOM Configuration data (Rooms, Equipment, Environmental Conditions, SOP Steps, Packaging QC) as read-only reference panels on Work Order Execution pages.

**Architecture:** 1 new API endpoint aggregates 5 BOM config types from existing service functions and flattens nested results. 1 reusable React component (`BOMConfigReferencePanel`) is used on the execution dashboard (summary, collapsed) and on 4 sub-pages (detail, expanded). Environmental Monitoring and Packaging QC pages replace their existing BOM data cards with the new unified component.

**Tech Stack:** Next.js 16 + React 19, TanStack Query 5.x, next-intl, TypeScript 5.x

**Spec:** `docs/superpowers/specs/2026-03-25-bom-config-in-execution-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/types/bom-config.ts` | TypeScript interface for BOM config API response |
| Create | `src/app/api/production/work-orders/[id]/bom-config/route.ts` | API: aggregate + flatten 5 BOM config types |
| Create | `src/components/production/BOMConfigReferencePanel.tsx` | Reusable read-only panel component |
| Create | `tests/app/production/work-orders/execution-bom-config.test.tsx` | Component tests |
| Modify | `src/locales/th/production.json` | Thai i18n keys for bomConfiguration |
| Modify | `src/locales/en/production.json` | English i18n keys for bomConfiguration |
| Modify | `src/app/production/work-orders/[id]/execution/page.tsx` | Add BOM config summary to dashboard |
| Modify | `src/app/production/work-orders/[id]/cleaning/page.tsx` | Add rooms/equipment reference panel |
| Modify | `src/app/production/work-orders/[id]/sop-execution/page.tsx` | Add SOP steps reference panel |
| Modify | `src/app/production/work-orders/[id]/environmental-monitoring/page.tsx` | Replace existing condition card with reference panel |
| Modify | `src/app/production/work-orders/[id]/packaging-qc/page.tsx` | Replace existing criteria card with reference panel |

---

### Task 1: TypeScript Interface + i18n Keys

**Files:**
- Create: `src/types/bom-config.ts`
- Modify: `src/locales/th/production.json`
- Modify: `src/locales/en/production.json`

- [ ] **Step 1: Create the BOM config response interface**

```typescript
// src/types/bom-config.ts

export interface BOMConfigRoom {
  id: number;
  phase: string;
  roomCode: string;
  roomName: string;
  roomNameTh: string;
  sequence: number;
}

export interface BOMConfigEquipment {
  id: number;
  phase: string;
  equipmentCode: string;
  equipmentName: string;
  equipmentNameTh: string;
  sequence: number;
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
```

- [ ] **Step 2: Add Thai i18n keys**

In `src/locales/th/production.json`, replace the existing `"bomConfiguration"` block (currently `{"title": "การตั้งค่า BOM"}` around line 313) with:

```json
"bomConfiguration": {
  "title": "การตั้งค่า BOM",
  "summary": "สรุปการตั้งค่า BOM",
  "rooms": "ห้อง",
  "equipment": "อุปกรณ์",
  "environmentalConditions": "เงื่อนไขสภาพแวดล้อม",
  "sopSteps": "ขั้นตอน SOP",
  "packagingQC": "เกณฑ์ QC บรรจุภัณฑ์",
  "noConfig": "ไม่พบการตั้งค่า BOM",
  "requirements": "ข้อกำหนด BOM",
  "temperatureRange": "อุณหภูมิ",
  "humidityMax": "ความชื้นสูงสุด",
  "monitoringInterval": "ช่วงเวลาตรวจวัด",
  "weightMin": "น้ำหนักต่ำสุด",
  "weightMax": "น้ำหนักสูงสุด",
  "sampleSize": "จำนวนตัวอย่าง",
  "maxFailures": "จำนวนล้มเหลวสูงสุด",
  "checkInterval": "ช่วงเวลาตรวจสอบ",
  "parameters": "พารามิเตอร์",
  "instructions": "คำแนะนำ",
  "everyMinutes": "ทุก {minutes} นาที",
  "step": "ขั้นตอนที่ {sequence}"
}
```

- [ ] **Step 3: Add English i18n keys**

In `src/locales/en/production.json`, replace the existing `"bomConfiguration"` block (currently `{"title": "BOM Configuration"}` around line 313) with:

```json
"bomConfiguration": {
  "title": "BOM Configuration",
  "summary": "BOM Configuration Summary",
  "rooms": "Rooms",
  "equipment": "Equipment",
  "environmentalConditions": "Environmental Conditions",
  "sopSteps": "SOP Steps",
  "packagingQC": "Packaging QC Criteria",
  "noConfig": "No BOM configuration found",
  "requirements": "BOM Requirements",
  "temperatureRange": "Temperature",
  "humidityMax": "Max Humidity",
  "monitoringInterval": "Monitoring Interval",
  "weightMin": "Min Weight",
  "weightMax": "Max Weight",
  "sampleSize": "Sample Size",
  "maxFailures": "Max Failures",
  "checkInterval": "Check Interval",
  "parameters": "Parameters",
  "instructions": "Instructions",
  "everyMinutes": "every {minutes} minutes",
  "step": "Step {sequence}"
}
```

- [ ] **Step 4: Verify i18n**

Run: `bun run i18n:check`
Expected: No missing key errors for bomConfiguration namespace

- [ ] **Step 5: Type check**

Run: `bunx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/types/bom-config.ts src/locales/th/production.json src/locales/en/production.json
git commit -m "feat: add BOM config TypeScript interface and i18n keys"
```

---

### Task 2: API Endpoint — GET /api/production/work-orders/[id]/bom-config

**Files:**
- Create: `src/app/api/production/work-orders/[id]/bom-config/route.ts`

**Context:**
- The existing service functions in `src/lib/services/bom-configuration.service.ts` return nested joined objects. This API must **flatten** them.
- Service return shapes:
  - `getBOMRooms(bomId)` → `Array<{ bomRoom: {...}, room: {...} }>`
  - `getBOMEquipment(bomId)` → `Array<{ bomEquipment: {...}, equipment: {...} }>`
  - `getBOMEnvironmentalConditions(bomId)` → `Array<{ bomCondition: {...}, condition: {...} }>`
  - `getBOMSOPSteps(bomId)` → `Array<{ bomStep: {...}, template: {...} }>`
  - `getBOMPackagingQC(bomId)` → `Array<{ bomQC: {...}, criteria: {...} }>`
- `parameters` and `equipmentIds` on SOP steps are stored as JSON text — must `JSON.parse()`.
- `bomId` is `notNull` on work orders, but guard defensively.

- [ ] **Step 1: Create the API route**

```typescript
// src/app/api/production/work-orders/[id]/bom-config/route.ts

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { successResponse, serverErrorResponse, notFoundResponse, withAuth } from '@/lib/api-utils';
import {
  getBOMRooms,
  getBOMEquipment,
  getBOMEnvironmentalConditions,
  getBOMSOPSteps,
  getBOMPackagingQC,
} from '@/lib/services/bom-configuration.service';
import type { BOMConfigResponse } from '@/types/bom-config';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/production/work-orders/[id]/bom-config
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);

      if (isNaN(workOrderId)) {
        return notFoundResponse('Invalid work order ID');
      }

      // Fetch work order to get bomId
      const workOrdersTable = getTableRef('workOrders');
      const woResult = await executeDbOperation(async (db) => {
        return db
          .select({ bomId: workOrdersTable.bomId })
          .from(workOrdersTable)
          .where(eq(workOrdersTable.id, workOrderId))
          .limit(1);
      });

      if (woResult.length === 0) {
        return notFoundResponse('Work order not found');
      }

      const bomId = woResult[0].bomId as number;

      if (!bomId) {
        // Defensive: bomId is notNull in schema, but guard anyway
        const emptyConfig: BOMConfigResponse = {
          bomId: 0,
          rooms: [],
          equipment: [],
          environmentalConditions: [],
          sopSteps: [],
          packagingQC: [],
        };
        return successResponse(emptyConfig);
      }

      // Fetch all 5 config types in parallel
      const [rawRooms, rawEquipment, rawConditions, rawSteps, rawQC] = await Promise.all([
        getBOMRooms(bomId),
        getBOMEquipment(bomId),
        getBOMEnvironmentalConditions(bomId),
        getBOMSOPSteps(bomId),
        getBOMPackagingQC(bomId),
      ]);

      // Flatten nested results
      const config: BOMConfigResponse = {
        bomId,
        rooms: (rawRooms || []).map((r: any) => ({
          id: r.bomRoom?.id,
          phase: r.bomRoom?.phase || '',
          roomCode: r.room?.code || '',
          roomName: r.room?.name || '',
          roomNameTh: r.room?.nameTh || '',
          sequence: r.bomRoom?.sequence || 0,
        })),
        equipment: (rawEquipment || []).map((e: any) => ({
          id: e.bomEquipment?.id,
          phase: e.bomEquipment?.phase || '',
          equipmentCode: e.equipment?.code || '',
          equipmentName: e.equipment?.name || '',
          equipmentNameTh: e.equipment?.nameTh || '',
          sequence: e.bomEquipment?.sequence || 0,
        })),
        environmentalConditions: (rawConditions || []).map((c: any) => ({
          id: c.bomCondition?.id,
          phase: c.bomCondition?.phase || '',
          conditionName: c.condition?.name || '',
          temperatureMin: Number(c.condition?.temperatureMin) || 0,
          temperatureMax: Number(c.condition?.temperatureMax) || 0,
          humidityMax: Number(c.condition?.humidityMax) || 0,
          monitoringIntervalMinutes: Number(c.condition?.monitoringIntervalMinutes) || 0,
        })),
        sopSteps: (rawSteps || []).map((s: any) => {
          let parameters: Record<string, number> | null = null;
          let equipmentIds: number[] | null = null;
          try {
            if (s.bomStep?.parameters) parameters = JSON.parse(s.bomStep.parameters);
          } catch { /* ignore parse errors */ }
          try {
            if (s.bomStep?.equipmentIds) equipmentIds = JSON.parse(s.bomStep.equipmentIds);
          } catch { /* ignore parse errors */ }

          return {
            id: s.bomStep?.id,
            sequence: s.bomStep?.sequence || 0,
            stepName: s.bomStep?.stepName || '',
            stepNameTh: s.bomStep?.stepNameTh || '',
            instructions: s.bomStep?.instructions || '',
            instructionsTh: s.bomStep?.instructionsTh || '',
            parameters,
            equipmentIds,
            requiresVerification: Boolean(s.bomStep?.requiresVerification),
          };
        }),
        packagingQC: (rawQC || []).map((q: any) => ({
          id: q.bomQC?.id,
          criteriaName: q.criteria?.name || '',
          weightMin: Number(q.criteria?.weightMin) || 0,
          weightMax: Number(q.criteria?.weightMax) || 0,
          sampleSize: Number(q.criteria?.sampleSize) || 0,
          maxFailures: Number(q.criteria?.maxFailures) || 0,
          checkIntervalMinutes: Number(q.criteria?.checkIntervalMinutes) || 0,
        })),
      };

      return successResponse(config);
    } catch (error) {
      return serverErrorResponse(error);
    }
  });
}
```

- [ ] **Step 2: Type check**

Run: `bunx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/production/work-orders/\[id\]/bom-config/route.ts
git commit -m "feat: add GET /api/production/work-orders/[id]/bom-config endpoint"
```

---

### Task 3: BOMConfigReferencePanel Component + Tests

**Files:**
- Create: `src/components/production/BOMConfigReferencePanel.tsx`
- Create: `tests/app/production/work-orders/execution-bom-config.test.tsx`

**Context:**
- This component fetches from the API endpoint created in Task 2.
- Used on the dashboard (all config types, collapsed) and sub-pages (filtered by phase/showOnly, expanded).
- Must handle: empty config, partial config, collapse/expand, phase filtering.
- Uses `useTranslations('production')` with `bomConfiguration.*` keys from Task 1.
- Uses TanStack Query with shared cache key `['wo-bom-config', workOrderId]` and `staleTime: 5 * 60 * 1000`.
- Display as light blue info panel (`bg-blue-50 border border-blue-200 rounded-lg`).
- Import types from `@/types/bom-config`.

- [ ] **Step 1: Write the test file**

```typescript
// tests/app/production/work-orders/execution-bom-config.test.tsx
/**
 * BOMConfigReferencePanel Tests
 * @vitest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';

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
}));

// Full BOM config mock data
const fullBomConfig = {
  bomId: 1,
  rooms: [
    { id: 1, phase: 'pre_production', roomCode: 'MFG-01', roomName: 'Manufacturing Room 1', roomNameTh: 'ห้องผลิต 1', sequence: 1 },
    { id: 2, phase: 'production', roomCode: 'MFG-02', roomName: 'Manufacturing Room 2', roomNameTh: 'ห้องผลิต 2', sequence: 1 },
  ],
  equipment: [
    { id: 1, phase: 'pre_production', equipmentCode: 'SCL-01', equipmentName: 'Scale', equipmentNameTh: 'เครื่องชั่ง', sequence: 1 },
    { id: 2, phase: 'production', equipmentCode: 'MIX-01', equipmentName: 'Mixer', equipmentNameTh: 'เครื่องผสม', sequence: 1 },
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

// Mock TanStack Query
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
    // production phase items should NOT appear
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
    // Initially collapsed — content should not be visible
    expect(screen.queryByText('Rooms')).not.toBeInTheDocument();
    // Click toggle
    fireEvent.click(screen.getByTestId('bom-config-toggle'));
    // Now content should be visible
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/production/work-orders/execution-bom-config.test.tsx`
Expected: FAIL — `Cannot find module '@/components/production/BOMConfigReferencePanel'`

- [ ] **Step 3: Implement the BOMConfigReferencePanel component**

```typescript
// src/components/production/BOMConfigReferencePanel.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { BOMConfigResponse } from '@/types/bom-config';

interface BOMConfigReferencePanelProps {
  workOrderId: number;
  phase?: string;
  showOnly?: ('rooms' | 'equipment' | 'environmental' | 'sopSteps' | 'packagingQC')[];
  defaultExpanded?: boolean;
}

export default function BOMConfigReferencePanel({
  workOrderId,
  phase,
  showOnly,
  defaultExpanded = false,
}: BOMConfigReferencePanelProps) {
  const t = useTranslations('production');
  const locale = useLocale();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const { data: bomConfig } = useQuery<BOMConfigResponse>({
    queryKey: ['wo-bom-config', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/bom-config`);
      if (!res.ok) throw new Error('Failed to fetch BOM config');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to fetch BOM config');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!bomConfig) return null;

  // Filter by phase if specified
  const rooms = phase
    ? bomConfig.rooms.filter((r) => r.phase === phase)
    : bomConfig.rooms;
  const equipment = phase
    ? bomConfig.equipment.filter((e) => e.phase === phase)
    : bomConfig.equipment;
  const conditions = phase
    ? bomConfig.environmentalConditions.filter((c) => c.phase === phase)
    : bomConfig.environmentalConditions;
  const sopSteps = bomConfig.sopSteps; // No phase on SOP steps
  const packagingQC = bomConfig.packagingQC;

  // Determine which sections to show
  const shouldShow = (type: string) => {
    if (showOnly && !showOnly.includes(type as any)) return false;
    switch (type) {
      case 'rooms': return rooms.length > 0;
      case 'equipment': return equipment.length > 0;
      case 'environmental': return conditions.length > 0;
      case 'sopSteps': return sopSteps.length > 0;
      case 'packagingQC': return packagingQC.length > 0;
      default: return false;
    }
  };

  const hasAnyConfig = rooms.length > 0 || equipment.length > 0 || conditions.length > 0 || sopSteps.length > 0 || packagingQC.length > 0;

  // If filtering by showOnly and nothing matches, show empty state
  if (!hasAnyConfig) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
        <Info className="h-5 w-5 text-amber-600 flex-shrink-0" />
        <p className="text-amber-800 text-sm">{t('bomConfiguration.noConfig')}</p>
      </div>
    );
  }

  const title = phase
    ? `${t('bomConfiguration.requirements')}: ${phase.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`
    : t('bomConfiguration.summary');

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
      {/* Header — always visible */}
      <button
        data-testid="bom-config-toggle"
        className="w-full flex items-center justify-between p-4 text-left hover:bg-blue-100 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-blue-800">{title}</span>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-blue-600" />
        ) : (
          <ChevronRight className="h-4 w-4 text-blue-600" />
        )}
      </button>

      {/* Content — collapsible */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Rooms */}
          {shouldShow('rooms') && (
            <div>
              <h4 className="text-sm font-semibold text-blue-700 mb-1">{t('bomConfiguration.rooms')}</h4>
              <div className="flex flex-wrap gap-2">
                {rooms.map((r) => (
                  <span key={r.id} className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded border border-blue-200 text-sm text-blue-800">
                    <strong>{r.roomCode}</strong> ({locale === 'th' && r.roomNameTh ? r.roomNameTh : r.roomName})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Equipment */}
          {shouldShow('equipment') && (
            <div>
              <h4 className="text-sm font-semibold text-blue-700 mb-1">{t('bomConfiguration.equipment')}</h4>
              <div className="flex flex-wrap gap-2">
                {equipment.map((e) => (
                  <span key={e.id} className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded border border-blue-200 text-sm text-blue-800">
                    <strong>{e.equipmentCode}</strong> ({locale === 'th' && e.equipmentNameTh ? e.equipmentNameTh : e.equipmentName})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Environmental Conditions */}
          {shouldShow('environmental') && (
            <div>
              <h4 className="text-sm font-semibold text-blue-700 mb-1">{t('bomConfiguration.environmentalConditions')}</h4>
              {conditions.map((c) => (
                <div key={c.id} className="text-sm text-blue-800 bg-white rounded border border-blue-200 p-2 mb-1">
                  <span className="font-medium">{c.conditionName}</span>
                  {' — '}
                  {t('bomConfiguration.temperatureRange')}: {c.temperatureMin}-{c.temperatureMax}°C,{' '}
                  {t('bomConfiguration.humidityMax')}: ≤{c.humidityMax}% RH,{' '}
                  {t('bomConfiguration.monitoringInterval')}: {t('bomConfiguration.everyMinutes', { minutes: c.monitoringIntervalMinutes })}
                </div>
              ))}
            </div>
          )}

          {/* SOP Steps */}
          {shouldShow('sopSteps') && (
            <div>
              <h4 className="text-sm font-semibold text-blue-700 mb-1">{t('bomConfiguration.sopSteps')}</h4>
              <div className="space-y-1">
                {sopSteps.map((s) => (
                  <div key={s.id} className="text-sm text-blue-800 bg-white rounded border border-blue-200 p-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t('bomConfiguration.step', { sequence: s.sequence })}:</span>
                      <span>{locale === 'th' && s.stepNameTh ? s.stepNameTh : s.stepName}</span>
                    </div>
                    {s.parameters && Object.keys(s.parameters).length > 0 && (
                      <div className="mt-1 text-xs text-blue-600">
                        {t('bomConfiguration.parameters')}:{' '}
                        {Object.entries(s.parameters).map(([key, val]) => `${key}: ${val}`).join(', ')}
                      </div>
                    )}
                    {(s.instructions || s.instructionsTh) && (
                      <div className="mt-1 text-xs text-blue-600">
                        {t('bomConfiguration.instructions')}: {locale === 'th' && s.instructionsTh ? s.instructionsTh : s.instructions}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Packaging QC */}
          {shouldShow('packagingQC') && (
            <div>
              <h4 className="text-sm font-semibold text-blue-700 mb-1">{t('bomConfiguration.packagingQC')}</h4>
              {packagingQC.map((q) => (
                <div key={q.id} className="text-sm text-blue-800 bg-white rounded border border-blue-200 p-2">
                  <span className="font-medium">{q.criteriaName}</span>
                  {' — '}
                  {t('bomConfiguration.weightMin')}: {q.weightMin}g,{' '}
                  {t('bomConfiguration.weightMax')}: {q.weightMax}g,{' '}
                  {t('bomConfiguration.sampleSize')}: {q.sampleSize},{' '}
                  {t('bomConfiguration.maxFailures')}: {q.maxFailures},{' '}
                  {t('bomConfiguration.checkInterval')}: {t('bomConfiguration.everyMinutes', { minutes: q.checkIntervalMinutes })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/app/production/work-orders/execution-bom-config.test.tsx`
Expected: All 7 tests pass

- [ ] **Step 5: Type check**

Run: `bunx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/production/BOMConfigReferencePanel.tsx tests/app/production/work-orders/execution-bom-config.test.tsx
git commit -m "feat: add BOMConfigReferencePanel component with tests"
```

---

### Task 4: Add BOM Config Summary to Execution Dashboard

**Files:**
- Modify: `src/app/production/work-orders/[id]/execution/page.tsx`

**Context:**
- The execution dashboard shows WO status card at line ~460, then phase sections at line ~484.
- Insert `BOMConfigReferencePanel` between these two sections.
- Use default collapsed, show all config types (no `showOnly` filter).
- No `phase` filter — dashboard shows everything.

- [ ] **Step 1: Add import**

At the top of `src/app/production/work-orders/[id]/execution/page.tsx`, add:

```typescript
import BOMConfigReferencePanel from '@/components/production/BOMConfigReferencePanel';
```

- [ ] **Step 2: Insert BOM Config panel between WO Status card and Phase sections**

After the `{/* Work Order Status */}` Card closing tag (around line 481 `</Card>`) and before `{/* Execution Sections by Phase */}` (around line 483), add:

```tsx
      {/* BOM Configuration Summary */}
      <BOMConfigReferencePanel workOrderId={workOrderId} defaultExpanded={false} />
```

- [ ] **Step 3: Type check**

Run: `bunx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/production/work-orders/\[id\]/execution/page.tsx
git commit -m "feat: add BOM config summary to execution dashboard"
```

---

### Task 5: Add Reference Panel to Cleaning Page

**Files:**
- Modify: `src/app/production/work-orders/[id]/cleaning/page.tsx`

**Context:**
- The cleaning page uses `?phase=` query param to determine current phase (pre_production, post_production, pre_packaging).
- It already has phase via `phaseMap[activeTab]` (line 78: `const phaseMap = ['pre_production', 'post_production', 'pre_packaging']`).
- Insert the panel showing rooms + equipment for the current phase, above the cleaning checklist content.

- [ ] **Step 1: Add import**

At the top of `src/app/production/work-orders/[id]/cleaning/page.tsx`, add:

```typescript
import BOMConfigReferencePanel from '@/components/production/BOMConfigReferencePanel';
```

- [ ] **Step 2: Add panel after header, before main content**

After the `<ResponsivePageHeader ... />` closing and before the cleaning checklist content, add:

```tsx
      {/* BOM Requirements for this phase */}
      <BOMConfigReferencePanel
        workOrderId={workOrderId}
        phase={phaseMap[activeTab]}
        showOnly={['rooms', 'equipment']}
        defaultExpanded={true}
      />
```

Note: Insert inside the main container `<div>`, after the `ResponsivePageHeader` section. The exact location should be after the breadcrumbs/actions and before the tab content.

- [ ] **Step 3: Type check**

Run: `bunx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/production/work-orders/\[id\]/cleaning/page.tsx
git commit -m "feat: add BOM rooms/equipment reference panel to cleaning page"
```

---

### Task 6: Add Reference Panel to SOP Execution Page

**Files:**
- Modify: `src/app/production/work-orders/[id]/sop-execution/page.tsx`

**Context:**
- SOP steps have no phase field — all are production phase.
- Insert panel showing SOP steps from BOM above the execution step list.
- No phase filter needed.

- [ ] **Step 1: Add import**

At the top of `src/app/production/work-orders/[id]/sop-execution/page.tsx`, add:

```typescript
import BOMConfigReferencePanel from '@/components/production/BOMConfigReferencePanel';
```

- [ ] **Step 2: Add panel after header, before step list**

After the `<ResponsivePageHeader ... />` section and before the step cards, add:

```tsx
      {/* BOM SOP Steps Reference */}
      <BOMConfigReferencePanel
        workOrderId={workOrderId}
        showOnly={['sopSteps']}
        defaultExpanded={true}
      />
```

- [ ] **Step 3: Type check**

Run: `bunx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/production/work-orders/\[id\]/sop-execution/page.tsx
git commit -m "feat: add BOM SOP steps reference panel to SOP execution page"
```

---

### Task 7: Replace Condition Card on Environmental Monitoring Page

**Files:**
- Modify: `src/app/production/work-orders/[id]/environmental-monitoring/page.tsx`

**Context:**
- The page currently fetches BOM condition via a separate API call (`/api/production/work-orders/${workOrderId}/environmental-condition?phase=${currentPhase}`) at line 115-123.
- It displays the condition in a teal-colored card at lines 239-264.
- **Replace** both the dedicated fetch and the teal card with `BOMConfigReferencePanel`.
- IMPORTANT: The `condition` variable is still used by the `isWithinLimits` function (line 158-164) and the add log mutation validation. We need to keep the condition fetch for data access OR derive the values from bomConfig. The simplest approach: keep the existing `condition` fetch for functional use (validation logic), but replace the visual card only.

- [ ] **Step 1: Add import**

At the top of `src/app/production/work-orders/[id]/environmental-monitoring/page.tsx`, add:

```typescript
import BOMConfigReferencePanel from '@/components/production/BOMConfigReferencePanel';
```

- [ ] **Step 2: Replace the condition display card**

Replace the existing condition display cards (lines ~239-275, the `{condition && (...)}` teal card AND the `{!condition && (...)}` amber card) with:

```tsx
      {/* BOM Environmental Requirements */}
      <BOMConfigReferencePanel
        workOrderId={workOrderId}
        phase={currentPhase}
        showOnly={['environmental']}
        defaultExpanded={true}
      />
```

Note: Keep the existing `condition` query (lines 115-123) and the `isWithinLimits` function — these are used for validation logic, not display.

- [ ] **Step 3: Type check**

Run: `bunx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/production/work-orders/\[id\]/environmental-monitoring/page.tsx
git commit -m "feat: replace environmental condition card with BOM config reference panel"
```

---

### Task 8: Replace Criteria Card on Packaging QC Page

**Files:**
- Modify: `src/app/production/work-orders/[id]/packaging-qc/page.tsx`

**Context:**
- The page currently fetches BOM QC criteria via separate API (`/api/production/work-orders/${workOrderId}/packaging-qc-criteria`) at line 122-131.
- It displays criteria in an indigo-colored card at lines 283-320.
- IMPORTANT: The `criteria` variable is used by the add weight mutation to validate weights. Keep the existing fetch for functional use, replace only the display card.

- [ ] **Step 1: Add import**

At the top of `src/app/production/work-orders/[id]/packaging-qc/page.tsx`, add:

```typescript
import BOMConfigReferencePanel from '@/components/production/BOMConfigReferencePanel';
```

- [ ] **Step 2: Replace the criteria display cards**

Replace the existing criteria display (lines ~283-320, the `{criteria && (...)}` indigo card AND the `{!criteria && (...)}` amber card) with:

```tsx
      {/* BOM Packaging QC Criteria */}
      <BOMConfigReferencePanel
        workOrderId={workOrderId}
        showOnly={['packagingQC']}
        defaultExpanded={true}
      />
```

Note: Keep the existing `criteria` query (lines 122-131) — it's used for validation in the weight mutation logic.

- [ ] **Step 3: Type check**

Run: `bunx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/production/work-orders/\[id\]/packaging-qc/page.tsx
git commit -m "feat: replace packaging QC criteria card with BOM config reference panel"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run tests/app/production/work-orders/execution-bom-config.test.tsx`
Expected: All tests pass

- [ ] **Step 2: Full type check**

Run: `bunx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 3: Lint check**

Run: `bun run lint`
Expected: No new errors

- [ ] **Step 4: Browser verification**

Open the dev server at http://localhost:33021 and verify:
1. Navigate to Production → Work Orders → pick a WO → Execution
2. Verify BOM Configuration Summary card appears (collapsed) between status card and phase sections
3. Click to expand — verify all 5 config types show data
4. Navigate to Cleaning page — verify rooms/equipment panel appears for the phase
5. Navigate to SOP Execution — verify SOP steps panel appears
6. Navigate to Environmental Monitoring — verify condition panel appears (blue style instead of old teal)
7. Navigate to Packaging QC — verify criteria panel appears (blue style instead of old indigo)
