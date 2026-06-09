/**
 * Token shop. Four consumable pack tiers with cosmetic ribbons.
 *
 * Phase 8.5.5 — wired to the real expo-iap flow: a tap runs
 * `purchaseFlow.purchaseProduct` → (on success) `grantIAPTokens`, and the
 * three-state result (success / pending / error) drives an inline status
 * banner. The pre-8.5.5 `__DEV__` mockUser.grantTokens mint and the
 * production "Coming soon" alert are both gone — dev now uses real
 * StoreKit 2 sandbox transactions (Apple's standard test path).
 *
 * The card display still comes from the local `PACKS` table (its
 * `+BONUS` labels and comma formatting aren't in `productCatalog`); each
 * row carries a `productId` to route the purchase. The catalog remains
 * the source of truth for the wire SKU and the granted token amount —
 * the success message reports the amount `grantIAPTokens` actually
 * credited, so display and grant can't silently disagree.
 *
 * Scope notes:
 *   - NO `finishTransaction` here. The grant fires, but finishing the
 *     StoreKit transaction is 8.5.6 — so 8.5.5 must NOT drive real
 *     device/sandbox purchases (unfinished transactions re-deliver). The
 *     mocked-expo-iap tests are safe.
 *   - Remove Ads (non-consumable) has no card here yet — its purchase
 *     surface lands in 8.6 alongside the ads it removes. The success
 *     copy is kept ready in `successText`.
 *   - Restore Purchases UI is 8.5.7.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { initialize as initializeIap } from '@lib/iap/iapManager';
import { finalizePurchase, purchaseProduct } from '@lib/iap/purchaseFlow';
import type { IAPError, IAPErrorCode } from '@lib/iap/errors';
import type { ProductId } from '@lib/iap/productCatalog';
import type { RootStackParamList } from '@navigation/routes';
import type { IAPTransaction } from '@state/userStore';
import { useUserStore } from '@state/userStore';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Shop'>;

/** Inline status shown above the pack list after a purchase attempt. */
type PurchaseStatus = { readonly kind: 'success' | 'pending' | 'error'; readonly text: string };

/** Success message clears after this long; CTAs re-enable. */
const SUCCESS_FADE_MS = 2000;

/**
 * User-facing message per error code. `USER_CANCELLED` is intentionally
 * empty — dismissing the Apple sheet is silent by iOS convention
 * (`getErrorMessage` returns null for it). `DUPLICATE_TRANSACTION` never
 * reaches here (it's a `grantIAPTokens` result, handled silently).
 */
const ERROR_MESSAGES: Record<IAPErrorCode, string> = {
  USER_CANCELLED: '',
  PAYMENT_INVALID: 'Payment method issue. Check your Apple ID.',
  PAYMENT_NOT_ALLOWED: 'Purchases not allowed on this device.',
  PRODUCT_NOT_FOUND: 'Product unavailable. Try again later.',
  NETWORK_ERROR: 'Connection issue. Try again.',
  VERIFICATION_FAILED: "Purchase couldn't be verified. Contact support.",
  DUPLICATE_TRANSACTION: '',
  UNKNOWN: 'Something went wrong. Try again.',
};

/** Returns the message to show, or null for silent codes (cancel). */
function getErrorMessage(error: IAPError): string | null {
  if (error.code === 'USER_CANCELLED') return null;
  return ERROR_MESSAGES[error.code] || ERROR_MESSAGES.UNKNOWN;
}

/** Success banner copy from the recorded grant (catalog-derived amount). */
function successText(record: IAPTransaction): string {
  return record.tokensGranted > 0
    ? `Tokens added! +${record.tokensGranted} tokens`
    : 'Ads removed! Thanks for supporting CipherBreaker.';
}

interface PackRibbon {
  readonly label: string;
  readonly color: string;
}

interface Pack {
  /** Catalog short id — routes the purchase + grant. */
  readonly productId: ProductId;
  readonly displayAmount: string;
  readonly price: string;
  readonly ribbon?: PackRibbon;
  readonly bonus?: string;
}

const PACKS: readonly Pack[] = [
  { productId: 'tokens_500', displayAmount: '500', price: '$0.99' },
  {
    productId: 'tokens_1500',
    displayAmount: '1,500',
    price: '$2.99',
    ribbon: { label: 'MOST POPULAR', color: colors.pink },
  },
  { productId: 'tokens_5000', displayAmount: '5,000', price: '$7.99', bonus: '+40% BONUS' },
  {
    productId: 'tokens_15000',
    displayAmount: '15,000',
    price: '$19.99',
    ribbon: { label: 'BEST VALUE', color: colors.gold },
    bonus: '+60% BONUS',
  },
];

