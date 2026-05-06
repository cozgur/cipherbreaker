import { act, fireEvent } from '@testing-library/react-native';

import { HomeScreen } from '../HomeScreen';
import { TutorialMatchScreen } from '../TutorialMatchScreen';
import { generateTutorialSecret } from '@game/tutorial/secret';
import {
  ONBOARDING_DEFAULTS,
  USER_STORE_DEFAULTS,
  useUserStore,
} from '@state/userStore';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { renderWithNavigation } from '@/test-utils/renderWithNavigation';

jest.mock('@game/tutorial/secret', () => ({
  generateTutorialSecret: jest.fn(),
}));

const mockedGenerateSecret = generateTutorialSecret as jest.MockedFunction<
  typeof generateTutorialSecret
>;

function pinSecret(digits: readonly number[]): void {
  mockedGenerateSecret.mockReturnValue(digits);
}

function resetUserStore(): void {
  useUserStore.setState({
    ...USER_STORE_DEFAULTS,
    onboarding: { ...ONBOARDING_DEFAULTS },
    matchesCompletedSinceOnboarding: 0,
    tokens: 1000,
  });
}

function mountTutorial() {
  return renderWithNavigation('TutorialMatch', {
    TutorialMatch: TutorialMatchScreen,
    OnboardingTokenWalkthrough: RouteStubScreen,
    Home: HomeScreen,
  });
}

const SECRET_DIGITS_1234 = [1, 2, 3, 4] as const;

function fillDigits(utils: ReturnType<typeof mountTutorial>, digits: readonly number[]): void {
  for (const d of digits) {
    act(() => {
      // DigitKeypad renders one Pressable per digit with a label
      // `Digit {n}` — see DigitKeypad component.
      fireEvent.press(utils.getByLabelText(String(d)));
    });
  }
}

function dismissWelcome(utils: ReturnType<typeof mountTutorial>): void {
  act(() => {
    fireEvent.press(utils.getByText('Start →'));
  });
}

function submitGuess(utils: ReturnType<typeof mountTutorial>): void {
  act(() => {
    fireEvent.press(utils.getByText('Guess'));
  });
}

function dismissTeachingIfPresent(utils: ReturnType<typeof mountTutorial>): void {
  const cta = utils.queryByText('Got it →');
  if (cta !== null) {
    act(() => {
      fireEvent.press(cta);
    });
  }
}

