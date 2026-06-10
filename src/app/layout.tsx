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
        {/* Recover from "stale chunk after deploy": a tab left open across a
            new build references old chunk hashes; the next soft navigation
            fails to load them (404). Catch that at the window level (it may
            surface as an unhandled rejection that never reaches the React
            error boundary) and reload ONCE to pick up the current build. */}
        <Script id="chunk-reload-guard" strategy="beforeInteractive">{`
          (function () {
            var KEY = 'chunk-reload-attempted';
            function isChunkError(msg) {
              msg = msg || '';
              return /Loading chunk [\\d]+ failed/i.test(msg)
                || /Loading CSS chunk/i.test(msg)
                || /ChunkLoadError/i.test(msg)
                || /Failed to fetch dynamically imported module/i.test(msg)
                || /error loading dynamically imported module/i.test(msg)
                || /importing a module script failed/i.test(msg);
            }
            function recover(msg) {
              if (!isChunkError(msg)) return false;
              var attempted = false;
              try { attempted = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
              if (attempted) return false;
              try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
              window.location.reload();
              return true;
            }
            window.addEventListener('error', function (e) {
              var m = (e && e.message) || (e && e.error && e.error.message) || '';
              if (recover(m)) { e.preventDefault(); e.stopPropagation(); }
            }, true);
            window.addEventListener('unhandledrejection', function (e) {
              var r = e && e.reason;
              var m = (r && r.message) || (typeof r === 'string' ? r : '') || '';
              if (recover(m)) { e.preventDefault(); }
            });
            // Clear the one-shot guard on a clean full load so the next real
            // deploy can self-heal again.
            window.addEventListener('load', function () {
              try { sessionStorage.removeItem(KEY); } catch (e) {}
            });
          })();
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
