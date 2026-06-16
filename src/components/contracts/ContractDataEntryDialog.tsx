'use client';

/**
 * Contract Data Entry Dialog Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * Reusable dialog for creating/editing manufacturing contracts.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Popup } from 'devextreme-react/popup';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxButton } from '@/components/ui/dx-button';
import { FormSection, FormField } from '@/components/shared';
import type { ManufacturingContract, ContractCreate, ContractorType } from '@/types/contracts';
import { toLocalDateStr } from '@/lib/utils/date-format';

interface ContractDataEntryDialogProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: (contract: ManufacturingContract) => void;
  mode: 'create' | 'edit';
  contract?: ManufacturingContract;
}

const contractorTypes = [
  { value: 'manufacturer', label: 'ผู้ผลิต' },
  { value: 'laboratory', label: 'ห้องปฏิบัติการ' },
  { value: 'both', label: 'ทั้งสองอย่าง' },
];

export function ContractDataEntryDialog({
  visible,
  onClose,
  onSaved,
  mode,
  contract,
}: ContractDataEntryDialogProps) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<ContractCreate>({
    contractorName: contract?.contractorName || '',
    contractorType: contract?.contractorType || 'manufacturer',
    scope: contract?.scope || '',
    effectiveDate: contract?.effectiveDate || '',
    expirationDate: contract?.expirationDate || '',
    contactPerson: contract?.contactPerson || '',
    contactEmail: contract?.contactEmail || '',
    contactPhone: contract?.contactPhone || '',
    notes: contract?.notes || '',
  });

  const createMutation = useMutation({
    mutationFn: async (data: ContractCreate) => {
      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contracts-dashboard'] });
      if (onSaved) onSaved(data);
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ContractCreate) => {
      const response = await fetch(`/api/contracts/${contract?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contracts-dashboard'] });
      if (onSaved) onSaved(data);
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!formData.contractorName.trim()) {
      return;
    }

    if (mode === 'create') {
      createMutation.mutate(formData);
    } else {
      updateMutation.mutate(formData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  return (
    <Popup
      visible={visible}
      onHiding={onClose}
      title={mode === 'create' ? 'สัญญาการผลิตใหม่' : 'แก้ไขสัญญา'}
      width={700}
      height="auto"
      maxHeight="90vh"
      showCloseButton
      dragEnabled={false}
    >
      <div className="p-4 space-y-6 max-h-[80vh] overflow-y-auto">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error.message}
          </div>
        )}

        <FormSection title="ข้อมูลผู้รับจ้าง" columns={2}>
          <FormField label="ชื่อผู้รับจ้าง" required colSpan={2}>
            <DxTextBox
              value={formData.contractorName}
              onValueChanged={(e) =>
                setFormData((prev) => ({ ...prev, contractorName: e.value }))
              }
              placeholder="กรอกชื่อผู้รับจ้าง"
            />
          </FormField>

          <FormField label="ประเภทผู้รับจ้าง" required>
            <DxSelectBox
              dataSource={contractorTypes}
              displayExpr="label"
              valueExpr="value"
              value={formData.contractorType}
              onValueChanged={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  contractorType: e.value as ContractorType,
                }))
              }
            />
          </FormField>

          <FormField label="ขอบเขตงาน" colSpan={2}>
            <DxTextArea
              value={formData.scope || ''}
              onValueChanged={(e) => setFormData((prev) => ({ ...prev, scope: e.value }))}
              placeholder="อธิบายขอบเขตของสัญญา..."
              height={80}
            />
          </FormField>
        </FormSection>

        <FormSection title="ระยะเวลาสัญญา" columns={2}>
          <FormField label="วันที่มีผล">
            <DxDateBox
              value={formData.effectiveDate || undefined}
              onValueChanged={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  effectiveDate: e.value
                    ? toLocalDateStr(new Date(e.value))
                    : '',
                }))
              }
              type="date"
              displayFormat="yyyy-MM-dd"
            />
          </FormField>

          <FormField label="วันที่สิ้นสุด">
            <DxDateBox
              value={formData.expirationDate || undefined}
              onValueChanged={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  expirationDate: e.value
                    ? toLocalDateStr(new Date(e.value))
                    : '',
                }))
              }
              type="date"
              displayFormat="yyyy-MM-dd"
            />
          </FormField>
        </FormSection>

        <FormSection title="ข้อมูลติดต่อ" columns={2}>
          <FormField label="ผู้ติดต่อ">
            <DxTextBox
              value={formData.contactPerson || ''}
              onValueChanged={(e) =>
                setFormData((prev) => ({ ...prev, contactPerson: e.value }))
              }
              placeholder="ชื่อผู้ติดต่อ"
            />
          </FormField>

          <FormField label="อีเมล">
            <DxTextBox
              value={formData.contactEmail || ''}
              onValueChanged={(e) =>
                setFormData((prev) => ({ ...prev, contactEmail: e.value }))
              }
              placeholder="email@example.com"
              mode="email"
            />
          </FormField>

          <FormField label="เบอร์โทรศัพท์">
            <DxTextBox
              value={formData.contactPhone || ''}
              onValueChanged={(e) =>
                setFormData((prev) => ({ ...prev, contactPhone: e.value }))
              }
              placeholder="+66-xx-xxx-xxxx"
            />
          </FormField>
        </FormSection>

        <FormSection title="ข้อมูลเพิ่มเติม" columns={1}>
          <FormField label="หมายเหตุ">
            <DxTextArea
              value={formData.notes || ''}
              onValueChanged={(e) => setFormData((prev) => ({ ...prev, notes: e.value }))}
              placeholder="หมายเหตุเพิ่มเติม..."
              height={80}
            />
          </FormField>
        </FormSection>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <DxButton text="ยกเลิก" stylingMode="outlined" onClick={onClose} />
          <DxButton
            text={mode === 'create' ? 'สร้างสัญญา' : 'บันทึกการเปลี่ยนแปลง'}
            type="success"
            onClick={handleSubmit}
            disabled={isLoading || !formData.contractorName.trim()}
          />
        </div>
      </div>
    </Popup>
  );
}
