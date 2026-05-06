import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import { RootNavigator } from '../RootNavigator';

const insets = { top: 44, left: 0, right: 0, bottom: 34 };

function renderRoot() {
  return render(
    <SafeAreaProvider initialMetrics={{ insets, frame: { x: 0, y: 0, width: 390, height: 844 } }}>
      <RootNavigator />
    </SafeAreaProvider>,
  );
}

describe('RootNavigator', () => {
  beforeEach(() => {
    __resetMockUserForTests();
  });

  it('lands on Home when the player has already onboarded', () => {
    // Phase 7A.6 CP3.1 — hasOnboarded default flipped to false, so
    // the "already onboarded" path now requires an explicit flip.
    mockUser.hasOnboarded = true;
    const utils = renderRoot();
    // The "CipherBreaker" hero on Home is unique to that screen.
    expect(utils.getByText('CipherBreaker')).toBeTruthy();
  });

  it('lands on Onboarding for a fresh install', () => {
    // hasOnboarded defaults to false post-CP3.1 — no explicit flip
    // needed; this matches a real fresh-install path.
    expect(mockUser.hasOnboarded).toBe(false);
    const utils = renderRoot();
    expect(utils.getByText('Crack the code.\nBeat your rival.')).toBeTruthy();
  });
});
