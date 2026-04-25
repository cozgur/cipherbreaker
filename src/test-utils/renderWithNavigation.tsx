/**
 * Test helper — mounts a screen inside a memory navigation stack so
 * that `useNavigation()`, route params, and the safe-area context all
 * resolve. Returns the RTL render result plus a helper to observe
 * the current route without poking at internals.
 *
 * `react-native-screens` stamps every screen with a random `screenId`
 * — `stableTreeForSnapshot()` strips it (and the matching
 * `id`/`onAppear` callbacks Jest can't compare) so snapshots stay
 * deterministic across runs.
 */

import type { ComponentType } from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer, type NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { RootStackParamList } from '@navigation/routes';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';

const VOLATILE_PROPS = new Set(['screenId']);

type JsonTree =
  | string
  | number
  | null
  | undefined
  | boolean
  | { type: string; props: Record<string, unknown>; children: JsonTree[] | null };

/** Strips non-deterministic native-stack metadata before snapshotting. */
export function stableTreeForSnapshot(tree: JsonTree | JsonTree[] | null): unknown {
  if (tree == null) return tree;
  if (Array.isArray(tree)) return tree.map((node) => stableTreeForSnapshot(node));
  if (typeof tree !== 'object') return tree;

  const cleanedProps: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(tree.props ?? {})) {
    if (VOLATILE_PROPS.has(key)) continue;
    cleanedProps[key] = value;
  }
  return {
    type: tree.type,
    props: cleanedProps,
    children: tree.children == null ? null : tree.children.map((c) => stableTreeForSnapshot(c)),
  };
}

type AnyRoute = keyof RootStackParamList;

type InitialParamsFor<R extends AnyRoute> = RootStackParamList[R];

const Stack = createNativeStackNavigator<RootStackParamList>();

// Fixed insets keep snapshots stable across test environments.
const DEFAULT_INSETS = { top: 44, left: 0, right: 0, bottom: 34 };

type Registrable = {
  [K in AnyRoute]?: ComponentType<object>;
};

export function renderWithNavigation<R extends AnyRoute>(
  initialRouteName: R,
  components: Registrable,
  initialParams?: InitialParamsFor<R>,
): ReturnType<typeof render> & {
  readonly navRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
} {
  const navRef = createRef<NavigationContainerRef<RootStackParamList>>();

  const merged: Registrable = { ...components };

  const utils = render(
    <SafeAreaProvider
      initialMetrics={{
        insets: DEFAULT_INSETS,
        frame: { x: 0, y: 0, width: 390, height: 844 },
      }}
    >
      <NavigationContainer ref={navRef}>
        <Stack.Navigator
          initialRouteName={initialRouteName}
          screenOptions={{ headerShown: false, animation: 'none' }}
        >
          {(Object.keys(merged) as AnyRoute[]).map((name) => {
            const Component = merged[name] ?? RouteStubScreen;
            const isInitial = name === initialRouteName;
            return (
              <Stack.Screen
                key={name}
                name={name as never}
                component={Component as never}
                initialParams={isInitial ? (initialParams as never) : undefined}
              />
            );
          })}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>,
  );

  return Object.assign(utils, { navRef });
}
