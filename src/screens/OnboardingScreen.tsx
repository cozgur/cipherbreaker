/**
 * Three-slide intro carousel. Ported from `reference/screens-home.jsx`;
 * illustrations are native `react-native-svg` renders of the locked
 * safe / radar sweep / token cascade. `Skip` on any slide and
 * `Start Playing` on slide 3 both replace the stack with Home so the
 * back gesture cannot re-enter onboarding. `markOnboarded()` is
 * called at the exit boundary — Phase 2's store will persist it.
 */

import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button } from '@components/Button';
import { Screen } from '@components/Screen';
import { markOnboarded } from '@data/mockUser';
import type { RootStackParamList } from '@navigation/routes';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

interface OnboardingSlide {
  readonly title: string;
  readonly subtitle: string;
}

const SLIDES: readonly OnboardingSlide[] = [
  {
    title: 'Crack the code.\nBeat your rival.',
    subtitle: 'A 4-digit secret. One mind against yours. Three ways to play.',
  },
  {
    title: 'Win tokens.\nClimb the ranks.',
    subtitle: 'Every match raises the stakes. Every win raises your level.',
  },
  {
    title: 'You start with\n500 tokens.',
    subtitle: "Let's play.",
  },
];

export function OnboardingScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // `noUncheckedIndexedAccess`: SLIDES is fixed length 3 and step is
  // clamped to 1..3 — the fallback is defensive only.
  const slide = useMemo<OnboardingSlide>(() => SLIDES[step - 1] ?? SLIDES[0]!, [step]);

  const finish = useCallback((): void => {
    markOnboarded();
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }, [navigation]);

  const next = useCallback((): void => {
    if (step === 3) {
      finish();
      return;
    }
    setStep((current) => (current === 1 ? 2 : 3));
  }, [step, finish]);

  const isLast = step === 3;

  return (
    <Screen ambientIntensity={0.25}>
      <View
        style={[styles.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}
      >
        <View style={styles.illustrationWrap}>
          <OnboardIllustration step={step} />
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {[1, 2, 3].map((dotStep) => {
              const isActive = dotStep === step;
              return (
                <View
                  key={dotStep}
                  style={[
                    styles.dot,
                    isActive
                      ? { width: 22, backgroundColor: colors.violet }
                      : { width: 6, backgroundColor: withAlpha(colors.violet, 0.25) },
                  ]}
                />
              );
            })}
          </View>

          <View style={styles.buttons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding"
              onPress={finish}
              style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
            >
              <Text style={styles.skipLabel}>Skip</Text>
            </Pressable>
            <Button onPress={next} size="lg" style={styles.nextButton}>
              {isLast ? 'Start Playing' : 'Next'}
            </Button>
          </View>
        </View>
      </View>
    </Screen>
  );
}

interface OnboardIllustrationProps {
  readonly step: 1 | 2 | 3;
}

function OnboardIllustration({ step }: OnboardIllustrationProps): React.JSX.Element {
  if (step === 1) return <LockedSafeIllustration />;
  if (step === 2) return <RadarIllustration />;
  return <TokenCascadeIllustration />;
}

function LockedSafeIllustration(): React.JSX.Element {
  return (
    <Svg width={240} height={300} viewBox="0 0 240 300">
      <Defs>
        <SvgLinearGradient id="onb-safe" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2a2c54" />
          <Stop offset="1" stopColor="#15172e" />
        </SvgLinearGradient>
        <RadialGradient id="onb-glow1" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
          <Stop offset="0" stopColor="#8b5cf6" stopOpacity={0.6} />
          <Stop offset="1" stopColor="#8b5cf6" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={120} cy={160} r={140} fill="url(#onb-glow1)" />
      <Rect
        x={40}
        y={60}
        width={160}
        height={200}
        rx={20}
        fill="url(#onb-safe)"
        stroke="#3a3c6e"
        strokeWidth={1.5}
      />
      <Rect x={60} y={80} width={120} height={80} rx={10} fill="#0a0b1e" stroke="#2a2c54" />
      {['7', '3', '1', '9'].map((digit, index) => (
        <Rect
          key={`slot-${index}`}
          x={68 + index * 28}
          y={94}
          width={22}
          height={52}
          rx={4}
          fill="#15172e"
          stroke="#4c1d95"
        />
      ))}
      {['7', '3', '1', '9'].map((digit, index) => (
        <SvgText
          key={`digit-${index}`}
          x={79 + index * 28}
          y={130}
          textAnchor="middle"
          fontFamily={fonts.mono}
          fontSize={22}
          fontWeight="700"
          fill="#8b5cf6"
        >
          {digit}
        </SvgText>
      ))}
      <Circle cx={120} cy={215} r={30} fill="#0a0b1e" stroke="#8b5cf6" strokeWidth={2} />
      <Circle cx={120} cy={215} r={20} fill="none" stroke="#a78bfa" strokeWidth={1.5} />
      <Circle cx={120} cy={215} r={4} fill={colors.gold} />
      <Path d="M120 195 L125 200 L115 200 Z" fill={colors.gold} />
    </Svg>
  );
}

function RadarIllustration(): React.JSX.Element {
  return (
    <Svg width={260} height={300} viewBox="0 0 260 300">
      <Defs>
        <RadialGradient id="onb-rglow" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
          <Stop offset="0" stopColor="#06b6d4" stopOpacity={0.3} />
          <Stop offset="1" stopColor="#06b6d4" stopOpacity={0} />
        </RadialGradient>
        <SvgLinearGradient id="onb-scan" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#8b5cf6" stopOpacity={0} />
          <Stop offset="1" stopColor="#8b5cf6" stopOpacity={0.8} />
        </SvgLinearGradient>
      </Defs>
      <Circle cx={130} cy={150} r={150} fill="url(#onb-rglow)" />
      {[120, 90, 60, 30].map((radius) => (
        <Circle
          key={radius}
          cx={130}
          cy={150}
          r={radius}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth={1}
          opacity={0.2 + (120 - radius) * 0.004}
        />
      ))}
      <Path d="M130 150 L250 90 A130 130 0 0 0 130 20 Z" fill="url(#onb-scan)" opacity={0.5} />
      <Circle cx={130} cy={150} r={6} fill="#8b5cf6" />
      <Circle cx={180} cy={110} r={5} fill="#ec4899" />
      <Circle cx={85} cy={190} r={4} fill="#06b6d4" />
      <Circle cx={195} cy={180} r={3} fill="#fbbf24" />
    </Svg>
  );
}

function TokenCascadeIllustration(): React.JSX.Element {
  const coins: readonly (readonly [number, number, number])[] = [
    [60, 50, 20],
    [130, 30, 28],
    [200, 60, 22],
    [90, 110, 26],
    [170, 120, 24],
    [60, 180, 22],
    [130, 160, 34],
    [200, 190, 20],
    [90, 240, 24],
    [170, 250, 22],
  ];
  return (
    <Svg width={260} height={300} viewBox="0 0 260 300">
      <Defs>
        <RadialGradient id="onb-gc" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
          <Stop offset="0" stopColor="#fbbf24" stopOpacity={0.45} />
          <Stop offset="1" stopColor="#fbbf24" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="onb-cbcoin-big" cx="0.35" cy="0.3" rx="0.65" ry="0.7">
          <Stop offset="0" stopColor="#fde68a" />
          <Stop offset="0.6" stopColor="#fbbf24" />
          <Stop offset="1" stopColor="#b45309" />
        </RadialGradient>
      </Defs>
      <Circle cx={130} cy={160} r={150} fill="url(#onb-gc)" />
      {coins.map(([cx, cy, r], index) => (
        <Circle
          key={`coin-${index}`}
          cx={cx}
          cy={cy}
          r={r}
          fill="url(#onb-cbcoin-big)"
          stroke="#78350f"
          strokeWidth={0.8}
          opacity={0.92}
        />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  illustrationWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 320,
  },
  copy: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.6,
    lineHeight: 34,
    textShadowColor: withAlpha(colors.violet, 0.4),
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subtitle: {
    marginTop: 16,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    alignItems: 'stretch',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  skip: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipPressed: {
    opacity: 0.6,
  },
  skipLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  nextButton: {
    flex: 1.6,
  },
});
