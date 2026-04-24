/* eslint-disable @typescript-eslint/no-require-imports */
// Reanimated v4 ships a "mock" that still boots Worklets — unusable in Node.
// We stub the surface our primitives actually touch: `Easing` functions +
// the default Animated namespace (moti keys off the latter internally).
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const identity = (value) => value;
  const easingFactory = () => identity;
  const Easing = new Proxy(
    { linear: identity, ease: identity, in: easingFactory, out: easingFactory, inOut: easingFactory, sin: identity, bezier: easingFactory },
    { get: (target, prop) => (prop in target ? target[prop] : easingFactory) },
  );
  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent: (Component) => Component,
    },
    Easing,
    createAnimatedComponent: (Component) => Component,
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    withTiming: identity,
    withSpring: identity,
    withRepeat: identity,
    withSequence: identity,
    runOnJS: (fn) => fn,
  };
});

// Moti spins up reanimated worklets under MotiView/animate — in Jest we
// just need the children to render; animations are visual concerns the
// device screenshot covers.
jest.mock('moti', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Passthrough = React.forwardRef((props, ref) =>
    React.createElement(View, { ...props, ref }, props.children),
  );
  Passthrough.displayName = 'MotiViewMock';
  return {
    __esModule: true,
    MotiView: Passthrough,
    MotiText: Passthrough,
    MotiImage: Passthrough,
    AnimatePresence: ({ children }) => children,
  };
});
