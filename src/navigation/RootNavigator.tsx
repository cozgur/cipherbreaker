import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { mockUser } from '@data/mockUser';
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
import { OnboardingScreen } from '@screens/OnboardingScreen';
import { ProfileScreen } from '@screens/ProfileScreen';
import { SecretSetupScreen } from '@screens/SecretSetupScreen';
import { ShopScreen } from '@screens/ShopScreen';
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

export function RootNavigator(): React.JSX.Element {
  // Phase 2 replaces this mockUser read with a Zustand selector that
  // hydrates from AsyncStorage; the navigator shape does not change.
  const initialRouteName: keyof RootStackParamList = mockUser.hasOnboarded ? 'Home' : 'Onboarding';

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bgBase },
        }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
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
