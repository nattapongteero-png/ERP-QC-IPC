/**
 * Delivery Schema Tests
 * Verifies delivery records table structure for sales order shipments
 */

import { describe, it, expect } from 'vitest';
import { getTableColumns, getTableName } from 'drizzle-orm';
import {
  sqliteSalesDeliveries,
  mysqlSalesDeliveries,
} from '@/lib/db/schema';

describe('Sales Deliveries Schema', () => {
  it('should have sqlite table named sales_deliveries', () => {
    expect(getTableName(sqliteSalesDeliveries)).toBe('sales_deliveries');
  });

  it('should have mysql table named sales_deliveries', () => {
    expect(getTableName(mysqlSalesDeliveries)).toBe('sales_deliveries');
  });

  it('should have required columns for delivery tracking', () => {
    const cols = getTableColumns(sqliteSalesDeliveries);

    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('soId');
    expect(cols).toHaveProperty('soLineId');
    expect(cols).toHaveProperty('itemId');
    expect(cols).toHaveProperty('lotId');
    expect(cols).toHaveProperty('quantity');
    expect(cols).toHaveProperty('deliveryDate');
    expect(cols).toHaveProperty('deliveryNumber');
    expect(cols).toHaveProperty('status');
    expect(cols).toHaveProperty('notes');
    expect(cols).toHaveProperty('createdBy');
    expect(cols).toHaveProperty('createdAt');
  });
});
