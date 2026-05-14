# BOM Configuration Display in WO Execution — Design Spec

## Goal

Display BOM Configuration data (Rooms, Equipment, Environmental Conditions, SOP Steps, Packaging QC) on Work Order Execution pages so operators can reference production requirements while executing.

## Architecture

- **1 new API endpoint** (`GET /api/production/work-orders/[id]/bom-config`) aggregates all 5 BOM config types via existing service functions, flattens nested results
- **1 new reusable component** (`BOMConfigReferencePanel`) for both dashboard summary and sub-page detail
- **Read-only reference panels** added to 4 existing sub-pages (Cleaning, SOP Execution, Environmental Monitoring, Packaging QC)
- No new database tables or mutations — purely read-only

## Tech Stack

- Next.js 16 + React 19, TanStack Query (data fetching), next-intl (i18n)
- Existing: `bom-configuration.service.ts` (getBOMRooms, getBOMEquipment, getBOMEnvironmentalConditions, getBOMSOPSteps, getBOMPackagingQC — all already exist)

---

## 1. API: `GET /api/production/work-orders/[id]/bom-config`

### Purpose
Fetch all BOM configuration for the BOM linked to a work order. Single endpoint to avoid N+1 fetches from UI.

### Flow
1. Fetch work order by ID → get `bomId` (note: `bomId` is `notNull` in schema, but guard defensively)
2. If no `bomId`, return empty config
3. Call existing service functions in parallel:
   - `getBOMRooms(bomId)`
   - `getBOMEquipment(bomId)`
   - `getBOMEnvironmentalConditions(bomId)`
   - `getBOMSOPSteps(bomId)`
   - `getBOMPackagingQC(bomId)`
4. **Flatten nested results** — service functions return joined objects (e.g., `{ bomRoom: {...}, room: {...} }`). The API must transform these into flat response objects.
5. **Parse JSON text fields** — `parameters` and `equipmentIds` on SOP steps are stored as JSON text in the database. The API must `JSON.parse()` these before returning.
6. Return aggregated response

### Response Shape

Service functions return nested structures that must be flattened:

| Service Function | Returns | Flatten To |
|---|---|---|
| `getBOMRooms` | `{ bomRoom: {...}, room: {...} }` | `{ id: bomRoom.id, phase: bomRoom.phase, roomCode: room.code, roomName: room.name, roomNameTh: room.nameTh, sequence: bomRoom.sequence }` |
| `getBOMEquipment` | `{ bomEquipment: {...}, equipment: {...} }` | `{ id: bomEquipment.id, phase: bomEquipment.phase, equipmentCode: equipment.code, equipmentName: equipment.name, equipmentNameTh: equipment.nameTh, sequence: bomEquipment.sequence }` |
| `getBOMEnvironmentalConditions` | `{ bomCondition: {...}, condition: {...} }` | `{ id: bomCondition.id, phase: bomCondition.phase, conditionName: condition.name, temperatureMin: condition.temperatureMin, temperatureMax: condition.temperatureMax, humidityMax: condition.humidityMax, monitoringIntervalMinutes: condition.monitoringIntervalMinutes }` |
| `getBOMSOPSteps` | `{ bomStep: {...}, template: {...} }` | `{ id: bomStep.id, sequence: bomStep.sequence, stepName: bomStep.stepName, stepNameTh: bomStep.stepNameTh, instructions: bomStep.instructions, instructionsTh: bomStep.instructionsTh, parameters: JSON.parse(bomStep.parameters), equipmentIds: JSON.parse(bomStep.equipmentIds), requiresVerification: bomStep.requiresVerification }` |
| `getBOMPackagingQC` | `{ bomQC: {...}, criteria: {...} }` | `{ id: bomQC.id, criteriaName: criteria.name, weightMin: criteria.weightMin, weightMax: criteria.weightMax, sampleSize: criteria.sampleSize, maxFailures: criteria.maxFailures, checkIntervalMinutes: criteria.checkIntervalMinutes }` |

**Note on SOP Steps:** The `bom_sop_steps` table has NO `phase` column — steps are not phase-specific. All steps apply to the production phase.

**Note on Packaging QC:** The `packaging_qc_criteria` table has NO `targetWeight` field. It has `weightMin` and `weightMax` only.

