/**
 * Standard Costs Management Page (T148)
 * Manage standard costs for items
 * Part of 011-accounting-spec-gap - User Story 6
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toLocalDateStr } from '@/lib/utils/date-format';
import DataGrid, {
  Column,
  Paging,
  Toolbar,
  Item,
  Scrolling,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { Popup } from 'devextreme-react/popup';
import { Form, SimpleItem, GroupItem, RequiredRule } from 'devextreme-react/form';
import notify from 'devextreme/ui/notify';
import type { StandardCost } from '@/types/variance';

interface CreateFormData {
  itemId: number | null;
  effectiveDate: string;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  standardHours: number;
  standardLaborRate: number;
  notes: string;
  setAsCurrent: boolean;
}

const defaultFormData: CreateFormData = {
  itemId: null,
  effectiveDate: toLocalDateStr(new Date()),
  materialCost: 0,
  laborCost: 0,
  overheadCost: 0,
  standardHours: 0,
  standardLaborRate: 0,
  notes: '',
  setAsCurrent: true,
};

export default function StandardCostsPage() {
  const t = useTranslations('accounting');
  const [loading, setLoading] = useState(true);
  const [costs, setCosts] = useState<StandardCost[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState<CreateFormData>(defaultFormData);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<{ id: number; code: string; name: string }[]>([]);

  const fetchCosts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/accounting/standard-costs');
      const result = await response.json();
      if (result.success) {
        setCosts(result.data);
      }
    } catch (error) {
      console.error('Error fetching standard costs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Products the item picker offers.
   *
   * Two bugs lived here: the URL was `/api/inventory/items`, which does not
   * exist and 404s (so the picker was always empty), and the response was read
   * as `result.data` when the payload is `{ items, total, ... }` — an object,
   * not the array the SelectBox needs.
   *
   * Scoped to finished goods + WIP: a standard cost is what a MANUFACTURED
   * product should cost, so offering raw materials and packaging here would
   * invite costing something that is never produced.
   */
  const fetchItems = useCallback(async () => {
    try {
      const types = ['finished_goods', 'wip'];
      const responses = await Promise.all(
        types.map((type) =>
          fetch(`/api/items?type=${type}&limit=1000`).then((r) => r.json()),
        ),
      );

      const all = responses.flatMap((result) =>
        result?.success ? (result.data?.items ?? []) : [],
      );

      setItems(
        all.map((it: { id: number; code: string; nameTh?: string; name?: string }) => ({
          id: it.id,
          code: it.code,
          name: it.nameTh || it.name || it.code,
        })),
      );
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  }, []);

  useEffect(() => {
    fetchCosts();
    fetchItems();
  }, [fetchCosts, fetchItems]);

  const handleCreate = async () => {
    if (!formData.itemId) {
      notify(t('standardCosts.validation.selectItem'), 'error', 3000);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/accounting/standard-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (result.success) {
        notify(t('standardCosts.toast.createSuccess'), 'success', 3000);
        setShowCreateDialog(false);
        setFormData(defaultFormData);
        await fetchCosts();
      } else {
        notify(result.error || t('standardCosts.toast.createFailed'), 'error', 3000);
      }
    } catch (error) {
      console.error('Error creating standard cost:', error);
      notify(t('standardCosts.toast.createFailed'), 'error', 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRollup = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/accounting/standard-costs/rollup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const result = await response.json();
      if (result.success) {
        notify(
          t('standardCosts.toast.rollupSuccess', {
            updated: result.data.itemsUpdated,
            processed: result.data.itemsProcessed,
          }),
          'success',
          3000
        );
        await fetchCosts();
      } else {
        notify(result.error || t('standardCosts.toast.rollupFailed'), 'error', 3000);
      }
    } catch (error) {
      console.error('Error during roll-up:', error);
      notify(t('standardCosts.toast.rollupFailed'), 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  const renderCurrentBadge = (cellData: any) => {
    const isCurrent = cellData.value;
    return isCurrent ? (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        {t('standardCosts.status.current')}
      </span>
    ) : (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        {t('standardCosts.status.history')}
      </span>
    );
  };

  if (loading && costs.length === 0) {
    return (
        <div className="flex items-center justify-center h-64">
          <LoadIndicator />
        </div>
    );
  }

  return (
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
            {t('standardCosts.title')}
          </h1>
          <p className="text-gray-600">
            {t('standardCosts.subtitle')}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow">
          <DataGrid
            dataSource={costs}
            keyExpr="id"
            showBorders={true}
            rowAlternationEnabled={true}
            loadPanel={{ enabled: loading }}
            // On narrow screens (tablet) the fixed-width columns squeezed the
            // flexible "ชื่อสินค้า" column until its header overlapped its
            // neighbours. Wrap header/cell text, give every column a minimum
            // width, and let the grid scroll horizontally instead of crushing.
            wordWrapEnabled={true}
            columnMinWidth={90}
            allowColumnResizing={true}
            data-testid="standard-costs-grid"
          >
            <Scrolling columnRenderingMode="standard" showScrollbar="onHover" />
            <Paging defaultPageSize={10} />
            <Toolbar>
              <Item location="before">
                <span className="text-lg font-medium">{t('standardCosts.gridTitle')}</span>
              </Item>
              <Item location="after">
                <Button
                  icon="add"
                  text={t('standardCosts.actions.add')}
                  onClick={() => setShowCreateDialog(true)}
                  data-testid="new-cost-btn"
                />
              </Item>
              <Item location="after">
                <Button
                  icon="refresh"
                  text={t('standardCosts.actions.rollup')}
                  onClick={handleRollup}
                  data-testid="rollup-btn"
                />
              </Item>
            </Toolbar>

            <Column dataField="itemCode" caption={t('standardCosts.columns.itemCode')} width={120} />
            <Column dataField="itemName" caption={t('standardCosts.columns.itemName')} minWidth={160} />
            <Column dataField="effectiveDate" caption={t('standardCosts.columns.effectiveDate')} dataType="date" width={120} />
            <Column
              dataField="materialCost"
              caption={t('standardCosts.columns.materialCost')}
              dataType="number"
              format="#,##0.00"
              width={100}
            />
            <Column
              dataField="laborCost"
              caption={t('standardCosts.columns.laborCost')}
              dataType="number"
              format="#,##0.00"
              width={100}
            />
            <Column
              dataField="overheadCost"
              caption={t('standardCosts.columns.overheadCost')}
              dataType="number"
              format="#,##0.00"
              width={100}
            />
            <Column
              dataField="totalCost"
              caption={t('standardCosts.columns.totalCost')}
              dataType="number"
              format="#,##0.00"
              width={120}
            />
            <Column
              dataField="isCurrent"
              caption={t('standardCosts.columns.status')}
              width={100}
              cellRender={renderCurrentBadge}
            />
          </DataGrid>
        </div>

        {/* Create Dialog */}
        <Popup
          visible={showCreateDialog}
          onHiding={() => setShowCreateDialog(false)}
          title={t('standardCosts.dialog.createTitle')}
          width={500}
          // height="auto" let the popup grow taller than the viewport when the
          // form was long, pushing the Save button off-screen with no way to
          // scroll to it. Cap the height and scroll the body instead so Save is
          // always reachable.
          height="auto"
          maxHeight="90vh"
          showCloseButton={true}
        >
          <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
            <Form
              formData={formData}
              onFieldDataChanged={(e) =>
                setFormData((prev) => ({ ...prev, [e.dataField as string]: e.value }))
              }
            >
              <GroupItem caption={t('standardCosts.dialog.itemInfo')}>
                <SimpleItem
                  dataField="itemId"
                  editorType="dxSelectBox"
                  editorOptions={{
                    items,
                    displayExpr: (item: any) => (item ? `${item.code} - ${item.name}` : ''),
                    valueExpr: 'id',
                    searchEnabled: true,
                    placeholder: t('standardCosts.dialog.selectItem'),
                  }}
                >
                  <RequiredRule message={t('standardCosts.validation.selectItem')} />
                </SimpleItem>
                <SimpleItem
                  dataField="effectiveDate"
                  editorType="dxDateBox"
                  editorOptions={{
                    displayFormat: 'yyyy-MM-dd',
                  }}
                >
                  <RequiredRule message={t('standardCosts.validation.effectiveDate')} />
                </SimpleItem>
              </GroupItem>

              <GroupItem caption={t('standardCosts.dialog.costGroup')}>
                <SimpleItem
                  dataField="materialCost"
                  editorType="dxNumberBox"
                  editorOptions={{ format: '#,##0.00', min: 0 }}
                />
                <SimpleItem
                  dataField="laborCost"
                  editorType="dxNumberBox"
                  editorOptions={{ format: '#,##0.00', min: 0 }}
                />
                <SimpleItem
                  dataField="overheadCost"
                  editorType="dxNumberBox"
                  editorOptions={{ format: '#,##0.00', min: 0 }}
                />
              </GroupItem>

              <GroupItem caption={t('standardCosts.dialog.laborStandardGroup')}>
                <SimpleItem
                  dataField="standardHours"
                  editorType="dxNumberBox"
                  editorOptions={{ format: '#,##0.00', min: 0 }}
                />
                <SimpleItem
                  dataField="standardLaborRate"
                  editorType="dxNumberBox"
                  editorOptions={{ format: '#,##0.00', min: 0 }}
                />
              </GroupItem>

              <SimpleItem dataField="notes" editorType="dxTextArea" editorOptions={{ height: 80 }} />
              <SimpleItem dataField="setAsCurrent" editorType="dxCheckBox" />
            </Form>

            <div className="flex justify-end gap-2 mt-4">
              <Button text={t('common.cancel')} onClick={() => setShowCreateDialog(false)} />
              <Button
                text={submitting ? t('common.saving') : t('common.save')}
                type="success"
                stylingMode="contained"
                onClick={handleCreate}
                disabled={submitting}
                data-testid="save-cost-btn"
              />
            </div>
          </div>
        </Popup>
      </div>
  );
}
