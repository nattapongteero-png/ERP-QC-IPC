# BOM Unit Dropdown + Unit Conversion on Verify

## Goal

Replace free-text Unit field in BOM Materials/Ingredients with a dropdown showing only the item's Primary/Secondary units, and apply unit conversion during Verify to deduct inventory in the correct (primary) unit.

## Requirements

### 1. BOM Form — Unit Dropdown

- Replace DxTextBox with DxSelectBox for the Unit field in BOM Materials/Ingredients section
- Options: only Primary Unit + Secondary Unit of the selected item
- If item has no Secondary Unit → show only Primary Unit (1 option, locked)
- Default: Primary Unit when adding a new material line
- When item changes → reset unit to the new item's Primary Unit

### 2. Unit Conversion on Verify

When verifying material weight (pressing Verify button):
- Fetch item's `primaryUnit`, `secondaryUnit`, `conversionRate`
- Compare `work_order_materials.unit` with item settings:
  - If unit = primaryUnit → deduct weighedQty as-is
  - If unit = secondaryUnit → convert: `deductQty = weighedQty / conversionRate`
  - If unit matches neither → deduct as-is (fallback)
- Pass converted quantity to `getLotsForPicking()` and `issueMaterial()`
- Store `actualQuantity` in primary unit (inventory unit)

### 3. Data Cleanup

Fix existing data in both databases (herbal_erp, herbal_erp_metaherb):
- `bom_lines.unit` → match against item's primaryUnit/secondaryUnit; if neither matches, set to primaryUnit
- `work_order_materials.unit` → same logic

### 4. Unchanged

- BOM lines schema (still stores unit as text)
- Material Weighing UI (shows unit from BOM line)
- Weigh dialog (unit display unchanged)
