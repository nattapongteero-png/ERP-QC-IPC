import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Sarabun } from "next/font/google";
import { Providers } from "@/components/providers";
import { ClientErrorReporter } from "@/components/dev/ClientErrorReporter";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { getLocale, getMessages } from "next-intl/server";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fonts used by the IPC criteria prototype-match design.
// Loaded via next/font/google so they're optimized + self-hosted.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Herbal Medicine ERP",
  description: "ERP System for Herbal Medicine Manufacturing",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        {/* Suppress harmless DevExtreme DOM cleanup errors */}
        <Script id="dx-error-filter" strategy="beforeInteractive">{`
          window.addEventListener('error', function(e) {
            var msg = e.message || '';
            if (msg.indexOf('removeChild') !== -1 ||
                msg.indexOf('insertBefore') !== -1 ||
                msg.indexOf('not a child of this node') !== -1) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          }, true);
        `}</Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${sarabun.variable} antialiased bg-white text-gray-900`}
      >
        <I18nProvider locale={locale} messages={messages}>
          <Providers>
            <ClientErrorReporter>{children}</ClientErrorReporter>
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
