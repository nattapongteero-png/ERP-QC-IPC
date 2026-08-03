/**
 * Purchase Requisition Line Grid Component (T045)
 * Part of 011-accounting-spec-gap
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DataGrid, {
  Column,
  Editing,
  KeyboardNavigation,
  Lookup,
  Paging,
  Summary,
  TotalItem,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { useTranslations } from 'next-intl';
import { ItemSearchDialog, type Item as InventoryItem } from '@/components/ui/item-search-dialog';
import type { PRLineInput } from '@/types/purchase-requisition';

// Fallback units for MANUAL rows only (a line typed by hand with no linked item).
// For an item-linked line the dropdown is restricted to that item's own configured
// units (primary + secondary) — see getUnitOptions.
const STANDARD_UNITS = ['EA', 'kg', 'g', 'mg', 'L', 'mL', 'box', 'bottle', 'pack', 'roll'];

interface PRLineGridProps {
  lines: PRLineInput[];
  onChange: (lines: PRLineInput[]) => void;
  prId?: number;
  editable?: boolean;
  /** Active vendors, for the per-line "บริษัทผู้ขาย" dropdown (list item 5b). */
  vendors?: Array<{ id: number; name: string; code?: string | null }>;
}

export function PRLineGrid({ lines, onChange, prId, editable = true, vendors = [] }: PRLineGridProps) {
  const t = useTranslations('purchasing');
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  // Configured units per item (itemId -> [primaryUnit, secondaryUnit]). Populated
  // when items are added via the picker, and back-filled from /api/items/[id] for
  // lines loaded from an existing PR. The หน่วยนับ dropdown of an item-linked line
  // is restricted to that item's own units — NOT a global list.
  const [unitsByItem, setUnitsByItem] = useState<Record<number, string[]>>({});

  // Per-row dropdown options for หน่วยนับ. For an item-linked line: only that
  // item's configured units (+ the value already saved on the line, so it always
  // resolves). For a manual line (no itemId): the standard fallback list.
  const getUnitOptions = useCallback(
    (rowData?: Partial<PRLineInput>) => {
      const itemId = rowData?.itemId;
      const current = rowData?.unitOfMeasure;
      let base: string[];
      if (itemId != null && unitsByItem[itemId]?.length) {
        base = unitsByItem[itemId];
      } else if (itemId != null) {
        base = current ? [current] : []; // item line, units not loaded yet
      } else {
        base = STANDARD_UNITS; // manual row, no linked item
      }
      const set = new Set(base.filter(Boolean));
      if (current) set.add(current);
      return Array.from(set).map((u) => ({ value: u, label: u }));
    },
    [unitsByItem],
  );

  // Back-fill item units for lines loaded from an existing PR (their itemId is
  // known but the item wasn't picked this session, so unitsByItem has no entry).
  useEffect(() => {
    const missing = Array.from(
      new Set(
        lines
          .map((l) => l.itemId)
          .filter((id): id is number => typeof id === 'number' && !(id in unitsByItem)),
      ),
    );
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (id) => {
          try {
            const res = await fetch(`/api/items/${id}`);
            const data = await res.json();
            const it = data?.data ?? data;
            const units = [it?.primaryUnit, it?.secondaryUnit].filter((u): u is string => !!u);
            return [id, units] as const;
          } catch {
            return [id, [] as string[]] as const;
          }
        }),
      );
      if (cancelled) return;
      setUnitsByItem((prev) => {
        const next = { ...prev };
        for (const [id, units] of entries) next[id] = units;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [lines, unitsByItem]);

  // Vendor dropdown options for the per-line "บริษัทผู้ขาย" column. A PR line can
  // name the company it should be bought from, so PR→PO conversion can split one
  // requisition into a PO per vendor without the buyer re-picking on every line.
  const vendorOptions = useMemo(
    () =>
      vendors.map((v) => ({
        id: v.id,
        label: v.code ? `${v.code} - ${v.name}` : v.name,
      })),
    [vendors],
  );

  const toLine = useCallback((item: InventoryItem): PRLineInput => ({
    itemId: item.id,
    itemCode: item.code,
    description: item.nameTh || item.code,
    quantity: 1,
    unitOfMeasure: item.primaryUnit || 'EA',
    estimatedUnitPrice: 0,
  }), []);

  const handleSelectFromInventory = useCallback((item: InventoryItem) => {
    const units = [item.primaryUnit, item.secondaryUnit].filter(
      (u): u is string => !!u,
    );
    setUnitsByItem((prev) => ({ ...prev, [item.id]: units }));
    onChange([...lines, toLine(item)]);
    setItemSearchOpen(false);
  }, [lines, onChange, toLine]);

  // Multi-select: add every checked item in one go, skipping any already on the
  // PR (matched by itemId) so re-opening the picker can't create duplicates.
  const handleSelectMultiple = useCallback((items: InventoryItem[]) => {
    setUnitsByItem((prev) => {
      const next = { ...prev };
      for (const i of items) {
        next[i.id] = [i.primaryUnit, i.secondaryUnit].filter((u): u is string => !!u);
      }
      return next;
    });
    const existingIds = new Set(lines.map((l) => l.itemId).filter(Boolean));
    const fresh = items.filter((i) => !existingIds.has(i.id)).map(toLine);
    if (fresh.length) onChange([...lines, ...fresh]);
    setItemSearchOpen(false);
  }, [lines, onChange, toLine]);

  const handleRowInserted = useCallback(
    (e: any) => {
      const newLine: PRLineInput = {
        description: e.data.description || '',
        quantity: e.data.quantity || 1,
        unitOfMeasure: e.data.unitOfMeasure || 'EA',
        estimatedUnitPrice: e.data.estimatedUnitPrice || 0,
        itemCode: e.data.itemCode || undefined,
        suggestedVendorId: e.data.suggestedVendorId || undefined,
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
              suggestedVendorId: e.data.suggestedVendorId ?? line.suggestedVendorId,
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

  /**
   * Enter moves to the next cell along the row (รายละเอียด → จำนวน → หน่วยนับ
   * → ...), so an operator keying in a PR never has to reach for Tab or the
   * mouse. Shift+Enter steps back.
   *
   * Why not the built-in keyboardNavigation.enterKeyDirection="row"? It is the
   * documented way and it does not work in cell-edit mode here: on Enter the
   * grid first closes the editor, which detaches the <input> that the
   * follow-up focus move reads as its starting point — so focus lands nowhere
   * and the next keystrokes are dropped on the floor. Tab does the same
   * traversal without that teardown and works, so Enter drives the move itself
   * via editCell() on the next editable column.
   */
  const handleGridKeyDown = useCallback((e: any) => {
    const ev = e.event as KeyboardEvent | undefined;
    if (!ev || ev.key !== 'Enter') return;

    const grid = e.component;

    // Read the position from the DOM cell the keystroke actually came from.
    // grid.option('focusedColumnIndex') goes stale straight after a
    // programmatic editCell(), which made every Enter after the first one
    // navigate from the wrong column and lose focus.
    const td = (ev.target as HTMLElement)?.closest?.('td');
    const tr = td?.parentElement;
    if (!td || !tr) return;
    const colIndex = Array.prototype.indexOf.call(tr.children, td);

    ev.preventDefault();
    ev.stopPropagation();

    const visible = grid.getVisibleColumns();
    const editable = visible.filter((c: any) => c.allowEditing !== false && c.dataField);
    const currentField = visible[colIndex]?.dataField;
    const pos = editable.findIndex((c: any) => c.dataField === currentField);
    if (pos === -1) return;

    const nextField = editable[ev.shiftKey ? pos - 1 : pos + 1]?.dataField;
    if (!nextField) {
      // End of the row: commit and stop, rather than wrapping onto another
      // row's cell and silently editing a different line.
      grid.closeEditCell();
      return;
    }
    const nextIndex = visible.findIndex((c: any) => c.dataField === nextField);
    // Row index comes from the DOM row, for the same staleness reason.
    const domRowIndex = Array.prototype.indexOf.call(
      tr.parentElement ? [...tr.parentElement.children].filter((n: any) => n.classList.contains('dx-data-row')) : [],
      tr,
    );
    grid.editCell(domRowIndex < 0 ? 0 : domRowIndex, nextIndex);
  }, []);

  // Add index as key for local state management
  const dataWithKeys = lines.map((line, index) => ({
    ...line,
    key: index,
    estimatedAmount: (line.quantity || 0) * (line.estimatedUnitPrice || 0),
  }));

  return (
    <>
      {/* Plain edit cells — no green row tint, no green focus underline/outline.
          These override the GLOBAL emerald theme (src/styles/dx.emerald-override
          .css) which paints .dx-row-focused > td green and a green ::before
          underline on focused editors. We re-specify the SAME selectors prefixed
          with .pr-line-grid so specificity beats the global !important rules.
          Validation still works (the field tooltip still appears). */}
      <style>{`
        /* Every row cell → plain white, whatever the state (invalid red, edit,
           focused, selected). High-specificity via .dx-datagrid-rowsview + the
           state class beats the global theme's coloured rules. */
        .pr-line-grid .dx-datagrid .dx-datagrid-rowsview .dx-data-row > td,
        .pr-line-grid .dx-datagrid-rowsview .dx-row.dx-row-invalid > td,
        .pr-line-grid .dx-datagrid-rowsview .dx-edit-row > td,
        .pr-line-grid .dx-datagrid-rowsview .dx-row-focused > td,
        .pr-line-grid .dx-datagrid-rowsview .dx-selection.dx-row > td,
        .pr-line-grid .dx-datagrid-rowsview .dx-row.dx-row-focused.dx-edit-row > td {
          background-color: #fff !important;
        }
        /* In-cell editors: fill the cell edge-to-edge with a soft, EVEN gray
           border on all four sides (the global theme's rounded green box only
           showed a corner inside the square cell). No green ring, no radius. */
        .pr-line-grid .dx-datagrid-rowsview .dx-editor-cell .dx-texteditor,
        .pr-line-grid .dx-datagrid-rowsview .dx-editor-cell .dx-texteditor.dx-editor-filled,
        .pr-line-grid .dx-datagrid-rowsview .dx-editor-cell .dx-texteditor.dx-state-focused,
        .pr-line-grid .dx-datagrid-rowsview .dx-editor-cell .dx-texteditor.dx-state-hover,
        .pr-line-grid .dx-datagrid-rowsview .dx-editor-cell .dx-texteditor.dx-state-active {
          border: 1px solid #d1d5db !important;   /* gray-300, all sides */
          border-radius: 4px !important;
          box-shadow: none !important;
          background-color: #fff !important;
        }
        /* Remove the cell focus overlay / highlight box. */
        .pr-line-grid .dx-datagrid-rowsview td.dx-focused,
        .pr-line-grid .dx-highlight-outline {
          box-shadow: none !important;
          border-color: #d1d5db !important;
        }
        .pr-line-grid .dx-datagrid-focus-overlay {
          border: none !important;
          box-shadow: none !important;
        }
      `}</style>
      <div className="pr-line-grid">
      <DataGrid
        dataSource={dataWithKeys}
        keyExpr="key"
        showBorders={true}
        showRowLines={true}
        columnAutoWidth={true}
        onRowInserted={handleRowInserted}
        onRowUpdated={handleRowUpdated}
        onRowRemoved={handleRowRemoved}
        onKeyDown={handleGridKeyDown}
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
        <KeyboardNavigation enabled={true} editOnKeyPress={true} />
        <Paging defaultPageSize={10} />

        <Toolbar>
          <Item name="addRowButton" showText="always" />
          <Item location="after">
            <Button
              text={t('requisitions.form.selectFromInventory')}
              icon="search"
              stylingMode="outlined"
              onClick={() => setItemSearchOpen(true)}
              disabled={!editable}
            />
          </Item>
        </Toolbar>

        <Column
          dataField="itemCode"
          caption={t('requisitions.form.columns.itemCode')}
          width={120}
          data-testid="col-item-code"
        />
        <Column
          dataField="description"
          caption={t('requisitions.form.columns.description')}
          minWidth={200}
          validationRules={[{ type: 'required', message: t('requisitions.form.validation.descriptionRequired') }]}
          data-testid="col-description"
        />
        <Column
          dataField="quantity"
          caption={t('requisitions.form.columns.quantity')}
          dataType="number"
          width={110}
          alignment="right"
          format={{ type: 'fixedPoint', precision: 0 }}
          // Right-aligned number editor. No spin buttons — they showed a cramped
          // up/down control inside the narrow cell that looked like a stray
          // artifact. Plain number entry is cleaner here.
          editorOptions={{
            min: 0,
            format: '#,##0.##',
          }}
          validationRules={[
            { type: 'required', message: t('requisitions.form.validation.quantityRequired') },
            { type: 'range', min: 0.01, message: t('requisitions.form.validation.quantityPositive') },
          ]}
          data-testid="col-quantity"
        />
        <Column
          dataField="unitOfMeasure"
          caption={t('requisitions.form.columns.unit')}
          width={110}
          validationRules={[{ type: 'required', message: t('requisitions.form.validation.unitRequired') }]}
          data-testid="col-uom"
        >
          {/* Dropdown restricted per row to the linked item's own units (primary +
              secondary). Manual rows (no item) fall back to the standard list. */}
          <Lookup
            dataSource={(options: { data?: Partial<PRLineInput> }) => getUnitOptions(options?.data)}
            valueExpr="value"
            displayExpr="label"
            allowClearing={false}
          />
        </Column>
        <Column
          dataField="estimatedUnitPrice"
          caption={t('requisitions.form.columns.unitPrice')}
          dataType="number"
          width={130}
          alignment="right"
          format={{ type: 'fixedPoint', precision: 2 }}
          // Same tidy number-box editor for ราคาต่อหน่วย (filled, like the grid).
          editorOptions={{
            showSpinButtons: false,
            min: 0,
            format: '#,##0.00',
          }}
          data-testid="col-unit-price"
        />
        <Column
          caption={t('requisitions.form.columns.amount')}
          width={130}
          alignment="right"
          calculateCellValue={calculateAmount}
          format={{ type: 'fixedPoint', precision: 2 }}
          allowEditing={false}
          data-testid="col-amount"
        />
        {/* Per-line vendor (บริษัทผู้ขาย) — optional. When set, PR→PO conversion
            groups lines by this company and makes one PO per vendor (list item
            5b). Rendered only when a vendor list was supplied. */}
        {vendorOptions.length > 0 && (
          <Column
            dataField="suggestedVendorId"
            caption={t('requisitions.form.columns.vendor')}
            width={180}
            data-testid="col-vendor"
          >
            <Lookup
              dataSource={vendorOptions}
              valueExpr="id"
              displayExpr="label"
              allowClearing={true}
            />
          </Column>
        )}
        <Column
          dataField="notes"
          caption={t('requisitions.form.columns.notes')}
          width={150}
          data-testid="col-notes"
        />

        <Summary>
          <TotalItem
            column="Amount"
            summaryType="sum"
            valueFormat={{ type: 'fixedPoint', precision: 2 }}
            displayFormat={t('requisitions.form.totalLabel')}
          />
        </Summary>
      </DataGrid>
      </div>

      <ItemSearchDialog
        open={itemSearchOpen}
        onOpenChange={setItemSearchOpen}
        onSelect={handleSelectFromInventory}
        multiSelect
        onSelectMultiple={handleSelectMultiple}
        title={t('requisitions.form.selectFromInventoryMulti')}
        showPrice="cost"
        excludeIds={lines.filter(l => l.itemId).map(l => l.itemId!)}
        allowCreate
      />
    </>
  );
}
