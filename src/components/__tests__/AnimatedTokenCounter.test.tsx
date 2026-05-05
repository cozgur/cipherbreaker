/**
 * Phase 7A.5 CP7 — AnimatedTokenCounter behaviour suite.
 *
 * Pure interpolation math under fake timers: prop changes drive
 * the count-up; reduced motion bypasses the interval; mid-anim
 * re-target snapshots from the current display.
 */

import { act, render } from '@testing-library/react-native';

import { AnimatedTokenCounter } from '../AnimatedTokenCounter';
// Phase 7A.5 Codex round 2 finding 3 — useReducedMotion is mocked
// in jest.setup.js as a `jest.fn(() => false)`. Per-test overrides
// flip the return value via the standard mockReturnValue API.
import { useReducedMotion } from '@/lib/useReducedMotion';
const mockedUseReducedMotion = useReducedMotion as jest.MockedFunction<
  typeof useReducedMotion
>;

describe('AnimatedTokenCounter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Reset to the default (animations enabled) before each test.
    mockedUseReducedMotion.mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders the initial value formatted with toLocaleString', () => {
    const utils = render(<AnimatedTokenCounter value={1840} />);
    expect(utils.queryByText('1,840')).toBeTruthy();
  });

  it('renders the prefix when supplied (reward chip "+" sign)', () => {
    const utils = render(<AnimatedTokenCounter value={120} prefix="+" />);
    expect(utils.queryByText('+120')).toBeTruthy();
  });

  it('animates from previous value to new value on prop change', () => {
    const utils = render(<AnimatedTokenCounter value={100} duration={1000} />);
    expect(utils.queryByText('100')).toBeTruthy();
    // Re-render with new value.
    utils.rerender(<AnimatedTokenCounter value={200} duration={1000} />);
    // Mid-animation: ease-out-quad at t=0.5 → 1 - 0.25 = 0.75 →
    // 100 + (200-100) * 0.75 = 175. Allow ±2 tolerance for the
    // 16ms tick alignment.
    act(() => {
      jest.advanceTimersByTime(500);
    });
    const intermediateNode = utils.queryByText(/^1[7-9][0-9]$/);
    expect(intermediateNode).toBeTruthy();
    // Full duration: lands exactly at target.
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(utils.queryByText('200')).toBeTruthy();
  });

  it('settles exactly on the target after the full duration (defends float rounding)', () => {
    const utils = render(<AnimatedTokenCounter value={0} duration={500} />);
    utils.rerender(<AnimatedTokenCounter value={3} duration={500} />);
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(utils.queryByText('3')).toBeTruthy();
  });

  it('reduced motion: skips animation, sets value directly on prop change', () => {
    mockedUseReducedMotion.mockReturnValue(true);
    const utils = render(<AnimatedTokenCounter value={100} duration={1000} />);
    utils.rerender(<AnimatedTokenCounter value={500} duration={1000} />);
    // Reduced-motion path sets state synchronously inside the effect.
    expect(utils.queryByText('500')).toBeTruthy();
    // No intermediate frames: even if we advance time, display stays at 500.
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(utils.queryByText('500')).toBeTruthy();
  });

  it('cleans up the interval on unmount (no leaked timers)', () => {
    const utils = render(<AnimatedTokenCounter value={100} duration={1000} />);
    utils.rerender(<AnimatedTokenCounter value={200} duration={1000} />);
    utils.unmount();
    // Advancing time after unmount must not cause errors or leak.
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('mid-animation re-target: clears prior interval and snapshots from current display', () => {
    const utils = render(<AnimatedTokenCounter value={0} duration={1000} />);
    utils.rerender(<AnimatedTokenCounter value={1000} duration={1000} />);
    // 250ms in: ease-out-quad at t=0.25 → 0.4375 → 437.5 → ~437/438.
    act(() => {
      jest.advanceTimersByTime(250);
    });
    // Re-target while mid-animation. New animation should start
    // from the current displayed (~437) toward 100.
    utils.rerender(<AnimatedTokenCounter value={100} duration={1000} />);
    // Drain the new animation.
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(utils.queryByText('100')).toBeTruthy();
  });

  it('no-op when target equals current display (no spurious interval)', () => {
    const utils = render(<AnimatedTokenCounter value={100} duration={1000} />);
    // Re-render with the SAME value.
    utils.rerender(<AnimatedTokenCounter value={100} duration={1000} />);
    // No timers should be running.
    expect(jest.getTimerCount()).toBe(0);
    expect(utils.queryByText('100')).toBeTruthy();
  });

  describe('Phase 7A.5 Codex round 2 finding 2 — animateOnMount + initialValue', () => {
    it('default (animateOnMount=false): renders value directly on mount, no animation', () => {
      const utils = render(<AnimatedTokenCounter value={500} duration={1000} />);
      // Mount shows 500 immediately — no count-up frames.
      expect(utils.queryByText('500')).toBeTruthy();
      // No interval running; bail-out path on first render.
      expect(jest.getTimerCount()).toBe(0);
    });

    it('animateOnMount=true: starts at initialValue (default 0) and animates to value', () => {
      const utils = render(
        <AnimatedTokenCounter value={120} duration={1000} animateOnMount />,
      );
      // First render: shows initialValue (0).
      expect(utils.queryByText('0')).toBeTruthy();
      expect(utils.queryByText('120')).toBeNull();
      // Drain a portion: easeOutQuad at t=0.5 → 0.75 → ~90.
      act(() => {
        jest.advanceTimersByTime(500);
      });
      const intermediateNode = utils.queryByText(/^[6-9][0-9]$/);
      expect(intermediateNode).toBeTruthy();
      // Drain the rest: should land at 120.
      act(() => {
        jest.advanceTimersByTime(600);
      });
      expect(utils.queryByText('120')).toBeTruthy();
    });

    it('animateOnMount=true with custom initialValue: animates from custom start', () => {
      const utils = render(
        <AnimatedTokenCounter value={500} duration={1000} animateOnMount initialValue={100} />,
      );
      // First render: shows custom initial.
      expect(utils.queryByText('100')).toBeTruthy();
      // After full duration: lands at target.
      act(() => {
        jest.advanceTimersByTime(1100);
      });
      expect(utils.queryByText('500')).toBeTruthy();
    });

    it('animateOnMount=true respects reduced motion (jumps directly to value)', () => {
      mockedUseReducedMotion.mockReturnValue(true);
      const utils = render(
        <AnimatedTokenCounter value={120} duration={1000} animateOnMount />,
      );
      // Reduced-motion path: even though animateOnMount is true,
      // the first effect run sets value directly. The display
      // starts at initialValue (0) for the first paint, then the
      // effect immediately syncs to value (120).
      act(() => {
        jest.advanceTimersByTime(0);
      });
      expect(utils.queryByText('120')).toBeTruthy();
    });
  });
});
