'use client';

/**
 * Complaint Investigation Form Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Form for QC to record investigation findings and route complaints.
 */

import { useState } from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FlaskConical, UserCheck, AlertCircle, CheckCircle } from 'lucide-react';
import type { ComplaintDetails, ComplaintInvestigation } from '@/types/complaints';

// ============================================
// Types
// ============================================

interface ComplaintInvestigationFormProps {
  complaint: ComplaintDetails;
  onInvestigationStarted?: (investigation: ComplaintInvestigation) => void;
  onInvestigationRecorded?: (investigation: ComplaintInvestigation) => void;
}

interface InvestigationFormData {
  batchRecordReview: string;
  retainSampleTest: string;
  rootCause: string;
  conclusion: string;
  recommendation: string;
}

// ============================================
// API Functions
// ============================================

async function fetchQCUsers(): Promise<{ id: number; displayName: string }[]> {
  const response = await fetch('/api/users?role=qc');
  const result = await response.json();
  if (!result.success) return [];
  return result.data || [];
}

async function routeToQC(complaintId: number, investigatorId: number): Promise<ComplaintInvestigation> {
  const response = await fetch(`/api/complaints/${complaintId}/route-to-qc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ investigatorId }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to route complaint');
  }
  return result.data;
}

async function recordInvestigation(
  complaintId: number,
  data: InvestigationFormData
): Promise<ComplaintInvestigation> {
  const response = await fetch(`/api/complaints/${complaintId}/investigation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to record investigation');
  }
  return result.data;
}

// ============================================
// Component
// ============================================

