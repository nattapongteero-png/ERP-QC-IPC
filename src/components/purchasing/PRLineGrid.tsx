/**
 * Purchase Requisition Line Grid Component (T045)
 * Part of 011-accounting-spec-gap
 */

'use client';

import { useCallback, useState } from 'react';
import DataGrid, {
  Column,
  Editing,
  Paging,
  Summary,
  TotalItem,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { ItemSearchDialog, type Item as InventoryItem } from '@/components/ui/item-search-dialog';
import type { PRLineInput } from '@/types/purchase-requisition';

interface PRLineGridProps {
  lines: PRLineInput[];
  onChange: (lines: PRLineInput[]) => void;
  prId?: number;
  editable?: boolean;
}

export function PRLineGrid({ lines, onChange, prId, editable = true }: PRLineGridProps) {
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [itemSearchOpen, setItemSearchOpen] = useState(false);

  const handleSelectFromInventory = useCallback((item: InventoryItem) => {
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
        <Editing
          mode="row"
          allowAdding={editable}
          allowUpdating={editable}
          allowDeleting={editable}
          useIcons={true}
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
          width={80}
          validationRules={[{ type: 'required', message: 'กรุณาระบุหน่วยนับ' }]}
          data-testid="col-uom"
        />
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
