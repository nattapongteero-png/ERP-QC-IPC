/**
 * Enter must move to the next field, not submit the form.
 *
 * Data-entry staff key requisitions straight through. With the browser default,
 * one Enter saves a half-filled document — so the hook has to intercept Enter
 * everywhere EXCEPT the places where Enter genuinely means something else
 * (textarea newlines, buttons, an open dropdown's selection).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field';

function Form({ onSubmit }: { onSubmit?: () => void } = {}) {
  const ref = useEnterToNextField<HTMLDivElement>();
  return (
    <div ref={ref}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}>
        <input data-testid="a" defaultValue="" />
        <input data-testid="b" defaultValue="existing" />
        <textarea data-testid="notes" />
        <input data-testid="c" />
        <div data-enter-submit>
          <input data-testid="search" />
        </div>
        <button type="submit" data-testid="save">save</button>
      </form>
    </div>
  );
}

describe('useEnterToNextField', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  it('moves focus to the next field on Enter', async () => {
    render(<Form />);
    screen.getByTestId('a').focus();

    await user.keyboard('{Enter}');

    expect(document.activeElement).toBe(screen.getByTestId('b'));
  });

  it('selects the next field text so typing replaces it', async () => {
    render(<Form />);
    screen.getByTestId('a').focus();

    await user.keyboard('{Enter}');

    const b = screen.getByTestId('b') as HTMLInputElement;
    // Whole value selected — the behaviour operators expect when tabbing
    // through a form to correct values.
    expect(b.selectionStart).toBe(0);
    expect(b.selectionEnd).toBe('existing'.length);
  });

  it('does not submit the form on Enter', async () => {
    let submitted = false;
    render(<Form onSubmit={() => { submitted = true; }} />);
    screen.getByTestId('a').focus();

    await user.keyboard('{Enter}');

    // The whole point: a stray Enter must not save a half-filled document.
    expect(submitted).toBe(false);
  });

  it('leaves Enter alone in a textarea so it still makes a newline', async () => {
    render(<Form />);
    const notes = screen.getByTestId('notes') as HTMLTextAreaElement;
    notes.focus();

    await user.keyboard('one{Enter}two');

    expect(notes.value).toBe('one\ntwo');
    expect(document.activeElement).toBe(notes);
  });

  it('leaves Enter alone on a field marked data-enter-submit', async () => {
    let submitted = false;
    render(<Form onSubmit={() => { submitted = true; }} />);
    screen.getByTestId('search').focus();

    await user.keyboard('{Enter}');

    // Focus must not jump — this field opted out.
    expect(document.activeElement).toBe(screen.getByTestId('search'));
    expect(submitted).toBe(true);
  });

  it('ignores Enter with a modifier held', async () => {
    render(<Form />);
    screen.getByTestId('a').focus();

    await user.keyboard('{Shift>}{Enter}{/Shift}');

    // Shift+Enter is not a "next field" gesture.
    expect(document.activeElement).toBe(screen.getByTestId('a'));
  });

  it('blurs on the last field instead of looping to the top', async () => {
    render(<Form />);
    screen.getByTestId('search').removeAttribute('data-testid');
    const c = screen.getByTestId('c');
    c.focus();

    await user.keyboard('{Enter}');

    // Wrapping back to field one would silently undo the operator's place.
    expect(document.activeElement).not.toBe(screen.getByTestId('a'));
  });
});
