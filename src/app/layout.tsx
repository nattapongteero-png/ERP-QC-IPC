import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { ClientErrorReporter } from "@/components/dev/ClientErrorReporter";
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

export const metadata: Metadata = {
  title: "Herbal Medicine ERP",
  description: "ERP System for Herbal Medicine Manufacturing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <ClientErrorReporter>{children}</ClientErrorReporter>
        </Providers>
      </body>
    </html>
  );
}
