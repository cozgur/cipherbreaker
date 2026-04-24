/**
 * ⚠️  TEMPORARY — Phase 1A visual regression surface. Delete in Phase 1B
 *     once Home / Secret Setup / Match / Result screens consume these
 *     primitives directly. Do not import from this file anywhere else.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Avatar,
  Button,
  DigitKeypad,
  DigitTile,
  GlassCard,
  LevelBar,
  ModeCard,
  OpponentCard,
  RadarAnimation,
  Screen,
  SectionLabel,
  TinyTag,
  TokenBadge,
  TokenCoin,
  TypingIndicator,
  type DigitTileState,
} from '@components/index';
import { modeCatalog } from '@data/modeCatalog';
import { colors, fonts } from '@theme/tokens';
import { spacing } from '@theme/spacing';

const DIGIT_STATES: readonly DigitTileState[] = [
  'neutral',
  'green',
  'yellow',
  'gray',
  'violet',
  'blackout',
];

export function PrimitivePlaygroundScreen(): React.JSX.Element {
  return (
    <Screen>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.header}>PRIMITIVE PLAYGROUND</Text>
          <Text style={styles.subheader}>
            Phase 1A visual check. Remove in 1B.
          </Text>

          <Section title="Tags & labels">
            <View style={styles.row}>
              <SectionLabel>CLASSIC</SectionLabel>
              <SectionLabel color={colors.pink}>ADVANCED</SectionLabel>
            </View>
            <View style={styles.row}>
              <TinyTag>PRESTIGE</TinyTag>
              <TinyTag color={colors.warning}>⏱ TIMED</TinyTag>
              <TinyTag color="#dc2626">HIGH RISK</TinyTag>
              <TinyTag color="#14b8a6">SOLO RACE</TinyTag>
            </View>
          </Section>

          <Section title="Tokens">
            <View style={styles.row}>
              <TokenCoin size={16} />
              <TokenCoin size={24} />
              <TokenCoin size={36} />
            </View>
            <View style={styles.row}>
              <TokenBadge amount="1,840" size="sm" />
              <TokenBadge amount="12,400" size="md" />
              <TokenBadge amount="500" size="lg" />
            </View>
          </Section>

          <Section title="Avatars">
            <View style={styles.row}>
              <Avatar name="Nova" size={40} />
              <Avatar name="Shadow" size={56} />
              <Avatar name="Echo" size={72} />
              <Avatar name="" size={40} />
            </View>
          </Section>

          <Section title="Opponent cards">
            <OpponentCard name="nova_code" level={12} active />
            <View style={styles.gap} />
            <OpponentCard name="shadowHunter47" level={23} flag="🇩🇪" isOnline />
          </Section>

          <Section title="Digit tiles — every state">
            <View style={styles.row}>
              {DIGIT_STATES.map((state) => (
                <DigitTile key={state} digit={7} state={state} size={48} />
              ))}
            </View>
            <View style={styles.row}>
              <DigitTile size={62} />
              <DigitTile digit={4} state="violet" size={62} />
              <DigitTile digit={2} state="green" size={62} />
            </View>
          </Section>

          <Section title="Digit keypad">
            <View style={styles.keypadBox}>
              <DigitKeypad onDigit={() => undefined} onBackspace={() => undefined} />
            </View>
            <View style={styles.gap} />
            <View style={styles.keypadBox}>
              <DigitKeypad
                onDigit={() => undefined}
                onBackspace={() => undefined}
                disabled
              />
            </View>
          </Section>

          <Section title="Mode cards">
            {modeCatalog.map((entry) => (
              <View key={entry.id} style={styles.modeCardWrap}>
                <ModeCard meta={entry.meta} onPress={() => undefined} />
              </View>
            ))}
          </Section>

          <Section title="Buttons">
            <Button variant="primary">Play Again</Button>
            <View style={styles.gap} />
            <Button variant="cyan">Watch Ad · +50</Button>
            <View style={styles.gap} />
            <Button variant="outline">Home</Button>
            <View style={styles.gap} />
            <Button size="lg">Lock In Code</Button>
            <View style={styles.gap} />
            <Button disabled>Guess (disabled)</Button>
          </Section>

          <Section title="Glass card">
            <GlassCard>
              <Text style={styles.glassTitle}>Not enough tokens</Text>
              <Text style={styles.glassBody}>
                You need 50 tokens to play a match.
              </Text>
            </GlassCard>
          </Section>

          <Section title="Level bar">
            <LevelBar level={12} currentXP={2340} targetXP={3200} />
          </Section>

          <Section title="Radar animation">
            <View style={styles.radarWrap}>
              <RadarAnimation size={220} />
            </View>
          </Section>

          <Section title="Typing indicator">
            <View style={styles.row}>
              <TypingIndicator />
              <TypingIndicator color={colors.cyan} size={10} />
              <TypingIndicator color={colors.pink} size={14} />
            </View>
          </Section>

          <View style={styles.footer} />
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

interface SectionProps {
  readonly title: string;
  readonly children: React.ReactNode;
}

function Section({ title, children }: SectionProps): React.JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
  },
  header: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.5,
  },
  subheader: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
  sectionBody: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
  },
  gap: {
    height: spacing.sm,
  },
  keypadBox: {
    padding: spacing.sm,
    backgroundColor: colors.bgOverlay,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  modeCardWrap: {
    marginBottom: spacing.sm,
  },
  glassTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
  },
  glassBody: {
    marginTop: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  radarWrap: {
    alignItems: 'center',
  },
  footer: {
    height: spacing.xxl,
  },
});
