/**
 * Phase 7A.7 CP1 — `@/lib/haptics` helper tests.
 *
 * jest.setup.js mocks `@/lib/haptics` globally as no-ops so the
 * ~20 trigger sites across the codebase don't need to know about
 * haptics. This file exercises the REAL helper implementation
 * against the jest.setup.js mock of `expo-haptics`.
 */

jest.unmock('@/lib/haptics');

import * as Haptics from 'expo-haptics';

import * as haptics from '@/lib/haptics';
import { SETTINGS_STORE_DEFAULTS, useSettingsStore } from '@state/settingsStore';

const selectionAsyncMock = Haptics.selectionAsync as jest.MockedFunction<
  typeof Haptics.selectionAsync
>;
const impactAsyncMock = Haptics.impactAsync as jest.MockedFunction<
  typeof Haptics.impactAsync
>;
const notificationAsyncMock = Haptics.notificationAsync as jest.MockedFunction<
  typeof Haptics.notificationAsync
>;

function setHaptics(enabled: boolean): void {
  useSettingsStore.setState({ ...SETTINGS_STORE_DEFAULTS, haptics: enabled });
}

describe('Phase 7A.7 CP1 — @/lib/haptics', () => {
  beforeEach(() => {
    selectionAsyncMock.mockReset();
    selectionAsyncMock.mockResolvedValue(undefined);
    impactAsyncMock.mockReset();
    impactAsyncMock.mockResolvedValue(undefined);
    notificationAsyncMock.mockReset();
    notificationAsyncMock.mockResolvedValue(undefined);
    setHaptics(true);
  });

  describe('selection()', () => {
    it('calls Haptics.selectionAsync when haptics setting is enabled', () => {
      haptics.selection();
      expect(selectionAsyncMock).toHaveBeenCalledTimes(1);
    });

    it('returns silently without calling Haptics when haptics setting is disabled', () => {
      setHaptics(false);
      haptics.selection();
      expect(selectionAsyncMock).not.toHaveBeenCalled();
    });
  });

  describe('impact(style)', () => {
    it('defaults to "light" when no style argument passed', () => {
      haptics.impact();
      expect(impactAsyncMock).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });

    it('maps "light" / "medium" / "heavy" to the matching enum', () => {
      haptics.impact('light');
      haptics.impact('medium');
      haptics.impact('heavy');
      expect(impactAsyncMock).toHaveBeenNthCalledWith(1, Haptics.ImpactFeedbackStyle.Light);
      expect(impactAsyncMock).toHaveBeenNthCalledWith(2, Haptics.ImpactFeedbackStyle.Medium);
      expect(impactAsyncMock).toHaveBeenNthCalledWith(3, Haptics.ImpactFeedbackStyle.Heavy);
    });

    it('returns silently without calling Haptics when disabled', () => {
      setHaptics(false);
      haptics.impact('medium');
      expect(impactAsyncMock).not.toHaveBeenCalled();
    });
  });

  describe('notify(type)', () => {
    it('maps "success" / "warning" / "error" to the matching enum', () => {
      haptics.notify('success');
      haptics.notify('warning');
      haptics.notify('error');
      expect(notificationAsyncMock).toHaveBeenNthCalledWith(
        1,
        Haptics.NotificationFeedbackType.Success,
      );
      expect(notificationAsyncMock).toHaveBeenNthCalledWith(
        2,
        Haptics.NotificationFeedbackType.Warning,
      );
      expect(notificationAsyncMock).toHaveBeenNthCalledWith(
        3,
        Haptics.NotificationFeedbackType.Error,
      );
    });

    it('returns silently without calling Haptics when disabled', () => {
      setHaptics(false);
      haptics.notify('error');
      expect(notificationAsyncMock).not.toHaveBeenCalled();
    });
  });

  describe('fire-and-forget rejection handling', () => {
    it('selection() does not throw when Haptics.selectionAsync rejects', async () => {
      selectionAsyncMock.mockRejectedValueOnce(new Error('simulator'));
      // The helper is sync (returns void); the rejection is swallowed
      // inside its `.catch` chain. A throw here would surface as a
      // jest unhandled-rejection warning + test failure.
      expect(() => haptics.selection()).not.toThrow();
      // Flush microtasks so the rejection's `.catch` runs before
      // the test ends; otherwise jest may report unhandled-rejection
      // even though the catch is in place.
      await new Promise((resolve) => setImmediate(resolve));
      expect(selectionAsyncMock).toHaveBeenCalledTimes(1);
    });

    it('impact() does not throw when Haptics.impactAsync rejects', async () => {
      impactAsyncMock.mockRejectedValueOnce(new Error('simulator'));
      expect(() => haptics.impact('heavy')).not.toThrow();
      await new Promise((resolve) => setImmediate(resolve));
      expect(impactAsyncMock).toHaveBeenCalledTimes(1);
    });

    it('notify() does not throw when Haptics.notificationAsync rejects', async () => {
      notificationAsyncMock.mockRejectedValueOnce(new Error('simulator'));
      expect(() => haptics.notify('error')).not.toThrow();
      await new Promise((resolve) => setImmediate(resolve));
      expect(notificationAsyncMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('settings gate is checked at call time, not at module load', () => {
    it('flipping haptics on/off between calls is respected per call', () => {
      haptics.selection();
      expect(selectionAsyncMock).toHaveBeenCalledTimes(1);

      setHaptics(false);
      haptics.selection();
      expect(selectionAsyncMock).toHaveBeenCalledTimes(1);

      setHaptics(true);
      haptics.selection();
      expect(selectionAsyncMock).toHaveBeenCalledTimes(2);
    });
  });
});
