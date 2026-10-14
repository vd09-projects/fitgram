import {
  DEFAULT_TARGET_SETS,
  buildProgressSegments,
  clampExerciseIndex,
  formatElapsed,
} from "./workoutProgress";

/** An exercise with `n` logged sets; only `sets.length` is read. */
const withSets = (n: number) => ({ sets: Array.from({ length: n }, () => ({}) as any) });

const currentSegment = (sets: number, lastSessionSetCount: number | null) => {
  const [segment] = buildProgressSegments([withSets(sets)], 0, lastSessionSetCount);
  if (segment.state !== "current") throw new Error(`expected current, got ${segment.state}`);
  return segment;
};

describe("buildProgressSegments: current segment", () => {
  it("fills against last session's set count when history exists", () => {
    const segment = currentSegment(2, 4);
    expect(segment.targetSets).toBe(4);
    expect(segment.targetSource).toBe("lastSession");
    expect(segment.fill).toBe(0.5);
  });

  it("falls back to DEFAULT_TARGET_SETS without history, and says so", () => {
    const segment = currentSegment(2, null);
    expect(segment.targetSets).toBe(DEFAULT_TARGET_SETS);
    expect(segment.targetSource).toBe("default");
    expect(segment.fill).toBeCloseTo(2 / DEFAULT_TARGET_SETS);
  });

  it("caps the fill at 1 when sets exceed the target", () => {
    expect(currentSegment(5, 3).fill).toBe(1);
  });
});

describe("clampExerciseIndex", () => {
  it("clamps below the first and past the last exercise", () => {
    expect(clampExerciseIndex(-1, 3)).toBe(0);
    expect(clampExerciseIndex(3, 3)).toBe(2);
  });

  it("is null for an empty workout, never 0", () => {
    expect(clampExerciseIndex(0, 0)).toBeNull();
  });
});

describe("formatElapsed", () => {
  const start = 1_000_000;

  it("switches from m:ss to h:mm:ss at the hour", () => {
    expect(formatElapsed(start, start + 3599_000)).toBe("59:59");
    expect(formatElapsed(start, start + 3600_000)).toBe("1:00:00");
  });

  it("reads 0:00 for a start in the future", () => {
    expect(formatElapsed(start + 60_000, start)).toBe("0:00");
  });
});
