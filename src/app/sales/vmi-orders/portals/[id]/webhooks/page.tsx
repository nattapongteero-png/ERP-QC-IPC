'use client';

/**
 * VMI Webhook Management Page
 *
 * Manages webhook configurations for a specific VMI portal.
 * Allows creating, editing, and viewing webhook delivery history.
 *
 * Feature: 012-vmi-webhook
 */

import { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { WebhookConfigForm } from '@/components/vmi/WebhookConfigForm';
import {
  WebhookHealthBadge,
  WebhookHealthCard,
} from '@/components/vmi/WebhookHealthBadge';
import { cn } from '@/lib/utils/cn';
import {
  Webhook,
  Plus,
  ArrowLeft,
  Settings,
  History,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Activity,
  Loader2,
  RefreshCw,
  Trash2,
  Edit,
  Eye,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DataGridTypes } from 'devextreme-react/data-grid';
import type {
  VmiWebhookEventType,
  VmiWebhookCreate,
  VmiWebhookUpdate,
  VmiWebhookHealthStatus,
  VmiWebhookDeliveryStatus,
} from '@/types/vmi';
import { computeWebhookHealthStatus } from '@/types/vmi';

// ============================================================================
// Types
// ============================================================================

interface PageProps {
  params: Promise<{ id: string }>;
}

interface WebhookResponse {
  id: number;
  portalId: number;
  vmiWebhookId: number | null;
  name: string;
  description: string | null;
  url: string;
  events: VmiWebhookEventType[];
  isActive: boolean;
  isDisabledByFailures: boolean;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
}

interface DeliveryResponse {
  id: number;
  deliveryId: string;
  eventType: VmiWebhookEventType;
  eventId: string | null;
  signatureValid: boolean;
  status: VmiWebhookDeliveryStatus;
  responseCode: number | null;
  errorMessage: string | null;
  processingDurationMs: number | null;
  receivedAt: string;
  processedAt: string | null;
}

interface PortalInfo {
  id: number;
  name: string;
  portalUrl: string;
  connectionStatus: 'connected' | 'disconnected' | 'error';
}

type ViewMode = 'list' | 'create' | 'edit' | 'history';

// ============================================================================
// API Functions
// ============================================================================

async function fetchPortal(portalId: number): Promise<PortalInfo> {
  const response = await fetch(`/api/settings/vmi/${portalId}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to load portal');
  }
  return result.data;
}

async function fetchWebhooks(portalId: number): Promise<WebhookResponse[]> {
  const response = await fetch(`/api/sales/vmi-orders/portals/${portalId}/webhooks`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to load webhooks');
  }
  return result.webhooks || [];
}

async function createWebhook(
  portalId: number,
  data: VmiWebhookCreate
): Promise<{ webhook: WebhookResponse; secret: string }> {
  const response = await fetch(`/api/sales/vmi-orders/portals/${portalId}/webhooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message || 'Failed to create webhook');
  }
  return { webhook: result.webhook, secret: result.secret };
}

