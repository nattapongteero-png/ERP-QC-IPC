#!/usr/bin/env node
/**
 * Done-gate for Claude Code on this repo.
 *
 * Runs as a Stop hook: every time the assistant finishes a turn, this checks
 * the things it kept forgetting on 2026-07-28 and feeds any failures back so
 * they cannot be quietly skipped. The user should not have to be the one who
 * notices that GitHub was 43 commits behind, or that a UI change was never
 * looked at.
 *
 * Exit 0            = nothing to say.
 * Exit 2 + stderr   = blocking reason, shown back to the assistant.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Derive the repo from this file's own location. A hardcoded Windows path with
// a space in it silently produced empty output from every git command, so the
// gate passed everything — the exact class of false-negative it exists to stop.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sh = (cmd) => {
  try {
    return execSync(cmd, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

const problems = [];

// 1. Uncommitted source. Docker builds from the working tree, so an uncommitted
//    file can ship to UAT while living in no commit and no remote.
const dirty = sh('git status --porcelain')
  .split('\n')
  .filter((l) => /^\s*[MARD]/.test(l) && /\.(ts|tsx|css|json)$/.test(l))
  // porcelain is 'XY <path>'; trim the status columns without eating the path
  // (a fixed slice(3) turned 'src/…' into 'rc/…').
  .map((l) => l.replace(/^.{2}\s+/, '').trim());
if (dirty.length) {
  problems.push(`UNCOMMITTED source (${dirty.length}): ${dirty.slice(0, 5).join(', ')}${dirty.length > 5 ? ' …' : ''}`);
}

// 2. Both remotes. This repo has gitlab AND origin(GitHub) and both must be fed.
for (const remote of ['gitlab', 'origin']) {
  const has = sh(`git remote`).split('\n').includes(remote);
  if (!has) continue;
  const ahead = sh(`git rev-list --count ${remote}/main..HEAD`);
  if (ahead && ahead !== '0') {
    problems.push(`NOT PUSHED to ${remote}: ${ahead} commit(s) ahead. Run: git push ${remote} main`);
  }
}

// 3. A UI change with no screenshot taken. Reading code is not looking at it.
const uiTouched = sh('git diff --name-only HEAD~3..HEAD ')
  .split('\n')
  .some((f) => f.endsWith('.tsx') || f.endsWith('globals.css'));
const shotSeen = sh('git status --porcelain --ignored')
  .split('\n')
  .some((l) => /shot.*\.png/i.test(l));
if (uiTouched && !shotSeen) {
  problems.push(
    'UI files changed but no screenshot found. Capture the DEPLOYED page at 1920 AND 1440 and Read the .png before claiming it is done.',
  );
}

// 3b. Hardcoded Thai in UI code. The app is bilingual (next-intl): every
//     user-visible string must come from a translation key, or switching to EN
//     leaves Thai on screen. I added ~56 such strings on 2026-07-28 despite the
//     rule already being in CLAUDE.md.
// Look back far enough to cover a working session, and include files still
// uncommitted — a 3-commit window missed files edited earlier in the same day.
const recentUi = [
  ...sh('git diff --name-only HEAD~10..HEAD ').split('\n'),
  ...dirty,
].filter((f) => (f.startsWith('src/app/') || f.startsWith('src/components/')) && f.endsWith('.tsx'));
// Match in JS rather than shell — escaping a Thai character class through
// execSync silently produced no matches even though the pattern was correct.
const THAI_IN_UI = /(?:text=|hint=|placeholder=|title=|label=)["'][฀-๿]|>[฀-๿][^<]{2,}</;

// Statutory documents are EXEMPT. A Thai tax invoice must print the wording the
// Revenue Code prescribes — "ใบกำกับภาษี", "ต้นฉบับ", "สำนักงานใหญ่",
// "เลขประจำตัวผู้เสียภาษี". Those words are the legal content of the document,
// not UI copy, and translating them would make the document invalid. Same for
// the Excel sheet names on the VAT registers (รายงานภาษีขาย / รายงานภาษีซื้อ),
// which are the statutory report titles.
const I18N_EXEMPT = [
  /PrintDocument\.tsx$/,           // ใบกำกับภาษี / ใบเสร็จ / ใบส่งของ
  /wht-certificate-dialog\.tsx$/,  // หนังสือรับรองการหักภาษี ณ ที่จ่าย
  /reports\/(vat|wht)\/page\.tsx$/,// ชื่อรายงานภาษีตามกฎหมาย
  // The switcher's own caption reads "ภาษา / Language" in both languages on
  // purpose: someone stuck in the wrong language must still recognise the
  // control that gets them out. Translating it would hide the escape hatch.
  /shared\/language-switcher\.tsx$/,
];

const thaiOffenders = [];
for (const f of [...new Set(recentUi)].filter((f) => !I18N_EXEMPT.some((re) => re.test(f)))) {
  // Read the WORKING TREE, not `git show HEAD:` — HEAD is the version before
  // the fix, so the gate kept reporting strings that were already translated
  // and pointed at no line, which made it impossible to act on.
  let src = '';
  try {
    src = readFileSync(resolve(REPO, f), 'utf8');
  } catch {
    continue; // deleted or renamed
  }
  const hits = src
    .split('\n')
    .map((line, i) => [i + 1, line])
    .filter(([, line]) => !/^\s*(\/\/|\*)/.test(line)) // skip comments
    .filter(([, line]) => THAI_IN_UI.test(line));
  // Report path:line so the offender is directly openable.
  if (hits.length) thaiOffenders.push(`${f}:${hits.map(([n]) => n).slice(0, 4).join(',')}`);
}
if (thaiOffenders.length) {
  problems.push(
    `HARDCODED THAI in ${thaiOffenders.join(' | ')} — the app is bilingual. Move to src/locales/th + en and use useTranslations, then re-check in EN. (Statutory tax documents are exempt — see I18N_EXEMPT.)`,
  );
}

// 4. Typecheck. Baseline is 5 pre-existing errors; anything above that is mine.
//    Only run when source actually changed — tsc is slow and this fires on
//    every turn, including pure conversation.
const srcChanged =
  dirty.length > 0 ||
  sh('git diff --name-only HEAD~3..HEAD ')
    .split('\n')
    .some((f) => f.startsWith('src/'));
const TYPECHECK_BASELINE = 5;
if (srcChanged) {
  const count = Number(
    sh('bunx tsc --noEmit --skipLibCheck 2>&1 | grep -c "error TS"') || '0',
  );
  if (count > TYPECHECK_BASELINE) {
    problems.push(
      `TYPECHECK regressed: ${count} errors (baseline ${TYPECHECK_BASELINE}). Run: bunx tsc --noEmit --skipLibCheck`,
    );
  }
}

// 5. Deployed marker. A change that is committed and pushed but never deployed
//    is invisible to the user — they can only see UAT. If the buildMarker in
//    the working tree differs from the one UAT is serving, the deploy is
//    outstanding.
const localMarker = (sh('grep -o "HERBAL-BUILD-[a-zA-Z0-9._-]*" src/app/api/health/route.ts') || '').split('\n')[0];
if (localMarker && srcChanged) {
  const liveMarker = (
    sh('curl -s --max-time 20 https://herbal-erp-test-uat.bmscloud.in.th/api/health | grep -o "HERBAL-BUILD-[a-zA-Z0-9._-]*"') || ''
  ).split('\n')[0];
  if (liveMarker && liveMarker !== localMarker) {
    // A deploy can be genuinely blocked on something only the user can supply —
    // the SSH password is not stored on this machine. Repeating an identical
    // blocking message every turn does not make the credential appear; it just
    // trains me to ignore the gate. So: if a blocker is recorded AND names this
    // exact marker, downgrade to a non-blocking note. Anything else — no file,
    // or a stale file naming an older marker — still blocks, so this cannot be
    // used to wave a deploy through by writing the file once and forgetting it.
    let blocker = '';
    try {
      blocker = readFileSync(resolve(REPO, '.claude/DEPLOY-BLOCKED.md'), 'utf8');
    } catch {
      /* no blocker recorded */
    }
    if (blocker.includes(localMarker)) {
      console.error(
        `[done-gate] NOTE: "${localMarker}" is built but NOT deployed — blocked per .claude/DEPLOY-BLOCKED.md.\n` +
          `UAT still serves "${liveMarker}". Keep telling the user it is undeployed; delete that file once it ships.\n`,
      );
    } else {
      problems.push(
        `NOT DEPLOYED: UAT is serving "${liveMarker}" but the working tree says "${localMarker}". Build, ship the image, recreate app-uat, then curl /api/health to confirm.`,
      );
    }
  }
}

if (problems.length) {
  console.error(
    `\n[done-gate] ${problems.length} item(s) outstanding — do not report this as finished yet:\n` +
      problems.map((p) => `  • ${p}`).join('\n') +
      '\nIf a point genuinely does not apply, say so explicitly to the user rather than ignoring it.\n',
  );
  process.exit(2);
}
process.exit(0);
