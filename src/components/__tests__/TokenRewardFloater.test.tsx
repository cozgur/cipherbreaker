/**
 * Phase 7A.5 CP7 — TokenRewardFloater behaviour suite.
 *
 * One-shot translate+fade primitive driven by a state-interpolated
 * `progress` (0..1). The animation completes at duration; callers
 * receive `onComplete` to clean up.
 */

import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { TokenRewardFloater } from '../TokenRewardFloater';

describe('TokenRewardFloater', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders the +amount text formatted with toLocaleString', () => {
    const utils = render(
      <TokenRewardFloater amount={1500} onComplete={() => undefined} />,
    );
    expect(utils.queryByText('+1,500')).toBeTruthy();
  });

  it('exposes the amount via accessibility label for screen readers', () => {
    const utils = render(
      <TokenRewardFloater amount={120} onComplete={() => undefined} />,
    );
    expect(utils.queryByLabelText('Reward earned: +120 tokens')).toBeTruthy();
  });

  it('calls onComplete exactly once after the duration elapses', () => {
    const onComplete = jest.fn();
    render(
      <TokenRewardFloater
        amount={100}
        onComplete={onComplete}
        duration={1500}
      />,
    );
    expect(onComplete).not.toHaveBeenCalled();
    // Advance slightly past `duration`: with the 16ms tick counter,
    // the threshold crosses at the next tick AT OR AFTER duration
    // (e.g., t=1 lands at sim-time 1504ms for duration 1500).
    act(() => {
      jest.advanceTimersByTime(1600);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onComplete before duration elapses', () => {
    const onComplete = jest.fn();
    render(
      <TokenRewardFloater
        amount={100}
        onComplete={onComplete}
        duration={1500}
      />,
    );
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('reduced motion: fires onComplete immediately on next tick (no animation frames)', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);
    const onComplete = jest.fn();
    render(
      <TokenRewardFloater
        amount={100}
        onComplete={onComplete}
        duration={1500}
      />,
    );
    // The reduced-motion hook resolves async; flush the promise.
    await act(async () => {
      await Promise.resolve();
    });
    // The 0ms setTimeout in the reduced-motion branch fires on
    // the next macrotask.
    act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('cleans up the interval on unmount (no leaked timers, no late onComplete)', () => {
    const onComplete = jest.fn();
    const utils = render(
      <TokenRewardFloater
        amount={100}
        onComplete={onComplete}
        duration={1500}
      />,
    );
    utils.unmount();
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
