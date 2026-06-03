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
  FilterRow,
  Toolbar,
  Item,
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

  const fetchItems = useCallback(async () => {
    try {
      const response = await fetch('/api/inventory/items?limit=1000');
      const result = await response.json();
      if (result.success) {
        setItems(result.data);
      }
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
      notify('Please select an item', 'error', 3000);
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
        notify('Standard cost created successfully', 'success', 3000);
        setShowCreateDialog(false);
        setFormData(defaultFormData);
        await fetchCosts();
      } else {
        notify(result.error || 'Failed to create standard cost', 'error', 3000);
      }
    } catch (error) {
      console.error('Error creating standard cost:', error);
      notify('Failed to create standard cost', 'error', 3000);
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
          `Roll-up complete: ${result.data.itemsUpdated} of ${result.data.itemsProcessed} items updated`,
          'success',
          3000
        );
        await fetchCosts();
      } else {
        notify(result.error || 'Roll-up failed', 'error', 3000);
      }
    } catch (error) {
      console.error('Error during roll-up:', error);
      notify('Roll-up failed', 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  const renderCurrentBadge = (cellData: any) => {
    const isCurrent = cellData.value;
    return isCurrent ? (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Current
      </span>
    ) : (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        Historical
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
            {t('page.title')}
          </h1>
          <p className="text-gray-600">
            Manage standard costs for manufacturing variance analysis
          </p>
        </div>

        <div className="bg-white rounded-lg shadow">
          <DataGrid
            dataSource={costs}
            keyExpr="id"
            showBorders={true}
            rowAlternationEnabled={true}
            loadPanel={{ enabled: loading }}
            data-testid="standard-costs-grid"
          >
            <FilterRow visible={true} />
            <Paging defaultPageSize={10} />
            <Toolbar>
              <Item location="before">
                <span className="text-lg font-medium">Standard Costs</span>
              </Item>
              <Item location="after">
                <Button
                  icon="add"
                  text="New Cost"
                  onClick={() => setShowCreateDialog(true)}
                  data-testid="new-cost-btn"
                />
              </Item>
              <Item location="after">
                <Button
                  icon="refresh"
                  text="Roll-up from BOM"
                  onClick={handleRollup}
                  data-testid="rollup-btn"
                />
              </Item>
            </Toolbar>

            <Column dataField="itemCode" caption="Item Code" width={120} />
            <Column dataField="itemName" caption="Item Name" />
            <Column dataField="effectiveDate" caption="Effective Date" dataType="date" width={120} />
            <Column
              dataField="materialCost"
              caption="Material"
              dataType="number"
              format="#,##0.00"
              width={100}
            />
            <Column
              dataField="laborCost"
              caption="Labor"
              dataType="number"
              format="#,##0.00"
              width={100}
            />
            <Column
              dataField="overheadCost"
              caption="Overhead"
              dataType="number"
              format="#,##0.00"
              width={100}
            />
            <Column
              dataField="totalCost"
              caption="Total Cost"
              dataType="number"
              format="#,##0.00"
              width={120}
            />
            <Column
              dataField="isCurrent"
              caption="Status"
              width={100}
              cellRender={renderCurrentBadge}
            />
          </DataGrid>
        </div>

        {/* Create Dialog */}
        <Popup
          visible={showCreateDialog}
          onHiding={() => setShowCreateDialog(false)}
          title="Create Standard Cost"
          width={500}
          height="auto"
          showCloseButton={true}
        >
          <div className="p-4">
            <Form
              formData={formData}
              onFieldDataChanged={(e) =>
                setFormData((prev) => ({ ...prev, [e.dataField as string]: e.value }))
              }
            >
              <GroupItem caption="Item Information">
                <SimpleItem
                  dataField="itemId"
                  editorType="dxSelectBox"
                  editorOptions={{
                    items,
                    displayExpr: (item: any) => (item ? `${item.code} - ${item.name}` : ''),
                    valueExpr: 'id',
                    searchEnabled: true,
                    placeholder: 'Select Item',
                  }}
                >
                  <RequiredRule message="Item is required" />
                </SimpleItem>
                <SimpleItem
                  dataField="effectiveDate"
                  editorType="dxDateBox"
                  editorOptions={{
                    displayFormat: 'yyyy-MM-dd',
                  }}
                >
                  <RequiredRule message="Effective date is required" />
                </SimpleItem>
              </GroupItem>

              <GroupItem caption="Costs">
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

              <GroupItem caption="Labor Standards">
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
              <Button text="Cancel" onClick={() => setShowCreateDialog(false)} />
              <Button
                text={submitting ? 'Saving...' : 'Save'}
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