```typescript
// Final response type
interface BOMConfigResponse {
  bomId: number;
  rooms: Array<{
    id: number;
    phase: string;
    roomCode: string;
    roomName: string;
    roomNameTh: string;
    sequence: number;
  }>;
  equipment: Array<{
    id: number;
    phase: string;
    equipmentCode: string;
    equipmentName: string;
    equipmentNameTh: string;
    sequence: number;
  }>;
  environmentalConditions: Array<{
    id: number;
    phase: string;
    conditionName: string;
    temperatureMin: number;
    temperatureMax: number;
    humidityMax: number;
    monitoringIntervalMinutes: number;
  }>;
  sopSteps: Array<{
    id: number;
    sequence: number;
    stepName: string;
    stepNameTh: string;
    instructions: string;
    instructionsTh: string;
    parameters: Record<string, number> | null;
    equipmentIds: number[] | null;
    requiresVerification: boolean;
  }>;
  packagingQC: Array<{
    id: number;
    criteriaName: string;
    weightMin: number;
    weightMax: number;
    sampleSize: number;
    maxFailures: number;
    checkIntervalMinutes: number;
  }>;
}
```

### Auth
`withAuth(request, handler, ['production:read'])`

---

## 2. Execution Dashboard — BOM Configuration Summary

### Location
`src/app/production/work-orders/[id]/execution/page.tsx`

### Design
- New card section placed **between** the WO Status card and the Phase sections
- Collapsible (default: collapsed) to not overwhelm the dashboard
- Header: "BOM Configuration" with a toggle icon
- Content: only show rows for config types that have data (hide empty types)

| Config Type | Summary Display |
|---|---|
| Rooms | Count per phase: "Pre-Production: 2, Production: 1, Post-Production: 1" |
| Equipment | Count per phase: "Pre-Production: 3, Production: 2" |
| Environmental | Condition names + ranges: "20-25°C, <60% RH" |
| SOP Steps | Total count + first 3 step names |
| Packaging QC | Weight range: "Min: 495g, Max: 505g, Sample: 10" |

If ALL config arrays are empty → show existing amber "BOM Configuration Required" alert (already implemented).

### Data Fetching
```typescript
const { data: bomConfig } = useQuery({
  queryKey: ['wo-bom-config', workOrderId],
  queryFn: () => fetch(`/api/production/work-orders/${workOrderId}/bom-config`).then(r => r.json()).then(d => d.data),
  staleTime: 5 * 60 * 1000, // 5 min — config rarely changes during execution
});
```

---

## 3. Sub-page Reference Panels

Each sub-page gets a **read-only info panel** (light blue background, `bg-blue-50 border border-blue-200 rounded-lg p-4`) placed above the execution content.

### Deduplication Strategy

The **Environmental Monitoring** page already fetches BOM conditions via its own API (`/api/production/work-orders/{id}/environmental-condition`), and the **Packaging QC** page already fetches BOM QC criteria via its own API (`/api/production/work-orders/{id}/packaging-qc-criteria`). These pages already display some BOM data in existing cards.

**Approach:** The reference panel on these pages will **replace** the existing inline BOM data displays with a consistent `BOMConfigReferencePanel`. The existing dedicated API calls for conditions/criteria will be removed in favor of the unified `/bom-config` endpoint, reducing API call count.

### 3a. Cleaning Page (`cleaning/page.tsx`)

**Shows:** Rooms and Equipment required for the current phase (filtered by `?phase=` query param)

```
┌─ BOM Requirements: Pre-Production ──────────────────┐
│ Rooms: MFG-01 (Manufacturing Room 1), QA-01 (QA Lab) │
│ Equipment: MIX-01 (Mixer), SCL-01 (Scale)            │
└──────────────────────────────────────────────────────┘
```

Data: Filter `bomConfig.rooms` and `bomConfig.equipment` by current phase.

### 3b. SOP Execution Page (`sop-execution/page.tsx`)

**Shows:** All SOP steps from BOM with expected parameters (steps have no phase — all are production)

```
┌─ BOM SOP Steps ─────────────────────────────────────┐
│ 1. Weighing — Temp: 25°C, Duration: 30min           │
│ 2. Mixing — Speed: 200rpm, Temp: 40°C, Duration: 60min │
│ 3. Granulation — Temp: 50°C                          │
└──────────────────────────────────────────────────────┘
```

