/**
 * One colour theme per QC stage. Selecting a stage recolours the whole form —
 * the gradient panel, every section header and the GMP seal — so the page
 * always reads as "this criterion belongs to Raw Material / IPC / FG Release".
 *
 * Figma: raw_material 16:1815 (blue), ipc 16:1622 (orange), fg_release 33:2230
 * (green). Class strings are written out literally, never interpolated, so
 * Tailwind's scanner actually emits them.
 *
 * Shared by IPCCriteriaForm and IPCLivePreviewCard. It lives in its own module
 * rather than in the form because the form imports the preview card — putting
 * the map in either component would make the two import each other.
 */
import type { StageValue } from '@/lib/master-data/ipc-spec-payload';

export interface StageTheme {
  /** Gradient for the stage panel: bright stage colour → near-black. */
  panel: string;
  /** Gradient fill of the selected stage card. */
  card: string;
  /** Skeleton bars inside the stage cards. */
  bar: string;
  /** Tick in the selected card's corner. */
  check: string;
  /** GMP seal — SVG fills, so plain hex rather than Tailwind classes. */
  seal: { light: string; dark: string; ink: string };
  /**
   * Chosen-option colours (Check Interval chips). `text` is darkened from the
   * stage colour so 24px numerals clear the 3:1 large-text contrast ratio on
   * both the pale fill and white; the raw stage colours do not.
   */
  chip: { on: string; text: string };
}

export const STAGE_THEME: Record<StageValue, StageTheme> = {
  raw_material: {
    panel: 'from-[#327ef1] to-[#26272f]',
    card: 'from-[#f8f8f8] to-[#d2e4ff]',
    bar: 'bg-[#98b7e5]',
    check: 'text-[#327ef1]',
    seal: { light: '#4a92f5', dark: '#1a5cc4', ink: '#1a5cc4' },
    chip: { on: 'bg-[#e8effc] ring-[#2f6fd0]', text: 'text-[#2f6fd0]' },
  },
  ipc: {
    panel: 'from-[#ea7029] to-[#2f2e26]',
    card: 'from-[#f8f8f8] to-[#ffc8a8]',
    bar: 'bg-[#faaa7b]',
    check: 'text-[#ea7029]',
    seal: { light: '#f59255', dark: '#c2551a', ink: '#c2551a' },
    chip: { on: 'bg-[#fdeee2] ring-[#d0631c]', text: 'text-[#d0631c]' },
  },
  fg_release: {
    panel: 'from-[#85bc63] to-[#292f26]',
    card: 'from-[#f8f8f8] to-[#defacd]',
    bar: 'bg-[#80b45f]',
    check: 'text-[#85bc63]',
    seal: { light: '#3ec46b', dark: '#12913f', ink: '#12913f' },
    chip: { on: 'bg-[#eaf6e3] ring-[#4f9236]', text: 'text-[#4f9236]' },
  },
};

/**
 * Surface behind every section header — เอกสาร GMP, ประเภทเกณฑ์, แผนการสุ่ม,
 * เกณฑ์การยอมรับ and the Live Preview.
 *
 * One neutral colour for all of them, not a per-stage tint: the stage panel at
 * the top already carries the stage's colour, and repeating it down the page
 * left every card reading as a status banner.
 */
export const SECTION_HEADER = 'bg-[#fbfbfb]';

/** Same colour as `SECTION_HEADER`, for inline gradients that cannot take a class. */
export const SECTION_HEADER_HEX = '#fbfbfb';
