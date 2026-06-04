/**
 * Phase 7A.6 CP5 — Mirror mode teaser.
 *
 * One-shot interrupt fired by HomeScreen when
 * `matchesCompletedSinceOnboarding === 5` AND `mirrorTeaserSeen === false`.
 * Inline overlay component (TutorialOverlay-style: absolute fill +
 * non-dismissive backdrop), NOT a stack-route modal — same self-
 * contained pattern as BlitzTeaserModal.
 *
 * Two exit paths:
 *   - "Try Mirror →" CTA → `addTokens(50, 'mirror_teaser_gift')` +
 *     `markMirrorTeaserSeen()` + `onClose`. The 50-token gift
 *     partially covers Mirror's 75 stake — the spec accepts the
 *     partial-cover (a paying decision: tokens make Mirror
 *     reachable but not free).
 *   - "Skip" → `markMirrorTeaserSeen()` only (no token grant) +
 *     `onClose`.
 *
 * Hero visual is the CP1 AI-generated brand illustration
 * (`teaser-mirror.png`) rendered via the shared `ModalHeroImage`
 * block (top ~40% of the card, bottom-fade gradient for text
 * contrast). Phase 7A.8 CP4 replaced the earlier inline split-board
 * mockup with this asset — the mockup deliberately diverged from
 * the production Mode 7 layout, so the brand illustration is no
 * longer a mechanic demo.
 *
 * Skip rendered last in the JSX tree so the overlay backdrop never
 * absorbs its tap.
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

const MIRROR_TEASER_GIFT_TOKENS = 50;
const MIRROR_MODE_ID = 7;

// Phase 7A.8 CP4 — AI hero asset (Flux Pro Ultra). Sole hero
// visual; replaced the legacy inline split-board mockup.
const AI_HERO = require('../../../assets/onboarding/teaser-mirror.png');

interface MirrorTeaserModalProps {
  readonly visible: boolean;
  /** Skip / backdrop dismiss — no unlock, no gift. */
  readonly onClose: () => void;
  /**
   * Phase 7A.8 CP8 — "Try Mirror" accepted. The modal handles the
   * promotional unlock + token gift + seen flag; `onTry` hands
   * navigation to the parent (HomeScreen routes Mode 7 to
   * ModeTutorial / Matchmaking). Split from `onClose` so Skip never
   * navigates.
   */
  readonly onTry: () => void;
}

export function MirrorTeaserModal({
  visible,
  onClose,
  onTry,
}: MirrorTeaserModalProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const addTokens = useUserStore((s) => s.addTokens);
  const grantModeUnlock = useUserStore((s) => s.grantModeUnlock);
  const markMirrorTeaserSeen = useUserStore((s) => s.markMirrorTeaserSeen);

  // Phase 7A.7 CP1 — open haptic, same pattern as BlitzTeaser.
  useEffect(() => {
    if (visible) haptics.impact('light');
  }, [visible]);

  if (!visible) return null;

  const handleSkip = (): void => {
    haptics.selection();
    markMirrorTeaserSeen();
    onClose();
  };

  const handleTry = (): void => {
    haptics.impact('medium');
    sound.earn();
    // Phase 7A.8 CP8 — promotional unlock for Mode 7 (idempotent) +
    // the separate 50-token gift (partial cover of Mirror's 75 stake,
    // unchanged from CP5). Navigation is the parent's job.
    grantModeUnlock(MIRROR_MODE_ID);
    addTokens(MIRROR_TEASER_GIFT_TOKENS, 'mirror_teaser_gift');
    markMirrorTeaserSeen();
    onTry();
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      testID="mirror-teaser-modal"
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
          accessibilityLabel="Same code. Solo race. First to crack wins. Speed matters more than precision."
        >
          <ModalHeroImage
            source={AI_HERO}
            accessibilityLabel="Mirror mode hero illustration"
          />

          <View style={styles.copy}>
            <Text style={styles.title} accessibilityRole="header">
              Same code. Solo race.
            </Text>
            <Text style={styles.body}>
              First to crack wins. Speed matters more than precision.
            </Text>
            <Text style={styles.giftLine}>
              Try it now — we&apos;ve got 50 tokens for you.
            </Text>
          </View>

          <Button onPress={handleTry} size="lg" style={styles.cta}>
            Try Mirror →
          </Button>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip Mirror teaser"
        onPress={handleSkip}
        style={({ pressed }) => [
          styles.skipFloater,
          { top: insets.top + 14 },
          pressed && styles.skipPressed,
        ]}
        testID="mirror-teaser-skip"
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
