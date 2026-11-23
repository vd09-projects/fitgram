import { renderHook } from "@testing-library/react-native";
import { useExerciseHistory } from "./useExerciseHistory";
import { useWorkoutStore } from "../stores/useWorkoutStore";
import { buildExercise, buildWorkout } from "../test/fixtures";

jest.mock("../services/firebase/firebase", () => ({ db: {} }));
jest.mock("../services/db/workoutSessions", () => ({
  getAllExerciseStats: jest.fn(),
  getChangedExerciseStats: jest.fn(),
}));

// TICKET-102: only the logger's own reading of an exercise in an edit draft is cut at the draft's start.
const START = new Date(2026, 10, 9, 18).getTime();
const seed = (editing: boolean) =>
  useWorkoutStore.setState({
    activeWorkout: {
      ...buildWorkout([], { id: "push", name: "Push", startTime: START, exercises: [buildExercise("Bench Press")] }),
      ...(editing ? { editOf: { sessionId: "push_s", endedAt: START + 1, original: [] } } : {}),
    },
  });

afterEach(() => useWorkoutStore.setState({ activeWorkout: null }));

it("an exercise of an edit draft reads as of the draft's start", () => {
  seed(true);
  const { result } = renderHook(() => useExerciseHistory("bench-press"));
  expect(result.current.asOf?.bestHidden).toBe(true);
});

it("a live workout's exercise is not cut", () => {
  seed(false);
  const { result } = renderHook(() => useExerciseHistory("bench-press"));
  expect(result.current.asOf).toBeUndefined();
});

it("a caller that passes its own fields (a plan card, the debug screen) is not cut, even during an edit", () => {
  seed(true);
  const fields = buildExercise("Bench Press").fields;
  const { result } = renderHook(() => useExerciseHistory("bench-press", { fields }));
  expect(result.current.asOf).toBeUndefined();
});

it("an exercise that is not in the draft is not cut", () => {
  seed(true);
  const { result } = renderHook(() => useExerciseHistory("squat"));
  expect(result.current.asOf).toBeUndefined();
});
