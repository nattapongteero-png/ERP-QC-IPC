/**
 * Item type → storage warehouse type mapping.
 *
 * Lives in `utils` (not in warehouse-resolver.service) because the receive
 * dialog needs it in the browser: that service pulls in drizzle / db-helper at
 * module scope, which must never reach a client component. The service imports
 * this same function so server and client agree on the routing rule.
 */

/**
 * Map an item's `type` (raw_material / packaging / wip / finished_goods /
 * consumable) to the storage warehouse `type` its stock belongs in.
 * WIP and finished goods land in the finished-goods warehouse; everything else
 * (raw material, packaging, consumables) lands in the raw-material warehouse.
 */
export function warehouseTypeForItemType(itemType: string | null | undefined): string {
  switch (itemType) {
    case 'finished_goods':
    case 'wip':
      return 'finished_goods';
    case 'raw_material':
    case 'packaging':
    case 'consumable':
    default:
      return 'raw_material';
  }
}

/**
 * Goods-receipt checklist category for an item type. The receipt checklist
 * templates only have two categories — a finished-goods delivery must not be
 * checked against the raw-material checklist.
 */
export function checklistCategoryForItemType(
  itemType: string | null | undefined,
): 'raw_material' | 'finished_goods' {
  return warehouseTypeForItemType(itemType) === 'finished_goods'
    ? 'finished_goods'
    : 'raw_material';
}

/**
 * Pick the warehouse an item of `itemType` should default to, from a list of
 * warehouses. Falls back to the first warehouse when no matching type exists
 * (a database that has not been seeded with a finished-goods warehouse yet),
 * so the dialog is never left with an empty required field.
 */
export function pickWarehouseForItemType<T extends { id: number; type?: string | null }>(
  warehouses: T[],
  itemType: string | null | undefined,
): T | undefined {
  if (warehouses.length === 0) return undefined;
  const wanted = warehouseTypeForItemType(itemType);
  return warehouses.find((w) => w.type === wanted) ?? warehouses[0];
}
