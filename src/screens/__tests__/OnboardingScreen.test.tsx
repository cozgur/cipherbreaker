import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import { HomeScreen } from '../HomeScreen';
import { OnboardingScreen } from '../OnboardingScreen';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

describe('OnboardingScreen', () => {
  beforeEach(() => {
    __resetMockUserForTests();
    mockUser.hasOnboarded = false;
  });

  it('snapshots the initial slide', () => {
    const { toJSON } = renderWithNavigation('Onboarding', {
      Onboarding: OnboardingScreen,
      Home: HomeScreen,
    });
    expect(stableTreeForSnapshot(toJSON())).toMatchSnapshot();
  });

  it('advances through the three slides before finishing', () => {
    const utils = renderWithNavigation('Onboarding', {
      Onboarding: OnboardingScreen,
      Home: HomeScreen,
    });
    // Slide 1 → Next
    expect(utils.getByText('Crack the code.\nBeat your rival.')).toBeTruthy();
    fireEvent.press(utils.getByText('Next'));
    // Slide 2
    expect(utils.getByText('Win tokens.\nClimb the ranks.')).toBeTruthy();
    fireEvent.press(utils.getByText('Next'));
    // Slide 3 exposes Start Playing
    expect(utils.getByText('You start with\n500 tokens.')).toBeTruthy();
    expect(utils.getByText('Start Playing')).toBeTruthy();
  });

  it('Skip replaces the stack with Home and flips hasOnboarded', () => {
    const utils = renderWithNavigation('Onboarding', {
      Onboarding: OnboardingScreen,
      Home: HomeScreen,
    });

    act(() => {
      fireEvent.press(utils.getByLabelText('Skip onboarding'));
    });

    expect(mockUser.hasOnboarded).toBe(true);
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Home');
  });
});
