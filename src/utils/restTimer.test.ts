import { extendRest, formatCountdown, restCountdown, RestTimer } from "./restTimer";

const START = 1_000_000;
const REST = 90_000;
const at = (seconds: number) => START + seconds * 1000;

describe("restCountdown", () => {
  it("counts down from the start timestamp", () => {
    expect(restCountdown(START, REST, START)).toEqual({ state: "running", remainingSeconds: 90, elapsedFraction: 0 });
    expect(restCountdown(START, REST, at(6))).toMatchObject({ remainingSeconds: 84 });
  });

  it("rounds up, so the last second reads 0:01 rather than 0:00 while running", () => {
    expect(restCountdown(START, REST, at(89.5))).toMatchObject({ state: "running", remainingSeconds: 1 });
    expect(restCountdown(START, REST, at(90))).toEqual({ state: "done" });
  });

  it("reads done, not negative or restarted, when the rest ran out while away", () => {
    expect(restCountdown(START, REST, at(10 * 60))).toEqual({ state: "done" });
  });

  it("reads done when the clock moved backwards", () => {
    expect(restCountdown(START, REST, at(-30))).toEqual({ state: "done" });
  });

  it("has no rest to show for a non-finite input or no duration", () => {
    expect(restCountdown(START, 0, START)).toBeNull();
    expect(restCountdown(NaN, REST, START)).toBeNull();
  });
});

describe("formatCountdown", () => {
  it("formats m:ss and floors at 0:00", () => {
    expect(formatCountdown(90)).toBe("1:30");
    expect(formatCountdown(5)).toBe("0:05");
    expect(formatCountdown(600)).toBe("10:00");
    expect(formatCountdown(-3)).toBe("0:00");
  });
});

describe("extendRest", () => {
  const rest: RestTimer = { exerciseId: "bench-press", startedAt: START, durationMs: REST };

  it("moves the end of a running rest 30 s later", () => {
    const extended = extendRest(rest, at(60));
    expect(extended.durationMs).toBe(120_000);
    expect(restCountdown(extended.startedAt, extended.durationMs, at(60))).toMatchObject({ remainingSeconds: 60 });
  });

  it("gives a rest that already ended 30 s from now, not from its old end", () => {
    const extended = extendRest(rest, at(300));
    expect(restCountdown(extended.startedAt, extended.durationMs, at(300))).toMatchObject({
      state: "running",
      remainingSeconds: 30,
    });
  });

  it("restarts at 30 s from now when the clock moved backwards", () => {
    const extended = extendRest(rest, at(-60));
    expect(extended).toEqual({ ...rest, startedAt: at(-60), durationMs: 30_000 });
  });
});
