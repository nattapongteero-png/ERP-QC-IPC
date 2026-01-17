'use client';

/**
 * New Issue Page
 * Feature: Issue Tracker
 *
 * Page for creating a new issue with AI-assisted validation.
 */

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Bug, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { IssueForm } from '@/components/issues';
import type { Issue } from '@/types/issues';

// ============================================
// Page Header Component
// ============================================

function NewIssuePageHeader() {
  return (
    <div className="flex items-center gap-4 mb-6">
      <Link href="/issues" className="p-2 hover:bg-gray-100 rounded-lg">
        <ArrowLeft className="w-5 h-5 text-gray-600" />
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bug className="w-6 h-6" />
          Report New Issue
        </h1>
        <p className="text-gray-600 mt-1">
          Submit a new issue for tracking and resolution
        </p>
      </div>
    </div>
  );
}

// ============================================
// Guidelines Card
// ============================================

function GuidelinesCard() {
  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
          <AlertCircle className="w-5 h-5" />
          Issue Reporting Guidelines
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-blue-600 space-y-2">
        <p>
          <strong>Clear Title:</strong> Use a descriptive title that summarizes the issue.
        </p>
        <p>
          <strong>Detailed Summary:</strong> Explain what happened, when, and where.
        </p>
        <p>
          <strong>Impact Assessment:</strong> Describe who or what is affected.
        </p>
        <p>
          <strong>For Bugs:</strong> Include steps to reproduce, expected vs actual behavior.
        </p>
        <p className="text-blue-700 font-medium mt-4">
          AI validation will check your issue for completeness before submission.
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================
// Main Component
// ============================================

export default function NewIssuePage() {
  const router = useRouter();

  const handleSave = (issue: Issue) => {
    // Navigate to the newly created issue
    router.push(`/issues/${issue.id}`);
  };

  const handleCancel = () => {
    router.push('/issues');
  };

  return (
    <div className="p-6" data-testid="new-issue-page">
      <NewIssuePageHeader />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <IssueForm
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <GuidelinesCard />

          {/* Additional Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tips for Fast Resolution</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2">
              <ul className="list-disc list-inside space-y-1">
                <li>Include error messages or codes</li>
                <li>Attach screenshots when relevant</li>
                <li>Mention any recent changes</li>
                <li>Note if issue is reproducible</li>
                <li>Specify environment details</li>
              </ul>
            </CardContent>
          </Card>

          {/* Category Help */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Choosing a Category</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2">
              <p>
                <strong>Bug:</strong> Something isn&apos;t working as expected
              </p>
              <p>
                <strong>Feature Request:</strong> New functionality suggestion
              </p>
              <p>
                <strong>Documentation:</strong> Docs updates or corrections
              </p>
              <p>
                <strong>Support:</strong> Help with using the system
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
