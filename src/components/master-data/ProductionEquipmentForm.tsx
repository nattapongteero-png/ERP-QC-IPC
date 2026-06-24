'use client';

/**
 * Production Equipment Form Component
 * Reusable form for creating and editing production equipment
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSwitch } from '@/components/ui/dx-switch';
import { DateBox } from 'devextreme-react/date-box';
import { SwitchTypes } from 'devextreme-react/switch';
import { useToast } from '@/hooks/use-toast';
import { Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProductionEquipment {
  id: number;
  code: string;
  name: string;
  nameTh: string;
  equipmentType: string;
  capacity?: string;
  roomId?: number;
  description?: string;
  isActive: boolean;
  // Calibration certificate of the scale itself (shown for equipmentType 'scale').
  calibrationCertNumber?: string | null;
  calibrationDate?: string | null;
  calibrationExpiryDate?: string | null;
}

interface ProductionRoom {
  id: number;
  code: string;
  name: string;
}

interface ProductionEquipmentFormProps {
  mode: 'create' | 'edit';
  id?: number;
}

const equipmentTypes = [
  { value: 'scale', label: 'เครื่องชั่ง' },
  { value: 'mixer', label: 'เครื่องผสม' },
  { value: 'hotplate', label: 'แผ่นทำความร้อน' },
  { value: 'container', label: 'ภาชนะ' },
  { value: 'tool', label: 'เครื่องมือ' },
  { value: 'filler', label: 'เครื่องบรรจุ' },
  { value: 'tank', label: 'ถัง' },
  { value: 'pump', label: 'ปั๊ม' },
  { value: 'other', label: 'อื่นๆ' },
];

export function ProductionEquipmentForm({ mode, id }: ProductionEquipmentFormProps) {
  // Fetch existing equipment for edit mode
  const { data: existingEquipment, isLoading: isLoadingEquipment } = useQuery<ProductionEquipment>({
    queryKey: ['production-equipment', id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/production-equipment?id=${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    enabled: mode === 'edit' && !!id,
  });

  // Block render until data is loaded — then mount inner form with key to ensure
  // DevExtreme TextBox gets correct initial values (it doesn't re-render from '' → value)
  if (mode === 'edit' && (isLoadingEquipment || !existingEquipment)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">กำลังโหลด...</div>
      </div>
    );
  }

  const initialData: Partial<ProductionEquipment> = existingEquipment
    ? {
        code: existingEquipment.code || '',
        name: existingEquipment.name || '',
        nameTh: existingEquipment.nameTh || '',
        equipmentType: existingEquipment.equipmentType || '',
        capacity: existingEquipment.capacity || '',
        roomId: existingEquipment.roomId,
        description: existingEquipment.description || '',
        isActive: existingEquipment.isActive ?? true,
        calibrationCertNumber: existingEquipment.calibrationCertNumber ?? '',
        calibrationDate: existingEquipment.calibrationDate ?? '',
        calibrationExpiryDate: existingEquipment.calibrationExpiryDate ?? '',
      }
    : { code: '', name: '', nameTh: '', equipmentType: '', capacity: '', roomId: undefined, description: '', isActive: true, calibrationCertNumber: '', calibrationDate: '', calibrationExpiryDate: '' };

  return <ProductionEquipmentFormInner key={id || 'new'} mode={mode} id={id} initialData={initialData} existingEquipment={existingEquipment} />;
}

function ProductionEquipmentFormInner({ mode, id, initialData, existingEquipment }: ProductionEquipmentFormProps & { initialData: Partial<ProductionEquipment>; existingEquipment?: ProductionEquipment | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [formData, setFormData] = React.useState<Partial<ProductionEquipment>>(initialData);

  // Fetch rooms for dropdown
  const { data: rooms } = useQuery<ProductionRoom[]>({
    queryKey: ['production-rooms'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/production-rooms');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<ProductionEquipment>) => {
      const url = '/api/master-data/production-equipment';
      const method = mode === 'edit' ? 'PUT' : 'POST';

      const payload = mode === 'edit' ? { ...data, id } : data;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-equipment'] });
      toast.success(
        mode === 'edit' ? 'อัปเดตอุปกรณ์แล้ว' : 'สร้างอุปกรณ์แล้ว',
        `${formData.name} ถูก${mode === 'edit' ? 'อัปเดต' : 'สร้าง'}เรียบร้อยแล้ว`
      );
      router.push('/master-data/production-equipment');
    },
    onError: (error: Error) => {
      toast.error('ผิดพลาด', error.message);
    },
  });

  const handleSave = () => {
    if (!formData.name || !formData.nameTh || !formData.equipmentType) {
      toast.error('ข้อมูลไม่ครบถ้วน', 'กรุณากรอก ชื่อ EN, ชื่อ TH, และประเภทอุปกรณ์');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleCancel = () => {
    router.push('/master-data/production-equipment');
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-4xl mx-auto">
      {/* Header */}
      <ResponsivePageHeader
        title={mode === 'edit' ? 'แก้ไขอุปกรณ์' : 'เพิ่มอุปกรณ์ใหม่'}
        subtitle={mode === 'edit' ? `กำลังแก้ไข ${existingEquipment?.name || ''}` : 'สร้างอุปกรณ์การผลิตใหม่'}
        icon={Wrench}
        iconBgColor="bg-purple-100"
        iconColor="text-purple-600"
        breadcrumbs={[
          { label: 'ข้อมูลหลัก', href: '/master-data' },
          { label: 'อุปกรณ์การผลิต', href: '/master-data/production-equipment' },
          { label: mode === 'edit' ? 'แก้ไข' : 'เพิ่มใหม่' },
        ]}
        actions={
          <div className="flex gap-2">
            <DxButton
              text="ยกเลิก"
              icon="back"
              stylingMode="outlined"
              onClick={handleCancel}
            />
            <DxButton
              text={saveMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              icon="save"
              type="success"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            />
          </div>
        }
      />

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-purple-600" />
            ข้อมูลอุปกรณ์
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รหัส <span className="text-gray-400 font-normal">(สร้างอัตโนมัติ ถ้าไม่กรอก)</span></label>
              <DxTextBox
                value={formData.code || ''}
                onValueChanged={(e) => setFormData({ ...formData, code: e.value })}
                placeholder="EQ-XXXX (auto)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทอุปกรณ์ *</label>
              <DxSelectBox
                dataSource={equipmentTypes}
                displayExpr="label"
                valueExpr="value"
                value={formData.equipmentType}
                onValueChanged={(e) => setFormData({ ...formData, equipmentType: e.value })}
                placeholder="เลือกประเภท"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ (EN) *</label>
            <DxTextBox
              value={formData.name || ''}
              onValueChanged={(e) => setFormData({ ...formData, name: e.value })}
              placeholder="ชื่ออุปกรณ์ภาษาอังกฤษ"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ (TH) *</label>
            <DxTextBox
              value={formData.nameTh || ''}
              onValueChanged={(e) => setFormData({ ...formData, nameTh: e.value })}
              placeholder="ชื่ออุปกรณ์ภาษาไทย"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ความจุ</label>
              <DxTextBox
                value={formData.capacity || ''}
                onValueChanged={(e) => setFormData({ ...formData, capacity: e.value })}
                placeholder="เช่น 200 กก., 50 ลิตร"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ห้องเริ่มต้น</label>
              <DxSelectBox
                dataSource={(rooms || []).map(r => ({ id: r.id, name: r.name }))}
                displayExpr="name"
                valueExpr="id"
                value={formData.roomId}
                onValueChanged={(e) => setFormData({ ...formData, roomId: e.value })}
                placeholder="เลือกห้อง"
                showClearButton
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
            <DxTextBox
              value={formData.description || ''}
              onValueChanged={(e) => setFormData({ ...formData, description: e.value })}
              placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
            />
          </div>

          {/* Calibration certificate — only relevant for scales. The scale (not
              the standard weight) carries its calibration cert. */}
          {formData.equipmentType === 'scale' && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-emerald-900">ใบรับรองการสอบเทียบเครื่องชั่ง (Calibration Certificate)</h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เลขที่ใบรับรอง</label>
                <DxTextBox
                  value={formData.calibrationCertNumber || ''}
                  onValueChanged={(e) => setFormData({ ...formData, calibrationCertNumber: e.value })}
                  placeholder="เช่น CAL-2026-001"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สอบเทียบ</label>
                  <DateBox
                    type="date"
                    displayFormat="dd/MM/yyyy"
                    value={formData.calibrationDate || null}
                    onValueChanged={(e) =>
                      setFormData({ ...formData, calibrationDate: e.value ? new Date(e.value).toISOString().slice(0, 10) : '' })
                    }
                    showClearButton
                    width="100%"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">วันหมดอายุใบรับรอง</label>
                  <DateBox
                    type="date"
                    displayFormat="dd/MM/yyyy"
                    value={formData.calibrationExpiryDate || null}
                    onValueChanged={(e) =>
                      setFormData({ ...formData, calibrationExpiryDate: e.value ? new Date(e.value).toISOString().slice(0, 10) : '' })
                    }
                    showClearButton
                    width="100%"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <DxSwitch
              value={formData.isActive !== false}
              onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setFormData({ ...formData, isActive: e.value })}
            />
            <span className="text-sm text-gray-700">ใช้งาน</span>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <DxButton
          text="ยกเลิก"
          stylingMode="outlined"
          onClick={handleCancel}
        />
        <DxButton
          text={saveMutation.isPending ? 'กำลังบันทึก...' : (mode === 'edit' ? 'อัปเดตอุปกรณ์' : 'สร้างอุปกรณ์')}
          type="success"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        />
      </div>
    </div>
  );
}
