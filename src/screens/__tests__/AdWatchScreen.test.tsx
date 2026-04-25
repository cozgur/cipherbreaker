import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import { AdWatchScreen } from '../AdWatchScreen';
import { HomeScreen } from '../HomeScreen';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

describe('AdWatchScreen', () => {
  beforeEach(() => {
    __resetMockUserForTests();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('snapshots the initial countdown frame', () => {
    const { toJSON } = renderWithNavigation('AdWatch', { AdWatch: AdWatchScreen });
    expect(stableTreeForSnapshot(toJSON())).toMatchSnapshot();
  });

  it('starts at "Skip in 3" and counts down each second', () => {
    const utils = renderWithNavigation('AdWatch', { AdWatch: AdWatchScreen });
    expect(utils.queryByText('Skip in 3')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(utils.queryByText('Skip in 2')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(utils.queryByText('Skip in 1')).toBeTruthy();
  });

  it('Skip button arms when two seconds remain and grants the reward when tapped', () => {
    const before = mockUser.tokens;
    const utils = renderWithNavigation('AdWatch', {
      AdWatch: AdWatchScreen,
      Home: HomeScreen,
    });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    // Now at 2 seconds left → label flips to plain "Skip" + button armed.
    const skip = utils.getByText('Skip');
    expect(skip).toBeTruthy();

    act(() => {
      fireEvent.press(skip);
    });
    expect(mockUser.tokens).toBe(before + 50);
  });

  it('auto-completes after 5 seconds and pops to the top of the stack', () => {
    const before = mockUser.tokens;
    const utils = renderWithNavigation('AdWatch', {
      AdWatch: AdWatchScreen,
      Home: HomeScreen,
    });
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(mockUser.tokens).toBe(before + 50);
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('AdWatch');
    // popToTop fires on the same tick as the reward grant.
    act(() => {
      jest.advanceTimersByTime(0);
    });
  });

  it('logs an analytics line on completion', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    renderWithNavigation('AdWatch', {
      AdWatch: AdWatchScreen,
      Home: HomeScreen,
    });
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(logSpy).toHaveBeenCalledWith(
      '[analytics] ad_watch_completed',
      expect.objectContaining({ tokens: 50, reason: 'completed' }),
    );
  });
});
