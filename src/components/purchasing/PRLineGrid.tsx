/**
 * Purchase Requisition Line Grid Component (T045)
 * Part of 011-accounting-spec-gap
 */

'use client';

import { useCallback, useMemo, useState } from 'react';
import DataGrid, {
  Column,
  Editing,
  Lookup,
  Paging,
  Summary,
  TotalItem,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { ItemSearchDialog, type Item as InventoryItem } from '@/components/ui/item-search-dialog';
import type { PRLineInput } from '@/types/purchase-requisition';

// Standard units always offered in the หน่วยนับ dropdown, merged with any unit
// configured on the items the user has added (their primary/secondary units).
const STANDARD_UNITS = ['EA', 'kg', 'g', 'mg', 'L', 'mL', 'box', 'bottle', 'pack', 'roll'];

interface PRLineGridProps {
  lines: PRLineInput[];
  onChange: (lines: PRLineInput[]) => void;
  prId?: number;
  editable?: boolean;
}

export function PRLineGrid({ lines, onChange, prId, editable = true }: PRLineGridProps) {
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  // Units gathered from the items the user has picked (primary + secondary),
  // so the หน่วยนับ dropdown reflects each item's configured units.
  const [itemUnits, setItemUnits] = useState<string[]>([]);

  // Dropdown options for หน่วยนับ: item-configured units + current line units +
  // a standard fallback list, de-duplicated.
  const unitOptions = useMemo(() => {
    const set = new Set<string>();
    itemUnits.forEach((u) => u && set.add(u));
    lines.forEach((l) => l.unitOfMeasure && set.add(l.unitOfMeasure));
    STANDARD_UNITS.forEach((u) => set.add(u));
    return Array.from(set).map((u) => ({ value: u, label: u }));
  }, [itemUnits, lines]);

  const handleSelectFromInventory = useCallback((item: InventoryItem) => {
    const units = [item.primaryUnit, item.secondaryUnit].filter(
      (u): u is string => !!u,
    );
    if (units.length) setItemUnits((prev) => Array.from(new Set([...prev, ...units])));
    const newLine: PRLineInput = {
      itemId: item.id,
      itemCode: item.code,
      description: item.nameTh || item.code,
      quantity: 1,
      unitOfMeasure: item.primaryUnit || 'EA',
      estimatedUnitPrice: 0,
    };
    onChange([...lines, newLine]);
    setItemSearchOpen(false);
  }, [lines, onChange]);

  const handleRowInserted = useCallback(
    (e: any) => {
      const newLine: PRLineInput = {
        description: e.data.description || '',
        quantity: e.data.quantity || 1,
        unitOfMeasure: e.data.unitOfMeasure || 'EA',
        estimatedUnitPrice: e.data.estimatedUnitPrice || 0,
        itemCode: e.data.itemCode || undefined,
        notes: e.data.notes || undefined,
      };
      onChange([...lines, newLine]);
    },
    [lines, onChange]
  );

  const handleRowUpdated = useCallback(
    (e: any) => {
      const updatedLines = lines.map((line, index) =>
        index === e.key
          ? {
              ...line,
              description: e.data.description ?? line.description,
              quantity: e.data.quantity ?? line.quantity,
              unitOfMeasure: e.data.unitOfMeasure ?? line.unitOfMeasure,
              estimatedUnitPrice: e.data.estimatedUnitPrice ?? line.estimatedUnitPrice,
              itemCode: e.data.itemCode ?? line.itemCode,
              notes: e.data.notes ?? line.notes,
            }
          : line
      );
      onChange(updatedLines);
    },
    [lines, onChange]
  );

  const handleRowRemoved = useCallback(
    (e: any) => {
      const filteredLines = lines.filter((_, index) => index !== e.key);
      onChange(filteredLines);
    },
    [lines, onChange]
  );

  const calculateAmount = useCallback((rowData: any) => {
    return (rowData.quantity || 0) * (rowData.estimatedUnitPrice || 0);
  }, []);

  // Add index as key for local state management
  const dataWithKeys = lines.map((line, index) => ({
    ...line,
    key: index,
    estimatedAmount: (line.quantity || 0) * (line.estimatedUnitPrice || 0),
  }));

  return (
    <>
      <DataGrid
        dataSource={dataWithKeys}
        keyExpr="key"
        showBorders={true}
        showRowLines={true}
        columnAutoWidth={true}
        rowAlternationEnabled={true}
        onRowInserted={handleRowInserted}
        onRowUpdated={handleRowUpdated}
        onRowRemoved={handleRowRemoved}
        data-testid="pr-lines-grid"
      >
        {/* Cell editing — each cell is directly editable on click (no need to
            press an edit/pencil icon first). */}
        <Editing
          mode="cell"
          allowAdding={editable}
          allowUpdating={editable}
          allowDeleting={editable}
          useIcons={true}
          startEditAction="click"
          selectTextOnEditStart={true}
        />
        <Paging defaultPageSize={10} />

        <Toolbar>
          <Item name="addRowButton" showText="always" />
          <Item location="after">
            <Button
              text="เลือกจากคลังสินค้า"
              icon="search"
              stylingMode="outlined"
              onClick={() => setItemSearchOpen(true)}
              disabled={!editable}
            />
          </Item>
        </Toolbar>

        <Column
          dataField="itemCode"
          caption="รหัสสินค้า"
          width={120}
          data-testid="col-item-code"
        />
        <Column
          dataField="description"
          caption="รายละเอียด"
          minWidth={200}
          validationRules={[{ type: 'required', message: 'กรุณากรอกรายละเอียด' }]}
          data-testid="col-description"
        />
        <Column
          dataField="quantity"
          caption="จำนวน"
          dataType="number"
          width={80}
          validationRules={[
            { type: 'required', message: 'กรุณากรอกจำนวน' },
            { type: 'range', min: 0.01, message: 'จำนวนต้องมากกว่า 0' },
          ]}
          data-testid="col-quantity"
        />
        <Column
          dataField="unitOfMeasure"
          caption="หน่วยนับ"
          width={110}
          validationRules={[{ type: 'required', message: 'กรุณาระบุหน่วยนับ' }]}
          data-testid="col-uom"
        >
          {/* Dropdown sourced from the selected items' configured units +
              standard units (acceptCustomValue lets the user type a new one). */}
          <Lookup dataSource={unitOptions} valueExpr="value" displayExpr="label" allowClearing={false} />
        </Column>
        <Column
          dataField="estimatedUnitPrice"
          caption="ราคาต่อหน่วย"
          dataType="number"
          width={120}
          format={{ type: 'fixedPoint', precision: 2 }}
          data-testid="col-unit-price"
        />
        <Column
          caption="จำนวนเงิน"
          width={120}
          calculateCellValue={calculateAmount}
          format={{ type: 'fixedPoint', precision: 2 }}
          allowEditing={false}
          data-testid="col-amount"
        />
        <Column
          dataField="notes"
          caption="หมายเหตุ"
          width={150}
          data-testid="col-notes"
        />

        <Summary>
          <TotalItem
            column="Amount"
            summaryType="sum"
            valueFormat={{ type: 'fixedPoint', precision: 2 }}
            displayFormat="รวม: {0}"
          />
        </Summary>
      </DataGrid>

      <ItemSearchDialog
        open={itemSearchOpen}
        onOpenChange={setItemSearchOpen}
        onSelect={handleSelectFromInventory}
        title="เลือกสินค้าจากคลัง"
        showPrice="cost"
        excludeIds={lines.filter(l => l.itemId).map(l => l.itemId!)}
        allowCreate
      />
    </>
  );
}
