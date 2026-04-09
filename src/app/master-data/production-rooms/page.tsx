'use client';

/**
 * Production Rooms Master Data Page
 * Manages production rooms/areas for GMP compliance.
 * Includes Excel template download and import functionality.
 */

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { useToast } from '@/hooks/use-toast';
import { Building2, Eye, Edit, Trash2, Download, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ProductionRoom {
  id: number;
  code: string;
  name: string;
  nameTh: string;
  roomType: string;
  description?: string;
  isActive: boolean;
}

const roomTypes = [
  { value: 'weighing', label: 'Weighing Room' },
  { value: 'mixing', label: 'Mixing Room' },
  { value: 'packaging', label: 'Packaging Room' },
  { value: 'storage', label: 'Storage Area' },
  { value: 'preparation', label: 'Preparation Room' },
  { value: 'production', label: 'Production Room' },
];

const VALID_ROOM_TYPES = roomTypes.map(r => r.value);

export default function ProductionRoomsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch rooms
  const { data: rooms, isLoading } = useQuery<ProductionRoom[]>({
    queryKey: ['production-rooms'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/production-rooms');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/master-data/production-rooms?id=${id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-rooms'] });
      toast.success('Room Deactivated', 'The room has been deactivated.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (rows: Omit<ProductionRoom, 'id' | 'isActive'>[]) => {
      const results = { success: 0, errors: [] as string[] };
      for (const row of rows) {
        try {
          const res = await fetch('/api/master-data/production-rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...row, isActive: true }),
          });
          const result = await res.json();
          if (!result.success) {
            results.errors.push(`${row.code}: ${result.error}`);
          } else {
            results.success++;
          }
        } catch (err) {
          results.errors.push(`${row.code}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['production-rooms'] });
      if (results.success > 0) {
        toast.success('นำเข้าสำเร็จ', `นำเข้า ${results.success} รายการสำเร็จ`);
      }
      if (results.errors.length > 0) {
        toast.error('บางรายการมีปัญหา', results.errors.slice(0, 3).join('\n') +
          (results.errors.length > 3 ? `\n...และอีก ${results.errors.length - 3} รายการ` : ''));
      }
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleCreate = () => {
    router.push('/master-data/production-rooms/new');
  };

  const handleEdit = (id: number) => {
    router.push(`/master-data/production-rooms/${id}`);
  };

  // Download Excel template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'รหัสห้อง (Code)*': 'ROOM-001',
        'ชื่อห้อง (EN)*': 'Weighing Room 1',
        'ชื่อห้อง (TH)*': 'ห้องชั่งยา 1',
        'ประเภทห้อง (Room Type)*': 'weighing',
        'รายละเอียด (Description)': 'ห้องชั่งวัตถุดิบ ชั้น 2',
      },
      {
        'รหัสห้อง (Code)*': 'ROOM-002',
        'ชื่อห้อง (EN)*': 'Mixing Room A',
        'ชื่อห้อง (TH)*': 'ห้องผสม A',
        'ประเภทห้อง (Room Type)*': 'mixing',
        'รายละเอียด (Description)': '',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // Code
      { wch: 25 }, // Name EN
      { wch: 25 }, // Name TH
      { wch: 25 }, // Room Type
      { wch: 35 }, // Description
    ];

    // Add instruction sheet
    const instructionData = [
      ['คำแนะนำการใช้ Template นำเข้าข้อมูล Production Rooms'],
      [''],
      ['ฟิลด์ที่มีเครื่องหมาย * คือฟิลด์บังคับ (Required)'],
      [''],
      ['คอลัมน์', 'คำอธิบาย', 'ตัวอย่าง'],
      ['รหัสห้อง (Code)*', 'รหัสห้องไม่ซ้ำกัน', 'ROOM-001'],
      ['ชื่อห้อง (EN)*', 'ชื่อภาษาอังกฤษ', 'Weighing Room 1'],
      ['ชื่อห้อง (TH)*', 'ชื่อภาษาไทย', 'ห้องชั่งยา 1'],
      ['ประเภทห้อง (Room Type)*', 'ประเภท (ดูตารางด้านล่าง)', 'weighing'],
      ['รายละเอียด (Description)', 'รายละเอียดเพิ่มเติม (ไม่บังคับ)', 'ห้องชั่งวัตถุดิบ ชั้น 2'],
      [''],
      ['ประเภทห้อง (Room Type) ที่รองรับ:'],
      ['ค่า', 'ความหมาย'],
      ['weighing', 'ห้องชั่งยา (Weighing Room)'],
      ['mixing', 'ห้องผสม (Mixing Room)'],
      ['packaging', 'ห้องบรรจุ (Packaging Room)'],
      ['storage', 'พื้นที่จัดเก็บ (Storage Area)'],
      ['preparation', 'ห้องเตรียม (Preparation Room)'],
      ['production', 'ห้องผลิต (Production Room)'],
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instructionData);
    wsInstr['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 25 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsInstr, 'คำแนะนำ');
    XLSX.utils.book_append_sheet(wb, ws, 'Production Rooms');

    XLSX.writeFile(wb, 'Template_Production_Rooms.xlsx');
    toast.success('ดาวน์โหลดสำเร็จ', 'ดาวน์โหลด Template เรียบร้อย');
  };

  // Handle file import
  const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Find the data sheet (not instruction sheet)
        const sheetName = workbook.SheetNames.find(n => n !== 'คำแนะนำ') || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

        if (jsonData.length === 0) {
          toast.error('ไฟล์ว่าง', 'ไม่พบข้อมูลในไฟล์ Excel');
          return;
        }

        // Map columns to fields
        const rows: Omit<ProductionRoom, 'id' | 'isActive'>[] = [];
        const errors: string[] = [];

        jsonData.forEach((row, index) => {
          const rowNum = index + 2; // Excel row (header=1, data starts at 2)
          const code = (row['รหัสห้อง (Code)*'] || row['Code'] || row['code'] || '').toString().trim();
          const name = (row['ชื่อห้อง (EN)*'] || row['Name'] || row['name'] || '').toString().trim();
          const nameTh = (row['ชื่อห้อง (TH)*'] || row['Name TH'] || row['nameTh'] || '').toString().trim();
          const roomType = (row['ประเภทห้อง (Room Type)*'] || row['Room Type'] || row['roomType'] || '').toString().trim().toLowerCase();
          const description = (row['รายละเอียด (Description)'] || row['Description'] || row['description'] || '').toString().trim();

          // Validate
          if (!code) { errors.push(`แถว ${rowNum}: ไม่มีรหัสห้อง (Code)`); return; }
          if (!name) { errors.push(`แถว ${rowNum}: ไม่มีชื่อห้อง EN`); return; }
          if (!nameTh) { errors.push(`แถว ${rowNum}: ไม่มีชื่อห้อง TH`); return; }
          if (!VALID_ROOM_TYPES.includes(roomType)) {
            errors.push(`แถว ${rowNum}: ประเภทห้อง "${roomType}" ไม่ถูกต้อง (ต้องเป็น: ${VALID_ROOM_TYPES.join(', ')})`);
            return;
          }

          rows.push({ code, name, nameTh, roomType, description: description || undefined });
        });

        if (errors.length > 0) {
          toast.error('พบข้อผิดพลาด', errors.slice(0, 5).join('\n') +
            (errors.length > 5 ? `\n...และอีก ${errors.length - 5} รายการ` : ''));
          if (rows.length === 0) return;
        }

        if (rows.length > 0) {
          if (confirm(`พบข้อมูล ${rows.length} รายการ${errors.length > 0 ? ` (ข้าม ${errors.length} รายการที่ผิดพลาด)` : ''}\nต้องการนำเข้าหรือไม่?`)) {
            importMutation.mutate(rows);
          }
        }
      } catch {
        toast.error('อ่านไฟล์ไม่ได้', 'ไฟล์ Excel ไม่ถูกต้อง กรุณาตรวจสอบรูปแบบไฟล์');
      }
    };
    reader.readAsArrayBuffer(file);

    // Reset input so same file can be selected again
    event.target.value = '';
  };

  const renderRoomTypeBadge = (roomType: string) => {
    const type = roomTypes.find((t) => t.value === roomType);
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <Building2 className="h-3 w-3" />
        {type?.label || roomType}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleImportExcel}
        className="hidden"
      />

      {/* Header */}
      <ResponsivePageHeader
        title="Production Rooms"
        subtitle="Manage production rooms and areas for GMP compliance"
        icon={Building2}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        onBack={() => router.push('/master-data')}
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'Production Rooms' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              Template
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {importMutation.isPending ? 'กำลังนำเข้า...' : 'นำเข้า Excel'}
            </button>
            <DxButton
              text="Add Room"
              icon="plus"
              type="success"
              onClick={handleCreate}
            />
          </div>
        }
      />

      {/* Data Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <DxDataGrid
          dataSource={rooms || []}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height="auto"
          width="100%"
          columnAutoWidth
        >
          <DxSearchPanel visible placeholder="Search rooms..." width={200} />
          <DxPaging defaultPageSize={20} />

          <DxColumn dataField="code" caption="Code" width={120} cellRender={(cell) => (
            <span className="font-mono font-medium text-blue-700">{cell.value}</span>
          )} />
          <DxColumn dataField="name" caption="Name (EN)" minWidth={150} />
          <DxColumn dataField="nameTh" caption="Name (TH)" minWidth={150} />
          <DxColumn dataField="roomType" caption="Type" width={150} cellRender={(cell) => renderRoomTypeBadge(cell.value)} />
          <DxColumn dataField="description" caption="Description" minWidth={200} />
          <DxColumn dataField="isActive" caption="Status" width={100} cellRender={(cell) => (
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {cell.value ? 'Active' : 'Inactive'}
            </span>
          )} />
          <DxColumn caption="Actions" width={120} cellRender={(cell) => (
            <div className="flex gap-1">
              <button
                onClick={() => handleEdit((cell.data as ProductionRoom).id)}
                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="View"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleEdit((cell.data as ProductionRoom).id)}
                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Edit"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => { if (confirm(`ต้องการลบ ${(cell.data as ProductionRoom).name} หรือไม่?`)) deleteMutation.mutate((cell.data as ProductionRoom).id); }}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Deactivate"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )} />
        </DxDataGrid>
      </div>
    </div>
  );
}
