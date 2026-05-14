'use client';

/**
 * New Issue Page
 * Feature: Issue Tracker
 *
 * Page for creating a new issue with AI-assisted validation.
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bug, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { IssueForm } from '@/components/issues';
import { ResponsivePageHeader } from '@/components/shared';
import type { Issue } from '@/types/issues';

// ============================================
// Page Header Component
// ============================================

function NewIssuePageHeader() {
  const router = useRouter();
  const t = useTranslations('issues');
  return (
    <div className="mb-4 md:mb-6">
      <ResponsivePageHeader
        title={t('new.title')}
        subtitle={t('new.subtitle')}
        icon={Bug}
        iconBgColor="bg-rose-100"
        iconColor="text-rose-600"
        onBack={() => router.push('/issues')}
      />
    </div>
  );
}

// ============================================
// Guidelines Card
// ============================================

function GuidelinesCard() {
  const t = useTranslations('issues');
  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
          <AlertCircle className="w-5 h-5" />
          {t('new.guidelines.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-blue-600 space-y-2">
        <p>
          <strong>{t('new.guidelines.clearTitle')}</strong> {t('new.guidelines.clearTitleText')}
        </p>
        <p>
          <strong>{t('new.guidelines.detailedSummary')}</strong> {t('new.guidelines.detailedSummaryText')}
        </p>
        <p>
          <strong>{t('new.guidelines.impactAssessment')}</strong> {t('new.guidelines.impactAssessmentText')}
        </p>
        <p>
          <strong>{t('new.guidelines.forBugs')}</strong> {t('new.guidelines.forBugsText')}
        </p>
        <p className="text-blue-700 font-medium mt-4">
          {t('new.guidelines.aiValidation')}
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================
// Tips Card
// ============================================

function TipsCard() {
  const t = useTranslations('issues');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('new.tips.title')}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-gray-600 space-y-2">
        <ul className="list-disc list-inside space-y-1">
          <li>{t('new.tips.includeErrorMessages')}</li>
          <li>{t('new.tips.attachScreenshots')}</li>
          <li>{t('new.tips.mentionRecentChanges')}</li>
          <li>{t('new.tips.noteReproducible')}</li>
          <li>{t('new.tips.specifyEnvironment')}</li>
        </ul>
      </CardContent>
    </Card>
  );
}

// ============================================
// Category Help Card
// ============================================

function CategoryHelpCard() {
  const t = useTranslations('issues');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('new.categoryHelp.title')}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-gray-600 space-y-2">
        <p>
          <strong>{t('new.categoryHelp.bug')}</strong> {t('new.categoryHelp.bugText')}
        </p>
        <p>
          <strong>{t('new.categoryHelp.featureRequest')}</strong> {t('new.categoryHelp.featureRequestText')}
        </p>
        <p>
          <strong>{t('new.categoryHelp.documentation')}</strong> {t('new.categoryHelp.documentationText')}
        </p>
        <p>
          <strong>{t('new.categoryHelp.support')}</strong> {t('new.categoryHelp.supportText')}
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
          <TipsCard />
          <CategoryHelpCard />
        </div>
      </div>
    </div>
  );
}
