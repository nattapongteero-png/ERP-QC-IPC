'use client';

/**
 * Production Equipment Master Data Page
 * Manages production equipment for GMP compliance.
 */

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { useToast } from '@/hooks/use-toast';
import { Wrench, Eye, Edit, Trash2 } from 'lucide-react';

interface ProductionEquipment {
  id: number;
  code: string;
  name: string;
  nameTh: string;
  equipmentType: string;
  capacity?: string;
  roomId?: number;
  roomName?: string;
  room?: { name: string };
  description?: string;
  isActive: boolean;
}

const equipmentTypes = [
  { value: 'scale', label: 'Scale' },
  { value: 'mixer', label: 'Mixer' },
  { value: 'hotplate', label: 'Hotplate' },
  { value: 'container', label: 'Container' },
  { value: 'tool', label: 'Tool' },
  { value: 'filler', label: 'Filler' },
  { value: 'tank', label: 'Tank' },
  { value: 'pump', label: 'Pump' },
  { value: 'other', label: 'Other' },
];

export default function ProductionEquipmentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Fetch equipment
  const { data: equipment, isLoading } = useQuery<ProductionEquipment[]>({
    queryKey: ['production-equipment'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/production-equipment?isActive=true');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/master-data/production-equipment?id=${id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-equipment'] });
      toast.success('Equipment Deactivated', 'The equipment has been deactivated.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleCreate = () => {
    router.push('/master-data/production-equipment/new');
  };

  const handleEdit = (id: number) => {
    router.push(`/master-data/production-equipment/${id}`);
  };

  const renderTypeBadge = (type: string) => {
    const typeInfo = equipmentTypes.find((t) => t.value === type);
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
        <Wrench className="h-3 w-3" />
        {typeInfo?.label || type}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title="Production Equipment"
        subtitle="Manage production equipment for GMP compliance"
        icon={Wrench}
        iconBgColor="bg-purple-100"
        iconColor="text-purple-600"
        onBack={() => router.push('/master-data')}
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'Production Equipment' },
        ]}
        actions={
          <DxButton
            text="Add Equipment"
            icon="plus"
            type="success"
            onClick={handleCreate}
          />
        }
      />

      {/* Data Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <DxDataGrid
          dataSource={equipment || []}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height="auto"
          width="100%"
          columnAutoWidth
        >
          <DxSearchPanel visible placeholder="Search equipment..." width={200} />
          <DxPaging defaultPageSize={20} />

          <DxColumn dataField="code" caption="Code" width={120} cellRender={(cell) => (
            <span className="font-mono font-medium text-purple-700">{cell.value}</span>
          )} />
          <DxColumn dataField="name" caption="Name (EN)" minWidth={150} />
          <DxColumn dataField="nameTh" caption="Name (TH)" minWidth={150} />
          <DxColumn dataField="equipmentType" caption="Type" width={120} cellRender={(cell) => renderTypeBadge(cell.value)} />
          <DxColumn dataField="capacity" caption="Capacity" width={120} />
          <DxColumn caption="Default Room" minWidth={150} cellRender={(cell) => {
            const data = cell.data as ProductionEquipment;
            return data.room?.name || data.roomName || '-';
          }} />
          <DxColumn dataField="isActive" caption="Status" width={100} cellRender={(cell) => (
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {cell.value ? 'Active' : 'Inactive'}
            </span>
          )} />
          <DxColumn caption="Actions" width={120} cellRender={(cell) => (
            <div className="flex gap-1">
              <button
                onClick={() => handleEdit((cell.data as ProductionEquipment).id)}
                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="View"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleEdit((cell.data as ProductionEquipment).id)}
                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Edit"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => deleteMutation.mutate((cell.data as ProductionEquipment).id)}
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
