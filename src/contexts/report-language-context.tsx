'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

type Language = 'en' | 'th';

interface Translations {
  [key: string]: { en: string; th: string };
}

const translations: Translations = {
  // Report titles
  trialBalance: { en: 'Trial Balance', th: 'งบทดลอง' },
  balanceSheet: { en: 'Balance Sheet', th: 'งบแสดงฐานะการเงิน' },
  incomeStatement: { en: 'Income Statement', th: 'งบกำไรขาดทุน' },
  cashFlowStatement: { en: 'Cash Flow Statement', th: 'งบกระแสเงินสด' },

  // Section headers
  assets: { en: 'Assets', th: 'สินทรัพย์' },
  currentAssets: { en: 'Current Assets', th: 'สินทรัพย์หมุนเวียน' },
  nonCurrentAssets: { en: 'Non-Current Assets', th: 'สินทรัพย์ไม่หมุนเวียน' },
  liabilities: { en: 'Liabilities', th: 'หนี้สิน' },
  currentLiabilities: { en: 'Current Liabilities', th: 'หนี้สินหมุนเวียน' },
  nonCurrentLiabilities: { en: 'Non-Current Liabilities', th: 'หนี้สินไม่หมุนเวียน' },
  equity: { en: 'Equity', th: 'ส่วนของผู้ถือหุ้น' },
  revenue: { en: 'Revenue', th: 'รายได้' },
  costOfGoodsSold: { en: 'Cost of Goods Sold', th: 'ต้นทุนขาย' },
  grossProfit: { en: 'Gross Profit', th: 'กำไรขั้นต้น' },
  operatingExpenses: { en: 'Operating Expenses', th: 'ค่าใช้จ่ายดำเนินงาน' },
  operatingIncome: { en: 'Operating Income', th: 'กำไรจากการดำเนินงาน' },
  netIncome: { en: 'Net Income', th: 'กำไรสุทธิ' },
  operatingActivities: { en: 'Operating Activities', th: 'กิจกรรมดำเนินงาน' },
  investingActivities: { en: 'Investing Activities', th: 'กิจกรรมลงทุน' },
  financingActivities: { en: 'Financing Activities', th: 'กิจกรรมจัดหาเงิน' },

  // Column headers
  accountCode: { en: 'Account Code', th: 'รหัสบัญชี' },
  accountName: { en: 'Account Name', th: 'ชื่อบัญชี' },
  debit: { en: 'Debit', th: 'เดบิต' },
  credit: { en: 'Credit', th: 'เครดิต' },
  openingBalance: { en: 'Opening Balance', th: 'ยอดยกมา' },
  periodActivity: { en: 'Period Activity', th: 'เคลื่อนไหวระหว่างงวด' },
  closingBalance: { en: 'Closing Balance', th: 'ยอดคงเหลือ' },
  amount: { en: 'Amount', th: 'จำนวนเงิน' },
  percentOfRevenue: { en: '% of Revenue', th: '% ของรายได้' },

  // KPI labels
  totalDebits: { en: 'Total Debits', th: 'รวมเดบิต' },
  totalCredits: { en: 'Total Credits', th: 'รวมเครดิต' },
  variance: { en: 'Variance', th: 'ผลต่าง' },
  totalAssets: { en: 'Total Assets', th: 'รวมสินทรัพย์' },
  totalLiabilities: { en: 'Total Liabilities', th: 'รวมหนี้สิน' },
  totalEquity: { en: 'Total Equity', th: 'รวมส่วนของผู้ถือหุ้น' },
  currentRatio: { en: 'Current Ratio', th: 'อัตราส่วนหมุนเวียน' },
  quickRatio: { en: 'Quick Ratio', th: 'อัตราส่วนเงินสด' },
  debtToEquity: { en: 'Debt to Equity', th: 'หนี้สินต่อส่วนของผู้ถือหุ้น' },
  grossMargin: { en: 'Gross Margin', th: 'อัตรากำไรขั้นต้น' },
  operatingMargin: { en: 'Operating Margin', th: 'อัตรากำไรจากการดำเนินงาน' },
  netMargin: { en: 'Net Margin', th: 'อัตรากำไรสุทธิ' },
  operatingCashFlow: { en: 'Operating Cash Flow', th: 'กระแสเงินสดจากการดำเนินงาน' },
  freeCashFlow: { en: 'Free Cash Flow', th: 'กระแสเงินสดอิสระ' },

  // Actions
  export: { en: 'Export', th: 'ส่งออก' },
  print: { en: 'Print', th: 'พิมพ์' },
  refresh: { en: 'Refresh', th: 'รีเฟรช' },
  asOfDate: { en: 'As of Date', th: 'ณ วันที่' },
  periodFrom: { en: 'Period From', th: 'ตั้งแต่วันที่' },
  periodTo: { en: 'Period To', th: 'ถึงวันที่' },

  // Status
  balanced: { en: 'Balanced', th: 'สมดุล' },
  outOfBalance: { en: 'Out of Balance', th: 'ไม่สมดุล' },
  noData: { en: 'No data found for the selected period', th: 'ไม่พบข้อมูลสำหรับงวดที่เลือก' },
};

interface ReportLanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string) => string;
  getAccountName: (nameTh: string, nameEn: string) => string;
}

const ReportLanguageContext = createContext<ReportLanguageContextType | null>(null);

export function ReportLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('reportLanguage') as Language | null;
    if (saved === 'en' || saved === 'th') {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('reportLanguage', lang);
  }, []);

  const t = useCallback((key: string): string => {
    return translations[key]?.[language] || key;
  }, [language]);

  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }, []);

  const formatDate = useCallback((date: string): string => {
    const d = new Date(date);
    return new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  }, [language]);

  const getAccountName = useCallback((nameTh: string, nameEn: string): string => {
    return language === 'th' ? nameTh : nameEn;
  }, [language]);

  return (
    <ReportLanguageContext.Provider value={{ language, setLanguage, t, formatCurrency, formatDate, getAccountName }}>
      {children}
    </ReportLanguageContext.Provider>
  );
}

export function useReportLanguage() {
  const context = useContext(ReportLanguageContext);
  if (!context) {
    throw new Error('useReportLanguage must be used within a ReportLanguageProvider');
  }
  return context;
}
