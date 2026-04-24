import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { PlaceholderScreen } from '@screens/PlaceholderScreen';
import { PrimitivePlaygroundScreen } from '@screens/PrimitivePlaygroundScreen';
import { colors } from '@theme/index';

export type RootStackParamList = {
  Placeholder: undefined;
  PrimitivePlayground: undefined;
};

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
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        // TODO(phase-1B): switch initial route back to the onboarding entry
        // once real screens land. `PrimitivePlayground` exists only as a
        // visual regression surface during Phase 1A.
        initialRouteName="PrimitivePlayground"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bgBase },
        }}
      >
        <Stack.Screen name="PrimitivePlayground" component={PrimitivePlaygroundScreen} />
        <Stack.Screen name="Placeholder" component={PlaceholderScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
