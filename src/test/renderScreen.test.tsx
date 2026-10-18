// The `history` option had no consumer before TICKET-018. These check that what
// it seeds is what `useExerciseHistory` reads, so screen tests built on it are
// testing the screen and not a broken seed.

import React from "react";
import { Text } from "react-native";
import { screen } from "@testing-library/react-native";
import { renderScreen } from "./renderScreen";
import { buildStats, buildWorkout } from "./fixtures";
import { useExerciseHistory } from "../hooks/useExerciseHistory";

/** Renders the hook's view of one exercise as text. */
function HistoryProbe() {
  const bench = useExerciseHistory("bench-press");
  const squat = useExerciseHistory("squat");
  const set = bench.setAt(1);
  return (
    <>
      <Text>{`bench:${bench.status}:${bench.hasHistory}:${set?.weight}x${set?.reps}`}</Text>
      <Text>{`squat:${squat.status}:${squat.hasHistory}`}</Text>
    </>
  );
}

describe("renderScreen history option", () => {
  it("seeds a stats doc as ready history the hook reads", () => {
    const stats = buildStats("Bench Press", [{ sets: [{ Weight: "60", Reps: "8" }] }]);
    renderScreen(HistoryProbe, {
      workout: buildWorkout(["Bench Press", "Squat"]),
      history: { [stats.exerciseId]: stats },
    });
    expect(screen.getByText("bench:ready:true:60x8")).toBeOnTheScreen();
    expect(screen.getByText("squat:idle:false")).toBeOnTheScreen();
  });

  it("seeds null as fetched-and-never-done, not idle", () => {
    renderScreen(HistoryProbe, { history: { "bench-press": null } });
    expect(screen.getByText("bench:ready:false:undefinedxundefined")).toBeOnTheScreen();
  });
});
