# BOM Configuration Display in WO Execution — Design Spec

## Goal

Display BOM Configuration data (Rooms, Equipment, Environmental Conditions, SOP Steps, Packaging QC) on Work Order Execution pages so operators can reference production requirements while executing.

## Architecture

- **1 new API endpoint** (`GET /api/production/work-orders/[id]/bom-config`) aggregates all 5 BOM config types via existing service functions
- **1 new reusable component** (`BOMConfigSummary`) for the execution dashboard overview
- **Read-only reference panels** added to 4 existing sub-pages (Cleaning, SOP Execution, Environmental Monitoring, Packaging QC)
- No new database tables or mutations — purely read-only

## Tech Stack

- Next.js 16 + React 19, TanStack Query (data fetching), next-intl (i18n)
- Existing: `bom-configuration.service.ts` (getBOMRooms, getBOMEquipment, getBOMEnvironmentalConditions, getBOMSOPSteps, getBOMPackagingQC)

---

## 1. API: `GET /api/production/work-orders/[id]/bom-config`

### Purpose
Fetch all BOM configuration for the BOM linked to a work order. Single endpoint to avoid N+1 fetches from UI.

### Flow
1. Fetch work order by ID → get `bomId`
2. If no `bomId`, return empty config
3. Call existing service functions in parallel:
   - `getBOMRooms(bomId)`
   - `getBOMEquipment(bomId)` (from service — need to add this function)
   - `getBOMEnvironmentalConditions(bomId)`
   - `getBOMSOPSteps(bomId)`
   - `getBOMPackagingQC(bomId)`
4. Return aggregated response

### Response Shape
```typescript
{
  success: true,
  data: {
    bomId: number,
    rooms: Array<{
      id: number;
      phase: string;
      roomCode: string;
      roomName: string;
      sequence: number;
    }>;
    equipment: Array<{
      id: number;
      phase: string;
      equipmentCode: string;
      equipmentName: string;
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
      phase: string;
      requiresVerification: boolean;
    }>;
    packagingQC: Array<{
      id: number;
      criteriaName: string;
      targetWeight: number;
      minWeight: number;
      maxWeight: number;
      sampleSize: number;
      maxFailures: number;
    }>;
  }
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
- Content: 5 rows summarizing each config type

| Config Type | Summary Display |
|---|---|
| Rooms | Count per phase: "Pre-Production: 2, Production: 1, Post-Production: 1" |
| Equipment | Count per phase: "Pre-Production: 3, Production: 2" |
| Environmental | Condition names + ranges: "Room Temp: 20-25°C, <60% RH" |
| SOP Steps | Total count + first 3 step names |
| Packaging QC | Criteria count + weight range: "Target: 500g (495-505g)" |

If no BOM config exists → show existing amber "BOM Configuration Required" alert (already implemented).

### Data Fetching
```typescript
const { data: bomConfig } = useQuery({
  queryKey: ['wo-bom-config', workOrderId],
  queryFn: () => fetch(`/api/production/work-orders/${workOrderId}/bom-config`).then(r => r.json()),
});
```

---

## 3. Sub-page Reference Panels

Each sub-page gets a **read-only info panel** (light blue background, `bg-blue-50 border border-blue-200 rounded-lg p-4`) placed above the execution content.

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

**Shows:** All SOP steps from BOM with expected parameters

```
┌─ BOM SOP Steps ─────────────────────────────────────┐
│ 1. Weighing — Temp: 25°C, Duration: 30min           │
│ 2. Mixing — Speed: 200rpm, Temp: 40°C, Duration: 60min │
│ 3. Granulation — Temp: 50°C                          │
└──────────────────────────────────────────────────────┘
```

Data: `bomConfig.sopSteps` sorted by sequence.

### 3c. Environmental Monitoring Page (`environmental-monitoring/page.tsx`)

**Shows:** Environmental conditions required for the current phase

```
┌─ BOM Environmental Requirements: Production ────────┐
│ Room Temperature: 20-25°C, Humidity: <60%            │
│ Monitoring Interval: every 30 minutes                │
└──────────────────────────────────────────────────────┘
```

Data: Filter `bomConfig.environmentalConditions` by current phase.

### 3d. Packaging QC Page (`packaging-qc/page.tsx`)

**Shows:** QC criteria from BOM

```
┌─ BOM Packaging QC Criteria ──────────────────────────┐
│ Weight Control: Target 500g (Min: 495g, Max: 505g)   │
│ Sample Size: 10, Max Failures: 1                     │
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
  defaultExpanded?: boolean;
}
```

This component:
1. Fetches `/api/production/work-orders/{id}/bom-config` via TanStack Query (shared cache key)
2. Filters by phase if provided
3. Renders only the specified config types
4. Displays as collapsible info panel

Used in both dashboard (all types, collapsed) and sub-pages (filtered types, expanded).

---

## 5. i18n Keys

Add to `src/locales/th/production.json` and `src/locales/en/production.json`:

```json
{
  "bomConfig": {
    "title": "BOM Configuration",
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
    "targetWeight": "Target Weight",
    "minWeight": "Min Weight",
    "maxWeight": "Max Weight",
    "sampleSize": "Sample Size",
    "maxFailures": "Max Failures",
    "parameters": "Parameters",
    "instructions": "Instructions",
    "everyMinutes": "every {minutes} minutes"
  }
}
```

---

## 6. Testing

### Unit Test
- `tests/app/production/work-orders/execution-bom-config.test.tsx`
- Mock API response, verify BOM config panel renders with correct data
- Verify empty state when no config

### Existing Tests
- No changes to existing test files — all additions are new UI sections

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

## Out of Scope

- No editing BOM config from execution pages (read-only)
- No new database tables
- Material Weighing page already shows BOM line data — no changes needed
- Finished Inspection page has no BOM config link — no changes needed
