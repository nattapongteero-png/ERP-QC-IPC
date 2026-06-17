'use client';

/**
 * Production Room Form Component
 * Reusable form for creating and editing production rooms
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSwitch } from '@/components/ui/dx-switch';
import { SwitchTypes } from 'devextreme-react/switch';
import { useToast } from '@/hooks/use-toast';
import { Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProductionRoom {
  id: number;
  code: string;
  name: string;
  nameTh: string;
  roomType: string;
  description?: string;
  isActive: boolean;
}

interface ProductionRoomFormProps {
  mode: 'create' | 'edit';
  id?: number;
}

const roomTypes = [
  { value: 'weighing', label: 'ห้องชั่ง' },
  { value: 'mixing', label: 'ห้องผสม' },
  { value: 'packaging', label: 'ห้องบรรจุ' },
  { value: 'storage', label: 'พื้นที่จัดเก็บ' },
  { value: 'preparation', label: 'ห้องเตรียม' },
  { value: 'production', label: 'ห้องผลิต' },
];

export function ProductionRoomForm({ mode, id }: ProductionRoomFormProps) {
  // Fetch existing room for edit mode
  const { data: existingRoom, isLoading: isLoadingRoom } = useQuery<ProductionRoom>({
    queryKey: ['production-room', id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/production-rooms?id=${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    enabled: mode === 'edit' && !!id,
  });

  // Block render until data is loaded — then mount inner form with key to ensure
  // DevExtreme TextBox gets correct initial values (it doesn't re-render from '' → value)
  if (mode === 'edit' && (isLoadingRoom || !existingRoom)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">กำลังโหลด...</div>
      </div>
    );
  }

  const initialData: Partial<ProductionRoom> = existingRoom
    ? {
        code: existingRoom.code || '',
        name: existingRoom.name || '',
        nameTh: existingRoom.nameTh || '',
        roomType: existingRoom.roomType || '',
        description: existingRoom.description || '',
        isActive: existingRoom.isActive ?? true,
      }
    : { code: '', name: '', nameTh: '', roomType: '', description: '', isActive: true };

  return <ProductionRoomFormInner key={id || 'new'} mode={mode} id={id} initialData={initialData} existingRoom={existingRoom} />;
}

function ProductionRoomFormInner({ mode, id, initialData, existingRoom }: ProductionRoomFormProps & { initialData: Partial<ProductionRoom>; existingRoom?: ProductionRoom | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [formData, setFormData] = React.useState<Partial<ProductionRoom>>(initialData);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<ProductionRoom>) => {
      const url = '/api/master-data/production-rooms';
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
      queryClient.invalidateQueries({ queryKey: ['production-rooms'] });
      toast.success(
        mode === 'edit' ? 'อัปเดตห้องแล้ว' : 'สร้างห้องแล้ว',
        `${formData.name} ถูก${mode === 'edit' ? 'อัปเดต' : 'สร้าง'}เรียบร้อยแล้ว`
      );
      router.push('/master-data/production-rooms');
    },
    onError: (error: Error) => {
      toast.error('ผิดพลาด', error.message);
    },
  });

  const handleSave = () => {
    if (!formData.code || !formData.nameTh || !formData.roomType) {
      toast.error('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกข้อมูลที่จำเป็นทั้งหมด');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleCancel = () => {
    router.push('/master-data/production-rooms');
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-4xl mx-auto">
      {/* Header */}
      <ResponsivePageHeader
        title={mode === 'edit' ? 'แก้ไขห้อง' : 'เพิ่มห้องใหม่'}
        subtitle={mode === 'edit' ? `กำลังแก้ไข ${existingRoom?.name || ''}` : 'สร้างห้องผลิตใหม่'}
        icon={Building2}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'ข้อมูลหลัก', href: '/master-data' },
          { label: 'ห้องผลิต', href: '/master-data/production-rooms' },
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
            <Building2 className="h-5 w-5 text-blue-600" />
            ข้อมูลห้อง
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รหัส *</label>
              <DxTextBox
                value={formData.code || ''}
                onValueChanged={(e) => setFormData({ ...formData, code: e.value })}
                placeholder="เช่น ROOM-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทห้อง *</label>
              <DxSelectBox
                dataSource={roomTypes}
                displayExpr="label"
                valueExpr="value"
                value={formData.roomType}
                onValueChanged={(e) => setFormData({ ...formData, roomType: e.value })}
                placeholder="เลือกประเภท"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ (EN)</label>
            <DxTextBox
              value={formData.name || ''}
              onValueChanged={(e) => setFormData({ ...formData, name: e.value })}
              placeholder="ชื่อห้องภาษาอังกฤษ"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ (TH) *</label>
            <DxTextBox
              value={formData.nameTh || ''}
              onValueChanged={(e) => setFormData({ ...formData, nameTh: e.value })}
              placeholder="ชื่อห้องภาษาไทย"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
            <DxTextBox
              value={formData.description || ''}
              onValueChanged={(e) => setFormData({ ...formData, description: e.value })}
              placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
            />
          </div>

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
          text={saveMutation.isPending ? 'กำลังบันทึก...' : (mode === 'edit' ? 'อัปเดตห้อง' : 'สร้างห้อง')}
          type="success"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        />
      </div>
    </div>
  );
}
