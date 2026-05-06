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
 *     `markBlitzTeaserSeen()` + `onClose` (HomeScreen handles the
 *     downstream navigation if any — current scope hands control
 *     back to Home, mode-card highlight is post-CP8 polish).
 *   - "Skip" → `markBlitzTeaserSeen()` only (no token grant) +
 *     `onClose`.
 *
 * Mockup composition mirrors Mode 4 production styling where
 * possible:
 *   - Gradient `[colors.danger, '#f97316']` matches modeCatalog Blitz
 *     entry exactly.
 *   - Clock face uses `fonts.mono` 28px tinted `colors.warning` —
 *     same active-tick color the production clock uses.
 *   - Mini board pegs use the CP4.1 stylized-Mastermind palette
 *     (production digit tiles diverge — illustrative only).
 *
 * Skip rendered last in the JSX tree (zIndex via order) so the
 * overlay backdrop never absorbs its tap — same pattern
 * TutorialMatchScreen uses.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { Button } from '@components/Button';
import { useUserStore } from '@state/userStore';
import { colors, fonts, withAlpha } from '@theme/tokens';

const BLITZ_TEASER_GIFT_TOKENS = 50;

interface BlitzTeaserModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
}

export function BlitzTeaserModal({
  visible,
  onClose,
}: BlitzTeaserModalProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const addTokens = useUserStore((s) => s.addTokens);
  const markBlitzTeaserSeen = useUserStore((s) => s.markBlitzTeaserSeen);

  if (!visible) return null;

  const handleSkip = (): void => {
    markBlitzTeaserSeen();
    onClose();
  };

  const handleTry = (): void => {
    addTokens(BLITZ_TEASER_GIFT_TOKENS, 'blitz_teaser_gift');
    markBlitzTeaserSeen();
    onClose();
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
          <LinearGradient
            colors={[colors.danger, '#f97316']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <BlitzMockup />
          </LinearGradient>

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

          <Button onPress={handleTry} size="lg" style={styles.cta}>
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

// ─────────────────────────────────────────────────────────────
// Hero mockup — chess clock face + drained progress bar +
// 3-row mini board with feedback dots. Stylized reference to
// Mode 4's UI; not pixel-equal to production (peg circles vs
// production digit tiles, per CP4.1's accepted divergence).
// ─────────────────────────────────────────────────────────────

const MOCKUP_PEG_COLORS = ['#10b981', '#06b6d4', '#ec4899', '#f59e0b'] as const;

interface MockBlitzRow {
  readonly pegs: readonly string[];
  readonly feedback: readonly ('exact' | 'present' | 'absent')[];
}

const MOCKUP_BLITZ_ROWS: readonly MockBlitzRow[] = [
  {
    pegs: [MOCKUP_PEG_COLORS[1], MOCKUP_PEG_COLORS[3], MOCKUP_PEG_COLORS[0], MOCKUP_PEG_COLORS[2]],
    feedback: ['absent', 'present', 'absent', 'absent'],
  },
  {
    pegs: [MOCKUP_PEG_COLORS[0], MOCKUP_PEG_COLORS[2], MOCKUP_PEG_COLORS[3], MOCKUP_PEG_COLORS[1]],
    feedback: ['exact', 'absent', 'present', 'absent'],
  },
  {
    pegs: [MOCKUP_PEG_COLORS[0], MOCKUP_PEG_COLORS[3], MOCKUP_PEG_COLORS[2], MOCKUP_PEG_COLORS[1]],
    feedback: ['exact', 'exact', 'present', 'absent'],
  },
];

const FEEDBACK_DOT_STYLES: Readonly<
  Record<'exact' | 'present' | 'absent', { backgroundColor: string; borderColor: string }>
> = {
  exact: { backgroundColor: '#000000', borderColor: '#000000' },
  present: { backgroundColor: '#ffffff', borderColor: '#000000' },
  absent: { backgroundColor: 'transparent', borderColor: withAlpha('#ffffff', 0.4) },
};

function BlitzMockup(): React.JSX.Element {
  return (
    <View style={styles.mockupRoot} testID="blitz-mockup">
      <Text style={styles.clockFace}>00:42</Text>
      <View style={styles.clockTrack}>
        <View style={styles.clockFill} />
      </View>
      <View style={styles.miniBoard}>
        {MOCKUP_BLITZ_ROWS.map((row, i) => (
          <View key={i} style={styles.miniBoardRow}>
            <View style={styles.miniPegRow}>
              {row.pegs.map((color, j) => (
                <View key={j} style={[styles.miniPeg, { backgroundColor: color }]} />
              ))}
            </View>
            <View style={styles.feedbackCluster}>
              {row.feedback.map((f, j) => (
                <View key={j} style={[styles.feedbackDot, FEEDBACK_DOT_STYLES[f]]} />
              ))}
            </View>
          </View>
        ))}
      </View>
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
    paddingVertical: 26,
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

  // Mockup styles
  mockupRoot: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  clockFace: {
    fontFamily: fonts.mono,
    fontSize: 36,
    color: '#ffffff',
    letterSpacing: 1.6,
    textShadowColor: withAlpha(colors.warning, 0.5),
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
  clockTrack: {
    width: '70%',
    height: 6,
    borderRadius: 3,
    backgroundColor: withAlpha('#000000', 0.35),
    overflow: 'hidden',
  },
  clockFill: {
    height: '100%',
    width: '30%',
    backgroundColor: colors.warning,
    borderRadius: 3,
  },
  miniBoard: {
    gap: 6,
    marginTop: 6,
  },
  miniBoardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniPegRow: {
    flexDirection: 'row',
    gap: 4,
  },
  miniPeg: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: withAlpha('#000000', 0.35),
  },
  feedbackCluster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 18,
    gap: 2,
  },
  feedbackDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 0.6,
  },
});
