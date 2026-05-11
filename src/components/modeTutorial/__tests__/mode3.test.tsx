/**
 * Phase 7A.7 CP5 — Mode 3 (Precision) tutorial content tests.
 *
 * Two layers (mirrors CP4 mode2 test shape):
 *   1. Slide metadata — three slides with the corrected
 *      single-guess +N/−M win condition (the spec's "total
 *      score across guesses" framing was mechanically wrong;
 *      see mode3.tsx header).
 *   2. DemoBoard — interactive board, isolated render. Exercises
 *      digit entry → submit → production evaluator → +N −M
 *      chip render, the 3-guess soft-rig with `+4 −0` override
 *      on the forced win, and natural early-win paths.
 */

import { fireEvent, render } from '@testing-library/react-native';

import { DemoBoard, slides } from '../mode3';

describe('mode3 tutorial — slide metadata', () => {
  it('exposes exactly 3 slides', () => {
    expect(slides).toHaveLength(3);
  });

  it('slide 1 frames the +/− mechanic explicitly (Mastermind disambiguation)', () => {
    const slide = slides[0]!;
    expect(slide.title).toBe('Score over speed');
    // Guard against regressing to the spec's ambiguous
    // "lose points for wrong placements" — the corrected copy
    // names the right-place / wrong-place split exactly so the
    // user never reads −1 as "digit not in secret."
    expect(slide.body).toContain('+1');
    expect(slide.body).toContain('−1');
    expect(slide.body).toContain('right place');
    expect(slide.body).toContain('wrong place');
  });

  it('slide 2 ships the corrected single-guess +4 win condition (NOT cumulative)', () => {
    // CP5 mechanic correction: spec described scoring as
    // "Final score = total points across all guesses" but
    // production has no cumulative score — win = `plus === 4`
    // on a single guess. Shipping the literal spec copy would
    // teach a fictional mental model. This test pins the
    // correction so a future copy edit cannot regress.
    const slide = slides[1]!;
    expect(slide.title).toBe('Net score wins');
    expect(slide.body).toContain('+4');
    expect(slide.body).toMatch(/each guess/i);
    expect(slide.body).not.toMatch(/total points across all guesses/i);
  });

  it('slide 3 anchors strategy to actual −M reuse', () => {
    const slide = slides[2]!;
    expect(slide.title).toBe('Bisect by elimination');
    expect(slide.body).toContain('−M');
  });
});

describe('mode3 tutorial — DemoBoard', () => {
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
    expect(utils.getByText('Try 4719 — or guess to learn it.')).toBeTruthy();
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
    tapDigits(utils, [4, 7, 1]);
    expect(getGuessButton(utils).props.accessibilityState?.disabled).toBe(true);
    tapDigits(utils, [9]);
    expect(getGuessButton(utils).props.accessibilityState?.disabled).toBe(false);
  });

  it('1249 vs secret 4719 → +1 −2 chip (1 right place: nothing; verify against evaluator)', () => {
    // Secret 4719, guess 1249:
    //   pos 0: 1 vs 4 — no plus
    //   pos 1: 2 vs 7 — no
    //   pos 2: 4 vs 1 — no
    //   pos 3: 9 vs 9 — plus (1 right-place hit)
    // Pass 2: pos 0 '1' → secret[2]='1' unconsumed → minus
    //         pos 1 '2' → not in secret
    //         pos 2 '4' → secret[0]='4' unconsumed → minus
    //   → +1 −2
    const utils = render(<DemoBoard />);
    tapDigits(utils, [1, 2, 4, 9]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('+1')).toBeTruthy();
    expect(utils.getByText('−2')).toBeTruthy();
    expect(utils.queryByText('Cracked it. Try a real match.')).toBeNull();
  });

  it('caps the demo at 3 guesses — attempt #3 forces +4 −0 win regardless of input', () => {
    // CP5 soft-rig: the 3rd submission always wins, AND the
    // visual reward overrides plus/minus to (4, 0) so the
    // forced victory presents cleanly. Without the override,
    // the user's actual (likely off-target) numbers next to a
    // "Cracked it" cue would feel inconsistent.
    const utils = render(<DemoBoard />);

    // Attempt 1 — random guess.
    tapDigits(utils, [0, 0, 0, 0]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.queryByText('Cracked it. Try a real match.')).toBeNull();

    // Attempt 2 — random guess.
    tapDigits(utils, [1, 1, 1, 1]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.queryByText('Cracked it. Try a real match.')).toBeNull();

    // Attempt 3 — soft-rig forces win.
    tapDigits(utils, [2, 2, 2, 2]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('Cracked it. Try a real match.')).toBeTruthy();
    // Input region collapsed: keypad + Guess gone.
    expect(utils.queryByRole('button', { name: 'Guess' })).toBeNull();
    expect(utils.queryByLabelText('5')).toBeNull();
    // Forced-win row suppresses the +/- chip per CP4 "no pill
    // on winning row" idiom; the win cue speaks for the win.
    // (We previously saw +/- chips for the two non-winning
    // rows. The 3rd row should not contribute new chips.)
  });

  it('legitimate win on attempt 1 ends the demo without invoking the cap', () => {
    const utils = render(<DemoBoard />);
    tapDigits(utils, [4, 7, 1, 9]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('Cracked it. Try a real match.')).toBeTruthy();
    expect(utils.queryByRole('button', { name: 'Guess' })).toBeNull();
  });

  it('every history row carries a fixed-width chip slot — including the (chip-suppressed) winning row (CP7.1)', () => {
    // CP7.1 alignment hotfix: the original CP5 implementation
    // suppressed the +/- chip on winning rows to mirror CP4
    // mode2's "no pill on win" idiom. That left win rows
    // visually shorter than non-win rows; with parent
    // `alignItems: 'center'`, the win row's tile column
    // drifted right of non-win rows. The fix wraps the chip
    // (or its absence) in a fixed-minWidth slot so the row
    // total width is constant. This test asserts every row
    // has the slot — including the soft-rig forced-win row —
    // so a future regression that drops the wrapper is caught.
    const utils = render(<DemoBoard />);

    // 3 attempts: first two get chips, third is forced-win.
    tapDigits(utils, [0, 0, 0, 0]);
    fireEvent.press(getGuessButton(utils));
    tapDigits(utils, [1, 1, 1, 1]);
    fireEvent.press(getGuessButton(utils));
    tapDigits(utils, [2, 2, 2, 2]);
    fireEvent.press(getGuessButton(utils));

    expect(utils.getByTestId('mode3-chip-slot-0')).toBeTruthy();
    expect(utils.getByTestId('mode3-chip-slot-1')).toBeTruthy();
    expect(utils.getByTestId('mode3-chip-slot-2')).toBeTruthy();
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
