// TICKET-073: the Firestore rules tests, run against the emulator by
// `npm run test:rules` (inside `firebase emulators:exec`). Kept out of
// `npm test` and CI, which need no Java and no emulator (jest.config.js
// ignores the folder). Plain Node, not jest-expo: these talk to the emulator
// with the Firebase web SDK, no React Native.
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/firestoreRules/**/*.test.ts"],
  testTimeout: 30_000,
};
