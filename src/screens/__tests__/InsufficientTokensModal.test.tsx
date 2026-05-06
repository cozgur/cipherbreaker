import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests } from '@data/mockUser';
import { AD_CAP_PER_DAY } from '@game/economy/constants';
import { useUserStore } from '@state/userStore';
import { HomeScreen } from '../HomeScreen';
import { InsufficientTokensModal } from '../InsufficientTokensModal';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

function renderModal(modeId: number) {
  return renderWithNavigation(
    'InsufficientTokens',
    {
      InsufficientTokens: InsufficientTokensModal,
      AdWatch: RouteStubScreen,
      Shop: RouteStubScreen,
      Home: HomeScreen,
    },
    { modeId },
  );
}

describe('InsufficientTokensModal', () => {
  beforeEach(() => {
    __resetMockUserForTests();
    // Reset CP1 ad-cap state so each test starts with an open quota.
    useUserStore.setState({ adsWatchedToday: 0, adsWatchedLastDate: null });
  });

  it('snapshots the modal layout', () => {
    const utils = renderModal(1);
    expect(stableTreeForSnapshot(utils.toJSON())).toMatchSnapshot();
  });

  it('renders the CP4 copy ("You have X tokens. This match costs Y.")', () => {
    // Phase 7A.6 CP3.1 — default starting balance reset to 100. Pin
    // a low balance explicitly so the modal copy demonstrates the
    // "insufficient" framing (default 100 actually equals Mode 5
    // stake, which is the edge of affordable).
    useUserStore.setState({ tokens: 25 });
    const utils = renderModal(5);
    expect(utils.queryByText(/You have 25 tokens\. This match costs 100\./)).toBeTruthy();
  });

  it('reflects the live wallet balance (re-renders on token change)', () => {
    useUserStore.setState({ tokens: 25 });
    const utils = renderModal(1);
    expect(utils.queryByText(/You have 25 tokens\. This match costs 50\./)).toBeTruthy();
  });

  it('renders the new title ("Need more tokens")', () => {
    const utils = renderModal(1);
    expect(utils.queryByText('Need more tokens')).toBeTruthy();
  });

  it('Watch ad button navigates to AdWatch when the cap has headroom', () => {
    const utils = renderModal(1);
    act(() => {
      fireEvent.press(utils.getByText('Watch ad · +50'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('AdWatch');
  });

  it('Cancel button triggers goBack on the navigator (Q6=A — return to HomeScreen)', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const utils = renderModal(1);
    act(() => {
      fireEvent.press(utils.getByText('Cancel'));
    });
    expect(utils.navRef.current?.canGoBack()).toBe(false);
    errorSpy.mockRestore();
  });

  it('Close (X) button also triggers goBack', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const utils = renderModal(1);
    act(() => {
      fireEvent.press(utils.getByLabelText('Close'));
    });
    expect(utils.navRef.current?.canGoBack()).toBe(false);
    errorSpy.mockRestore();
  });

  describe('Phase 7A.5 CP4 — ad-cap-aware Watch Ad gate', () => {
    it('cap reached (today): Watch Ad button replaced with disabled "Daily ad limit reached"', () => {
      // Pin "today" via a fixed Date mock — the cap module compares
      // the persisted lastDate string against `formatDailyDate(new Date())`
      // and treats a stale day as a fresh quota. We need both
      // counters to reference the same calendar day.
      const originalDate = global.Date;
      const fixedTime = new originalDate(2026, 4, 5, 12, 0, 0).getTime();
      function MockDate(this: Date, ...args: unknown[]) {
        if (!new.target) return new (originalDate as DateConstructor)().toString();
        if (args.length === 0) return new (originalDate as DateConstructor)(fixedTime);
        // @ts-expect-error pass-through to native Date constructor
        return new (originalDate as DateConstructor)(...args);
      }
      MockDate.prototype = originalDate.prototype;
      MockDate.now = () => fixedTime;
      MockDate.parse = originalDate.parse.bind(originalDate);
      MockDate.UTC = originalDate.UTC.bind(originalDate);
      // @ts-expect-error mock Date substitution
      global.Date = MockDate;

      try {
        useUserStore.setState({
          adsWatchedToday: AD_CAP_PER_DAY,
          adsWatchedLastDate: '2026-05-05',
        });
        const utils = renderModal(1);
        expect(utils.queryByText('Daily ad limit reached')).toBeTruthy();
        expect(utils.queryByText('Watch ad · +50')).toBeNull();
      } finally {
        global.Date = originalDate;
      }
    });

    it('cap reached: Cancel button still functional (modal not stuck)', () => {
      const originalDate = global.Date;
      const fixedTime = new originalDate(2026, 4, 5, 12, 0, 0).getTime();
      function MockDate(this: Date, ...args: unknown[]) {
        if (!new.target) return new (originalDate as DateConstructor)().toString();
        if (args.length === 0) return new (originalDate as DateConstructor)(fixedTime);
        // @ts-expect-error pass-through to native Date constructor
        return new (originalDate as DateConstructor)(...args);
      }
      MockDate.prototype = originalDate.prototype;
      MockDate.now = () => fixedTime;
      MockDate.parse = originalDate.parse.bind(originalDate);
      MockDate.UTC = originalDate.UTC.bind(originalDate);
      // @ts-expect-error mock Date substitution
      global.Date = MockDate;

      try {
        useUserStore.setState({
          adsWatchedToday: AD_CAP_PER_DAY,
          adsWatchedLastDate: '2026-05-05',
        });
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const utils = renderModal(1);
        act(() => {
          fireEvent.press(utils.getByText('Cancel'));
        });
        expect(utils.navRef.current?.canGoBack()).toBe(false);
        errorSpy.mockRestore();
      } finally {
        global.Date = originalDate;
      }
    });

    it('stale-day cap (yesterday at the limit): Watch Ad re-enabled today (cross-midnight reset)', () => {
      const originalDate = global.Date;
      const fixedTime = new originalDate(2026, 4, 5, 12, 0, 0).getTime();
      function MockDate(this: Date, ...args: unknown[]) {
        if (!new.target) return new (originalDate as DateConstructor)().toString();
        if (args.length === 0) return new (originalDate as DateConstructor)(fixedTime);
        // @ts-expect-error pass-through to native Date constructor
        return new (originalDate as DateConstructor)(...args);
      }
      MockDate.prototype = originalDate.prototype;
      MockDate.now = () => fixedTime;
      MockDate.parse = originalDate.parse.bind(originalDate);
      MockDate.UTC = originalDate.UTC.bind(originalDate);
      // @ts-expect-error mock Date substitution
      global.Date = MockDate;

      try {
        useUserStore.setState({
          adsWatchedToday: AD_CAP_PER_DAY,
          adsWatchedLastDate: '2026-05-04', // yesterday — stale
        });
        const utils = renderModal(1);
        expect(utils.queryByText('Watch ad · +50')).toBeTruthy();
        expect(utils.queryByText('Daily ad limit reached')).toBeNull();
      } finally {
        global.Date = originalDate;
      }
    });
  });
});
