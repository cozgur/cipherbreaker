import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

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
import { OnboardingIntroScreen } from '@screens/OnboardingIntroScreen';
import { OnboardingTokenWalkthroughScreen } from '@screens/OnboardingTokenWalkthroughScreen';
import { ProfileScreen } from '@screens/ProfileScreen';
import { SecretSetupScreen } from '@screens/SecretSetupScreen';
import { ShopScreen } from '@screens/ShopScreen';
import { TutorialMatchScreen } from '@screens/TutorialMatchScreen';
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
 * Phase 7A.6 CP7 — onboarding flow entry point.
 *
 * `hasOnboarded` is the master gate. When true, the user goes
 * straight to Home (the "I've finished onboarding" path). When
 * false, the early-exit chain picks the next unseen step:
 *
 *   !introSeen                 → OnboardingIntro      (CP2)
 *   !tutorialMatchCompleted    → TutorialMatch        (CP3)
 *   !tokenWalkthroughSeen      → OnboardingTokenWalk… (CP4)
 *   otherwise                  → Home                  (failsafe)
 *
 * Force-quit recovery is implicit: a user who quits at CP3 has
 * `introSeen=true, tutorialMatchCompleted=false`, so the next
 * launch lands on TutorialMatch — not back at the start. CP3.1
 * zeroed the fresh-install defaults so this gate engages cleanly.
 *
 * The chain runs once at component mount (no hook subscription)
 * — same one-shot pattern the legacy `mockUser.hasOnboarded`
 * read used. State changes during a session don't re-route; the
 * per-screen `navigation.replace` calls handle forward motion.
 */
function pickInitialRoute(): keyof RootStackParamList {
  const state = useUserStore.getState();
  if (state.hasOnboarded) return 'Home';
  const onboarding = state.onboarding;
  if (!onboarding.introSeen) return 'OnboardingIntro';
  if (!onboarding.tutorialMatchCompleted) return 'TutorialMatch';
  if (!onboarding.tokenWalkthroughSeen) return 'OnboardingTokenWalkthrough';
  // All step flags true but `hasOnboarded === false` — defensive
  // failsafe (corrupt state / programmer error). The screens'
  // own completion calls flip `completedAt`; if every flag is set
  // here the user has effectively finished, so route them home.
  return 'Home';
}

export function RootNavigator(): React.JSX.Element {
  const initialRouteName = pickInitialRoute();

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
          name="OnboardingIntro"
          component={OnboardingIntroScreen}
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
          name="OnboardingTokenWalkthrough"
          component={OnboardingTokenWalkthroughScreen}
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
