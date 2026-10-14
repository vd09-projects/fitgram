// Runs before every test file. Only global, library-level mocks belong here;
// per-screen setup goes through renderScreen (src/test/renderScreen.tsx).

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The app's Firebase init module runs `initializeAuth` at import time, and under
// Jest `Constants.expoConfig.extra` is empty, so importing any store throws
// "auth/invalid-api-key" before a test starts. Only this module is replaced —
// the Firebase SDK itself still loads. Its handles throw on first use, so a test
// that reaches Firestore or Auth fails loudly instead of passing silently.
// Rejected: a fake config via expo-constants, which would let real network
// calls be attempted. A test needing Firestore behaviour replaces the store
// action that calls it (renderScreen's `workoutActions`).
jest.mock("../services/firebase/firebase", () => {
  const unreachable = (name: string) =>
    new Proxy(
      {},
      {
        get(_target, property) {
          throw new Error(
            `Test reached Firebase ${name}.${String(property)}. Seed the store or ` +
              `replace the action instead (src/test/README.md).`
          );
        },
      }
    );
  return { auth: unreachable("auth"), db: unreachable("db") };
});

// Fonts count as loaded. jest-expo 52's native mock has `getLoadedFonts()`
// return undefined, which expo-font 13 calls `.forEach` on, so every
// @expo/vector-icons icon threw on render. Reporting "none loaded" instead made
// each icon load its font and set state after the test finished. Tests assert
// behaviour, not glyphs, so there is nothing to load.
jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
}));

// Fake timers in every file. A stack card's open animation ends on a 16ms timer
// in React Native's Animated mock, which otherwise fires after the test has
// returned and sets state outside act(). The active workout's elapsed-time
// interval also stops ticking mid-test. Promises are unaffected, so async
// actions still settle. A test that needs time to pass calls
// `jest.advanceTimersByTime`.
jest.useFakeTimers();