async function updateWebhook(
  portalId: number,
  webhookId: number,
  data: VmiWebhookUpdate
): Promise<{ webhook: WebhookResponse; newSecret?: string }> {
  const response = await fetch(
    `/api/sales/vmi-orders/portals/${portalId}/webhooks/${webhookId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message || 'Failed to update webhook');
  }
  return { webhook: result.webhook, newSecret: result.secret };
}

async function deleteWebhook(portalId: number, webhookId: number): Promise<void> {
  const response = await fetch(
    `/api/sales/vmi-orders/portals/${portalId}/webhooks/${webhookId}`,
    {
      method: 'DELETE',
    }
  );
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message || 'Failed to delete webhook');
  }
}

async function fetchDeliveries(
  portalId: number,
  webhookId: number
): Promise<{ deliveries: DeliveryResponse[]; total: number }> {
  const response = await fetch(
    `/api/sales/vmi-orders/portals/${portalId}/webhooks/${webhookId}/deliveries?pageSize=50`
  );
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message || 'Failed to load deliveries');
  }
  return {
    deliveries: result.deliveries || [],
    total: result.pagination?.totalItems || 0,
  };
}

// ============================================================================
// Main Component
// ============================================================================

export default function VmiWebhooksPage({ params }: PageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('sales');
  const { id } = use(params);
  const portalId = parseInt(id, 10);

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookResponse | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // Queries
  const {
    data: portal,
    isLoading: isLoadingPortal,
    error: portalError,
  } = useQuery({
    queryKey: ['vmi-portal', portalId],
    queryFn: () => fetchPortal(portalId),
    enabled: !isNaN(portalId) && portalId > 0,
  });

  const {
    data: webhooks = [],
    isLoading: isLoadingWebhooks,
    refetch: refetchWebhooks,
  } = useQuery({
    queryKey: ['vmi-webhooks', portalId],
    queryFn: () => fetchWebhooks(portalId),
    enabled: !isNaN(portalId) && portalId > 0,
  });

  const {
    data: deliveryData,
    isLoading: isLoadingDeliveries,
    refetch: refetchDeliveries,
  } = useQuery({
    queryKey: ['vmi-webhook-deliveries', portalId, selectedWebhook?.id],
    queryFn: () =>
      selectedWebhook ? fetchDeliveries(portalId, selectedWebhook.id) : null,
    enabled: viewMode === 'history' && selectedWebhook !== null,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: VmiWebhookCreate) => createWebhook(portalId, data),
    onSuccess: (result) => {
      setNewSecret(result.secret);
      queryClient.invalidateQueries({ queryKey: ['vmi-webhooks', portalId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { webhookId: number; data: VmiWebhookUpdate }) =>
      updateWebhook(portalId, data.webhookId, data.data),
    onSuccess: (result) => {
      if (result.newSecret) {
        setNewSecret(result.newSecret);
      } else {
        setViewMode('list');
        setSelectedWebhook(null);
      }
      queryClient.invalidateQueries({ queryKey: ['vmi-webhooks', portalId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (webhookId: number) => deleteWebhook(portalId, webhookId),
    onSuccess: () => {
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ['vmi-webhooks', portalId] });
    },
  });

  // Handlers
  const handleCreate = async (data: VmiWebhookCreate | VmiWebhookUpdate) => {
    await createMutation.mutateAsync(data as VmiWebhookCreate);
  };

  const handleUpdate = async (data: VmiWebhookCreate | VmiWebhookUpdate) => {
    if (selectedWebhook) {
      await updateMutation.mutateAsync({
        webhookId: selectedWebhook.id,
        data: data as VmiWebhookUpdate,
      });
    }
  };

  const handleRegenerateSecret = async () => {
    if (selectedWebhook) {
      await updateMutation.mutateAsync({
        webhookId: selectedWebhook.id,
        data: { regenerateSecret: true },
      });
    }
  };

  const handleReEnable = async (webhookId: number) => {
    await updateMutation.mutateAsync({
      webhookId,
      data: { reenableWebhook: true },
    });
  };

  const handleDelete = async (webhookId: number) => {
    await deleteMutation.mutateAsync(webhookId);
  };

  const openEdit = (webhook: WebhookResponse) => {
    setSelectedWebhook(webhook);
    setNewSecret(null);
    setViewMode('edit');
  };

  const openHistory = (webhook: WebhookResponse) => {
    setSelectedWebhook(webhook);
    setViewMode('history');
  };

  const openCreate = () => {
    setSelectedWebhook(null);
    setNewSecret(null);
    setViewMode('create');
  };

  const closeForm = () => {
    setViewMode('list');
    setSelectedWebhook(null);
    setNewSecret(null);
  };

  // Generate webhook URL
  const getWebhookUrl = (webhook?: WebhookResponse | null) => {
    if (typeof window === 'undefined') return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/sales/vmi-orders/webhooks/${portalId}`;
  };

  // Compute webhook stats
  const stats = {
    total: webhooks.length,
    active: webhooks.filter((w) => w.isActive && !w.isDisabledByFailures).length,
    warning: webhooks.filter(
      (w) => w.isActive && !w.isDisabledByFailures && w.consecutiveFailures >= 3
    ).length,
    disabled: webhooks.filter((w) => !w.isActive || w.isDisabledByFailures).length,
  };

  // Cell renderers for DataGrid
  const renderNameCell = (data: { data?: WebhookResponse }) => {
    if (!data.data) return null;
    return (
      <div>
        <p className="font-medium text-gray-900">{data.data.name}</p>
        {data.data.description && (
          <p className="text-xs text-gray-500 truncate">{data.data.description}</p>
        )}
      </div>
    );
  };

  const renderEventsCell = (data: { data?: WebhookResponse }) => {
    if (!data.data) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {data.data.events.map((event) => (
          <span
            key={event}
            className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded"
          >
            {event}
          </span>
        ))}
      </div>
    );
  };

  const renderHealthCell = (data: { data?: WebhookResponse }) => {
    if (!data.data) return null;
    const status = computeWebhookHealthStatus(
      data.data.isActive,
      data.data.isDisabledByFailures,
      data.data.consecutiveFailures
    );
    return (
      <WebhookHealthBadge
        status={status}
        consecutiveFailures={data.data.consecutiveFailures}
      />
    );
  };

  const renderActionsCell = (data: { data?: WebhookResponse }) => {
    if (!data.data) return null;
    const webhook = data.data;
    return (
      <div className="flex items-center gap-1">
        <DxButton
          icon="edit"
          type="normal"
          stylingMode="text"
          hint="แก้ไข"
          onClick={(e) => {
            e.event?.stopPropagation();
            openEdit(webhook);
          }}
        />
        <DxButton
          icon="clock"
          type="normal"
          stylingMode="text"
          hint="ดูประวัติการส่ง"
          onClick={(e) => {
            e.event?.stopPropagation();
            openHistory(webhook);
          }}
        />
        {confirmDelete === webhook.id ? (
          <div className="flex items-center gap-1">
            <DxButton
              icon="check"
              type="danger"
              stylingMode="text"
              hint="ยืนยันการลบ"
              onClick={(e) => {
                e.event?.stopPropagation();
                handleDelete(webhook.id);
              }}
            />
            <DxButton
              icon="close"
              type="normal"
              stylingMode="text"
              hint="ยกเลิก"
              onClick={(e) => {
                e.event?.stopPropagation();
                setConfirmDelete(null);
              }}
            />
          </div>
        ) : (
          <DxButton
            icon="trash"
            type="normal"
            stylingMode="text"
            hint="ลบ"
            onClick={(e) => {
              e.event?.stopPropagation();
              setConfirmDelete(webhook.id);
            }}
          />
        )}
      </div>
    );
  };

  // Delivery grid columns
  const renderDeliveryStatusCell = (data: { data?: DeliveryResponse }) => {
    if (!data.data) return null;
    const status = data.data.status;
    return (
      <Badge
        variant={
          status === 'processed'
            ? 'success'
            : status === 'failed'
              ? 'danger'
              : 'warning'
        }
      >
        {status}
      </Badge>
    );
  };

  const renderDeliveryTimeCell = (data: { data?: DeliveryResponse }) => {
    if (!data.data) return null;
    const date = new Date(data.data.receivedAt);
    return (
      <span className="text-sm">
        {date.toLocaleDateString('th-TH')} {date.toLocaleTimeString('th-TH')}
      </span>
    );
  };

  const deliveryColumns: DxDataGridColumn[] = [
    {
      dataField: 'deliveryId',
      caption: 'รหัสการส่ง',
      width: 280,
    },
    {
      dataField: 'eventType',
      caption: 'เหตุการณ์',
      width: 150,
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 120,
      cellRender: renderDeliveryStatusCell,
    },
    {
      dataField: 'receivedAt',
      caption: 'เวลาที่รับ',
      width: 180,
      cellRender: renderDeliveryTimeCell,
    },
    {
      dataField: 'processingDurationMs',
      caption: 'ระยะเวลา',
      width: 100,
      cellRender: (data: { data?: DeliveryResponse }) =>
        data.data?.processingDurationMs ? `${data.data.processingDurationMs}ms` : '-',
    },
    {
      dataField: 'errorMessage',
      caption: 'ข้อผิดพลาด',
      minWidth: 200,
    },
  ];

  // Loading state
  if (isLoadingPortal) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </MainLayout>
    );
  }

  // Error state
  if (portalError || !portal) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <PageHeader
            title="ไม่พบพอร์ทัล"
            breadcrumb={
              <nav className="flex text-sm text-gray-500">
                <Link href="/sales/vmi-orders" className="hover:text-gray-700">
                  คำสั่งซื้อ VMI
                </Link>
                <span className="mx-2">/</span>
                <span className="text-gray-900">ข้อผิดพลาด</span>
              </nav>
            }
          />
          <Card elevation="raised">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-red-600">
                <XCircle className="h-6 w-6" />
                <span>
                  {portalError instanceof Error
                    ? portalError.message
                    : 'โหลดพอร์ทัลไม่สำเร็จ'}
                </span>
              </div>
              <div className="mt-4">
                <Link href="/settings/vmi">
                  <DxButton text="กลับไปยังการตั้งค่า VMI" icon="arrowleft" type="normal" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Create/Edit Form View
  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <MainLayout>
        <div className="space-y-6 max-w-[1200px] mx-auto">
          <PageHeader
            title={viewMode === 'create' ? 'สร้างเว็บฮุก' : 'แก้ไขเว็บฮุก'}
            breadcrumb={
              <nav className="flex text-sm text-gray-500">
                <Link href="/sales/vmi-orders" className="hover:text-gray-700">
                  คำสั่งซื้อ VMI
                </Link>
                <span className="mx-2">/</span>
                <Link
                  href={`/sales/vmi-orders/portals/${portalId}/webhooks`}
                  className="hover:text-gray-700"
                  onClick={(e) => {
                    e.preventDefault();
                    closeForm();
                  }}
                >
                  เว็บฮุก
                </Link>
                <span className="mx-2">/</span>
                <span className="text-gray-900">
                  {viewMode === 'create' ? 'ใหม่' : selectedWebhook?.name}
                </span>
              </nav>
            }
          />

          <WebhookConfigForm
            portalId={portalId}
            portalName={portal.name}
            mode={viewMode === 'create' ? 'create' : 'edit'}
            webhookUrl={getWebhookUrl(selectedWebhook)}
            initialValues={
              selectedWebhook
                ? {
                    id: selectedWebhook.id,
                    name: selectedWebhook.name,
                    description: selectedWebhook.description,
                    events: selectedWebhook.events,
                    isActive: selectedWebhook.isActive,
                  }
                : undefined
            }
            secret={newSecret || undefined}
            onSubmit={viewMode === 'create' ? handleCreate : handleUpdate}
            onRegenerateSecret={
              viewMode === 'edit' ? handleRegenerateSecret : undefined
            }
            onCancel={closeForm}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            isRegenerating={
              updateMutation.isPending && updateMutation.variables?.data?.regenerateSecret
            }
          />
        </div>
      </MainLayout>
    );
  }

  // Delivery History View
  if (viewMode === 'history' && selectedWebhook) {
    const healthStatus = computeWebhookHealthStatus(
      selectedWebhook.isActive,
      selectedWebhook.isDisabledByFailures,
      selectedWebhook.consecutiveFailures
    );

    return (
      <MainLayout>
        <div className="space-y-6">
          <PageHeader
            title={`ประวัติการส่ง: ${selectedWebhook.name}`}
            description="ดูประวัติการส่งเว็บฮุกและแก้ไขปัญหา"
            breadcrumb={
              <nav className="flex text-sm text-gray-500">
                <Link href="/sales/vmi-orders" className="hover:text-gray-700">
                  คำสั่งซื้อ VMI
                </Link>
                <span className="mx-2">/</span>
                <button
                  onClick={() => setViewMode('list')}
                  className="hover:text-gray-700"
                >
                  เว็บฮุก
                </button>
                <span className="mx-2">/</span>
                <span className="text-gray-900">ประวัติการส่ง</span>
              </nav>
            }
            actions={
              <div className="flex items-center gap-3">
                <DxButton
                  text="รีเฟรช"
                  icon="refresh"
                  type="normal"
                  onClick={() => refetchDeliveries()}
                />
                <DxButton
                  text="กลับ"
                  icon="arrowleft"
                  type="normal"
                  onClick={() => setViewMode('list')}
                />
              </div>
            }
          />

          <div className="grid grid-cols-12 gap-6">
            {/* Health Status */}
            <div className="col-span-4">
              <WebhookHealthCard
                status={healthStatus}
                consecutiveFailures={selectedWebhook.consecutiveFailures}
                lastSuccessAt={selectedWebhook.lastSuccessAt}
                lastFailureAt={selectedWebhook.lastFailureAt}
                lastErrorMessage={selectedWebhook.lastErrorMessage}
                onReEnable={
                  healthStatus === 'disabled_by_failures'
                    ? () => handleReEnable(selectedWebhook.id)
                    : undefined
                }
                isReEnabling={updateMutation.isPending}
              />
            </div>

            {/* Delivery Grid */}
            <div className="col-span-8">
              <Card elevation="raised" className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="h-5 w-5 text-gray-600" />
                      <CardTitle>ประวัติการส่ง</CardTitle>
                    </div>
                    <span className="text-sm text-gray-500">
                      {deliveryData?.total || 0} รายการ
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {isLoadingDeliveries ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    </div>
                  ) : deliveryData?.deliveries.length ? (
                    <DxDataGrid
                      dataSource={deliveryData.deliveries}
                      keyExpr="id"
                      columns={deliveryColumns}
                      showBorders
                      sorting
                      noDataText="ยังไม่มีรายการส่ง"
                    />
                  ) : (
                    <EmptyState
                      icon={<History className="h-8 w-8" />}
                      title="ยังไม่มีรายการส่ง"
                      description="รายการส่งจะแสดงที่นี่เมื่อได้รับเว็บฮุก"
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // List View (default)
  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="จัดการเว็บฮุก"
          description={`จัดการเว็บฮุกสำหรับ ${portal.name}`}
          breadcrumb={
            <nav className="flex text-sm text-gray-500">
              <Link href="/sales/vmi-orders" className="hover:text-gray-700">
                คำสั่งซื้อ VMI
              </Link>
              <span className="mx-2">/</span>
              <Link href="/settings/vmi" className="hover:text-gray-700">
                ตั้งค่าพอร์ทัล
              </Link>
              <span className="mx-2">/</span>
              <span className="text-gray-900">เว็บฮุก</span>
            </nav>
          }
          actions={
            <div className="flex items-center gap-3">
              <DxButton
                text="รีเฟรช"
                icon="refresh"
                type="normal"
                onClick={() => refetchWebhooks()}
              />
              <DxButton
                text="เพิ่มเว็บฮุก"
                icon="plus"
                type="success"
                onClick={openCreate}
                disabled={webhooks.length >= 5}
              />
            </div>
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-100">
                  <Webhook className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  <p className="text-sm text-gray-500">{t('webhooks.totalWebhooks')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-100">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                  <p className="text-sm text-gray-500">ใช้งาน</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-100">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{stats.warning}</p>
                  <p className="text-sm text-gray-500">เตือน</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gray-100">
                  <XCircle className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-600">{stats.disabled}</p>
                  <p className="text-sm text-gray-500">ปิดใช้งาน</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Webhooks List */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-gray-600" />
              <CardTitle>เว็บฮุกที่กำหนดค่าไว้</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoadingWebhooks ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : webhooks.length > 0 ? (
              <DxDataGrid
                dataSource={webhooks}
                keyExpr="id"
                showBorders
                columns={[
                  {
                    dataField: 'name',
                    caption: 'เว็บฮุก',
                    minWidth: 200,
                    cellRender: renderNameCell,
                  },
                  {
                    dataField: 'events',
                    caption: 'เหตุการณ์',
                    minWidth: 280,
                    cellRender: renderEventsCell,
                  },
                  {
                    dataField: 'isActive',
                    caption: 'สถานะสุขภาพ',
                    width: 140,
                    cellRender: renderHealthCell,
                  },
                  {
                    dataField: 'consecutiveFailures',
                    caption: 'ครั้งที่ล้มเหลว',
                    width: 100,
                    alignment: 'center',
                  },
                  {
                    caption: 'การดำเนินการ',
                    width: 160,
                    cellRender: renderActionsCell,
                  },
                ]}
              />
            ) : (
              <EmptyState
                icon={<Webhook className="h-8 w-8" />}
                title="ยังไม่มีเว็บฮุกที่กำหนดค่า"
                description="สร้างเว็บฮุกเพื่อรับการแจ้งเตือนแบบเรียลไทม์จากพอร์ทัล VMI"
                action={{
                  label: 'เพิ่มเว็บฮุก',
                  onClick: openCreate,
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* Webhook URL Info */}
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4">
            <h4 className="font-medium text-blue-900 mb-2">ปลายทางเว็บฮุก</h4>
            <div className="flex items-center gap-2 mb-2">
              <code className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm font-mono overflow-x-auto">
                {getWebhookUrl()}
              </code>
              <DxButton
                icon="copy"
                type="normal"
                stylingMode="outlined"
                hint="คัดลอก URL"
                onClick={() => {
                  navigator.clipboard.writeText(getWebhookUrl());
                }}
              />
            </div>
            <p className="text-sm text-blue-700">
              กำหนดค่า URL นี้ในการตั้งค่าเว็บฮุกของพอร์ทัล VMI เว็บฮุกแต่ละรายการจะใช้
              ปลายทางเดียวกัน แต่ใช้รหัสลับที่แตกต่างกันสำหรับการตรวจสอบ
            </p>
          </CardContent>
        </Card>

        {/* Limit Warning */}
        {webhooks.length >= 5 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="text-sm text-amber-800">
              คุณมีเว็บฮุกครบ 5 รายการต่อพอร์ทัลแล้ว ซึ่งเป็นจำนวนสูงสุด กรุณาลบเว็บฮุก
              ที่มีอยู่เพื่อเพิ่มรายการใหม่
            </span>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
