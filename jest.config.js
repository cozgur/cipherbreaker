/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@game/(.*)$': '<rootDir>/src/game/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@theme/(.*)$': '<rootDir>/src/theme/$1',
    '^@state/(.*)$': '<rootDir>/src/state/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@data/(.*)$': '<rootDir>/src/data/$1',
    '^@navigation/(.*)$': '<rootDir>/src/navigation/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.expo/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-reanimated|react-native-worklets|moti))',
  ],
};
