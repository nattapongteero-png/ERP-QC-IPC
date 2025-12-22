/**
 * Report Thumbnail Service
 * Handles generation and caching of report template thumbnails
 */

import { getDb, isSqlite } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_HEIGHT = 280;

// Simple in-memory cache for thumbnails
const thumbnailCache = new Map<string, { data: string; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Generate a placeholder thumbnail SVG for a report
 * In production, this would render the actual report to an image
 */
export function generatePlaceholderThumbnail(
  reportName: string,
  reportType: 'table' | 'chart' | 'form' | 'mixed' = 'mixed'
): string {
  const typeIcons: Record<string, string> = {
    table: `
      <rect x="20" y="60" width="160" height="10" rx="2" fill="#E5E7EB"/>
      <rect x="20" y="80" width="160" height="8" rx="2" fill="#F3F4F6"/>
      <rect x="20" y="95" width="160" height="8" rx="2" fill="#F3F4F6"/>
      <rect x="20" y="110" width="160" height="8" rx="2" fill="#F3F4F6"/>
      <rect x="20" y="125" width="160" height="8" rx="2" fill="#F3F4F6"/>
      <rect x="20" y="140" width="160" height="8" rx="2" fill="#F3F4F6"/>
    `,
    chart: `
      <rect x="20" y="60" width="30" height="80" rx="2" fill="#3B82F6"/>
      <rect x="60" y="80" width="30" height="60" rx="2" fill="#60A5FA"/>
      <rect x="100" y="70" width="30" height="70" rx="2" fill="#3B82F6"/>
      <rect x="140" y="100" width="30" height="40" rx="2" fill="#60A5FA"/>
    `,
    form: `
      <rect x="20" y="60" width="60" height="12" rx="2" fill="#E5E7EB"/>
      <rect x="90" y="60" width="90" height="12" rx="2" fill="#F3F4F6"/>
      <rect x="20" y="85" width="60" height="12" rx="2" fill="#E5E7EB"/>
      <rect x="90" y="85" width="90" height="12" rx="2" fill="#F3F4F6"/>
      <rect x="20" y="110" width="60" height="12" rx="2" fill="#E5E7EB"/>
      <rect x="90" y="110" width="90" height="12" rx="2" fill="#F3F4F6"/>
    `,
    mixed: `
      <rect x="20" y="60" width="160" height="10" rx="2" fill="#E5E7EB"/>
      <rect x="20" y="80" width="70" height="50" rx="2" fill="#DBEAFE"/>
      <rect x="100" y="80" width="80" height="8" rx="2" fill="#F3F4F6"/>
      <rect x="100" y="95" width="80" height="8" rx="2" fill="#F3F4F6"/>
      <rect x="100" y="110" width="80" height="8" rx="2" fill="#F3F4F6"/>
    `,
  };

  // Truncate name if too long
  const displayName = reportName.length > 20
    ? reportName.substring(0, 17) + '...'
    : reportName;

  const svg = `
    <svg width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" viewBox="0 0 ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" fill="#FFFFFF" rx="8"/>

      <!-- Border -->
      <rect x="1" y="1" width="${THUMBNAIL_WIDTH - 2}" height="${THUMBNAIL_HEIGHT - 2}" fill="none" stroke="#E5E7EB" stroke-width="1" rx="7"/>

      <!-- Header -->
      <rect x="10" y="10" width="${THUMBNAIL_WIDTH - 20}" height="35" fill="#F9FAFB" rx="4"/>
      <text x="${THUMBNAIL_WIDTH / 2}" y="32" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#374151">${displayName}</text>

      <!-- Content Area -->
      ${typeIcons[reportType]}

      <!-- Footer -->
      <rect x="10" y="${THUMBNAIL_HEIGHT - 45}" width="${THUMBNAIL_WIDTH - 20}" height="35" fill="#F9FAFB" rx="4"/>
      <text x="${THUMBNAIL_WIDTH / 2}" y="${THUMBNAIL_HEIGHT - 22}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" fill="#6B7280">Report Template</text>
    </svg>
  `;

  // Convert to base64 data URL
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Detect report type from definition (simplified)
 */
export function detectReportType(definition?: string): 'table' | 'chart' | 'form' | 'mixed' {
  if (!definition) return 'mixed';

  const lowerDef = definition.toLowerCase();

  if (lowerDef.includes('xrchart') || lowerDef.includes('chart')) {
    return 'chart';
  }
  if (lowerDef.includes('xrtable') || lowerDef.includes('table')) {
    return 'table';
  }
  if (lowerDef.includes('xrlabel') && !lowerDef.includes('xrtable')) {
    return 'form';
  }

  return 'mixed';
}

/**
 * Get thumbnail for a report template (with caching)
 */
export async function getReportThumbnail(
  templateCode: string,
  forceRegenerate = false
): Promise<string | null> {
  // Check memory cache first
  if (!forceRegenerate) {
    const cached = thumbnailCache.get(templateCode);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  try {
    const db = await getDb();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const usingSqlite = isSqlite();

    const templatesTable = usingSqlite
      ? schema.sqliteReportTemplates
      : schema.mysqlReportTemplates;

    // Get template
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const templates = await (db as any)
      .select({
        name: templatesTable.name,
        thumbnail: templatesTable.thumbnail,
        definition: templatesTable.definition,
      })
      .from(templatesTable)
      .where(eq(templatesTable.code, templateCode))
      .limit(1);

    if (templates.length === 0) {
      return null;
    }

    const template = templates[0];

    // If template has stored thumbnail, use it
    if (template.thumbnail && !forceRegenerate) {
      thumbnailCache.set(templateCode, {
        data: template.thumbnail,
        timestamp: Date.now(),
      });
      return template.thumbnail;
    }

    // Generate placeholder thumbnail
    const reportType = detectReportType(template.definition);
    const thumbnail = generatePlaceholderThumbnail(template.name, reportType);

    // Cache in memory
    thumbnailCache.set(templateCode, {
      data: thumbnail,
      timestamp: Date.now(),
    });

    return thumbnail;
  } catch (error) {
    console.error('Failed to get report thumbnail:', error);
    return null;
  }
}

/**
 * Update stored thumbnail for a template
 */
export async function updateReportThumbnail(
  templateCode: string,
  thumbnailData: string
): Promise<boolean> {
  try {
    const db = await getDb();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const usingSqlite = isSqlite();

    const templatesTable = usingSqlite
      ? schema.sqliteReportTemplates
      : schema.mysqlReportTemplates;

    // Update template
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .update(templatesTable)
      .set({
        thumbnail: thumbnailData,
        updatedAt: new Date(),
      })
      .where(eq(templatesTable.code, templateCode));

    // Update cache
    thumbnailCache.set(templateCode, {
      data: thumbnailData,
      timestamp: Date.now(),
    });

    return true;
  } catch (error) {
    console.error('Failed to update report thumbnail:', error);
    return false;
  }
}

/**
 * Generate thumbnails for all templates missing them
 */
export async function generateMissingThumbnails(): Promise<number> {
  try {
    const db = await getDb();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const usingSqlite = isSqlite();

    const templatesTable = usingSqlite
      ? schema.sqliteReportTemplates
      : schema.mysqlReportTemplates;

    // Get all templates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const templates = await (db as any)
      .select({
        code: templatesTable.code,
        name: templatesTable.name,
        thumbnail: templatesTable.thumbnail,
        definition: templatesTable.definition,
      })
      .from(templatesTable);

    let generatedCount = 0;

    for (const template of templates) {
      if (!template.thumbnail) {
        const reportType = detectReportType(template.definition);
        const thumbnail = generatePlaceholderThumbnail(template.name, reportType);

        await updateReportThumbnail(template.code, thumbnail);
        generatedCount++;
      }
    }

    return generatedCount;
  } catch (error) {
    console.error('Failed to generate missing thumbnails:', error);
    return 0;
  }
}

/**
 * Clear thumbnail cache
 */
export function clearThumbnailCache(): void {
  thumbnailCache.clear();
}

/**
 * Get cache statistics
 */
export function getThumbnailCacheStats(): { size: number; entries: string[] } {
  return {
    size: thumbnailCache.size,
    entries: Array.from(thumbnailCache.keys()),
  };
}
