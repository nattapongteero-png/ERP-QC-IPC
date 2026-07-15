'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Enter moves to the next field instead of submitting the form.
 *
 * Data-entry staff key long forms without touching the mouse. The browser
 * default — Enter submits — means one keystroke saves a half-filled document,
 * so operators learn to reach for Tab or the mouse on every field.
 *
 * Attach the returned ref to a container; every focusable field inside it is
 * wired, including fields rendered later (DevExtreme builds its inputs after
 * mount, and rows can be added at runtime), because the handler is delegated
 * on the container rather than bound per input.
 *
 *   const formRef = useEnterToNextField<HTMLDivElement>();
 *   return <div ref={formRef}>...</div>;
 *
 * Deliberately NOT intercepted:
 *  - textarea — Enter is a newline there, that is the whole point of the field.
 *  - buttons / submit inputs — Enter on a focused button must press it.
 *  - anything marked data-enter-submit, for the one field where Enter really
 *    should submit (e.g. a search box).
 *  - DevExtreme dropdowns while their list is open: Enter picks the highlighted
 *    item. Stealing it there would make the picker unusable.
 */

/** Fields Enter must be left alone on. */
function isExempt(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'button') return true;

  if (tag === 'input') {
    const type = (el as HTMLInputElement).type;
    if (type === 'submit' || type === 'button' || type === 'reset') return true;
  }

  if (el.closest('[data-enter-submit]')) return true;

  // A DevExtreme dropdown with its popup open owns Enter (it selects the
  // highlighted option). dx-dropdowneditor-active marks exactly that state.
  if (el.closest('.dx-dropdowneditor-active')) return true;

  return false;
}

const FOCUSABLE = [
  'input:not([type="hidden"])',
  'textarea',
  'select',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Visible, enabled fields in DOM order — the order the eye reads them. */
function focusableFields(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if ((el as HTMLInputElement).readOnly) return false;

    // Skip fields inside a hidden subtree — DevExtreme keeps helper inputs in
    // the DOM, and focusing one would strand the cursor somewhere invisible.
    //
    // NOT offsetParent: jsdom never computes layout, so offsetParent is always
    // null there and this filter would reject every field, making the hook a
    // no-op under test while working in the browser.
    if (el.closest('[hidden]')) return false;
    if (el.style.display === 'none' || el.style.visibility === 'hidden') return false;
    if (el.closest('.dx-state-invisible')) return false;

    return true;
  });
}

export function useEnterToNextField<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  const onKeyDown = useCallback((event: Event) => {
    const e = event as KeyboardEvent;
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return;

    const container = ref.current;
    const target = e.target as HTMLElement | null;
    if (!container || !target || !container.contains(target)) return;
    if (isExempt(target)) return;

    const fields = focusableFields(container);
    const index = fields.indexOf(target);
    if (index === -1) return;

    // Stop the browser submitting the form on Enter.
    e.preventDefault();

    const next = fields[index + 1];
    if (next) {
      next.focus();
      // Select existing text so typing replaces it — the expected behaviour when
      // tabbing through a form to correct values.
      const input = next as HTMLInputElement;
      if (typeof input.select === 'function' && input.value) input.select();
    } else {
      // Last field: drop focus so the operator can press Enter again to submit
      // via the form's own button, rather than looping back to the top.
      target.blur();
    }
  }, []);

  useEffect(() => {
    // Bound on the document, not the container: the container ref is still null
    // when this effect first runs, and DevExtreme mounts its inputs after
    // render. The handler checks container.contains(target) itself, so events
    // outside the form are ignored — and fields added at runtime need no
    // re-binding.
    //
    // Capture phase: DevExtreme's own editors handle keydown on the input and
    // would otherwise act on Enter before this runs.
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onKeyDown]);

  return ref;
}