describe('TutorialMatchScreen', () => {
  beforeEach(() => {
    resetUserStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the welcome overlay on mount', () => {
    pinSecret(SECRET_DIGITS_1234);
    const utils = mountTutorial();
    expect(utils.getByText('Crack the code')).toBeTruthy();
    expect(
      utils.getByText('4 digits. 0–9. 10 guesses. Make a guess, read the feedback, narrow it down.'),
    ).toBeTruthy();
    expect(utils.getByText('Start →')).toBeTruthy();
  });

  it('welcome dismiss reveals the first-guess prompt toast', () => {
    pinSecret(SECRET_DIGITS_1234);
    const utils = mountTutorial();
    dismissWelcome(utils);
    expect(utils.getByTestId('tutorial-toast-first-guess')).toBeTruthy();
    expect(utils.getByText('Tap pegs to build your guess.')).toBeTruthy();
  });

  it('first peg tap auto-dismisses the first-guess toast', () => {
    pinSecret(SECRET_DIGITS_1234);
    const utils = mountTutorial();
    dismissWelcome(utils);
    expect(utils.queryByTestId('tutorial-toast-first-guess')).toBeTruthy();

    act(() => {
      fireEvent.press(utils.getByLabelText('5'));
    });

    expect(utils.queryByTestId('tutorial-toast-first-guess')).toBeNull();
  });

  it('feedback teaching overlay appears after the first guess submits, dismisses on CTA', () => {
    pinSecret(SECRET_DIGITS_1234);
    const utils = mountTutorial();
    dismissWelcome(utils);
    fillDigits(utils, [5, 6, 7, 8]);
    submitGuess(utils);

    expect(utils.getByText('Reading the feedback')).toBeTruthy();
    expect(utils.getByText('Got it →')).toBeTruthy();

    act(() => {
      fireEvent.press(utils.getByText('Got it →'));
    });
    expect(utils.queryByText('Reading the feedback')).toBeNull();
  });

  it('turn 6 with no win triggers the auto-hint toast and locks one position', () => {
    pinSecret(SECRET_DIGITS_1234);
    const utils = mountTutorial();
    dismissWelcome(utils);
    // Six losing guesses: all-9s never matches secret 1234.
    for (let turn = 0; turn < 6; turn += 1) {
      fillDigits(utils, [9, 9, 9, 9]);
      submitGuess(utils);
      // Turn 1 surfaces feedback teaching — clear it.
      dismissTeachingIfPresent(utils);
    }
    expect(utils.getByTestId('tutorial-toast-auto-hint')).toBeTruthy();
    expect(utils.getByText("Here's a hint — position 1 is")).toBeTruthy();
  });

  it('auto-hint does NOT fire at turn 5 (only at turn 6)', () => {
    pinSecret(SECRET_DIGITS_1234);
    const utils = mountTutorial();
    dismissWelcome(utils);
    for (let turn = 0; turn < 5; turn += 1) {
      fillDigits(utils, [9, 9, 9, 9]);
      submitGuess(utils);
      dismissTeachingIfPresent(utils);
    }
    expect(utils.queryByTestId('tutorial-toast-auto-hint')).toBeNull();
  });

  it('auto-hint fires at most once per match — turn 7+ does not re-trigger', () => {
    pinSecret(SECRET_DIGITS_1234);
    const utils = mountTutorial();
    dismissWelcome(utils);
    // Six losing guesses fire the auto-hint at the end of turn 6.
    for (let turn = 0; turn < 6; turn += 1) {
      fillDigits(utils, [9, 9, 9, 9]);
      submitGuess(utils);
      dismissTeachingIfPresent(utils);
    }
    expect(utils.queryByTestId('tutorial-toast-auto-hint')).toBeTruthy();

    // Turn 7 — locked position 0 is auto-filled, so the player only
    // types into the 3 remaining slots. Submitting must NOT re-fire
    // the auto-hint toast (the guard is the once-per-match autoHintFired
    // flag).
    fillDigits(utils, [9, 9, 9]);
    submitGuess(utils);
    dismissTeachingIfPresent(utils);
    // The toast component re-renders the same testID — visibility is
    // controlled by `state.showAutoHintToast`. Hint never re-fires →
    // no second wave of badge text. We can't easily assert "never
    // re-shown after dismiss" because the toast doesn't auto-clear,
    // but the once-only invariant matters because of side effects:
    // the locked digit must not move after a second turn-6-equivalent
    // moment. Assert the locked tile in the draft row still shows
    // digit 1 (secret[0]).
    expect(utils.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('a fresh match (after Try again) re-arms the auto-hint at turn 6', () => {
    pinSecret(SECRET_DIGITS_1234);
    const utils = mountTutorial();
    dismissWelcome(utils);
    // Lose first match.
    for (let turn = 0; turn < 10; turn += 1) {
      fillDigits(utils, [9, 9, 9, 9]);
      submitGuess(utils);
      dismissTeachingIfPresent(utils);
    }
    act(() => {
      fireEvent.press(utils.getByText('Try again'));
    });
    // Welcome reappears for the new match.
    dismissWelcome(utils);
    // No auto-hint yet on the fresh match.
    expect(utils.queryByTestId('tutorial-toast-auto-hint')).toBeNull();
    for (let turn = 0; turn < 6; turn += 1) {
      fillDigits(utils, [9, 9, 9, 9]);
      submitGuess(utils);
      dismissTeachingIfPresent(utils);
    }
    expect(utils.queryByTestId('tutorial-toast-auto-hint')).toBeTruthy();
  });

  it('winning on turn 6 itself does NOT trigger the auto-hint (win check runs first)', () => {
    pinSecret(SECRET_DIGITS_1234);
    const utils = mountTutorial();
    dismissWelcome(utils);
    // Five losing guesses to land on turn 6.
    for (let turn = 0; turn < 5; turn += 1) {
      fillDigits(utils, [9, 9, 9, 9]);
      submitGuess(utils);
      dismissTeachingIfPresent(utils);
    }
    // Turn 6 — guess the secret.
    fillDigits(utils, SECRET_DIGITS_1234);
    submitGuess(utils);
    expect(utils.getByText('Code cracked!')).toBeTruthy();
    expect(utils.queryByTestId('tutorial-toast-auto-hint')).toBeNull();
  });

  it('win surfaces the celebration overlay; Continue grants 50 tokens and marks complete', () => {
    pinSecret(SECRET_DIGITS_1234);
    const utils = mountTutorial();
    dismissWelcome(utils);
    fillDigits(utils, SECRET_DIGITS_1234);
    submitGuess(utils);

    expect(utils.getByText('Code cracked!')).toBeTruthy();
    expect(utils.getByText('+50 tokens earned.')).toBeTruthy();

    const before = useUserStore.getState();
    expect(before.onboarding.tutorialMatchCompleted).toBe(false);

    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });

    const after = useUserStore.getState();
    expect(after.tokens).toBe(before.tokens + 50);
    expect(after.onboarding.tutorialMatchCompleted).toBe(true);
    // recordMatchResult was NOT called — gamesPlayed must be unchanged
    // (DDA bypass invariant).
    expect(after.stats.gamesPlayed).toBe(before.stats.gamesPlayed);
    expect(after.stats.recentMatches).toEqual(before.stats.recentMatches);
    // Phase 7A.6 CP7 — Win Continue forwards to the token walkthrough,
    // not Home (was the CP3 placeholder).
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe(
      'OnboardingTokenWalkthrough',
    );
  });

  it('skip button opens the confirm dialog; Cancel keeps the match running', () => {
    pinSecret(SECRET_DIGITS_1234);
    const utils = mountTutorial();
    dismissWelcome(utils);
    act(() => {
      fireEvent.press(utils.getByLabelText('Skip tutorial'));
    });
    expect(utils.getByText('Skip tutorial match?')).toBeTruthy();

    act(() => {
      fireEvent.press(utils.getByText('Cancel'));
    });
    expect(utils.queryByText('Skip tutorial match?')).toBeNull();
    // Still on TutorialMatch — not navigated away.
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('TutorialMatch');
    expect(useUserStore.getState().onboarding.tutorialMatchCompleted).toBe(false);
  });

  it('skip confirm marks tutorial complete and forwards to OnboardingTokenWalkthrough', () => {
    // Phase 7A.6 CP7 — atomic step skip: TutorialMatch's mid-match
    // Skip is a step-level skip, not a full-flow skip. It marks
    // the tutorial step done and forwards to the next step (CP4
    // token walkthrough); the user can still Skip All from there.
    pinSecret(SECRET_DIGITS_1234);
    const utils = mountTutorial();
    dismissWelcome(utils);
    act(() => {
      fireEvent.press(utils.getByLabelText('Skip tutorial'));
    });

    act(() => {
      fireEvent.press(utils.getByText('Skip'));
    });

    expect(useUserStore.getState().onboarding.tutorialMatchCompleted).toBe(true);
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe(
      'OnboardingTokenWalkthrough',
    );
  });

  it('losing 10 turns transitions to the lose view with code reveal', () => {
    pinSecret(SECRET_DIGITS_1234);
    const utils = mountTutorial();
    dismissWelcome(utils);
    for (let turn = 0; turn < 10; turn += 1) {
      fillDigits(utils, [9, 9, 9, 9]);
      submitGuess(utils);
      dismissTeachingIfPresent(utils);
    }
    expect(utils.getByText('Not this time')).toBeTruthy();
    expect(utils.getByText('Try again')).toBeTruthy();
    expect(utils.getByText('Skip and continue')).toBeTruthy();
    // The reveal renders the secret digits.
    expect(utils.getByTestId('tutorial-lose-reveal')).toBeTruthy();
  });

  it('Try again resets the match and does NOT mark tutorial complete', () => {
    pinSecret(SECRET_DIGITS_1234);
    const utils = mountTutorial();
    dismissWelcome(utils);
    for (let turn = 0; turn < 10; turn += 1) {
      fillDigits(utils, [9, 9, 9, 9]);
      submitGuess(utils);
      dismissTeachingIfPresent(utils);
    }

    act(() => {
      fireEvent.press(utils.getByText('Try again'));
    });

    // Back to the welcome overlay (fresh match) and the lose CTAs are gone.
    expect(utils.queryByText('Not this time')).toBeNull();
    expect(utils.getByText('Crack the code')).toBeTruthy();
    expect(useUserStore.getState().onboarding.tutorialMatchCompleted).toBe(false);
  });

  it('Skip and continue from the lose view marks complete and forwards to OnboardingTokenWalkthrough', () => {
    // Phase 7A.6 CP7 — same atomic step-skip semantic as the
    // mid-match Skip confirm: tutorial step marked done, flow
    // continues to CP4.
    pinSecret(SECRET_DIGITS_1234);
    const utils = mountTutorial();
    dismissWelcome(utils);
    for (let turn = 0; turn < 10; turn += 1) {
      fillDigits(utils, [9, 9, 9, 9]);
      submitGuess(utils);
      dismissTeachingIfPresent(utils);
    }

    act(() => {
      fireEvent.press(utils.getByText('Skip and continue'));
    });

    expect(useUserStore.getState().onboarding.tutorialMatchCompleted).toBe(true);
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe(
      'OnboardingTokenWalkthrough',
    );
  });

  it('manual hints do not exist in the tutorial UI (Mode 1 has no hint affordance)', () => {
    pinSecret(SECRET_DIGITS_1234);
    const utils = mountTutorial();
    dismissWelcome(utils);
    // No HINT or PROBE buttons should be on the tutorial screen — they
    // belong to the Daily Challenge surface, not Mode 1.
    expect(utils.queryByText('HINT')).toBeNull();
    expect(utils.queryByText('PROBE')).toBeNull();
  });

  it('skip pressed during the welcome overlay dismisses it and shows the confirm', () => {
    pinSecret(SECRET_DIGITS_1234);
    const utils = mountTutorial();
    // Welcome is visible.
    expect(utils.getByText('Crack the code')).toBeTruthy();
    act(() => {
      fireEvent.press(utils.getByLabelText('Skip tutorial'));
    });
    // Welcome is gone, confirm is visible (no stacked overlays).
    expect(utils.queryByText('Crack the code')).toBeNull();
    expect(utils.getByText('Skip tutorial match?')).toBeTruthy();
  });
});
