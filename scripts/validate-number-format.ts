#!/usr/bin/env npx tsx
/**
 * Number Formatting Validation Script
 *
 * Guards the bug reported on the eBMR screen (/production/work-orders/34):
 * quantities rendered as "1000" instead of "1,000", and without their unit.
 * Root cause was simply that those JSX sites called NO formatter at all.
 *
 * Two checks, deliberately weighted so this stays a guard people keep enabled:
 *
 *  1. ERROR — a numeric-looking field rendered raw in JSX (no formatter) inside
 *     the modules we've cleaned. This is the actual reported bug. Scoped to
 *     `errorRoots` so it stays at zero and any regression fails the build.
 *
 *  2. WARN — `Number.toLocaleString()` / `Intl.NumberFormat` used for display.
 *     NOT an error: on a full-ICU Node these render "1,234,567" correctly.
 *     But they're locale-dependent (a small-icu build, or an unexpected default
 *     locale, silently changes or drops the separator) and they bypass the
 *     shared helpers, so decimals drift between screens. Prefer
 *     formatNumber/formatMoney/formatBaht from src/lib/utils/number-format.
 *     Date formatting (toLocaleDateString/toLocaleTimeString, and toLocaleString
 *     on a Date) is fine and never flagged.
 *
 * Usage:
 *   bun run scripts/validate-number-format.ts [--verbose] [--strict]
 *
 * Options:
 *   --verbose  List every warning, not just the count.
 *   --strict   Exit non-zero on warnings too (default: only errors fail).
 */

import * as fs from 'fs';
import * as path from 'path';

const VERBOSE = process.argv.includes('--verbose');
const STRICT = process.argv.includes('--strict');

const CONFIG = {
  /**
   * ERROR scope (check 1): raw, unformatted numeric renders fail the build here.
   * These are the modules that have been cleaned and must stay clean.
   * Widen this list as other modules get converted to the shared helpers.
   */
  errorRoots: [
    'src/app/production/work-orders',
    'src/components/production',
  ],
  /** WARN scope (check 2): locale-dependent formatters, repo-wide. */
  warnRoots: ['src/app', 'src/components'],
  formatterModule: 'src/lib/utils/number-format.ts',
  exts: ['.tsx'],
};

type Finding = { file: string; line: number; text: string; why: string };

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(full, out);
    } else if (CONFIG.exts.includes(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

/** True when this `.toLocaleString(` call is on a Date, which is allowed. */
function isDateToLocaleString(line: string): boolean {
  return (
    /new\s+Date\s*\([^)]*\)\s*(?:!|\?)?\s*\.toLocaleString/.test(line) ||
    // a variable that is obviously a date: `testedDate.toLocaleString(...)`
    /\b\w*(?:date|Date|At|time|Time)\w*\s*(?:!|\?)?\.toLocaleString/.test(line)
  );
}

/** Check 1: banned SSR-unsafe numeric formatters. */
function findBannedFormatters(file: string, lines: string[]): Finding[] {
  const found: Finding[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith('*') || line.startsWith('//')) return; // doc comments

    if (/Intl\.NumberFormat/.test(line)) {
      found.push({
        file,
        line: i + 1,
        text: line,
        why: 'Intl.NumberFormat is locale-dependent and bypasses the shared helpers. Prefer formatNumber/formatMoney/formatBaht from @/lib/utils/number-format.',
      });
    }
    if (/\.toLocaleString\s*\(/.test(line) && !isDateToLocaleString(line)) {
      found.push({
        file,
        line: i + 1,
        text: line,
        why: 'Number.toLocaleString() is locale-dependent (a small-icu Node build drops the separator). Prefer formatNumber() from @/lib/utils/number-format.',
      });
    }
  });
  return found;
}

/** Field names that denote a numeric quantity/amount worth formatting. */
const NUMERIC_FIELD =
  /\b\w*(?:qty|Qty|quantity|Quantity|amount|Amount|weight|Weight|price|Price|cost|Cost|total|Total|balance|Balance|subtotal|Subtotal)\b/;

/**
 * Names that are counts/ids/flags/handlers — formatting them is wrong or moot.
 * `total`/`count` progress denominators ("3/12 steps") must NOT get a comma
 * treatment that implies a measured quantity, and event handlers like
 * `handleSubmitWeight` merely *contain* a numeric-looking word.
 */
const EXEMPT =
  /\b(?:id|Id|ID|index|Index|key|Key|length|count|Count|page|Page|step|Step|version|Version|year|Year|total|Total|errors?|Errors?|every|Every|round|Round|rounds|Rounds)\b|^(?:handle|on)[A-Z]|Bytes\b|\w*[Rr]ounds?(?:Total)?\b/;

