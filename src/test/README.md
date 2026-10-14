# How to add a test

`npm test` runs everything once; `npm run test:watch` reruns on save.

## Where files go

Next to the code they cover, named `*.test.ts` or `*.test.tsx`:
`src/utils/workoutProgress.test.ts`,
`src/screens/workout_management/ActiveWorkoutScreen.test.tsx`. Jest only
collects those two patterns under `src/`; `src/scripts/` is hand-run scripts.

Test files are typechecked by `npx tsc --noEmit` like any other source.

## A pure function

Import it and call it. No setup, no mocks. See `src/utils/workoutProgress.test.ts`.
If a screen computes a number, move the maths into a function in `src/utils/`
and test it there; a wrong number on a screen looks like data.

## A screen

```tsx
import { fireEvent, screen } from "@testing-library/react-native";
import ActiveWorkoutScreen from "./ActiveWorkoutScreen";
import { renderScreen } from "../../test/renderScreen";
import { buildWorkout } from "../../test/fixtures";

it("shows the first exercise", () => {
  renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press", "Squat"]) });
  expect(screen.getByText("Bench Press")).toBeOnTheScreen();
});
```

`renderScreen` supplies the theme and tour providers, a real navigator, and a
signed-in user, and resets every store first. You seed a scenario through its
options (`src/test/renderScreen.tsx` documents each one):

| Option | What it sets | Default |
| --- | --- | --- |
| `workout` | the active workout; build with `buildWorkout` | none |
| `workoutActions` | store actions to replace, e.g. `{ endWorkout: jest.fn() }` | real actions |
| `history` | cached history per exercise id, as `ready` | every exercise `idle` |
| `user` | signed-in user, or `null` | `{ uid: "test-user" }` |
| `route` | the route name the screen sits under | `LogWorkout` |

Read state back from the store directly:
`useWorkoutStore.getState().activeWorkout?.currentExerciseIndex`. When the tap
runs an async action that awaits storage first (logging a set does), wrap it:
`await act(() => fireEvent.press(...))`, or the store has not changed yet.

**Navigation** is real. Every other route is a stub that renders its own path,
so assert where a tap went with `screen.getByText("route:Workout/WorkoutHome")`.
The screen under test has nothing behind it on the stack.

**Find elements** the way a user would: `getByRole("button", { name: ... })`
using the accessibility label, or `getByText` for visible copy.

## What to mock

Usually nothing. Already handled for every test (`src/test/jest.setup.ts`):
AsyncStorage and gesture handler (the libraries' own mocks), fonts, fake
timers, and the Firebase init module.

- **Anything that saves or loads from Firestore:** replace the store action
  with `workoutActions`. Do not mock Firebase. If a test reaches Firebase, it
  fails with "Test reached Firebase …" — that is the signal to replace the
  action, not to widen the mock.
- **A store action that itself calls Firestore** (testing `endWorkout`, not a
  screen that calls it): replace the service function it calls, with
  `jest.mock` and `jest.requireActual` for the rest of the module. See
  `src/stores/useWorkoutStore.test.ts`.
- **Time:** timers are fake. `jest.advanceTimersByTime(ms)` moves them.
- **A new provider** a screen needs: add it to `renderScreen`, once, not in the
  test.

## What not to write

From the TICKET-017 review and TICKET-024:

- An assertion that cannot fail. Before you commit a test, break the line it
  covers and watch it go red. Negative assertions ("not called", "does not
  throw") are the ones that pass against broken code; pair each with the
  positive case.
- Snapshots, source-text regexes, or layout checks (sizes, borders, hit areas).
  Layout stays on device.
- Every branch. Cover what your change added or fixed; four or five tests per
  screen is the norm (CLAUDE.md, "Test what the change touched").
