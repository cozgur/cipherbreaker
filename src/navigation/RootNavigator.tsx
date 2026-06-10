import { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { initialize as initializeAds } from '@lib/ads/adManager';
import { dispose as disposeIap, initialize as initializeIap } from '@lib/iap/iapManager';
import { startPurchaseListener } from '@lib/iap/purchaseFlow';
import { AdWatchScreen } from '@screens/AdWatchScreen';
import { ChangeUsernameModal } from '@screens/ChangeUsernameModal';
import { DailyMatchScreen } from '@screens/DailyMatchScreen';
import { DailyResultScreen } from '@screens/DailyResultScreen';
import { HomeScreen } from '@screens/HomeScreen';
import { InsufficientTokensModal } from '@screens/InsufficientTokensModal';
import { InterstitialAdScreen } from '@screens/InterstitialAdScreen';
import { MatchmakingScreen } from '@screens/MatchmakingScreen';
import { MatchResultScreen } from '@screens/MatchResultScreen';
import { MatchScreen } from '@screens/MatchScreen';
import { ModeTutorialScreen } from '@screens/ModeTutorialScreen';
import { OnboardingHeroScreen } from '@screens/OnboardingHeroScreen';
import { ProfileScreen } from '@screens/ProfileScreen';
import { SecretSetupScreen } from '@screens/SecretSetupScreen';
import { ShopScreen } from '@screens/ShopScreen';
import { TutorialMatchScreen } from '@screens/TutorialMatchScreen';
import { UnlockModal } from '@screens/UnlockModal';
import { useUserStore } from '@state/userStore';
import { colors } from '@theme/index';
import type { RootStackParamList } from './routes';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme: Theme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bgBase,
    card: colors.bgElevated,
    text: colors.text,
    border: colors.borderSubtle,
    primary: colors.violet,
    notification: colors.pink,
  },
};

/**
 * Phase 7A.6 CP7 + Phase 7A.8 CP2 — onboarding flow entry point.
 *
 * `hasOnboarded` is the master gate. When true, the user goes
 * straight to Home (the "I've finished onboarding" path). When
 * false, the early-exit chain picks the next unseen step:
 *
 *   !introSeen                 → OnboardingHero       (CP2)
 *   !tutorialMatchCompleted    → TutorialMatch        (Phase 7A.6 CP3)
 *   otherwise                  → Home                  (failsafe + linear-complete)
 *
 * Phase 7A.8 CP2 collapsed the prior 3-step chain (intro →
 * tutorial → token walkthrough) into 2 steps (hero → tutorial).
 * The walkthrough was deleted; `tokenWalkthroughSeen` remains
 * in the schema as a dead flag (Phase 9 cleanup queued in
 * PHASE-9-BACKLOG.md). In-progress TestFlight users with
 * `tokenWalkthroughSeen=false` and the other two flags true
 * hit the failsafe → Home; they don't see the new hero (their
 * `introSeen` is already true) and `hasOnboarded` stays false
 * until they happen to complete a fresh onboarding cycle —
 * acceptable per CP2 spec decision 6.
 *
 * Force-quit recovery is implicit: a user who quits between
 * Hero and TutorialMatch has `introSeen=true,
 * tutorialMatchCompleted=false`, so the next launch lands on
 * TutorialMatch — not back at the start.
 *
 * The chain runs once at component mount (no hook subscription).
 * State changes during a session don't re-route; the per-screen
 * `navigation.replace` calls handle forward motion.
 */
function pickInitialRoute(): keyof RootStackParamList {
  const state = useUserStore.getState();
  if (state.hasOnboarded) return 'Home';
  const onboarding = state.onboarding;
  if (!onboarding.introSeen) return 'OnboardingHero';
  if (!onboarding.tutorialMatchCompleted) return 'TutorialMatch';
  // All remaining step flags true but `hasOnboarded === false` —
  // defensive failsafe (corrupt state, programmer error, or
  // TestFlight user mid-flow before the CP2 rework). The
  // screens' own completion calls flip `completedAt` /
  // `hasOnboarded`; if we reach here the user has effectively
  // finished, so route them home.
  return 'Home';
}

export function RootNavigator(): React.JSX.Element {
  const initialRouteName = pickInitialRoute();

  // Phase 8.5.6 — app-launch IAP wiring. The persistent purchase listener
  // is installed FIRST, then the store connects: a StoreKit transaction
  // re-delivered during launch (an interrupted purchase, an Ask-to-Buy
  // approval) then routes to purchaseFlow's unsolicited handler instead of
  // being dropped. `initialize` is idempotent (ShopScreen also calls it);
  // a launch-time connection failure is non-fatal — the shop surfaces a
  // soft retry. Runs once at the app's root mount.
  useEffect(() => {
    startPurchaseListener();
    initializeIap().catch((error) => {
      console.log('[iap] launch initialize failed (shop will retry)', { error });
    });
    // Phase 8.6.2 — AdMob SDK bring-up, parallel with IAP (no dependency,
    // no ordering constraint). Runs regardless of `adsRemoved`: Remove Ads
    // only suppresses interstitial LOADS (8.6.4); the rewarded path stays
    // available to payers (8.6.1 Q11). `initialize` contains its own
    // failures (resolves false, dev-logged) — the catch is a belt-and-
    // braces guard so no rejection can ever escape the launch effect.
    initializeAds().catch((error) => {
      console.log('[ads] launch initialize failed', { error });
    });
    return () => {
      void disposeIap();
    };
  }, []);

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bgBase },
        }}
      >
        <Stack.Screen
          name="OnboardingHero"
          component={OnboardingHeroScreen}
          options={{
            presentation: 'fullScreenModal',
            gestureEnabled: false,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="TutorialMatch"
          component={TutorialMatchScreen}
          options={{
            presentation: 'fullScreenModal',
            gestureEnabled: false,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="ModeTutorial"
          component={ModeTutorialScreen}
          options={{
            presentation: 'fullScreenModal',
            gestureEnabled: false,
            headerShown: false,
          }}
        />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Matchmaking" component={MatchmakingScreen} />
        <Stack.Screen
          name="SecretSetup"
          component={SecretSetupScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen name="Match" component={MatchScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen
          name="MatchResult"
          component={MatchResultScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen name="Shop" component={ShopScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="AdWatch"
          component={AdWatchScreen}
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />
        <Stack.Screen
          name="InterstitialAd"
          component={InterstitialAdScreen}
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen
          name="InsufficientTokens"
          component={InsufficientTokensModal}
          options={{ presentation: 'transparentModal', animation: 'fade' }}
        />
        <Stack.Screen
          name="Unlock"
          component={UnlockModal}
          options={{ presentation: 'transparentModal', animation: 'fade' }}
        />
        <Stack.Screen
          name="ChangeUsername"
          component={ChangeUsernameModal}
          options={{ presentation: 'transparentModal', animation: 'fade' }}
        />
        <Stack.Screen name="Daily" component={DailyMatchScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen
          name="DailyResult"
          component={DailyResultScreen}
          options={{ gestureEnabled: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
