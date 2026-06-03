/**
 * Phase 7A.6 CP6 — soft-ask modal before iOS native notification
 * permission prompt.
 *
 * Triggered from `DailyResultScreen` on first Daily WIN where
 * `notificationOptInAsked === false`. The flag-gate is the source
 * of "first" — once asked, the flag flips and the modal never
 * re-fires from the CP6 logic.
 *
 * Two exit paths:
 *   - "Not now" → `markNotificationOptInAsked()` only, no native
 *     prompt. iOS permission state stays untouched so a future
 *     Settings re-enable (CP8 polish) can re-ask.
 *   - "Turn on reminders" → `await Notifications.requestPermissionsAsync()`
 *     → `markNotificationOptInAsked()` regardless of the
 *     result. iOS holds the prompt until the user responds, so
 *     either 'granted' or 'denied' is the natural settle. Setting
 *     the flag in both cases keeps the soft-ask single-shot —
 *     re-prompts after denial would feel spammy.
 *
 * SCOPE BOUNDARY: this CP only fires the native permission
 * request. It does NOT register the device with APNs, schedule
 * any notifications, configure delivery handlers, or implement
 * Daily reminder content. All of that is Phase 7B+.
 *
 * Hero visual is the CP1 AI-generated brand illustration
 * (`modal-notification.png`) rendered via the shared
 * `ModalHeroImage` block (top ~40% of the card, bottom-fade
 * gradient for text contrast). Phase 7A.8 CP4 replaced the earlier
 * inline stylized iOS-notification-banner mockup with this asset.
 */

import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import * as haptics from '@/lib/haptics';
import * as sound from '@/lib/sound';
import { Button } from '@components/Button';
import { ModalHeroImage } from '@components/ModalHeroImage';
import { useUserStore } from '@state/userStore';
import { colors, fonts, withAlpha } from '@theme/tokens';

// Phase 7A.8 CP4 — AI hero asset (Flux Pro Ultra). Sole hero
// visual; replaced the legacy inline iOS-notification-banner mockup.
const AI_HERO = require('../../../assets/onboarding/modal-notification.png');

interface NotificationOptInModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
}

export function NotificationOptInModal({
  visible,
  onClose,
}: NotificationOptInModalProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const markNotificationOptInAsked = useUserStore((s) => s.markNotificationOptInAsked);

  // Phase 7A.7 CP1 — open haptic, same pattern as CP5 teasers.
  useEffect(() => {
    if (visible) haptics.impact('light');
  }, [visible]);

  if (!visible) return null;

  const handleNotNow = (): void => {
    haptics.selection();
    markNotificationOptInAsked();
    onClose();
  };

  const handleTurnOn = async (): Promise<void> => {
    haptics.impact('medium');
    // Phase 7A.7 CP2 — fires BEFORE the await so the audio
    // plays even if iOS denies permission silently (cached
    // "Don't Allow" returns immediately without UI).
    sound.dailyUnlock();
    // Fire the native permission request. iOS displays its system
    // prompt; this promise resolves only after the user taps
    // "Allow" or "Don't Allow" (or, on subsequent calls past a
    // prior denial, resolves immediately with the cached state).
    // Either way we flip the flag — the soft-ask is single-shot.
    try {
      await Notifications.requestPermissionsAsync();
    } catch {
      // expo-notifications can throw on simulators / unsupported
      // platforms. We still flip the flag — the user clicked "Turn
      // on reminders" intentionally; a re-prompt after a thrown
      // error would feel broken. Phase 7B's real analytics layer
      // surfaces this case for instrumentation.
    }
    markNotificationOptInAsked();
    onClose();
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      testID="notification-opt-in-modal"
      accessibilityRole="alert"
    >
      <Pressable
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={styles.backdrop}
        onPress={() => {}}
      />
      <View
        style={[
          styles.shell,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 },
        ]}
        pointerEvents="box-none"
      >
        <View
          style={styles.card}
          accessible
          accessibilityViewIsModal
          accessibilityLabel="Don't miss tomorrow's Daily. We'll remind you when a new Daily Challenge unlocks."
        >
          <ModalHeroImage
            source={AI_HERO}
            accessibilityLabel="Daily reminder hero illustration"
          />

          <View style={styles.copy}>
            <Text style={styles.title} accessibilityRole="header">
              Don&apos;t miss tomorrow&apos;s Daily
            </Text>
            <Text style={styles.body}>
              We&apos;ll remind you when a new Daily Challenge unlocks.
            </Text>
          </View>

          <Button onPress={handleTurnOn} size="lg" style={styles.cta}>
            Turn on reminders
          </Button>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification opt-in"
        onPress={handleNotNow}
        style={({ pressed }) => [
          styles.skipFloater,
          { top: insets.top + 14 },
          pressed && styles.skipPressed,
        ]}
        testID="notification-opt-in-skip"
      >
        <Text style={styles.skipLabel}>Not now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha('#000000', 0.78),
  },
  shell: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: colors.bgElevated,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    // Phase 7A.6 CP8 polish — bumped from 18 → 24 so the CTA gets
    // breathing room from the card's bottom edge. Same direction
    // as the marginTop / marginHorizontal nudges below.
    paddingBottom: 24,
  },
  copy: {
    paddingTop: 22,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  body: {
    marginTop: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cta: {
    // Phase 7A.6 CP8 polish — was 18 / 18; CTA visibly cramped
    // against body text and card edges on iOS Simulator manual
    // sanity. Bumped to 28 vertical / 22 horizontal so the CTA
    // sits with at least 22px inset from card edges and 28px
    // from body text above. Layout shape preserved (CTA stays
    // inside the card; CP4-style "button outside card" is a
    // separate design decision, deferred).
    marginTop: 28,
    marginHorizontal: 22,
  },
  skipFloater: {
    position: 'absolute',
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    zIndex: 100,
    elevation: 12,
  },
  skipPressed: { opacity: 0.55 },
  skipLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#ffffff',
    opacity: 0.85,
  },
});
