/**
 * Phase 7A.7 CP4 — Mode 2 tutorial content tests.
 *
 * Two layers:
 *   1. Slide metadata — three slides with the corrected (CP4)
 *      whole-number copy. Locks the spec/production-mechanic
 *      reconciliation in place so a future copy edit cannot
 *      regress to the per-digit framing without breaking a test.
 *   2. DemoBoard — interactive board, isolated render. Exercises
 *      digit entry → submit → production evaluator → pill render
 *      and the win-state collapse of the input region.
 */

import { fireEvent, render } from '@testing-library/react-native';

import { DemoBoard, slides } from '../mode2';

describe('mode2 tutorial — slide metadata', () => {
  it('exposes exactly 3 slides', () => {
    expect(slides).toHaveLength(3);
  });

  it('slide 1 ships corrected whole-number copy (not per-digit)', () => {
    // CP4 finding: the spec described per-digit feedback, but
    // production gives one direction for the whole guess. Copy
    // must say "for the whole number" — a regression toward
    // per-digit phrasing would teach a wrong rule.
    const slide = slides[0]!;
    expect(slide.title).toBe('One clue per guess');
    expect(slide.body).toContain('one arrow for the whole number');
    expect(slide.body).toContain('not per digit');
  });

  it('slide 2 explains higher/lower as bigger/smaller', () => {
    const slide = slides[1]!;
    expect(slide.title).toBe('Bigger or smaller');
    expect(slide.body).toContain('HIGHER');
    expect(slide.body).toContain('LOWER');
  });

  it('slide 3 hints at the bisection strategy', () => {
    const slide = slides[2]!;
    expect(slide.title).toBe('Bisect to crack it');
    expect(slide.body).toMatch(/middle|5000|half/);
  });
});

