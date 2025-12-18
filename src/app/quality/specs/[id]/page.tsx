'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Table } from '@/components/ui/table';
import {
  ArrowLeft,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  FlaskConical,
  Package,
  Save,
  X,
} from 'lucide-react';

interface QualitySpecDetail {
  id: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  testName: string;
  testMethod: string;
  specification: string;
  minValue: number | null;
  maxValue: number | null;
  unit: string;
  isCritical: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  recentTests: {
    id: number;
    testType: string;
    sampleNumber: string;
    testDate: string;
    result: string;
    numericResult: number | null;
    status: string;
    createdAt: string;
  }[];
  stats: {
    totalTests: number;
    passCount: number;
    failCount: number;
    pendingCount: number;
    retestCount: number;
  };
}

export default function QualitySpecDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [spec, setSpec] = useState<QualitySpecDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [editForm, setEditForm] = useState({
    testName: '',
    testMethod: '',
    specification: '',
    minValue: '' as string | number,
    maxValue: '' as string | number,
    unit: '',
    isCritical: false,
  });

  const fetchSpec = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/quality/specs/${id}`);
      const data = await res.json();

      if (data.success) {
        setSpec(data.data);
        setEditForm({
          testName: data.data.testName || '',
          testMethod: data.data.testMethod || '',
          specification: data.data.specification || '',
          minValue: data.data.minValue ?? '',
          maxValue: data.data.maxValue ?? '',
          unit: data.data.unit || '',
          isCritical: data.data.isCritical || false,
        });
      } else {
        console.error('API error:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch spec:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchSpec();
    }
  }, [id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/quality/specs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          minValue: editForm.minValue !== '' ? Number(editForm.minValue) : null,
          maxValue: editForm.maxValue !== '' ? Number(editForm.maxValue) : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsEditing(false);
        fetchSpec();
      }
      // API errors handled by global error handler
    } catch (error) {
      console.error('Failed to update spec:', error);
      // API errors handled by global error handler
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!spec) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/quality/specs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !spec.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        fetchSpec();
      }
      // API errors handled by global error handler
    } catch (error) {
      console.error('Failed to toggle status:', error);
      // API errors handled by global error handler
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/quality/specs/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        router.push('/quality/specs');
      } else {
        setShowDeleteConfirm(false);
      }
      // API errors handled by global error handler
    } catch (error) {
      console.error('Failed to delete spec:', error);
      // API errors handled by global error handler
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadgeVariant = (status: string): 'success' | 'danger' | 'warning' | 'default' => {
    switch (status) {
      case 'pass':
        return 'success';
      case 'fail':
        return 'danger';
      case 'retest':
        return 'warning';
      default:
        return 'default';
    }
  };

  const testColumns = [
    {
      key: 'testType',
      header: 'Type',
      render: (test: any) => (
        <Badge variant="info" size="sm">
          {test.testType}
        </Badge>
      ),
    },
    {
      key: 'sampleNumber',
      header: 'Sample',
      render: (test: any) => test.sampleNumber || '-',
    },
    {
      key: 'result',
      header: 'Result',
      render: (test: any) => (
        <span className="font-medium">
          {test.numericResult !== null ? test.numericResult : test.result || '-'}
        </span>
      ),
    },
    {
      key: 'testDate',
      header: 'Test Date',
      render: (test: any) => formatDate(test.testDate),
    },
    {
      key: 'status',
      header: 'Status',
      render: (test: any) => (
        <Badge variant={getStatusBadgeVariant(test.status)} dot size="sm">
          {test.status}
        </Badge>
      ),
    },
  ];

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-96 bg-gray-200 rounded animate-pulse" />
        </div>
      </MainLayout>
    );
  }

  if (!spec) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900">Specification not found</h2>
          <p className="text-gray-500 mt-2">The specification you are looking for does not exist.</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => router.push('/quality/specs')}
          >
            Back to Specifications
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title={spec.testName}
          description={`${spec.itemCode} - ${spec.itemName}`}
          backButton={
            <Button variant="ghost" size="sm" onClick={() => router.push('/quality/specs')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          }
          actions={
            <div className="flex items-center gap-2">
              {spec.isCritical && (
                <Badge variant="danger" size="md">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Critical
                </Badge>
              )}
              <Badge variant={spec.isActive ? 'success' : 'default'} dot size="md">
                {spec.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          }
        />

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-800">Delete this specification?</p>
                    <p className="text-sm text-red-600">
                      This action cannot be undone. Specifications with tests cannot be deleted.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isSaving}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-gray-500">Total Tests</p>
              <p className="text-2xl font-bold">{spec.stats.totalTests}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-gray-500">Passed</p>
              <p className="text-2xl font-bold text-green-600">{spec.stats.passCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-gray-500">Failed</p>
              <p className="text-2xl font-bold text-red-600">{spec.stats.failCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-gray-600">{spec.stats.pendingCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-gray-500">Pass Rate</p>
              <p className="text-2xl font-bold text-blue-600">
                {spec.stats.totalTests > 0
                  ? Math.round((spec.stats.passCount / spec.stats.totalTests) * 100)
                  : 0}
                %
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Specification Details */}
            <Card elevation="raised">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Specification Details</CardTitle>
                  {!isEditing ? (
                    <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsEditing(false)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={isSaving}>
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Test Name"
                        value={editForm.testName}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, testName: e.target.value }))
                        }
                      />
                      <Input
                        label="Test Method"
                        value={editForm.testMethod}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, testMethod: e.target.value }))
                        }
                      />
                    </div>
                    <Input
                      label="Specification"
                      value={editForm.specification}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, specification: e.target.value }))
                      }
                      placeholder="e.g., White to off-white powder"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input
                        label="Min Value"
                        type="number"
                        step="any"
                        value={editForm.minValue}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, minValue: e.target.value }))
                        }
                      />
                      <Input
                        label="Max Value"
                        type="number"
                        step="any"
                        value={editForm.maxValue}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, maxValue: e.target.value }))
                        }
                      />
                      <Input
                        label="Unit"
                        value={editForm.unit}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, unit: e.target.value }))
                        }
                        placeholder="e.g., mg, %, pH"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isCritical"
                        checked={editForm.isCritical}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, isCritical: e.target.checked }))
                        }
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="isCritical" className="text-sm font-medium text-gray-700">
                        Critical Test Parameter
                      </label>
                    </div>
                  </div>
                ) : (
                  <dl className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm text-gray-500">Test Name</dt>
                      <dd className="font-medium">{spec.testName}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Test Method</dt>
                      <dd className="font-medium">{spec.testMethod || '-'}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-sm text-gray-500">Specification</dt>
                      <dd className="font-medium">{spec.specification || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Min Value</dt>
                      <dd className="font-medium">
                        {spec.minValue !== null ? `${spec.minValue} ${spec.unit || ''}` : '-'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Max Value</dt>
                      <dd className="font-medium">
                        {spec.maxValue !== null ? `${spec.maxValue} ${spec.unit || ''}` : '-'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Unit</dt>
                      <dd className="font-medium">{spec.unit || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Critical</dt>
                      <dd>
                        <Badge variant={spec.isCritical ? 'danger' : 'default'}>
                          {spec.isCritical ? 'Yes' : 'No'}
                        </Badge>
                      </dd>
                    </div>
                  </dl>
                )}
              </CardContent>
            </Card>

            {/* Recent Tests */}
            <Card elevation="raised">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5" />
                    Recent Tests
                  </CardTitle>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push('/quality/tests/new')}
                  >
                    New Test
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {spec.recentTests.length > 0 ? (
                  <Table
                    columns={testColumns}
                    data={spec.recentTests}
                    keyField="id"
                    striped
                    hoverable
                    onRowClick={(test) => router.push(`/quality/tests/${test.id}`)}
                  />
                ) : (
                  <p className="text-center py-8 text-gray-500">
                    No tests have been performed using this specification yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Item Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Item Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Item Code</p>
                  <p className="font-medium">{spec.itemCode}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Item Name</p>
                  <p className="font-medium">{spec.itemName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Item Type</p>
                  <p className="font-medium capitalize">{spec.itemType}</p>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant={spec.isActive ? 'secondary' : 'primary'}
                  className="w-full"
                  onClick={handleToggleActive}
                  disabled={isSaving}
                >
                  {spec.isActive ? (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Activate
                    </>
                  )}
                </Button>
                <Button
                  variant="danger"
                  className="w-full"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSaving || spec.stats.totalTests > 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
                {spec.stats.totalTests > 0 && (
                  <p className="text-xs text-gray-500 text-center">
                    Cannot delete - has {spec.stats.totalTests} associated tests
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Timestamps */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Created</p>
                  <p className="font-medium">{formatDate(spec.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Updated</p>
                  <p className="font-medium">{formatDate(spec.updatedAt)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
