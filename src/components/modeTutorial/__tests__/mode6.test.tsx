/**
 * Phase 7A.7 CP6 — Mode 6 (Sudden Death) tutorial content tests.
 *
 * Two layers (mirrors CP4-CP6 mode test shape):
 *   1. Slide metadata — exactly 2 slides (NOT 3 — Decision 2);
 *      Mode 6 is the only 2-slide tutorial in the set. Slide 1
 *      ships the literal "5 guesses" budget, not the spec's
 *      placeholder N.
 *   2. DemoBoard — Mode 1 mechanic (re-uses `evaluateColorMatch`);
 *      "ATTEMPT N / 3" counter mirrors production's `N/5`
 *      `extra` label idiom; smaller cap because demo cap is 3.
 */

import { fireEvent, render } from '@testing-library/react-native';

import { DemoBoard, slides } from '../mode6';

describe('mode6 tutorial — slide metadata', () => {
  it('exposes exactly 2 slides (NOT 3 — Mode 6 is the short walk)', () => {
    // Decision 2 (Phase 7A.6 design): Mode 6's mechanic is
    // simple enough that a 3rd slide would pad. Pin the count
    // so a future copy edit cannot regress.
    expect(slides).toHaveLength(2);
  });

  it('slide 1 surfaces the literal 5-guess budget', () => {
    const slide = slides[0]!;
    expect(slide.title).toBe('Five chances');
    expect(slide.body).toMatch(/color match/i);
    // Spec had a placeholder "N guesses"; CP6 fills in the
    // actual `maxGuessesPerPlayer: 5` from the catalog.
    expect(slide.body).toContain('5 guesses');
    expect(slide.body).toMatch(/no second chances/i);
  });

  it('slide 2 frames the strategy (information-rich first guesses)', () => {
    const slide = slides[1]!;
    expect(slide.title).toBe('Make every guess count');
  });
});

describe('mode6 tutorial — DemoBoard', () => {
  function tapDigits(utils: ReturnType<typeof render>, digits: readonly number[]): void {
    for (const d of digits) {
      fireEvent.press(utils.getByLabelText(String(d)));
    }
  }

  function getGuessButton(utils: ReturnType<typeof render>) {
    return utils.getByRole('button', { name: 'Guess' });
  }

  it('renders the prompt copy + acknowledges the demo-vs-real cap difference', () => {
    const utils = render(<DemoBoard />);
    expect(utils.getByText('Demo caps at 3. Real match: 5.')).toBeTruthy();
  });

  it('renders the ATTEMPT N / 3 counter on the idle state', () => {
    // Decision 5: the demo counter mirrors production's `N/5`
    // idiom but with the demo's smaller cap. Pin the literal
    // string so a future copy edit cannot drift the counter
    // shape (e.g., to "1 of 3" or "1/3").
    const utils = render(<DemoBoard />);
    expect(utils.getByText('ATTEMPT 1 / 3')).toBeTruthy();
  });

  it('advances the ATTEMPT counter after each non-final guess', () => {
    const utils = render(<DemoBoard />);

    tapDigits(utils, [0, 0, 0, 0]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('ATTEMPT 2 / 3')).toBeTruthy();

    tapDigits(utils, [1, 1, 1, 1]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('ATTEMPT 3 / 3')).toBeTruthy();
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
    tapDigits(utils, [9, 4, 3]);
    expect(getGuessButton(utils).props.accessibilityState?.disabled).toBe(true);
    tapDigits(utils, [6]);
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
    // Counter region collapses with the input region on win.
    expect(utils.queryByText(/^ATTEMPT/)).toBeNull();
  });

  it('legitimate win on attempt 1 ends the demo without invoking the cap (9436)', () => {
    const utils = render(<DemoBoard />);
    tapDigits(utils, [9, 4, 3, 6]);
    fireEvent.press(getGuessButton(utils));
    expect(utils.getByText('Cracked it. Try a real match.')).toBeTruthy();
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
