import { REST_DONE_CHIP_MS } from "../config/workout";
import { restChipState } from "./restChip";
import { RestTimer } from "./restTimer";

const START = 1_000_000;
const REST = 90_000;
const rest: RestTimer = { exerciseId: "bench", startedAt: START, durationMs: REST, setNumber: 2 };
const at = (seconds: number) => START + seconds * 1000;

describe("restChipState", () => {
  it("shows the time left and how far through on another exercise", () => {
    expect(restChipState(rest, "fly", at(49))).toEqual({ kind: "running", remaining: "0:41", elapsedFraction: 49 / 90 });
  });

  it("shows nothing on the resting exercise, where the card is, or with no rest", () => {
    expect(restChipState(rest, "bench", at(49))).toBeNull();
    expect(restChipState(null, "fly", at(49))).toBeNull();
  });

  it("reads done for a window after the end, then nothing, without ending the rest", () => {
    expect(restChipState(rest, "fly", START + REST)).toEqual({ kind: "done" });
    expect(restChipState(rest, "fly", START + REST + REST_DONE_CHIP_MS - 1)).toEqual({ kind: "done" });
    expect(restChipState(rest, "fly", START + REST + REST_DONE_CHIP_MS)).toBeNull();
  });

  it("shows no chip, not 'Rest over', when the clock moved backwards", () => {
    expect(restChipState(rest, "fly", at(-30))).toBeNull();
  });

  it("shows no chip for a rest with no usable duration", () => {
    expect(restChipState({ ...rest, durationMs: 0 }, "fly", at(5))).toBeNull();
  });
});
