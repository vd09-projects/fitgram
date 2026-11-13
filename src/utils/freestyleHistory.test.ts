import { buildExercise } from "../test/fixtures";
import { WorkoutSessionDoc } from "../types/workoutSession";
import { FREESTYLE_ID } from "../constants/freestyle";
import { freestyleHistoryEntry } from "./freestyleHistory";

const session = (workoutId: string, startedAt: number, exerciseIds: string[]): WorkoutSessionDoc => ({
  lifts: [], sessionId: `${workoutId}_${startedAt}`,
  workoutId,
  workoutName: workoutId,
  startedAt,
  endedAt: startedAt + 1,
  exerciseIds,
});

describe("freestyleHistoryEntry", () => {
  it("is null with no Freestyle session, plan sessions or not", () => {
    expect(freestyleHistoryEntry([], [])).toBeNull();
    expect(freestyleHistoryEntry([session("push", 1, ["bench"])], [])).toBeNull();
  });

  it("lists Freestyle's exercises newest first, once each, never a plan's, with a plan's custom exercise as the plan has it", () => {
    const curl = { ...buildExercise("Cable Curl"), id: "my-curl" };
    const entry = freestyleHistoryEntry(
      [
        session(FREESTYLE_ID, 100, ["squat", "my-curl"]),
        session("push", 300, ["bench"]),
        session(FREESTYLE_ID, 200, ["row__barbell", "squat"]),
      ],
      [{ id: "arms", name: "Arms", exercises: [curl] }]
    );

    expect(entry).toMatchObject({ id: FREESTYLE_ID, name: "Freestyle" });
    expect(entry!.exercises.map((e) => e.id)).toEqual(["row__barbell", "squat", "my-curl"]);
    expect(entry!.exercises[2]).toBe(curl);
    expect(entry!.exercises[0]).toEqual({ id: "row__barbell", name: "", fields: [] });
  });
});