Data: `bomConfig.sopSteps` sorted by sequence.

### 3c. Environmental Monitoring Page (`environmental-monitoring/page.tsx`)

**Shows:** Environmental conditions required for the current phase (replaces existing condition display)

```
┌─ BOM Environmental Requirements: Production ────────┐
│ Room Temperature: 20-25°C, Humidity: <60%            │
│ Monitoring Interval: every 30 minutes                │
└──────────────────────────────────────────────────────┘
```

Data: Filter `bomConfig.environmentalConditions` by current phase (`production` or `packaging`).

### 3d. Packaging QC Page (`packaging-qc/page.tsx`)

**Shows:** QC criteria from BOM (replaces existing criteria card)

```
┌─ BOM Packaging QC Criteria ──────────────────────────┐
│ Weight: Min 495g - Max 505g                          │
│ Sample Size: 10, Max Failures: 1                     │
│ Check Interval: every 30 minutes                     │
└──────────────────────────────────────────────────────┘
```

Data: `bomConfig.packagingQC`.

---

## 4. Reusable Component

### `BOMConfigReferencePanel`

```typescript
// src/components/production/BOMConfigReferencePanel.tsx
interface BOMConfigReferencePanelProps {
  workOrderId: number;
  phase?: string;           // Filter by phase (for sub-pages)
  showOnly?: ('rooms' | 'equipment' | 'environmental' | 'sopSteps' | 'packagingQC')[];
  defaultExpanded?: boolean; // true for sub-pages, false for dashboard
}
```

This component:
1. Fetches `/api/production/work-orders/{id}/bom-config` via TanStack Query (shared cache key `['wo-bom-config', workOrderId]`, `staleTime: 5min`)
2. Filters rooms/equipment/environmental by phase if provided
3. Renders only the specified config types (hides types with no data)
4. Displays as collapsible info panel

Used in both dashboard (all types, collapsed) and sub-pages (filtered types, expanded).

---

## 5. i18n Keys

Use existing `bomConfiguration` key namespace (already exists in production.json) and add nested keys.

### Thai (`src/locales/th/production.json`)
```json
{
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
}
```

### English (`src/locales/en/production.json`)
```json
{
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
}
```

---

## 6. TypeScript Interface

Add `BOMConfigResponse` interface to `src/types/production.ts` (or create if not exists) for shared use between API and UI.

---

## 7. Testing

### Component Test
- `tests/app/production/work-orders/execution-bom-config.test.tsx`
- Test cases:
  1. Renders BOM config panel with all 5 config types populated
  2. Renders empty state when no config data
  3. Filters rooms/equipment by phase correctly
  4. Partial data: only rooms exist, no equipment/SOP/etc → renders only rooms section
  5. Collapse/expand toggle behavior
  6. Renders Thai/English names based on locale context

### Sub-page Integration Tests
- Update existing test mocks for cleaning, SOP execution, environmental monitoring, and packaging QC pages to include the new `/bom-config` API mock
- Verify reference panel appears on each modified page

### API Test (optional — service functions are already tested)
- The API route is a thin aggregation layer over existing service functions
- Primary risk is flattening logic and JSON parsing — covered by component tests that mock API response

---

## Files Changed

| Action | File |
|--------|------|
| Create | `src/app/api/production/work-orders/[id]/bom-config/route.ts` |
| Create | `src/components/production/BOMConfigReferencePanel.tsx` |
| Create | `tests/app/production/work-orders/execution-bom-config.test.tsx` |
| Modify | `src/app/production/work-orders/[id]/execution/page.tsx` |
| Modify | `src/app/production/work-orders/[id]/cleaning/page.tsx` |
| Modify | `src/app/production/work-orders/[id]/sop-execution/page.tsx` |
| Modify | `src/app/production/work-orders/[id]/environmental-monitoring/page.tsx` |
| Modify | `src/app/production/work-orders/[id]/packaging-qc/page.tsx` |
| Modify | `src/locales/th/production.json` |
| Modify | `src/locales/en/production.json` |
| Create/Modify | `src/types/production.ts` |

## Out of Scope

- No editing BOM config from execution pages (read-only)
- No new database tables
- Material Weighing page already shows BOM line data — no changes needed
- Finished Inspection page has no BOM config link — no changes needed