export function ShopScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const tokens = useUserStore((s) => s.tokens);
  const insets = useSafeAreaInsets();

  const [processing, setProcessing] = useState(false);
  const [activeProductId, setActiveProductId] = useState<ProductId | null>(null);
  const [status, setStatus] = useState<PurchaseStatus | null>(null);

  // Guards setState after unmount (the purchase await / fade timer can
  // outlive the modal if the user closes it mid-flight).
  const mountedRef = useRef(true);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous re-entrancy guard. `processing` state drives the UI but
  // only after a re-render, so a rapid double-tap in the same tick could
  // slip past it; the ref flips immediately and blocks the second call.
  const processingRef = useRef(false);

  const close = useCallback(() => navigation.goBack(), [navigation]);

  // Connect to StoreKit on mount. initialize() is idempotent (iapManager
  // returns its cache when already connected), so re-opening the shop
  // never reconnects. Failure surfaces as a soft status, not a crash.
  useEffect(() => {
    mountedRef.current = true;
    initializeIap().catch(() => {
      if (mountedRef.current) {
        setStatus({ kind: 'error', text: 'Store unavailable. Try again later.' });
      }
    });
    return () => {
      mountedRef.current = false;
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  const reEnable = useCallback(() => {
    processingRef.current = false;
    setProcessing(false);
    setActiveProductId(null);
  }, []);

  const handlePurchase = useCallback(
    async (pack: Pack): Promise<void> => {
      if (processingRef.current) return; // re-entrancy guard (sync)
      processingRef.current = true;
      setStatus(null);
      setProcessing(true);
      setActiveProductId(pack.productId);

      const result = await purchaseProduct(pack.productId);

      if (result.status === 'success') {
        // Grant + finish the transaction even if the modal was closed
        // mid-purchase, so the balance is always correct and StoreKit
        // stops re-delivering; only the UI updates below are gated on
        // still being mounted. This MUST run before the mounted check —
        // a solicited transaction is consumed here and never re-delivered,
        // so an early return would silently drop the grant.
        const grant = await finalizePurchase(result.transaction, result.rawPurchase);
        if (!mountedRef.current) return;
        if (grant.success) {
          setStatus({ kind: 'success', text: successText(grant.transaction) });
          // Hold the success state briefly, then fade + re-enable.
          fadeTimerRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            setStatus(null);
            reEnable();
          }, SUCCESS_FADE_MS);
        } else {
          // duplicate (already credited) / invalid_product (defensive) —
          // silent, re-enable immediately.
          reEnable();
        }
        return;
      }

      if (!mountedRef.current) return;
      reEnable();
      if (result.status === 'pending') {
        setStatus({ kind: 'pending', text: 'Purchase awaiting approval' });
      } else {
        const message = getErrorMessage(result.error);
        if (message) setStatus({ kind: 'error', text: message });
      }
    },
    [reEnable],
  );

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
        <TokenBadge amount={tokens} size="sm" />
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>Get Tokens</Text>
        <Text style={styles.subtitle}>Top up to keep playing.</Text>
      </View>

      {status ? (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.statusBanner, STATUS_STYLES[status.kind]]}
        >
          <Text style={styles.statusText}>{status.text}</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 64 }]}
        showsVerticalScrollIndicator={false}
      >
        {PACKS.map((pack) => (
          <PackCard
            key={pack.productId}
            pack={pack}
            disabled={processing}
            loading={activeProductId === pack.productId}
            onPress={() => {
              void handlePurchase(pack);
            }}
          />
        ))}
        <Text style={styles.disclaimer}>All purchases are final. Tokens have no cash value.</Text>
      </ScrollView>
    </Screen>
  );
}

interface PackCardProps {
  readonly pack: Pack;
  readonly disabled: boolean;
  readonly loading: boolean;
  readonly onPress: () => void;
}

function PackCard({ pack, disabled, loading, onPress }: PackCardProps): React.JSX.Element {
  const isBest = pack.ribbon?.label === 'BEST VALUE';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Buy ${pack.displayAmount} tokens for ${pack.price}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isBest ? styles.cardBest : null,
        disabled && !loading ? styles.cardDimmed : null,
        pressed && !disabled ? styles.cardPressed : null,
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
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.priceLabel}>{pack.price}</Text>
        )}
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
  statusBanner: {
    marginHorizontal: 20,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
  },
  statusSuccess: {
    backgroundColor: withAlpha(colors.gold, 0.12),
    borderColor: withAlpha(colors.gold, 0.5),
  },
  statusPending: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.borderSubtle,
  },
  statusError: {
    backgroundColor: withAlpha(colors.pink, 0.12),
    borderColor: withAlpha(colors.pink, 0.5),
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
  cardDimmed: {
    opacity: 0.5,
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
    minWidth: 72,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
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

const STATUS_STYLES: Record<PurchaseStatus['kind'], object> = {
  success: styles.statusSuccess,
  pending: styles.statusPending,
  error: styles.statusError,
};
