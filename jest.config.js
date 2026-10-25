// How to add a test: src/test/README.md
/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  // Native-module mocks shipped by the libraries themselves, not hand-written.
  // react-native-reanimated is not installed, so it has no mock here.
  setupFiles: ["./node_modules/react-native-gesture-handler/jestSetup.js"],
  // jest-expo's list plus firebase, which resolves to ES modules here. Kept in
  // sync with node_modules/jest-expo/jest-preset.js by hand.
  transformIgnorePatterns: [
    "/node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|firebase|@firebase/.*)",
  ],
  // Merged with the preset's transforms. @firebase/util ships one .mjs file,
  // which the preset's `\\.[jt]sx?$` pattern does not match.
  transform: {
    "\\.mjs$": ["babel-jest", { caller: { name: "metro", bundler: "metro", platform: "ios" } }],
  },
  setupFilesAfterEnv: ["./src/test/jest.setup.ts"],
  // Tests sit next to the code they cover. `src/scripts/` holds hand-run
  // scripts; only their I/O-free cores have suites (wipe.test.ts).
  testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],
};
