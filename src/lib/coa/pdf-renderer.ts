/**
 * PDF Renderer — Phase 6
 *
 * Renders the CoaDocumentPdf React component to HTML, wraps it in a full HTML
 * document with Sarabun (Thai-capable) fonts, and pipes through Puppeteer to
 * produce a downloadable PDF Buffer.
 *
 * Strategy:
 *   1. ReactDOMServer.renderToString — produces clean HTML from the component.
 *   2. Wrap with <html> + Google Fonts <link> + minimal print CSS.
 *   3. puppeteer-core launches a headless Chromium (provided by
 *      @sparticuz/chromium for serverless / containerized environments).
 *      Falls back to process.env.CHROMIUM_PATH for custom Docker setups.
 *   4. page.setContent(html, { waitUntil: 'networkidle0' }) — waits for the
 *      Google Fonts CSS to load before printing so Thai chars render.
 *   5. page.pdf(...) returns a Buffer.
 *
 * Failure modes:
 *   - If Chromium can't initialize (no executable, missing libs in Alpine),
 *     this throws a `CoaPdfRenderError` with `code: 'CHROMIUM_UNAVAILABLE'`.
 *     Callers (the API route) translate that to HTTP 503 — the user can
 *     still preview in-browser with the CoaPreview component.
 */

import type { CoaDocumentFull } from '@/lib/services/coa.service';
import type { CoaLanguage } from '@/lib/validation/coa';
import * as React from 'react';

export class CoaPdfRenderError extends Error {
  code: 'CHROMIUM_UNAVAILABLE' | 'RENDER_FAILED';
  constructor(message: string, code: 'CHROMIUM_UNAVAILABLE' | 'RENDER_FAILED') {
    super(message);
    this.code = code;
  }
}

export interface RenderCoaPdfOptions {
  watermark?: 'DRAFT' | 'PREVIEW' | null;
  language?: CoaLanguage;
  /** Base URL for QR verify link (e.g. https://erp.example.com). */
  baseUrl?: string;
}

/**
 * Build the full HTML document that wraps the COA component output.
 * Inlines minimal print CSS — we don't load Tailwind on the server because
 * the CoaDocumentPdf uses inline styles only (deliberate, for portability).
 */
function buildHtmlDocument(bodyHtml: string, language: CoaLanguage): string {
  return `<!DOCTYPE html>
<html lang="${language === 'en' ? 'en' : 'th'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Certificate of Analysis</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: "Sarabun", "Noto Sans Thai", "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color: #111827;
    }
    @page { size: A4; margin: 0; }
    @media print {
      .coa-document { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

/**
 * Render the COA React component to a full HTML document — no Puppeteer.
 * Used by both the PDF pipeline AND the in-browser preview iframe (when
 * type=preview has no auth blocking).
 */
export async function renderCoaHtml(
  coa: CoaDocumentFull,
  options: RenderCoaPdfOptions = {},
): Promise<string> {
  // Lazy-import — keeps the bundle slim if the route never gets hit.
  const { renderToString } = await import('react-dom/server');
  const { CoaDocumentPdf } = await import('@/components/coa/CoaDocumentPdf');
  const QRCode = await import('qrcode');

  const language = options.language ?? coa.template?.language ?? 'bilingual';

  // Build verify URL + QR data URL
  const baseUrl =
    options.baseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:33021';
  const verifyUrl = `${baseUrl.replace(/\/$/, '')}/api/coa/verify/${encodeURIComponent(coa.qrCodeToken)}`;

  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: 'M',
      width: 256,
      margin: 1,
    });
  } catch (err) {
    console.error('[coa-pdf] QR generation failed:', err);
    qrDataUrl = '';
  }

  const element = React.createElement(CoaDocumentPdf, {
    coa,
    watermark: options.watermark ?? null,
    language: language as CoaLanguage,
    qrDataUrl,
    verifyUrl,
  });

  const bodyHtml = renderToString(element);
  return buildHtmlDocument(bodyHtml, language as CoaLanguage);
}

/**
 * Render the COA to a PDF Buffer using Puppeteer + headless Chromium.
 *
 * Caller responsibilities:
 *   - Load coa via `getCoaById` first so the snapshot rows are present.
 *   - Set Content-Type: application/pdf on the response.
 */
export async function renderCoaPdf(
  coa: CoaDocumentFull,
  options: RenderCoaPdfOptions = {},
): Promise<Buffer> {
  const html = await renderCoaHtml(coa, options);

  // Lazy-import Puppeteer — large dependency, only needed at PDF time.
  let puppeteer: typeof import('puppeteer-core');
  let chromium: typeof import('@sparticuz/chromium').default;
  try {
    puppeteer = await import('puppeteer-core');
    const chromMod = await import('@sparticuz/chromium');
    chromium = chromMod.default;
  } catch (err) {
    throw new CoaPdfRenderError(
      `Puppeteer / Chromium modules failed to load: ${
        err instanceof Error ? err.message : String(err)
      }`,
      'CHROMIUM_UNAVAILABLE',
    );
  }

  // Resolve executable path — env override > sparticuz bundled.
  let executablePath: string | undefined;
  try {
    executablePath = process.env.CHROMIUM_PATH || (await chromium.executablePath());
  } catch (err) {
    throw new CoaPdfRenderError(
      `Chromium executable not found. Set CHROMIUM_PATH env or install chromium. Underlying: ${
        err instanceof Error ? err.message : String(err)
      }`,
      'CHROMIUM_UNAVAILABLE',
    );
  }
  if (!executablePath) {
    throw new CoaPdfRenderError(
      'Chromium executable not resolved (set CHROMIUM_PATH env var or install chromium).',
      'CHROMIUM_UNAVAILABLE',
    );
  }

  // When running on a system-installed Chromium (CHROMIUM_PATH set in the
  // Dockerfile for Alpine), the @sparticuz/chromium args (designed for AWS
  // Lambda — e.g. --single-process) cause `Target closed` crashes. Use
  // Docker-friendly args in that case; otherwise fall back to sparticuz's.
  const useSystemChromium = !!process.env.CHROMIUM_PATH;
  const launchArgs = useSystemChromium
    ? [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--no-zygote',
        '--font-render-hinting=none',
      ]
    : chromium.args;

  let browser: import('puppeteer-core').Browser | null = null;
  try {
    browser = await puppeteer.launch({
      args: launchArgs,
      defaultViewport: { width: 1240, height: 1754 }, // ~A4 at 150dpi
      executablePath,
      headless: true,
    });
    const page = await browser.newPage();

    // Bypass CSP/cache so Google Fonts always loads
    await page.setBypassCSP(true);

    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `<div style="font-family: 'Sarabun', sans-serif; font-size: 8pt; color: #6b7280; width: 100%; padding: 0 15mm; display: flex; justify-content: space-between;">
        <span>${coa.coaNumber}</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`,
    });

    return Buffer.from(pdf);
  } catch (err) {
    throw new CoaPdfRenderError(
      `PDF render failed: ${err instanceof Error ? err.message : String(err)}`,
      'RENDER_FAILED',
    );
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* swallow — browser may already be closed */
      }
    }
  }
}