export function ComplaintInvestigationForm({
  complaint,
  onInvestigationStarted,
  onInvestigationRecorded,
}: ComplaintInvestigationFormProps) {
  const [selectedInvestigatorId, setSelectedInvestigatorId] = useState<number | null>(null);
  const [formData, setFormData] = useState<InvestigationFormData>({
    batchRecordReview: complaint.investigation?.batchRecordReview || '',
    retainSampleTest: complaint.investigation?.retainSampleTest || '',
    rootCause: complaint.investigation?.rootCause || '',
    conclusion: complaint.investigation?.conclusion || '',
    recommendation: complaint.investigation?.recommendation || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch QC users
  const { data: qcUsers } = useQuery({
    queryKey: ['qc-users'],
    queryFn: fetchQCUsers,
  });

  // Route to QC mutation
  const routeMutation = useMutation({
    mutationFn: () => routeToQC(complaint.id, selectedInvestigatorId!),
    onSuccess: (data) => {
      onInvestigationStarted?.(data);
    },
    onError: (error) => {
      setErrors({ route: error.message });
    },
  });

  // Record investigation mutation
  const recordMutation = useMutation({
    mutationFn: () => recordInvestigation(complaint.id, formData),
    onSuccess: (data) => {
      onInvestigationRecorded?.(data);
    },
    onError: (error) => {
      setErrors({ record: error.message });
    },
  });

  // Validate investigation form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.rootCause.trim()) {
      newErrors.rootCause = 'Root cause is required';
    }
    if (!formData.conclusion.trim()) {
      newErrors.conclusion = 'Conclusion is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle route to QC
  const handleRouteToQC = () => {
    if (!selectedInvestigatorId) {
      setErrors({ route: 'Please select an investigator' });
      return;
    }
    routeMutation.mutate();
  };

  // Handle record investigation
  const handleRecordInvestigation = () => {
    if (!validate()) return;
    recordMutation.mutate();
  };

  const isRouting = routeMutation.isPending;
  const isRecording = recordMutation.isPending;

  // Show route to QC form if status is 'received'
  if (complaint.status === 'received') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Route to QC</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Assign this complaint to a QC investigator for root cause analysis.
        </p>

        {errors.route && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {errors.route}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Assign Investigator <span className="text-destructive">*</span>
          </label>
          <DxSelectBox
            items={(qcUsers || []).map((u) => ({ value: u.id, label: u.displayName }))}
            value={selectedInvestigatorId}
            valueExpr="value"
            displayExpr="label"
            onValueChange={(value) => setSelectedInvestigatorId(value)}
            placeholder="Select QC investigator"
          />
        </div>

        <DxButton
          text="Route to QC"
          icon="user"
          onClick={handleRouteToQC}
          type="default"
          disabled={isRouting || !selectedInvestigatorId}
        />
      </div>
    );
  }

  // Show investigation form if status is 'under_investigation'
  if (complaint.status === 'under_investigation') {
    const investigation = complaint.investigation;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Investigation</h3>
        </div>

        {investigation && (
          <div className="p-3 bg-muted rounded-lg text-sm">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-4 w-4" />
              <span>Investigator: {investigation.investigatorName || 'Unknown'}</span>
            </div>
            <div className="text-muted-foreground">
              Started: {investigation.startDate}
            </div>
          </div>
        )}

        {errors.record && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {errors.record}
          </div>
        )}

        {/* Batch Record Review */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Batch Record Review</label>
          <DxTextArea
            value={formData.batchRecordReview}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, batchRecordReview: value || '' }))}
            placeholder="Document any findings from batch record review..."
            height={80}
          />
        </div>

        {/* Retain Sample Test */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Retain Sample Test Results</label>
          <DxTextArea
            value={formData.retainSampleTest}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, retainSampleTest: value || '' }))}
            placeholder="Document test results from retained samples..."
            height={80}
          />
        </div>

        {/* Root Cause */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Root Cause <span className="text-destructive">*</span>
          </label>
          <DxTextArea
            value={formData.rootCause}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, rootCause: value || '' }))}
            placeholder="Describe the root cause identified..."
            height={100}
          />
          {errors.rootCause && (
            <p className="text-sm text-destructive">{errors.rootCause}</p>
          )}
        </div>

        {/* Conclusion */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Conclusion <span className="text-destructive">*</span>
          </label>
          <DxTextArea
            value={formData.conclusion}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, conclusion: value || '' }))}
            placeholder="State the investigation conclusion..."
            height={100}
          />
          {errors.conclusion && (
            <p className="text-sm text-destructive">{errors.conclusion}</p>
          )}
        </div>

        {/* Recommendation */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Recommendation</label>
          <DxTextArea
            value={formData.recommendation}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, recommendation: value || '' }))}
            placeholder="Recommend corrective/preventive actions..."
            height={80}
          />
        </div>

        <DxButton
          text="Complete Investigation"
          icon="check"
          onClick={handleRecordInvestigation}
          type="success"
          disabled={isRecording}
        />
      </div>
    );
  }

  // Show completed investigation summary
  if (complaint.investigation) {
    const inv = complaint.investigation;
    const isCompleted = !!inv.completionDate;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-600" />
          )}
          <h3 className="text-lg font-semibold">
            Investigation {isCompleted ? 'Completed' : 'In Progress'}
          </h3>
        </div>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-medium text-muted-foreground">Investigator</p>
              <p>{inv.investigatorName || 'Unknown'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Started</p>
              <p>{inv.startDate}</p>
            </div>
            {inv.completionDate && (
              <div>
                <p className="font-medium text-muted-foreground">Completed</p>
                <p>{inv.completionDate}</p>
              </div>
            )}
          </div>

          {inv.rootCause && (
            <div>
              <p className="font-medium text-muted-foreground">Root Cause</p>
              <p className="whitespace-pre-wrap bg-muted p-2 rounded-md mt-1">{inv.rootCause}</p>
            </div>
          )}

          {inv.conclusion && (
            <div>
              <p className="font-medium text-muted-foreground">Conclusion</p>
              <p className="whitespace-pre-wrap bg-muted p-2 rounded-md mt-1">{inv.conclusion}</p>
            </div>
          )}

          {inv.recommendation && (
            <div>
              <p className="font-medium text-muted-foreground">Recommendation</p>
              <p className="whitespace-pre-wrap bg-muted p-2 rounded-md mt-1">{inv.recommendation}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
