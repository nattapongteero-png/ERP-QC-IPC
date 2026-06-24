'use client';

// Training Course Detail/Edit Page
// Feature: 007-hr-personnel-management - Task 5: Template Pattern Alignment
// + Feature: Document-Training Integration (Reverse Mapping)

import { use } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { TrainingCourseForm } from '@/components/hr/TrainingCourseForm';
import { Card, CardContent } from '@/components/ui/card';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';
import { FileText, ExternalLink } from 'lucide-react';

interface LinkedDocument {
  id: number;
  documentNumber: string;
  title: string;
  typeName: string;
  status: string;
  currentVersion: string | null;
  updatedAt: string;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function CourseDetailPage({ params }: Props) {
  const t = useTranslations('hr');
  const { id } = use(params);
  const courseId = Number(id);

  // Fetch linked GMP documents
  const { data: linkedDocs, isLoading: docsLoading } = useQuery<LinkedDocument[]>({
    queryKey: ['course-linked-documents', courseId],
    queryFn: async () => {
      const res = await fetch(`/api/hr/training/courses/${courseId}/documents`);
      const data = await res.json();
      if (!data.success) return [];
      return data.data || [];
    },
  });

  const getStatusVariant = (status: string): 'primary' | 'secondary' | 'danger' | 'default' => {
    switch (status) {
      case 'active': return 'primary';
      case 'draft': return 'secondary';
      case 'obsolete': return 'danger';
      default: return 'default';
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6" data-title={t('training.courses.actions.viewCourse')}>
      <TrainingCourseForm mode="edit" courseId={courseId} />

      {/* Linked GMP Documents Section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-lg">{t('training.courses.linkedDocs.title')}</h3>
            {linkedDocs && linkedDocs.length > 0 && (
              <Badge variant="secondary" size="sm">{linkedDocs.length}</Badge>
            )}
          </div>

          {docsLoading ? (
            <div className="flex items-center justify-center py-8">
              <DxLoadIndicator />
            </div>
          ) : linkedDocs && linkedDocs.length > 0 ? (
            <div className="divide-y">
              {linkedDocs.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/gmp/documents/${doc.id}`}
                  className="flex items-center justify-between py-3 px-2 hover:bg-gray-50 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 group-hover:text-blue-600">
                        {doc.documentNumber}
                      </p>
                      <p className="text-sm text-gray-500">{doc.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{doc.typeName}</span>
                    {doc.currentVersion && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        v{doc.currentVersion}
                      </span>
                    )}
                    <Badge variant={getStatusVariant(doc.status)} size="sm">
                      {doc.status}
                    </Badge>
                    <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-500" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{t('training.courses.linkedDocs.empty')}</p>
              <p className="text-sm mt-1">{t('training.courses.linkedDocs.emptyHint')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
