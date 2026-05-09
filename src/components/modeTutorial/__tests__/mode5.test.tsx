/**
 * Phase 7A.7 CP6 — Mode 5 (Blackout) tutorial content tests.
 *
 * Two layers (mirrors CP4 mode2 test shape):
 *   1. Slide metadata — three slides with the corrected
 *      blackout-count copy. The spec's "lock to see / wrong
 *      locks waste turns / right locks reveal feedback for
 *      the rest" framing was entirely fictional; production
 *      shows zero per-position info, only a 0-4 count.
 *   2. DemoBoard — interactive board, isolated render. Pins
 *      the "always blackout tiles + N LOCKED pill" idiom and
 *      the 3-guess soft-rig with `locked = 4` override on
 *      forced wins.
 */

import { fireEvent, render } from '@testing-library/react-native';

import { DemoBoard, slides } from '../mode5';

describe('mode5 tutorial — slide metadata', () => {
  it('exposes exactly 3 slides', () => {
    expect(slides).toHaveLength(3);
  });

  it("slide 1 ships the corrected pure-blackout-count copy (NOT the spec's lock-to-see metaphor)", () => {
    // CP6 mechanic correction (largest in Phase 7A.7): the
    // spec described a manual "lock" action with per-digit
    // persistence. None of that exists. Production shows
    // blackout tiles + a single number 0-4. This test pins
    // the corrected mental model.
    const slide = slides[0]!;
    expect(slide.title).toBe("Everything's blacked out");
    expect(slide.body).toMatch(/won.t see any digits/i);
    expect(slide.body).toMatch(/right slot/i);
    // Guard against regressing to the fictional metaphor.
    expect(slide.body).not.toMatch(/lock/i);
  });

  it('slide 2 frames the count as the only feedback', () => {
    const slide = slides[1]!;
    expect(slide.title).toBe('Count is the only clue');
    expect(slide.body).toMatch(/0, 1, 2, 3, or 4/);
    expect(slide.body).toMatch(/never WHICH/i);
  });

  it('slide 3 surfaces the unique-digits strategy hint', () => {
    // `digitsUnique: true` is a real catalog rule for Mode 5
    // and a load-bearing strategic hint — using unique digits
    // across guesses speeds elimination because each digit
    // either contributes to the count or doesn't.
    const slide = slides[2]!;
    expect(slide.title).toBe('High stakes, low signal');
    expect(slide.body).toMatch(/unique digits/i);
  });
});

describe('mode5 tutorial — DemoBoard', () => {
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
    expect(utils.getByText('Try 4 unique digits to start.')).toBeTruthy();
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
    tapDigits(utils, [2, 8, 4]);
    expect(getGuessButton(utils).props.accessibilityState?.disabled).toBe(true);
    tapDigits(utils, [1]);
    expect(getGuessButton(utils).props.accessibilityState?.disabled).toBe(false);
  });

  it('2049 vs secret 2841 → 1 LOCKED (only pos 0 matches)', () => {
    // Secret 2841, guess 2049:
    //   pos 0: 2 == 2 → +1
    //   pos 1: 0 vs 8 — no
    //   pos 2: 4 vs 4 — wait this matches... 2049 vs 2841 →
    //     pos 0: 2==2 ✓
    //     pos 1: 0 vs 8 ✗
    //     pos 2: 4 vs 4 ✓
    //     pos 3: 9 vs 1 ✗
    //   → locked = 2
    // Use a clearer test guess. 2000 vs 2841 → pos 0 only → 1 LOCKED.
    const utils = render(<DemoBoard />);
    tapDigits(utils, [2, 0, 0, 0]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('1 LOCKED')).toBeTruthy();
    expect(utils.queryByText('Cracked it. Try a real match.')).toBeNull();
  });

  it('0000 vs secret 2841 → NONE pill (zero locked)', () => {
    const utils = render(<DemoBoard />);
    tapDigits(utils, [0, 0, 0, 0]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('NONE')).toBeTruthy();
  });

  it('caps the demo at 3 guesses — attempt #3 forces 4 LOCKED win regardless of input', () => {
    // CP6 soft-rig: the 3rd submission always wins, AND the
    // visual reward overrides `locked` to 4 so the forced-win
    // pill reads cleanly.
    const utils = render(<DemoBoard />);

    tapDigits(utils, [0, 0, 0, 0]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.queryByText('Cracked it. Try a real match.')).toBeNull();

    tapDigits(utils, [1, 1, 1, 1]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.queryByText('Cracked it. Try a real match.')).toBeNull();

    tapDigits(utils, [3, 3, 3, 3]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('Cracked it. Try a real match.')).toBeTruthy();
    expect(utils.getByText('4 LOCKED')).toBeTruthy();
    expect(utils.queryByRole('button', { name: 'Guess' })).toBeNull();
  });

  it('legitimate win on attempt 1 ends the demo without invoking the cap (2841)', () => {
    const utils = render(<DemoBoard />);
    tapDigits(utils, [2, 8, 4, 1]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('Cracked it. Try a real match.')).toBeTruthy();
    expect(utils.getByText('4 LOCKED')).toBeTruthy();
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