describe('mode2 tutorial — DemoBoard', () => {
  function tapDigits(utils: ReturnType<typeof render>, digits: readonly number[]): void {
    // DigitKeypad labels each key with the bare digit string.
    for (const d of digits) {
      fireEvent.press(utils.getByLabelText(String(d)));
    }
  }

  function getGuessButton(utils: ReturnType<typeof render>) {
    return utils.getByRole('button', { name: 'Guess' });
  }

  it('renders the prompt copy before any guess', () => {
    const utils = render(<DemoBoard />);
    expect(utils.getByText('Try 5000 to start.')).toBeTruthy();
  });

  it('renders all 10 digit keys + backspace (regression: keypad must not collapse under alignItems:center)', () => {
    // Phase 7A.7 CP4 hotfix — DemoBoard's `demoRoot` uses
    // `alignItems: 'center'` to center the history / draft /
    // Guess elements. DigitKeypad has no intrinsic width, so
    // without an opt-out the keypad collapsed to 1px bars
    // (the `║║║` artifact). The `keypadStretch` wrapper
    // applies `alignSelf: 'stretch'`. This test pins the
    // *render presence* of each key — a regression of the
    // wrapper would still pass earlier digit-tap tests on
    // jsdom (which doesn't measure layout) but a follow-up
    // style snapshot would not catch the layout collapse
    // either. Asserting all 11 keys exist gives us a cheap
    // canary that the render tree is intact.
    const utils = render(<DemoBoard />);
    for (let d = 0; d <= 9; d += 1) {
      expect(utils.getByLabelText(String(d))).toBeTruthy();
    }
    expect(utils.getByLabelText('Delete digit')).toBeTruthy();
  });

  it('disables the Guess button until 4 digits are entered', () => {
    const utils = render(<DemoBoard />);
    expect(getGuessButton(utils).props.accessibilityState?.disabled).toBe(true);

    tapDigits(utils, [5, 0, 0]);
    expect(getGuessButton(utils).props.accessibilityState?.disabled).toBe(true);

    tapDigits(utils, [0]);
    expect(getGuessButton(utils).props.accessibilityState?.disabled).toBe(false);
  });

  it('5000 (less than 7392) renders ▲ Higher pill', () => {
    const utils = render(<DemoBoard />);
    tapDigits(utils, [5, 0, 0, 0]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('▲ Higher')).toBeTruthy();
    // History row replaces the prompt copy.
    expect(utils.queryByText('Try 5000 to start.')).toBeNull();
  });

  it('9000 (greater than 7392) renders ▼ Lower pill', () => {
    const utils = render(<DemoBoard />);
    tapDigits(utils, [9, 0, 0, 0]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('▼ Lower')).toBeTruthy();
  });

  it('typing the secret 7392 hides the input region and shows the win cue', () => {
    const utils = render(<DemoBoard />);
    tapDigits(utils, [7, 3, 9, 2]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('Cracked it. Try a real match.')).toBeTruthy();
    // Input region collapsed: no Guess button, no keypad.
    expect(utils.queryByRole('button', { name: 'Guess' })).toBeNull();
    expect(utils.queryByLabelText('5')).toBeNull();
  });

  it('backspace removes the most-recently-entered digit', () => {
    const utils = render(<DemoBoard />);
    tapDigits(utils, [5, 0, 0, 0]);
    expect(getGuessButton(utils).props.accessibilityState?.disabled).toBe(false);
    fireEvent.press(utils.getByLabelText('Delete digit'));
    expect(getGuessButton(utils).props.accessibilityState?.disabled).toBe(true);
  });

  it('caps the demo at 3 guesses — attempt #3 forces a win regardless of input', () => {
    // Soft-rig: the tutorial's job is teaching the mechanic, not
    // making the user grind through a full bisection. After two
    // honest guesses (Higher/Lower feedback teaches the idiom),
    // the 3rd attempt always wins so the user pivots into the
    // real match rather than chasing the demo secret.
    const utils = render(<DemoBoard />);

    // Attempt 1 — 5000 < 7392 → ▲ Higher (genuine feedback).
    tapDigits(utils, [5, 0, 0, 0]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('▲ Higher')).toBeTruthy();
    expect(utils.queryByText('Cracked it. Try a real match.')).toBeNull();

    // Attempt 2 — 9000 > 7392 → ▼ Lower (genuine feedback).
    tapDigits(utils, [9, 0, 0, 0]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('▼ Lower')).toBeTruthy();
    expect(utils.queryByText('Cracked it. Try a real match.')).toBeNull();

    // Attempt 3 — 1234 is FAR from 7392 but soft-rig forces win.
    tapDigits(utils, [1, 2, 3, 4]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('Cracked it. Try a real match.')).toBeTruthy();
    // Input region collapsed: keypad + Guess button gone.
    expect(utils.queryByRole('button', { name: 'Guess' })).toBeNull();
    expect(utils.queryByLabelText('5')).toBeNull();
  });

  it('legitimate win on attempt 1 ends the demo without invoking the cap', () => {
    // Edge case from CP4 spec — if the user types 7392 directly
    // on attempt 1, honor it; the soft-rig branch should not
    // fire (it only triggers on the 3rd submission).
    const utils = render(<DemoBoard />);
    tapDigits(utils, [7, 3, 9, 2]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('Cracked it. Try a real match.')).toBeTruthy();
    expect(utils.queryByRole('button', { name: 'Guess' })).toBeNull();
  });

  it('legitimate win on attempt 2 ends the demo before the cap fires', () => {
    const utils = render(<DemoBoard />);
    tapDigits(utils, [5, 0, 0, 0]);
    fireEvent.press(getGuessButton(utils));
    tapDigits(utils, [7, 3, 9, 2]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('Cracked it. Try a real match.')).toBeTruthy();
  });

  it('renders Guess as a full-width secondary button (alignSelf:stretch, no fixed pixel width)', () => {
    // CP4 visual hotfix: GUESS was a 160px primary CTA centered
    // under a stretched keypad — read as left-biased and same
    // emphasis as the actual START MATCH primary further down.
    // Now: outline variant + alignSelf:'stretch' to mirror the
    // START MATCH width while distinguishing the two CTAs by
    // variant treatment. Button itself defaults `fullWidth: true`
    // which adds `width: '100%'`, so we don't assert width
    // unset — only that no fixed pixel width is overlaid.
    const utils = render(<DemoBoard />);
    const button = getGuessButton(utils);
    const flatStyle = Array.isArray(button.props.style)
      ? Object.assign({}, ...button.props.style.flat(Infinity).filter(Boolean))
      : button.props.style;
    expect(flatStyle.alignSelf).toBe('stretch');
    expect(typeof flatStyle.width === 'number').toBe(false);
  });
});
