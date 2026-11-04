// TICKET-067 stage 2: Freestyle in the History filter. The dropdown is a
// native picker; it is replaced by one button per option so the test drives
// the filter's own logic (which entries, which sessions), not the picker.

import React from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import WorkoutHistoricalLogsFilter from "./WorkoutHistoricalLogsFilter";
import { renderScreen, TEST_USER_ID } from "../test/renderScreen";
import { buildExercise } from "../test/fixtures";
import { getAllWorkoutPlans } from "../services/db/userDB";
import { getExerciseSessions, getWorkoutSessions } from "../services/db/workoutSessions";
import { ExerciseSessionDoc, WorkoutSessionDoc } from "../types/workoutSession";
import { FREESTYLE_ID } from "../constants/freestyle";
import show from "../utils/toastUtils";

jest.mock("./SearchableInputDropdown", () => {
  const { Text, TouchableOpacity, View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: ({ title, data, onChange }: { title: string; data: { label: string; value: unknown }[]; onChange: (s: unknown) => void }) => (
      <View>
        {data.map((item) => (
          <TouchableOpacity
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={`${title}: ${item.label}`}
            onPress={() => onChange({ label: item.label, value: item.value, isCustom: false })}
          >
            <Text>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
  };
});
jest.mock("../services/db/userDB", () => ({
  ...jest.requireActual("../services/db/userDB"),
  getAllWorkoutPlans: jest.fn(),
}));
jest.mock("../services/db/workoutSessions", () => ({
  ...jest.requireActual("../services/db/workoutSessions"),
  getWorkoutSessions: jest.fn(),
  getExerciseSessions: jest.fn(),
}));
jest.mock("../utils/toastUtils", () => ({
  __esModule: true,
  default: { alert: jest.fn(), success: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockPlans = getAllWorkoutPlans as jest.Mock;
const mockSessions = getWorkoutSessions as jest.Mock;
const mockExerciseSessions = getExerciseSessions as jest.Mock;

const bench = buildExercise("Bench Press");
const PUSH = { id: "push", name: "Push", exercises: [bench] };

const workoutSession = (workoutId: string, startedAt: number, exerciseIds: string[]): WorkoutSessionDoc => ({
  sessionId: `${workoutId}_${startedAt}`,
  workoutId,
  workoutName: workoutId,
  startedAt,
  endedAt: startedAt + 1,
  exerciseIds,
  rollupPending: false,
});
const benchDone = (workoutId: string, performedAt: number): ExerciseSessionDoc => ({
  exerciseId: bench.id,
  exerciseName: "Bench Press",
  sessionId: `${workoutId}_${performedAt}`,
  workoutId,
  workoutName: workoutId,
  performedAt,
  fields: bench.fields,
  sets: [{ segments: [{ Weight: 60, Reps: 8 }], effort: null }],
});

async function renderFilter(freestyle: WorkoutSessionDoc[] | Error) {
  const setDisplayLog = jest.fn();
  mockPlans.mockResolvedValue([PUSH]);
  if (freestyle instanceof Error) mockSessions.mockRejectedValue(freestyle);
  else mockSessions.mockResolvedValue({ sessions: freestyle, lastDoc: null });
  mockExerciseSessions.mockResolvedValue({
    sessions: [benchDone(FREESTYLE_ID, 300), benchDone("push", 200), benchDone(FREESTYLE_ID, 100)],
    lastDoc: null,
  });
  renderScreen(() => <WorkoutHistoricalLogsFilter setDisplayLog={setDisplayLog} />);
  await screen.findByRole("button", { name: "Workout Plan: Push" });
  await waitFor(() => expect(mockSessions).toHaveBeenCalled());
  return setDisplayLog;
}

const showData = async () => {
  await act(async () => {
    fireEvent.press(screen.getByText("Show Data"));
  });
};

beforeEach(() => jest.clearAllMocks());

describe("WorkoutHistoricalLogsFilter, Freestyle", () => {
  it("lists Freestyle after the plans, with its exercises, and shows only Freestyle sessions", async () => {
    const setDisplayLog = await renderFilter([workoutSession(FREESTYLE_ID, 300, [bench.id])]);

    expect(mockSessions).toHaveBeenCalledWith(TEST_USER_ID, { workoutId: "freestyle", pageSize: 50 });
    const options = screen.getAllByRole("button", { name: /^Workout Plan: / }).map((b) => b.props.accessibilityLabel);
    expect(options).toEqual(["Workout Plan: Push", "Workout Plan: Freestyle"]);

    fireEvent.press(screen.getByRole("button", { name: "Workout Plan: Freestyle" }));
    fireEvent.press(await screen.findByRole("button", { name: "Exercises: Bench Press" }));
    await showData();

    const shown = setDisplayLog.mock.calls.at(-1)![0];
    expect(shown.WorkoutName).toBe("Freestyle");
    expect(shown.displayData.map((log: { id: string }) => log.id)).toEqual(["freestyle_300", "freestyle_100"]);
  });

  it("with no Freestyle session: plans only, and a plan's history leaves Freestyle sessions out", async () => {
    const setDisplayLog = await renderFilter([]);

    expect(screen.queryByRole("button", { name: "Workout Plan: Freestyle" })).toBeNull();
    await showData();

    const shown = setDisplayLog.mock.calls.at(-1)![0];
    expect(shown.WorkoutName).toBe("Push");
    expect(shown.displayData.map((log: { id: string }) => log.id)).toEqual(["push_200"]);
  });

  it("says so when Freestyle's sessions do not load, and still lists the plans", async () => {
    const quiet = jest.spyOn(console, "error").mockImplementation(() => {});
    await renderFilter(new Error("offline"));

    await waitFor(() => expect(show.warn).toHaveBeenCalledWith("Freestyle history did not load", expect.any(String)));
    expect(screen.getByRole("button", { name: "Workout Plan: Push" })).toBeOnTheScreen();
    quiet.mockRestore();
  });
});
