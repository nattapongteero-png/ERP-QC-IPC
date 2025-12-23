'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import {
  ArrowLeft,
  Play,
  CheckCircle,
  AlertTriangle,
  Clock,
  User,
  Package,
  FileText,
  ChevronLeft,
  ChevronRight,
  Save,
  UserCheck,
} from 'lucide-react';

interface Parameter {
  name: string;
  label: string;
  type: 'number' | 'text' | 'boolean' | 'select';
  unit?: string;
  min?: number;
  max?: number;
  options?: string[];
  required?: boolean;
}

interface BatchRecordDetail {
  id: number;
  workOrderId: number;
  woNumber: string;
  batchNumber: string;
  woStatus: string;
  productId: number;
  productCode: string;
  productName: string;
  productUnit: string;
  plannedQuantity: number;
  actualQuantity: number;
  operationId: number;
  operationName: string;
  operationDescription: string;
  standardTime: number;
  sequence: number;
  stepName: string;
  instructions: string;
  parameters: Parameter[] | null;
  actualValues: Record<string, any> | null;
  status: string;
  startTime: string;
  endTime: string;
  performedBy: number;
  verifiedBy: number;
  verifiedAt: string;
  performerName: string;
  verifierName: string;
  notes: string;
  attachments: string[] | null;
  createdAt: string;
  updatedAt: string;
  allRecords: {
    id: number;
    sequence: number;
    stepName: string;
    status: string;
    startTime: string;
    endTime: string;
  }[];
  materials: {
    id: number;
    itemId: number;
    itemCode: string;
    itemName: string;
    plannedQuantity: number;
    actualQuantity: number;
    unit: string;
    status: string;
  }[];
}

const booleanOptions = [
  { value: '', label: 'Select...' },
  { value: 'true', label: 'Yes / Pass' },
  { value: 'false', label: 'No / Fail' },
];

