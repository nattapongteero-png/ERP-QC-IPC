import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Confidentiality Settings | Herbal Medicine ERP',
  description: 'Configure BOM confidentiality bypass roles and access control settings',
};

export default function ConfidentialitySettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
