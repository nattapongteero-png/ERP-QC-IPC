# Material Weighing Improvements Design

## Goal

Improve the Material Weighing page (`/production/work-orders/[id]/material-weighing`) to show clearer product information and allow operators to select inventory lots from available stock before recording weights.

## Current State

- Material list shows Item Code, Status, Planned/Actual Qty but no Product Name
- Planned Quantity shown without UoM context
- "Weigh" dialog has a text input for Lot Number that is never saved to the database
- Lot is auto-assigned via FEFO after weighing — user has no control over lot selection
- `getWOMaterials()` does not JOIN with `inventory_lots`, so lot info is not displayed
- **Field mismatch**: DB column is `plannedQuantity` but frontend `MaterialLine` interface uses `plannedQty` — `getWOMaterials()` must alias correctly

## Requirements

### 1. Display: Product Name + Planned Qty with UoM

Each material card in the list must show:
- **Item Code** (existing)
- **Product Name in both languages**: Thai name / English name (e.g., `สารสกัดขมิ้น / Turmeric Extract`)
  - If Thai name is missing, show English only
  - If English name is missing, show Thai only
- **Planned Quantity with UoM**: e.g., `150.000 kg`
- Status badge + Actual Qty (existing, unchanged)

**Note**: `getWOMaterials()` returns `plannedQuantity` from DB but the `MaterialLine` interface expects `plannedQty`. The service must alias `plannedQuantity` → `plannedQty` in the returned object to match the frontend interface.

### 2. Lot Selection: SelectBox in Weigh Dialog

Replace the existing Lot Number text input with a DevExtreme SelectBox:

- **Data source**: Available lots from `inventory_lots` WHERE:
  - `itemId` = material's item ID
  - `status` = `'released'`
  - `quantity - reservedQuantity > 0` (has available stock)
- **Sort order**: FEFO (expiryDate ASC, id ASC)
- **Display format**: `{lotNumber} ({availableQty} {unit}) - Exp: {expiryDate} [{vendorLotNumber or manufacturerName}]`
  - Example: `LOT-2603001 (150.00 kg) - Exp: 2026-09-30 [Vendor: ABC]`
  - If no vendor info, omit the bracket portion
  - If `expiryDate` is null, show `Exp: N/A`
- **Behavior**:
  - Optional field — operator can skip lot selection
  - If lot selected: system uses that specific lot for inventory deduction
  - If not selected: system auto-assigns via FEFO algorithm (existing behavior)
  - Single lot per weighing operation (no multi-lot support)

### 3. API: Available Lots Endpoint

**New endpoint**: `GET /api/inventory/lots/available?itemId={itemId}`

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "lotNumber": "LOT-2603001",
      "availableQty": 150.0,
      "unit": "kg",
      "expiryDate": "2026-09-30",
      "vendorLotNumber": "VL-001",
      "manufacturerName": "ABC Co."
    }
  ]
}
```

Auth permission: `inventory:read` (matches existing inventory endpoints)

**Implementation note**: `availableQty` is computed in application code as `quantity - reservedQuantity` (same pattern as existing `getLotsForPicking()`). The query logic must **reuse** the existing `getLotsForPicking()` query conditions from `inventory.service.ts` to avoid duplication — extract a shared helper or extend `getLotsForPicking()` to support a "list all" mode (no quantity allocation, just return available lots).

### 4. API & Route: Modified Weight Recording

**Modified**: `PUT /api/production/work-orders/[id]/material-weighing`

Add optional `lotId` field to request body:
```json
{
  "materialId": 123,
  "weighedQty": 148.5,
  "lotId": 456
}
```

- If `lotId` provided: use that lot for inventory deduction (skip FEFO auto-pick)
- If `lotId` omitted/null: auto-assign via FEFO (existing behavior)
- **Validation**: if `lotId` provided, validate before calling `issueMaterial()`:
  - Lot must exist and have `status = 'released'`
  - Available qty (`quantity - reservedQuantity`) must be >= `weighedQty`
  - On validation failure: return structured 400 error (not unhandled throw) — operator must re-select lot
  - **No fallback to FEFO** when an explicit `lotId` fails validation

**Route handler update required**: The route handler in `route.ts` must extract `lotId` from the request body and pass it to `recordMaterialWeight()`. Currently the route only passes `materialId`, `weighedQty`, `weighedBy`, and water params — `lotId` must be added.

### 5. Service Layer Changes

**`wo-execution.service.ts`**:
- `recordMaterialWeight()`: Accept optional `lotId` parameter. If provided, validate the lot and use it directly instead of calling `getLotsForPicking()`. Return structured error if lot validation fails.
- `getWOMaterials()`: Add LEFT JOIN with `inventory_lots` on `eq(tables.workOrderMaterials.lotId, tables.inventoryLots.id)` to include `lotNumber` in the SELECT clause. This resolves the pre-existing gap where `MaterialLine.lotNumber` is defined in the interface but was never populated.

**`inventory.service.ts`**:
- `getAvailableLots(itemId)`: New function using the same `getDb()` pattern as the rest of inventory.service.ts. Must reuse/share the query conditions with `getLotsForPicking()` (released status, available qty > 0, FEFO sort) to avoid code duplication.

### 6. i18n Translation Keys

New keys needed in `src/locales/th/production.json` and `src/locales/en/production.json`:

| Key | Thai | English |
|-----|------|---------|
| `materialWeighing.form.lot.label` | Lot Number | Lot Number |
| `materialWeighing.form.lot.placeholder` | เลือก Lot (ไม่บังคับ) | Select Lot (optional) |
| `materialWeighing.form.lot.noData` | ไม่พบ Lot ที่ใช้ได้ | No available lots |
| `materialWeighing.form.lot.expiry` | หมดอายุ | Exp |
| `materialWeighing.form.lot.noExpiry` | N/A | N/A |

### 7. Unchanged Behavior

- Water quality parameters (conductivity, temperature, date)
- Two-step verification workflow (weigh then verify)
- Variance warning at +/-5% threshold
- Cost accounting integration
- Progress tracking and status badges
- No multi-lot support

## Architecture

```
Material Weighing Page
  ├── Material List (enhanced display)
  │   └── Shows: itemCode, itemNameTh / itemNameEn, plannedQty + unit
  │
  └── Weigh Dialog (modified)
      ├── SelectBox: Lot selection (from GET /api/inventory/lots/available)
      ├── Number input: Actual weight (existing)
      ├── Water params section (existing, unchanged)
      └── Record Weight button → PUT with optional lotId

GET /api/inventory/lots/available?itemId=XX
  └── inventory.service.ts → getAvailableLots(itemId)
      └── Reuses getLotsForPicking() query logic (no quantity allocation)
      └── SELECT from inventory_lots WHERE released AND available > 0

PUT /api/production/work-orders/[id]/material-weighing
  └── route.ts: extract lotId from body, pass to service
      └── wo-execution.service.ts → recordMaterialWeight({...lotId})
          ├── If lotId: validate lot → use directly (error if invalid)
          └── If no lotId: getLotsForPicking() (FEFO auto-assign)
```

## Testing

- Unit test: `getAvailableLots()` returns correct lots sorted by FEFO
- Unit test: `recordMaterialWeight()` uses provided lotId when given
- Unit test: `recordMaterialWeight()` falls back to FEFO when lotId is null
- Unit test: `recordMaterialWeight()` returns error when explicit lotId has insufficient qty
- UI test: Material list renders product names in both languages
- UI test: Weigh dialog shows SelectBox with lot options
- UI test: Form submits correctly with and without lot selection
