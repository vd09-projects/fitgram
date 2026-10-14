// Jest's globals (describe, it, expect, jest) and Testing Library's matchers
// (toBeOnTheScreen, toBeDisabled) for every test file.
//
// Named explicitly rather than left to TypeScript's automatic @types pickup:
// the CLI found @types/jest on its own, but the editor's TS server did not, and
// showed "Cannot find name 'describe'". A file under src/ is in tsconfig's
// `include`, so every TypeScript process that loads the project reads this one.
// Rejected: `"types": ["jest"]` in tsconfig, which switches automatic pickup off
// for every other @types package.

/// <reference types="jest" />
/// <reference types="@testing-library/react-native/extend-expect" />
