/**
 * Phase 7A.7 CP5 — Mode 4 (Blitz) tutorial content tests.
 *
 * Two layers (mirrors CP4 mode2 + CP5 mode3 test shape):
 *   1. Slide metadata — three slides; CP5 verified Mode 4's
 *      evaluator IS literally `evaluateColorMatch` (mode4Blitz
 *      re-exports it). Slide 2 ships chess-clock-honest copy
 *      (refined from the spec's "submit to pause briefly"
 *      framing which oversold a delay that does not exist).
 *   2. DemoBoard — interactive board, isolated render. Critical
 *      invariant: NO timer / clock UI in the demo (Phase 7A.6
 *      Decision 3). The evaluator is timer-orthogonal so the
 *      demo just calls it directly.
 */

import { fireEvent, render } from '@testing-library/react-native';

import { DemoBoard, slides } from '../mode4';

describe('mode4 tutorial — slide metadata', () => {
  it('exposes exactly 3 slides', () => {
    expect(slides).toHaveLength(3);
  });

  it('slide 1 confirms Mode 1 inheritance + 60-second budget', () => {
    const slide = slides[0]!;
    expect(slide.title).toBe('Beat the clock');
    expect(slide.body).toMatch(/color match/i);
    expect(slide.body).toContain('60');
  });

  it('slide 2 ships honest chess-clock copy (no "pause briefly" oversell)', () => {
    // CP5 copy refinement: spec said "Submit your guess to
    // pause briefly between turns." Production semantics are
    // simpler and stricter — your clock counts down on your
    // turn, opponent's clock on theirs, run out and you lose.
    // Pin the corrected framing.
    const slide = slides[1]!;
    expect(slide.title).toBe('Time over thought');
    expect(slide.body).toMatch(/your turn/i);
    expect(slide.body).toMatch(/lose/i);
    expect(slide.body).not.toMatch(/pause briefly/i);
  });

  it('slide 3 frames speed strategy', () => {
    const slide = slides[2]!;
    expect(slide.title).toBe('Speed strategy');
  });
});

describe('mode4 tutorial — DemoBoard', () => {
  function tapDigits(utils: ReturnType<typeof render>, digits: readonly number[]): void {
    for (const d of digits) {
      fireEvent.press(utils.getByLabelText(String(d)));
    }
  }

  function getGuessButton(utils: ReturnType<typeof render>) {
    return utils.getByRole('button', { name: 'Guess' });
  }

  it('renders the prompt copy before any guess', () => {
    const utils = render(<DemoBoard />);
    expect(utils.getByText("Timer's just for show. Try a guess.")).toBeTruthy();
  });

  it('renders the static decorative timer pill at "1:00" — production format, never ticks (CP7.1)', () => {
    // Phase 7A.7 CP7.1: the original CP6 demo had no timer
    // UI at all (Decision 3 — tutorial does not impose time
    // pressure). Manual sanity then revealed a visual-parity
    // gap: slides describe a 60-second clock but the demo
    // showed nothing. The fix adds a STATIC placeholder —
    // present enough to signal "this mode has a clock,"
    // static enough to never tick. "1:00" mirrors
    // production's `formatClock(60_000)` output (M:SS, not
    // 0:60). Slide 2's separate teaching clock at "00:43"
    // (danger-red) is unrelated to this demo placeholder.
    const utils = render(<DemoBoard />);
    const pill = utils.getByTestId('mode4-static-timer');
    expect(pill).toBeTruthy();
    expect(utils.getByText('1:00')).toBeTruthy();
  });

  it('the static timer pill does NOT change after submitting a guess', () => {
    // The placeholder is decorative — no useState, no
    // setInterval, no formatClock invocation. Submitting a
    // guess must not cause the pill to disappear, advance,
    // or otherwise mutate. (The pill DOES disappear in the
    // post-win state when the entire input region collapses,
    // but that's the win cue replacing the input UI, not
    // the timer ticking.)
    const utils = render(<DemoBoard />);
    expect(utils.getByText('1:00')).toBeTruthy();
    tapDigits(utils, [0, 0, 0, 0]);
    fireEvent.press(getGuessButton(utils));
    // After one non-winning guess, timer still reads "1:00".
    expect(utils.getByText('1:00')).toBeTruthy();
  });

  it('renders all 10 digit keys + backspace (regression guard for keypad collapse)', () => {
    const utils = render(<DemoBoard />);
    for (let d = 0; d <= 9; d += 1) {
      expect(utils.getByLabelText(String(d))).toBeTruthy();
    }
    expect(utils.getByLabelText('Delete digit')).toBeTruthy();
  });

  it('disables the Guess button until 4 digits are entered', () => {
    const utils = render(<DemoBoard />);
    expect(getGuessButton(utils).props.accessibilityState?.disabled).toBe(true);
    tapDigits(utils, [5, 1, 8]);
    expect(getGuessButton(utils).props.accessibilityState?.disabled).toBe(true);
    tapDigits(utils, [3]);
    expect(getGuessButton(utils).props.accessibilityState?.disabled).toBe(false);
  });

  it('caps the demo at 3 guesses — attempt #3 forces all-green win regardless of input', () => {
    const utils = render(<DemoBoard />);

    tapDigits(utils, [0, 0, 0, 0]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.queryByText('Cracked it. Try a real match.')).toBeNull();

    tapDigits(utils, [1, 1, 1, 1]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.queryByText('Cracked it. Try a real match.')).toBeNull();

    tapDigits(utils, [2, 2, 2, 2]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('Cracked it. Try a real match.')).toBeTruthy();
    expect(utils.queryByRole('button', { name: 'Guess' })).toBeNull();
  });

  it('legitimate win on attempt 1 ends the demo without invoking the cap (5183)', () => {
    const utils = render(<DemoBoard />);
    tapDigits(utils, [5, 1, 8, 3]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('Cracked it. Try a real match.')).toBeTruthy();
    expect(utils.queryByRole('button', { name: 'Guess' })).toBeNull();
  });

  it('renders Guess as a full-width secondary outline button', () => {
    const utils = render(<DemoBoard />);
    const button = getGuessButton(utils);
    const flatStyle = Array.isArray(button.props.style)
      ? Object.assign({}, ...button.props.style.flat(Infinity).filter(Boolean))
      : button.props.style;
    expect(flatStyle.alignSelf).toBe('stretch');
    expect(typeof flatStyle.width === 'number').toBe(false);
  });
});
