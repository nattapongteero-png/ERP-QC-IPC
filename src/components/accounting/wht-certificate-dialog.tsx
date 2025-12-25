'use client';

// WHT Certificate Dialog Component
// Feature: 010-accounting-module-integration
// User Story 6: Manage VAT and Withholding Tax

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
  const formTitle = isPND3 ? 'ภ.ง.ด.3 (PND 3)' : 'ภ.ง.ด.53 (PND 53)';

  return (
    <Popup
      visible={visible}
      onHiding={onClose}
      title={`WHT Certificate - ${certificate.certificateNumber}`}
      showCloseButton
      width={800}
      height="auto"
      maxHeight={700}
    >
      <div className="p-4">
        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Loading certificate data...</p>
          </div>
        ) : pdfData ? (
          <div className="space-y-6 print:p-4" id="wht-certificate-content">
            {/* Header */}
            <div className="text-center border-b pb-4">
              <h2 className="text-lg font-bold">หนังสือรับรองการหักภาษี ณ ที่จ่าย</h2>
              <h3 className="text-md">{formTitle}</h3>
              <p className="text-sm text-gray-600">Withholding Tax Certificate</p>
            </div>

            {/* Certificate Number */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                {isPND3 ? (
                  <User className="h-5 w-5 text-blue-600" />
                ) : (
                  <Building2 className="h-5 w-5 text-blue-600" />
                )}
                <span className="font-medium">{isPND3 ? 'Individual' : 'Juristic Person'}</span>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Certificate No.</p>
                <p className="font-bold">{pdfData.certificateNumber}</p>
              </div>
            </div>

            {/* Payer Info (Company) */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-700 mb-2">ผู้จ่ายเงิน / Payer</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Name (TH):</span>
                  <p className="font-medium">{pdfData.companyNameTh}</p>
                </div>
                <div>
                  <span className="text-gray-500">Name (EN):</span>
                  <p className="font-medium">{pdfData.companyName}</p>
                </div>
                <div>
                  <span className="text-gray-500">Tax ID:</span>
                  <p className="font-medium">{pdfData.companyTaxId}</p>
                </div>
                <div>
                  <span className="text-gray-500">Branch:</span>
                  <p className="font-medium">{pdfData.companyBranch === '00000' ? 'Head Office' : pdfData.companyBranch}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Address:</span>
                  <p className="font-medium">{pdfData.companyAddress}</p>
                </div>
              </div>
            </div>

            {/* Payee Info (Vendor) */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-700 mb-2">ผู้รับเงิน / Payee</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Name:</span>
                  <p className="font-medium">{pdfData.vendorName}</p>
                </div>
                <div>
                  <span className="text-gray-500">Tax ID:</span>
                  <p className="font-medium">{pdfData.vendorTaxId || '-'}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Address:</span>
                  <p className="font-medium">{pdfData.vendorAddress || '-'}</p>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">รายการภาษีที่หัก / Tax Withheld Details</h4>
              <table className="w-full border-collapse border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left text-sm">Type</th>
                    <th className="border p-2 text-left text-sm">Description</th>
                    <th className="border p-2 text-right text-sm">Date</th>
                    <th className="border p-2 text-right text-sm">Amount</th>
                    <th className="border p-2 text-right text-sm">Rate</th>
                    <th className="border p-2 text-right text-sm">WHT</th>
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
                    <td colSpan={3} className="border p-2 text-right">Total / รวม</td>
                    <td className="border p-2 text-right">{formatCurrency(pdfData.totalPaymentAmount)}</td>
                    <td className="border p-2"></td>
                    <td className="border p-2 text-right">{formatCurrency(pdfData.totalWHTAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Tax Period */}
            <div className="text-center text-sm text-gray-600">
              <p>งวดภาษี / Tax Period: {pdfData.taxPeriod}</p>
              <p>วันที่จ่ายเงิน / Payment Date: {formatThaiDate(pdfData.paymentDate)}</p>
            </div>

            {/* Signature Area */}
            <div className="grid grid-cols-2 gap-8 pt-6">
              <div className="text-center">
                <div className="h-16 border-b border-gray-300"></div>
                <p className="text-sm mt-2">ผู้มีหน้าที่หักภาษี ณ ที่จ่าย</p>
                <p className="text-xs text-gray-500">Authorized Signatory</p>
              </div>
              <div className="text-center">
                <div className="h-16 border-b border-gray-300"></div>
                <p className="text-sm mt-2">วันที่</p>
                <p className="text-xs text-gray-500">Date</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t print:hidden">
              <Button
                text="Download JSON"
                type="normal"
                stylingMode="outlined"
                icon="download"
                onClick={handleDownloadJSON}
              />
              <Button
                text="Print"
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
            <p className="text-gray-500">Failed to load certificate data</p>
          </div>
        )}
      </div>
    </Popup>
  );
}
