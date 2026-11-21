import { StyleSheet } from "react-native";
import { screen } from "@testing-library/react-native";
import { renderScreen } from "../../test/renderScreen";
import WorkoutProgressBar from "./WorkoutProgressBar";
import { ProgressSegment } from "../../utils/workoutProgress";
import { AllColorSchemas, DefaultColorSchema } from "../../constants/colors";

const accent = AllColorSchemas[DefaultColorSchema].role.accent;

// The hard case from the report: one exercise done, one skipped, the third current with no set yet.
const segments: ProgressSegment[] = [
  { state: "done", setsLogged: 3 },
  { state: "untouched" },
  { state: "current", setsLogged: 0, targetSets: 3, targetSource: "lastSession", fill: 0 },
  { state: "untouched" },
];

const style = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style);

describe("WorkoutProgressBar", () => {
  it("draws the current exercise as a bigger capsule outlined in the accent, not as another grey", () => {
    renderScreen(() => <WorkoutProgressBar segments={segments} />);

    const current = style("progress-current");
    const done = style("progress-done");

    expect(current.height).toBeGreaterThan(done.height);
    expect(current.borderWidth).toBeGreaterThan(0);
    expect(current.borderColor).toBe(accent);
    // Empty inside: the accent is only the outline until a set is logged.
    expect(current.backgroundColor).not.toBe(accent);
  });

  it("grows the fill inside the capsule with the sets logged", () => {
    renderScreen(() => (
      <WorkoutProgressBar segments={[{ state: "current", setsLogged: 2, targetSets: 5, targetSource: "lastSession", fill: 0.4 }, { state: "untouched" }]} />
    ));

    expect(style("progress-fill").width).toBe("40%");
  });
});
