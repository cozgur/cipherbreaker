/**
 * Phase 7A.7 CP1 — haptic feedback helper.
 *
 * Three named functions cover the iOS Haptics taxonomy:
 *
 *   selection() — UISelectionFeedbackGenerator.selectionChanged().
 *     Lightest tick. Fires on incremental UI selections (slide
 *     swipes, digit-tile taps, modal dismissals).
 *   impact(style) — UIImpactFeedbackGenerator.impactOccurred(style).
 *     Light / medium / heavy. Fires on discrete user actions
 *     (button presses, modal opens, token earn beats).
 *   notify(type) — UINotificationFeedbackGenerator.notificationOccurred(type).
 *     Success / warning / error. Fires on outcome moments (match
 *     win, draw, loss, low balance, streak break).
 *
 * Every function gates on `useSettingsStore.getState().haptics`
 * (default `true`, toggleable via the existing
 * `toggleSetting('haptics')` action and the Settings UI toggle
 * already wired in `ProfileScreen`). Call sites NEVER read the
 * setting directly — the helper is the single gate.
 *
 * Fire-and-forget: `expo-haptics`'s underlying calls return
 * promises; we discard them via `void` and `.catch` so that:
 *   1. No haptic ever blocks the UI thread.
 *   2. Simulator / unsupported-platform throws (expo-haptics can
 *      reject on iOS Simulator / Web / Android emulator) get
 *      swallowed silently. The user pressed the button; an
 *      uncaught rejection here would surface a noisy console
 *      error for what is just "device doesn't have a Taptic
 *      Engine."
 *
 * Test mocking strategy (jest.setup.js): `@/lib/haptics` is
 * mocked globally as no-ops, AND `expo-haptics` is mocked at the
 * native-binding level. The helper's own test file
 * (`haptics.test.ts`) calls `jest.unmock('@/lib/haptics')` to
 * exercise the real impl against the mocked native bindings.
 */

import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '@state/settingsStore';

function isEnabled(): boolean {
  return useSettingsStore.getState().haptics === true;
}

function fireAndForget(promise: Promise<void>): void {
  promise.catch(() => {
    // Silent — see module doc, fire-and-forget rationale.
  });
}

export function selection(): void {
  if (!isEnabled()) return;
  fireAndForget(Haptics.selectionAsync());
}

export type ImpactStyle = 'light' | 'medium' | 'heavy';

const IMPACT_STYLE_MAP: Record<ImpactStyle, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

export function impact(style: ImpactStyle = 'light'): void {
  if (!isEnabled()) return;
  fireAndForget(Haptics.impactAsync(IMPACT_STYLE_MAP[style]));
}

export type NotifyType = 'success' | 'warning' | 'error';

const NOTIFY_TYPE_MAP: Record<NotifyType, Haptics.NotificationFeedbackType> = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
};

export function notify(type: NotifyType): void {
  if (!isEnabled()) return;
  fireAndForget(Haptics.notificationAsync(NOTIFY_TYPE_MAP[type]));
}