export default function BatchRecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [record, setRecord] = useState<BatchRecordDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [actualValues, setActualValues] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');

  const fetchRecord = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/production/batch-records/${id}`);
      const data = await res.json();

      if (data.success) {
        setRecord(data.data);
        setActualValues(data.data.actualValues || {});
        setNotes(data.data.notes || '');
      } else {
        console.error('API error:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch batch record:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchRecord();
    }
  }, [id]);

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const getStatusBadgeVariant = (status: string): 'primary' | 'secondary' | 'warning' | 'danger' | 'default' => {
    switch (status) {
      case 'completed':
        return 'primary';
      case 'in_progress':
        return 'secondary';
      case 'deviation':
        return 'danger';
      case 'pending':
      default:
        return 'default';
    }
  };

  const handleStartStep = async () => {
    if (!record) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/production/batch-records/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'in_progress',
          startTime: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchRecord();
      }
    } catch (error) {
      console.error('Failed to start step:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProgress = async () => {
    if (!record) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/production/batch-records/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualValues,
          notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchRecord();
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteStep = async () => {
    if (!record) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/production/batch-records/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          actualValues,
          notes,
          endTime: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchRecord();
      }
    } catch (error) {
      console.error('Failed to complete step:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyStep = async () => {
    if (!record) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/production/batch-records/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verifiedBy: 1, // Would come from session in real app
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchRecord();
      }
    } catch (error) {
      console.error('Failed to verify step:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const navigateToStep = (stepId: number) => {
    router.push(`/production/batch-records/${stepId}`);
  };

  const getCurrentStepIndex = () => {
    if (!record) return -1;
    return record.allRecords.findIndex((r) => r.id === record.id);
  };

  const getPreviousStep = () => {
    const index = getCurrentStepIndex();
    if (index > 0 && record) {
      return record.allRecords[index - 1];
    }
    return null;
  };

  const getNextStep = () => {
    const index = getCurrentStepIndex();
    if (record && index < record.allRecords.length - 1) {
      return record.allRecords[index + 1];
    }
    return null;
  };

  const handleActualValueChange = (name: string, value: any) => {
    setActualValues((prev) => ({ ...prev, [name]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <DxLoadIndicator />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Batch record not found</h2>
        <p className="text-gray-500 mt-2">The batch record you are looking for does not exist.</p>
        <DxButton
          text="Back to Batch Records"
          type="normal"
          stylingMode="outlined"
          className="mt-4"
          onClick={() => router.push('/production/batch-records')}
        />
      </div>
    );
  }

  const prevStep = getPreviousStep();
  const nextStep = getNextStep();

  return (
    <div className="p-4 md:p-6 space-y-6">
        <PageHeader
          title={`Step ${record.sequence}: ${record.stepName}`}
          description={`${record.woNumber} - ${record.batchNumber}`}
          backButton={
            <DxButton
              text="Back"
              icon="back"
              type="normal"
              stylingMode="text"
              onClick={() => router.push('/production/batch-records')}
            />
          }
          actions={
            <div className="flex items-center gap-2">
              <Badge variant={getStatusBadgeVariant(record.status)} dot size="md">
                {record.status.replace('_', ' ')}
              </Badge>
            </div>
          }
        />

        {/* Step Navigation */}
        <div className="flex items-center justify-between">
          <DxButton
            text="Previous Step"
            icon="chevronleft"
            type="normal"
            stylingMode="outlined"
            disabled={!prevStep}
            onClick={() => prevStep && navigateToStep(prevStep.id)}
          />
          <div className="flex items-center gap-2">
            {record.allRecords.map((step, index) => (
              <button
                key={step.id}
                onClick={() => navigateToStep(step.id)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step.id === record.id
                    ? 'bg-blue-600 text-white'
                    : step.status === 'completed'
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : step.status === 'in_progress'
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <DxButton
            text="Next Step →"
            type="normal"
            stylingMode="outlined"
            disabled={!nextStep}
            onClick={() => nextStep && navigateToStep(nextStep.id)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  {record.instructions ? (
                    <div className="whitespace-pre-wrap text-gray-700">{record.instructions}</div>
                  ) : (
                    <p className="text-gray-500 italic">No specific instructions for this step.</p>
                  )}
                </div>
                {record.operationDescription && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700">Operation: {record.operationName}</p>
                    <p className="text-sm text-gray-500 mt-1">{record.operationDescription}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Parameters Entry */}
            {record.parameters && record.parameters.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Process Parameters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {record.parameters.map((param) => (
                      <div key={param.name} className="grid grid-cols-3 gap-4 items-center">
                        <label className="text-sm font-medium text-gray-700">
                          {param.label}
                          {param.required && <span className="text-red-500 ml-1">*</span>}
                          {param.unit && (
                            <span className="text-gray-400 font-normal ml-1">({param.unit})</span>
                          )}
                        </label>
                        <div className="col-span-2">
                          {param.type === 'number' ? (
                            <DxNumberBox
                              value={actualValues[param.name] || null}
                              onValueChange={(value) => handleActualValueChange(param.name, value)}
                              min={param.min}
                              max={param.max}
                              disabled={record.status === 'completed' || record.status === 'pending'}
                              format="#,##0.###"
                            />
                          ) : param.type === 'boolean' ? (
                            <DxSelectBox
                              items={booleanOptions}
                              value={actualValues[param.name]?.toString() || ''}
                              onValueChange={(value) => handleActualValueChange(param.name, value === 'true')}
                              valueExpr="value"
                              displayExpr="label"
                              disabled={record.status === 'completed' || record.status === 'pending'}
                            />
                          ) : param.type === 'select' ? (
                            <DxSelectBox
                              items={[{ value: '', label: 'Select...' }, ...(param.options?.map(opt => ({ value: opt, label: opt })) || [])]}
                              value={actualValues[param.name] || ''}
                              onValueChange={(value) => handleActualValueChange(param.name, value)}
                              valueExpr="value"
                              displayExpr="label"
                              disabled={record.status === 'completed' || record.status === 'pending'}
                            />
                          ) : (
                            <DxTextBox
                              value={actualValues[param.name] || ''}
                              onValueChange={(value) => handleActualValueChange(param.name, value)}
                              disabled={record.status === 'completed' || record.status === 'pending'}
                            />
                          )}
                          {param.min !== undefined && param.max !== undefined && (
                            <p className="text-xs text-gray-500 mt-1">
                              Acceptable range: {param.min} - {param.max} {param.unit}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Notes & Observations</CardTitle>
              </CardHeader>
              <CardContent>
                <DxTextArea
                  value={notes}
                  onValueChange={setNotes}
                  height={100}
                  placeholder="Enter any observations, deviations, or notes..."
                  disabled={record.status === 'completed' || record.status === 'pending'}
                />
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {record.status === 'pending' && (
                <DxButton
                  text="Start Step"
                  icon="play"
                  type="default"
                  onClick={handleStartStep}
                  disabled={isSaving}
                />
              )}
              {record.status === 'in_progress' && (
                <>
                  <DxButton
                    text="Save Progress"
                    icon="save"
                    type="normal"
                    stylingMode="outlined"
                    onClick={handleSaveProgress}
                    disabled={isSaving}
                  />
                  <DxButton
                    text="Complete Step"
                    icon="check"
                    type="success"
                    onClick={handleCompleteStep}
                    disabled={isSaving}
                  />
                </>
              )}
              {record.status === 'completed' && !record.verifiedBy && (
                <DxButton
                  text="Verify Completion"
                  icon="user"
                  type="default"
                  onClick={handleVerifyStep}
                  disabled={isSaving}
                />
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Work Order Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Work Order Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Work Order</p>
                  <p className="font-medium">{record.woNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Batch Number</p>
                  <p className="font-medium">{record.batchNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Product</p>
                  <p className="font-medium">{record.productCode}</p>
                  <p className="text-sm text-gray-500">{record.productName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Quantity</p>
                  <p className="font-medium">
                    {record.actualQuantity || record.plannedQuantity} {record.productUnit}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Timing */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Standard Time</p>
                  <p className="font-medium">{record.standardTime || '-'} minutes</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Started</p>
                  <p className="font-medium">{formatDateTime(record.startTime)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Completed</p>
                  <p className="font-medium">{formatDateTime(record.endTime)}</p>
                </div>
                {record.startTime && record.endTime && (
                  <div>
                    <p className="text-xs text-gray-500">Duration</p>
                    <p className="font-medium">
                      {Math.round(
                        (new Date(record.endTime).getTime() -
                          new Date(record.startTime).getTime()) /
                          60000
                      )}{' '}
                      minutes
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Personnel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Personnel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Performed By</p>
                  <p className="font-medium">{record.performerName || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Verified By</p>
                  <p className="font-medium">{record.verifierName || '-'}</p>
                  {record.verifiedAt && (
                    <p className="text-xs text-gray-500">at {formatDateTime(record.verifiedAt)}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Materials */}
            {record.materials && record.materials.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Materials
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {record.materials.map((material) => (
                      <div
                        key={material.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div>
                          <p className="font-medium">{material.itemCode}</p>
                          <p className="text-xs text-gray-500">{material.itemName}</p>
                        </div>
                        <div className="text-right">
                          <p>
                            {material.actualQuantity || material.plannedQuantity} {material.unit}
                          </p>
                          <Badge
                            variant={
                              material.status === 'issued'
                                ? 'primary'
                                : material.status === 'consumed'
                                ? 'secondary'
                                : 'default'
                            }
                            size="sm"
                          >
                            {material.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All Steps Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">All Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {record.allRecords.map((step) => (
                    <button
                      key={step.id}
                      onClick={() => navigateToStep(step.id)}
                      className={`w-full text-left p-2 rounded-md transition-colors ${
                        step.id === record.id
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                              step.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : step.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {step.sequence}
                          </span>
                          <span className="text-sm font-medium truncate">{step.stepName}</span>
                        </div>
                        {step.status === 'completed' && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                        {step.status === 'in_progress' && (
                          <Clock className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
