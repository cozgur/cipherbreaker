/**
 * Phase 7A.6 CP5 — Blitz mode teaser.
 *
 * One-shot interrupt fired by HomeScreen when
 * `matchesCompletedSinceOnboarding === 3` AND `blitzTeaserSeen === false`.
 * Inline overlay component (TutorialOverlay-style: absolute fill +
 * non-dismissive backdrop), NOT a stack-route modal — the teaser is
 * a state-driven event, not a user-initiated navigation, and the
 * spec asks for "self-contained, no routing changes".
 *
 * Two exit paths:
 *   - "Try Blitz →" CTA → `addTokens(50, 'blitz_teaser_gift')` +
 *     `markBlitzTeaserSeen()` + `onTry`. Phase 7A.8 CP10 — the CTA no
 *     longer grants Mode 4 for free (CP8 gave away a 1000-token mode
 *     for reaching 3 matches, breaking the unlock economy). The parent
 *     (HomeScreen) opens the UnlockModal at the promotional 70%-off
 *     price; the player still chooses to buy or cancel.
 *   - "Skip" → `markBlitzTeaserSeen()` only (no token grant) +
 *     `onClose`.
 *
 * Hero visual is the CP1 AI-generated brand illustration
 * (`teaser-blitz.png`) rendered via the shared `ModalHeroImage`
 * block (top ~40% of the card, bottom-fade gradient for text
 * contrast). Phase 7A.8 CP4 replaced the earlier inline clock +
 * mini-board mockup with this asset.
 *
 * Skip rendered last in the JSX tree (zIndex via order) so the
 * overlay backdrop never absorbs its tap — same pattern
 * TutorialMatchScreen uses.
 */

import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as haptics from '@/lib/haptics';
import * as sound from '@/lib/sound';
import { Button } from '@components/Button';
import { ModalHeroImage } from '@components/ModalHeroImage';
import { useUserStore } from '@state/userStore';
import { colors, fonts, withAlpha } from '@theme/tokens';

const BLITZ_TEASER_GIFT_TOKENS = 50;

// Phase 7A.8 CP4 — AI hero asset (Flux Pro Ultra). Sole hero
// visual; replaced the legacy inline clock + mini-board mockup.
const AI_HERO = require('../../../assets/onboarding/teaser-blitz.png');

interface BlitzTeaserModalProps {
  readonly visible: boolean;
  /** Skip / backdrop dismiss — no unlock, no gift. */
  readonly onClose: () => void;
  /**
   * Phase 7A.8 CP10 — "Try Blitz" accepted. The modal grants the
   * 50-token gift + flips the seen flag, then calls `onTry` so the
   * parent (HomeScreen) opens the UnlockModal at the promotional
   * Mode 4 price. Split out from `onClose` so Skip never navigates.
   */
  readonly onTry: () => void;
}

export function BlitzTeaserModal({
  visible,
  onClose,
  onTry,
}: BlitzTeaserModalProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const addTokens = useUserStore((s) => s.addTokens);
  const markBlitzTeaserSeen = useUserStore((s) => s.markBlitzTeaserSeen);

  // Phase 7A.7 CP1 — open haptic. Fires when the modal becomes
  // visible. The dep array re-fires only on visible flipping
  // false → true (and on initial mount when visible already true);
  // never fires when other props change.
  useEffect(() => {
    if (visible) haptics.impact('light');
  }, [visible]);

  if (!visible) return null;

  const handleSkip = (): void => {
    haptics.selection();
    markBlitzTeaserSeen();
    onClose();
  };

  const handleTry = (): void => {
    haptics.impact('medium');
    sound.earn();
    // Phase 7A.8 CP10 — no free Mode 4 unlock here anymore. Keep the
    // 50-token gift (covers Blitz's 50 stake) and flip the seen gate so
    // the teaser never re-shows, then hand off to the parent, which
    // opens the UnlockModal at the promotional 70%-off price. The
    // player buys or cancels there; cancelling keeps the gift.
    addTokens(BLITZ_TEASER_GIFT_TOKENS, 'blitz_teaser_gift');
    markBlitzTeaserSeen();
    onTry();
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      testID="blitz-teaser-modal"
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
          accessibilityLabel="Beat the clock. 60 seconds. Crack the code before time runs out."
        >
          <ModalHeroImage
            source={AI_HERO}
            accessibilityLabel="Blitz mode hero illustration"
          />

          <View style={styles.copy}>
            <Text style={styles.title} accessibilityRole="header">
              Beat the clock
            </Text>
            <Text style={styles.body}>
              60 seconds. Crack the code before time runs out.
            </Text>
            <Text style={styles.giftLine}>
              Try it now — we&apos;ll cover your first stake.
            </Text>
          </View>

          <Button onPress={handleTry} size="lg" style={styles.cta} fullWidth={false}>
            Try Blitz →
          </Button>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip Blitz teaser"
        onPress={handleSkip}
        style={({ pressed }) => [
          styles.skipFloater,
          { top: insets.top + 14 },
          pressed && styles.skipPressed,
        ]}
        testID="blitz-teaser-skip"
      >
        <Text style={styles.skipLabel}>Skip</Text>
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
    paddingBottom: 18,
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
  giftLine: {
    marginTop: 12,
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.gold,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  cta: {
    marginTop: 18,
    marginHorizontal: 18,
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
