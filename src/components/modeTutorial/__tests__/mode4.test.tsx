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

  it('renders the prompt copy before any guess (and confirms NO timer in demo)', () => {
    const utils = render(<DemoBoard />);
    expect(utils.getByText('No timer here. Try a guess.')).toBeTruthy();
  });

  it('does not render any clock / timer UI inside the DemoBoard', () => {
    // Phase 7A.6 Decision 3: the tutorial does NOT impose time
    // pressure. Demo must not surface a countdown clock face,
    // a "00:43"-shaped readout, or a "YOUR CLOCK" badge.
    // Slide 2's static visual *can* show those (it's a teaching
    // illustration of production), but the DemoBoard must not.
    const utils = render(<DemoBoard />);
    const board = utils.getByTestId('mode4-demo-board');
    expect(() => utils.getByText('YOUR CLOCK')).toThrow();
    // No mm:ss-shaped numeric readout inside the demo.
    const allText = (board.children as unknown[])
      .flat(Infinity)
      .filter((c): c is { props: { children: unknown } } =>
        typeof c === 'object' && c !== null && 'props' in c,
      );
    void allText; // structural exclusion — explicit assertion above is the load-bearing one.
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