/** Attribute position (`max={x}`, `value={x}`) — a prop, not rendered text. */
const ATTR_POSITION = /\b[\w-]+=\{$/;

/** Line is a URL / query string / fetch call, not display output. */
const NON_DISPLAY_LINE =
  /fetch\s*\(|`\/api\/|https?:\/\/|\?\w+=|&\w+=|router\.(?:push|replace)|new URLSearchParams/;

/** Check 1: heuristic raw-number render inside JSX. */
function findRawNumberRenders(file: string, lines: string[]): Finding[] {
  const found: Finding[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith('*') || line.startsWith('//')) return;
    if (/formatNumber|formatMoney|formatBaht/.test(line)) return; // already formatted
    if (/<Dx|NumberBox|<Column|dataField|value=\{|defaultValue/.test(line)) return; // editors/grid bindings
    if (NON_DISPLAY_LINE.test(line)) return; // urls / fetches

    // `{something.qtyLike}` or `{qtyLike}` rendered directly in JSX
    const jsxExpr = /\{\s*([A-Za-z_$][\w$.?![\]]*)\s*\}/g;
    let m: RegExpExecArray | null;
    while ((m = jsxExpr.exec(line)) !== null) {
      const expr = m[1];
      if (!NUMERIC_FIELD.test(expr)) continue;
      if (EXEMPT.test(expr)) continue;
      // Skip `foo={expr}` — that's a prop being passed, not text being rendered.
      if (ATTR_POSITION.test(line.slice(0, m.index + 1))) continue;
      found.push({
        file,
        line: i + 1,
        text: line,
        why: `"${expr}" looks numeric but is rendered raw — wrap with formatNumber() and show its unit.`,
      });
    }

    // `.toFixed(n)` used for display is also missing the separator.
    // Ignore unit-conversion arithmetic like `(bytes / 1024).toFixed(1)`.
    if (
      /\.toFixed\s*\(\s*\d+\s*\)/.test(line) &&
      /[{`]/.test(line) &&
      !/\/\s*1024|Bytes/.test(line)
    ) {
      found.push({
        file,
        line: i + 1,
        text: line,
        why: 'toFixed() for display has no thousands separator — use formatNumber(x, n).',
      });
    }
  });
  return found;
}

function relative(p: string): string {
  return p.split(path.sep).join('/');
}

function main(): void {
  if (!fs.existsSync(CONFIG.formatterModule)) {
    console.error(
      `[number-format] FATAL: expected shared formatter at ${CONFIG.formatterModule}`,
    );
    process.exit(1);
  }

  const errorFiles = new Set(CONFIG.errorRoots.flatMap((d) => walk(d)));
  const warnFiles = new Set(CONFIG.warnRoots.flatMap((d) => walk(d)));

  const errors: Finding[] = [];
  const warnings: Finding[] = [];

  // Check 1 (ERROR): raw unformatted numbers in the cleaned modules.
  for (const f of errorFiles) {
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
    errors.push(...findRawNumberRenders(f, lines));
  }
  // Check 2 (WARN): locale-dependent formatters anywhere.
  for (const f of warnFiles) {
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
    warnings.push(...findBannedFormatters(f, lines));
  }

  console.log(
    `[number-format] ${errorFiles.size} file(s) in strict scope, ` +
      `${warnFiles.size} scanned for locale-dependent formatters.`,
  );

  if (errors.length) {
    console.error(
      `\n[number-format] ${errors.length} ERROR(S) — number rendered without formatNumber():\n`,
    );
    for (const e of errors) {
      console.error(`  ${relative(e.file)}:${e.line}`);
      console.error(`    ${e.text.slice(0, 110)}`);
      console.error(`    → ${e.why}\n`);
    }
  }

  if (warnings.length) {
    console.warn(
      `\n[number-format] ${warnings.length} warning(s) — locale-dependent formatter ` +
        `(prefer the shared helpers).`,
    );
    if (VERBOSE) {
      for (const w of warnings) {
        console.warn(`  ${relative(w.file)}:${w.line}`);
        console.warn(`    ${w.text.slice(0, 110)}`);
        console.warn(`    → ${w.why}\n`);
      }
    } else {
      console.warn(`  Re-run with --verbose to list them.`);
    }
  }

  if (errors.length) {
    console.error(
      '[number-format] FAILED — wrap the value with formatNumber() from @/lib/utils/number-format.',
    );
    process.exit(1);
  }
  if (STRICT && warnings.length) {
    console.error('[number-format] FAILED (--strict) — warnings present.');
    process.exit(1);
  }
  console.log('[number-format] OK — eBMR/production numbers are formatted.');
}

main();
