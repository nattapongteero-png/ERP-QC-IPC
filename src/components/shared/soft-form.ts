/**
 * Soft form tokens — the field styling introduced on the QC & IPC criteria
 * screen (Figma nodes 36:2441 / 42:2473) and reused wherever a form should
 * look like that one: pale filled inputs, grey labels, a #fbfbfb section
 * header, and a filled pill for the action that commits.
 *
 * Kept here rather than in either screen so a third one does not have to copy
 * the strings a third time.
 */

/** Filled input on a white card. */
export const SOFT_INPUT =
  'w-full px-3 py-2.5 rounded-[10px] bg-[#f1f3f5] text-sm text-slate-900 outline-none ' +
  'transition placeholder:text-[#bfbfbf] focus:ring-2 focus:ring-emerald-500/25';

/** Label above a soft input. */
export const SOFT_LABEL = 'text-sm text-[#bfbfbf]';

/** Small print under a field. */
export const SOFT_HELPER = 'text-[11px] leading-relaxed text-[#bfbfbf]';

/** Surface behind a section heading. */
export const SOFT_SECTION = 'bg-[#fbfbfb]';

/** Heading of a section. */
export const SOFT_HEADING = 'text-sm font-semibold text-black';

/** Confirmation sentence that reads a setting back to the user. */
export const SOFT_READBACK =
  'flex items-start gap-1.5 text-[11px] leading-relaxed text-[#1a8a4a]';

/** The same sentence when the setting is still missing. */
export const SOFT_WARN =
  'flex items-start gap-1.5 text-[11px] leading-relaxed text-[#c2410c]';

/** Primary action. */
export const SOFT_PRIMARY_BTN =
  'rounded-full bg-[#2f6fd0] px-5 py-2.5 text-[13px] font-medium text-white ' +
  'transition hover:bg-[#2a61b8] disabled:cursor-not-allowed disabled:opacity-50';

/** Secondary action beside it. */
export const SOFT_SECONDARY_BTN =
  'rounded-full border border-[#e1e4e8] bg-white px-5 py-2.5 text-[13px] font-medium ' +
  'text-slate-700 transition hover:border-[#9db9e8] disabled:opacity-50';
