'use client';

// WHT Certificate Dialog Component
// Feature: 010-accounting-module-integration
// User Story 6: Manage VAT and Withholding Tax

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Popup } from 'devextreme-react/popup';
import { Button } from 'devextreme-react/button';
import { FileText, Download, Building2, User } from 'lucide-react';
import type { WHTCertificateEntry, WHTCertificatePDFData } from '@/types/accounting';

interface WHTCertificateDialogProps {
  visible: boolean;
  certificate: WHTCertificateEntry | null;
  onClose: () => void;
}

async function fetchCertificatePDF(certificateId: number): Promise<WHTCertificatePDFData> {
  const res = await fetch(`/api/accounting/reports/wht-certificates/${certificateId}/pdf`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch certificate PDF data');
  }
  const data = await res.json();
  return data.data;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
  }).format(value);
}

function formatThaiDate(dateStr: string): string {
  const date = new Date(dateStr);
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const day = date.getDate();
  const month = thaiMonths[date.getMonth()];
  const buddhistYear = date.getFullYear() + 543;
  return `${day} ${month} ${buddhistYear}`;
}

export function WHTCertificateDialog({ visible, certificate, onClose }: WHTCertificateDialogProps) {
  const t = useTranslations('accounting');
  const { data: pdfData, isLoading } = useQuery({
    queryKey: ['wht-certificate-pdf', certificate?.id],
    queryFn: () => fetchCertificatePDF(certificate!.id),
    enabled: visible && certificate !== null,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJSON = () => {
    if (!pdfData) return;
    const blob = new Blob([JSON.stringify(pdfData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wht-certificate-${certificate?.certificateNumber}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!certificate) return null;

  const isPND3 = certificate.certificateType === 'pnd3';
  const formTitle = isPND3 ? t('reports.wht.dialog.formTitle.pnd3') : t('reports.wht.dialog.formTitle.pnd53');

  return (
    <Popup
      visible={visible}
      onHiding={onClose}
      title={t('reports.wht.dialog.popupTitle', { number: certificate.certificateNumber })}
      showCloseButton
      width={800}
      height="auto"
      maxHeight={700}
    >
      <div className="p-4">
        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">{t('reports.wht.dialog.loading')}</p>
          </div>
        ) : pdfData ? (
          <div className="space-y-6 print:p-4" id="wht-certificate-content">
            {/* Header */}
            <div className="text-center border-b pb-4">
              <h2 className="text-lg font-bold">{t('reports.wht.dialog.headerTh')}</h2>
              <h3 className="text-md">{formTitle}</h3>
              <p className="text-sm text-gray-600">{t('reports.wht.dialog.headerEn')}</p>
            </div>

            {/* Certificate Number */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                {isPND3 ? (
                  <User className="h-5 w-5 text-blue-600" />
                ) : (
                  <Building2 className="h-5 w-5 text-blue-600" />
                )}
                <span className="font-medium">{isPND3 ? t('reports.wht.dialog.individual') : t('reports.wht.dialog.juristic')}</span>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">{t('reports.wht.dialog.certificateNumber')}</p>
                <p className="font-bold">{pdfData.certificateNumber}</p>
              </div>
            </div>

            {/* Payer Info (Company) */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-700 mb-2">{t('reports.wht.dialog.payer')}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">{t('reports.wht.dialog.nameTh')}</span>
                  <p className="font-medium">{pdfData.companyNameTh}</p>
                </div>
                <div>
                  <span className="text-gray-500">{t('reports.wht.dialog.nameEn')}</span>
                  <p className="font-medium">{pdfData.companyName}</p>
                </div>
                <div>
                  <span className="text-gray-500">{t('reports.wht.dialog.taxId')}</span>
                  <p className="font-medium">{pdfData.companyTaxId}</p>
                </div>
                <div>
                  <span className="text-gray-500">{t('reports.wht.dialog.branch')}</span>
                  <p className="font-medium">{pdfData.companyBranch === '00000' ? t('reports.wht.dialog.headOffice') : pdfData.companyBranch}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">{t('reports.wht.dialog.address')}</span>
                  <p className="font-medium">{pdfData.companyAddress}</p>
                </div>
              </div>
            </div>

            {/* Payee Info (Vendor) */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-700 mb-2">{t('reports.wht.dialog.payee')}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">{t('reports.wht.dialog.name')}</span>
                  <p className="font-medium">{pdfData.vendorName}</p>
                </div>
                <div>
                  <span className="text-gray-500">{t('reports.wht.dialog.taxId')}</span>
                  <p className="font-medium">{pdfData.vendorTaxId || '-'}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">{t('reports.wht.dialog.address')}</span>
                  <p className="font-medium">{pdfData.vendorAddress || '-'}</p>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">{t('reports.wht.dialog.taxWithheldDetails')}</h4>
              <table className="w-full border-collapse border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left text-sm">{t('reports.wht.dialog.columns.type')}</th>
                    <th className="border p-2 text-left text-sm">{t('reports.wht.dialog.columns.description')}</th>
                    <th className="border p-2 text-right text-sm">{t('reports.wht.dialog.columns.date')}</th>
                    <th className="border p-2 text-right text-sm">{t('reports.wht.dialog.columns.amount')}</th>
                    <th className="border p-2 text-right text-sm">{t('reports.wht.dialog.columns.rate')}</th>
                    <th className="border p-2 text-right text-sm">{t('reports.wht.dialog.columns.whtAmount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pdfData.items.map((item, index) => (
                    <tr key={index}>
                      <td className="border p-2 text-sm">{item.whtType}</td>
                      <td className="border p-2 text-sm">{item.whtDescription}</td>
                      <td className="border p-2 text-sm text-right">{formatThaiDate(item.paymentDate)}</td>
                      <td className="border p-2 text-sm text-right">{formatCurrency(item.paymentAmount)}</td>
                      <td className="border p-2 text-sm text-right">{item.whtRate}%</td>
                      <td className="border p-2 text-sm text-right">{formatCurrency(item.whtAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={3} className="border p-2 text-right">{t('reports.wht.dialog.total')}</td>
                    <td className="border p-2 text-right">{formatCurrency(pdfData.totalPaymentAmount)}</td>
                    <td className="border p-2"></td>
                    <td className="border p-2 text-right">{formatCurrency(pdfData.totalWHTAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Tax Period */}
            <div className="text-center text-sm text-gray-600">
              <p>{t('reports.wht.dialog.taxPeriod', { value: pdfData.taxPeriod })}</p>
              <p>{t('reports.wht.dialog.paymentDate', { value: formatThaiDate(pdfData.paymentDate) })}</p>
            </div>

            {/* Signature Area */}
            <div className="grid grid-cols-2 gap-8 pt-6">
              <div className="text-center">
                <div className="h-16 border-b border-gray-300"></div>
                <p className="text-sm mt-2">{t('reports.wht.dialog.signatoryTh')}</p>
                <p className="text-xs text-gray-500">{t('reports.wht.dialog.signatoryEn')}</p>
              </div>
              <div className="text-center">
                <div className="h-16 border-b border-gray-300"></div>
                <p className="text-sm mt-2">{t('reports.wht.dialog.dateTh')}</p>
                <p className="text-xs text-gray-500">{t('reports.wht.dialog.dateEn')}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t print:hidden">
              <Button
                text={t('reports.wht.dialog.downloadJson')}
                type="normal"
                stylingMode="outlined"
                icon="download"
                onClick={handleDownloadJSON}
              />
              <Button
                text={t('reports.wht.dialog.print')}
                type="default"
                stylingMode="contained"
                icon="print"
                onClick={handlePrint}
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('reports.wht.dialog.loadError')}</p>
          </div>
        )}
      </div>
    </Popup>
  );
}
