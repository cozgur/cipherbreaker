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
 * Mockup composition reuses Mode 7 production styling where
 * possible:
 *   - Gradient `['#14b8a6', '#94a3b8']` matches modeCatalog Mirror.
 *   - "SOLO RACE" TinyTag-equivalent pill in teal `#14b8a6` mirrors
 *     SoloRaceBanner's accent.
 *   - Stylized split-board "YOU vs OPPONENT" mockup diverges from
 *     production (which uses a single-perspective banner with an
 *     opponent-count badge). Same accepted-divergence pattern as
 *     CP4.1 — the mockup illustrates "race semantics" rather than
 *     mirroring the production layout 1:1.
 *
 * Skip rendered last in the JSX tree so the overlay backdrop never
 * absorbs its tap.
 */

import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import * as haptics from '@/lib/haptics';
import { Button } from '@components/Button';
import { useUserStore } from '@state/userStore';
import { colors, fonts, withAlpha } from '@theme/tokens';

const MIRROR_TEASER_GIFT_TOKENS = 50;
const MIRROR_ACCENT = '#14b8a6';

interface MirrorTeaserModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
}

export function MirrorTeaserModal({
  visible,
  onClose,
}: MirrorTeaserModalProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const addTokens = useUserStore((s) => s.addTokens);
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
    addTokens(MIRROR_TEASER_GIFT_TOKENS, 'mirror_teaser_gift');
    markMirrorTeaserSeen();
    onClose();
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
          <LinearGradient
            colors={[MIRROR_ACCENT, '#94a3b8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <MirrorMockup />
          </LinearGradient>

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

// ─────────────────────────────────────────────────────────────
// Hero mockup — "SOLO RACE" pill above two columns ("YOU"
// cracking on row 3, "OPPONENT" still racing on row 2). The
// split layout illustrates the racing semantic that production's
// SoloRaceBanner captures via an opponent-count badge — a
// stylized divergence accepted at the spec level.
// ─────────────────────────────────────────────────────────────

const MOCKUP_PEG_COLORS = ['#10b981', '#06b6d4', '#ec4899', '#f59e0b'] as const;

const YOU_ROWS = [
  [MOCKUP_PEG_COLORS[1], MOCKUP_PEG_COLORS[3], MOCKUP_PEG_COLORS[0], MOCKUP_PEG_COLORS[2]],
  [MOCKUP_PEG_COLORS[0], MOCKUP_PEG_COLORS[2], MOCKUP_PEG_COLORS[3], MOCKUP_PEG_COLORS[1]],
  [MOCKUP_PEG_COLORS[0], MOCKUP_PEG_COLORS[1], MOCKUP_PEG_COLORS[2], MOCKUP_PEG_COLORS[3]],
] as const;

const OPP_ROWS = [
  [MOCKUP_PEG_COLORS[2], MOCKUP_PEG_COLORS[0], MOCKUP_PEG_COLORS[1], MOCKUP_PEG_COLORS[3]],
  [MOCKUP_PEG_COLORS[1], MOCKUP_PEG_COLORS[2], MOCKUP_PEG_COLORS[0], MOCKUP_PEG_COLORS[3]],
] as const;

function MirrorMockup(): React.JSX.Element {
  return (
    <View style={styles.mockupRoot} testID="mirror-mockup">
      <View style={styles.tinyTag}>
        <Text style={styles.tinyTagText}>SOLO RACE</Text>
      </View>
      <View style={styles.splitRow}>
        <View style={styles.splitColumn}>
          <Text style={styles.splitLabel}>YOU</Text>
          {YOU_ROWS.map((row, i) => (
            <View key={i} style={styles.splitPegRow}>
              {row.map((color, j) => (
                <View key={j} style={[styles.splitPeg, { backgroundColor: color }]} />
              ))}
              {i === YOU_ROWS.length - 1 ? (
                <Text style={styles.crackedMark}>✓</Text>
              ) : null}
            </View>
          ))}
        </View>
        <View style={styles.splitDivider} />
        <View style={styles.splitColumn}>
          <Text style={styles.splitLabel}>RIVAL</Text>
          {OPP_ROWS.map((row, i) => (
            <View key={i} style={styles.splitPegRow}>
              {row.map((color, j) => (
                <View key={j} style={[styles.splitPeg, { backgroundColor: color }]} />
              ))}
            </View>
          ))}
          <View style={styles.splitPegRowEmpty}>
            {Array.from({ length: 4 }, (_, j) => (
              <View key={j} style={[styles.splitPeg, styles.splitPegEmpty]} />
            ))}
          </View>
        </View>
      </View>
      <Text style={styles.captionText}>Race to crack first</Text>
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
  hero: {
    width: '100%',
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
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

  // Mockup
  mockupRoot: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  tinyTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: withAlpha(MIRROR_ACCENT, 0.18),
    borderWidth: 1,
    borderColor: withAlpha(MIRROR_ACCENT, 0.55),
  },
  tinyTagText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: '#ffffff',
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  splitColumn: {
    alignItems: 'center',
    gap: 4,
  },
  splitLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: '#ffffff',
    opacity: 0.85,
    marginBottom: 2,
  },
  splitDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: withAlpha('#ffffff', 0.25),
  },
  splitPegRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  splitPegRowEmpty: {
    flexDirection: 'row',
    gap: 3,
  },
  splitPeg: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: withAlpha('#000000', 0.35),
  },
  splitPegEmpty: {
    backgroundColor: withAlpha('#ffffff', 0.18),
    borderStyle: 'dashed',
    borderColor: withAlpha('#ffffff', 0.5),
  },
  crackedMark: {
    marginLeft: 4,
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.success,
  },
  captionText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: '#ffffff',
    opacity: 0.85,
    textTransform: 'uppercase',
    marginTop: 4,
  },
});
