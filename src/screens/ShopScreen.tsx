/**
 * Token shop. Four pack tiers with cosmetic ribbons; tapping a pack
 * either pops a confirm-style alert (production placeholder) or, in
 * `__DEV__` builds, lets the developer mint the pack into mockUser.
 *
 * The dev-mode boost is critical for Phase 3+ when match economy
 * tests need to run end-to-end without paying real money. Production
 * builds never see the boost — Phase 7A wires real IAP here.
 */

import { useCallback } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  Ellipse,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '@components/Screen';
import { TokenBadge } from '@components/TokenBadge';
import { grantTokens, useMockUser } from '@data/mockUser';
import type { RootStackParamList } from '@navigation/routes';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Shop'>;

interface PackRibbon {
  readonly label: string;
  readonly color: string;
}

interface Pack {
  readonly amount: number;
  readonly displayAmount: string;
  readonly price: string;
  readonly ribbon?: PackRibbon;
  readonly bonus?: string;
}

const PACKS: readonly Pack[] = [
  { amount: 500, displayAmount: '500', price: '$0.99' },
  {
    amount: 1500,
    displayAmount: '1,500',
    price: '$2.99',
    ribbon: { label: 'MOST POPULAR', color: colors.pink },
  },
  { amount: 5000, displayAmount: '5,000', price: '$7.99', bonus: '+40% BONUS' },
  {
    amount: 15000,
    displayAmount: '15,000',
    price: '$19.99',
    ribbon: { label: 'BEST VALUE', color: colors.gold },
    bonus: '+60% BONUS',
  },
];

export function ShopScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const user = useMockUser();
  const insets = useSafeAreaInsets();

  const close = useCallback(() => navigation.goBack(), [navigation]);

  const handlePurchase = useCallback((pack: Pack): void => {
    if (__DEV__) {
      Alert.alert(
        'Test purchase',
        `Add ${pack.displayAmount} tokens to your balance? (dev mode only)`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add tokens',
            style: 'default',
            onPress: () => grantTokens(pack.amount),
          },
        ],
      );
      return;
    }
    Alert.alert('Coming soon', 'In-app purchases ship in a later release.');
  }, []);

  return (
    <Screen ambientTint={colors.gold} ambientIntensity={0.16}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close shop"
          onPress={close}
          style={styles.backChip}
        >
          <Svg width={14} height={14} viewBox="0 0 14 14">
            <Path
              d="M9 3L5 7l4 4"
              stroke={colors.textSecondary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Pressable>
        <TokenBadge amount={user.tokens.toLocaleString()} size="sm" />
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>Get Tokens</Text>
        <Text style={styles.subtitle}>Top up to keep playing.</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 64 }]}
        showsVerticalScrollIndicator={false}
      >
        {PACKS.map((pack) => (
          <PackCard key={pack.amount} pack={pack} onPress={() => handlePurchase(pack)} />
        ))}
        <Text style={styles.disclaimer}>All purchases are final. Tokens have no cash value.</Text>
      </ScrollView>
    </Screen>
  );
}

interface PackCardProps {
  readonly pack: Pack;
  readonly onPress: () => void;
}

function PackCard({ pack, onPress }: PackCardProps): React.JSX.Element {
  const isBest = pack.ribbon?.label === 'BEST VALUE';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Buy ${pack.displayAmount} tokens for ${pack.price}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isBest ? styles.cardBest : null,
        pressed ? styles.cardPressed : null,
      ]}
    >
      {pack.ribbon ? (
        <View
          style={[
            styles.ribbon,
            {
              backgroundColor: withAlpha(pack.ribbon.color, 0.18),
              borderColor: withAlpha(pack.ribbon.color, 0.5),
            },
          ]}
        >
          <Text style={[styles.ribbonLabel, { color: pack.ribbon.color }]}>
            {pack.ribbon.label}
          </Text>
        </View>
      ) : null}
      <CoinStackIcon />
      <View style={styles.cardBody}>
        <View style={styles.amountRow}>
          <Text style={styles.amount}>{pack.displayAmount}</Text>
          <Text style={styles.tokensSuffix}>tokens</Text>
        </View>
        {pack.bonus ? <Text style={styles.bonus}>{pack.bonus}</Text> : null}
      </View>
      <View style={styles.priceChip}>
        <Text style={styles.priceLabel}>{pack.price}</Text>
      </View>
    </Pressable>
  );
}

function CoinStackIcon(): React.JSX.Element {
  return (
    <Svg
      width={56}
      height={56}
      viewBox="0 0 56 56"
      style={Platform.select({
        ios: {
          shadowColor: colors.gold,
          shadowOpacity: 0.5,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
        },
        default: {},
      })}
    >
      <Defs>
        <RadialGradient id="shop-stack" cx="0.35" cy="0.3" rx="0.7" ry="0.7">
          <Stop offset="0" stopColor="#fde68a" />
          <Stop offset="0.6" stopColor="#fbbf24" />
          <Stop offset="1" stopColor="#b45309" />
        </RadialGradient>
      </Defs>
      <Ellipse cx={28} cy={46} rx={18} ry={5} fill="url(#shop-stack)" stroke="#78350f" />
      <Rect x={10} y={32} width={36} height={14} fill="url(#shop-stack)" stroke="#78350f" />
      <Ellipse cx={28} cy={32} rx={18} ry={5} fill="url(#shop-stack)" stroke="#78350f" />
      <Rect x={10} y={22} width={36} height={10} fill="url(#shop-stack)" stroke="#78350f" />
      <Ellipse cx={28} cy={22} rx={18} ry={5} fill="url(#shop-stack)" stroke="#78350f" />
      <Rect x={10} y={14} width={36} height={8} fill="url(#shop-stack)" stroke="#78350f" />
      <Ellipse cx={28} cy={14} rx={18} ry={5} fill="url(#shop-stack)" stroke="#78350f" />
      <SvgText
        x={28}
        y={17.5}
        textAnchor="middle"
        fontFamily={fonts.display}
        fontWeight="900"
        fontSize={7}
        fill="#78350f"
      >
        C
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intro: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.text,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  list: {
    paddingTop: 20,
    paddingHorizontal: 16,
    gap: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'visible',
  },
  cardBest: {
    borderColor: withAlpha(colors.gold, 0.6),
    ...Platform.select({
      ios: {
        shadowColor: colors.gold,
        shadowOpacity: 0.2,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  cardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  ribbon: {
    position: 'absolute',
    top: -10,
    left: 14,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  ribbonLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  cardBody: {
    flex: 1,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  amount: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    letterSpacing: -0.4,
  },
  tokensSuffix: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  bonus: {
    marginTop: 4,
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    color: colors.gold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  priceChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.violet,
    ...Platform.select({
      ios: {
        shadowColor: colors.violet,
        shadowOpacity: 0.4,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  priceLabel: {
    fontFamily: fonts.mono,
    fontSize: 15,
    color: '#ffffff',
  },
  disclaimer: {
    marginTop: 18,
    paddingHorizontal: 8,
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textDim,
    textAlign: 'center',
  },
});
