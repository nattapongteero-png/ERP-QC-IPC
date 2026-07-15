/**
 * Approval screens must not use the browser's own popups.
 *
 * alert()/confirm() render a grey box the browser titles with the hostname
 * ("herbal-erp-test-uat.bmscloud.in.th says…"). It reads as a phishing popup
 * rather than part of the system, freezes the page, and cannot be styled or
 * translated — so it always speaks whatever language the string was written in.
 *
 * The app already has DevExtreme notify() (31 files use it); these screens
 * simply hadn't adopted it.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const FILES = {
  approvals: 'src/app/accounting/approvals/page.tsx',
  prList: 'src/app/purchasing/requisitions/page.tsx',
};

function codeOnly(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** Native alert/confirm, ignoring member calls like foo.confirm(). */
function nativeDialogCalls(code: string): string[] {
  return Array.from(code.matchAll(/(?<![.\w])(alert|confirm)\s*\(/g)).map((m) => m[1]);
}

describe('approval screens — no native browser dialogs', () => {
  it('the approvals page uses notify, not alert', () => {
    const code = codeOnly(FILES.approvals);
    expect(nativeDialogCalls(code)).toEqual([]);
    expect(code).toMatch(/import notify from 'devextreme\/ui\/notify'/);
  });

  it('the approvals page confirms success, not just failure', () => {
    // Silence after a click reads as "nothing happened" and gets the approver
    // clicking again.
    const code = codeOnly(FILES.approvals);
    expect(code).toMatch(/notify\([\s\S]{0,120}'success'/);
  });

  it('the approvals page speaks Thai to the operator', () => {
    const code = codeOnly(FILES.approvals);
    // The old alert said "Failed to approve request".
    expect(code).not.toMatch(/Failed to \$\{actionType\} request/);
    expect(code).toMatch(/อนุมัติเรียบร้อย/);
  });

  it('the PR list uses notify, not alert', () => {
    const code = codeOnly(FILES.prList);
    expect(nativeDialogCalls(code)).toEqual([]);
    expect(code).toMatch(/import notify from 'devextreme\/ui\/notify'/);
  });

  it('a failed PR delete is reported, not swallowed', () => {
    // The catch branch used to only console.error — a failed delete looked
    // exactly like a successful one to the operator.
    const code = codeOnly(FILES.prList);
    expect(code).toMatch(/catch[\s\S]{0,200}notify\([\s\S]{0,80}'error'/);
  });
});
