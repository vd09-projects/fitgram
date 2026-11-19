import { graphInput, graphLayout, graphValueText, lineSegment, peekPosition, type GraphInput } from "./exerciseGraph";
import type { ExerciseLog, LogEntry } from "./exerciseLog";
import { EXERCISE_GRAPH_MIN_SPAN } from "../config/display";

const box = { width: 362, height: 116 };
const NOW = new Date(2026, 10, 19).getTime();
const options = { limit: 10, minSessions: 5, now: NOW };

let n = 0;
const point = (value: number | null, run = 0, extra: Partial<GraphInput> = {}): GraphInput => ({
  key: `k${n++}`,
  sessionId: `s${n}`,
  workoutName: "Push",
  startedAt: new Date(2026, 8, 1 + n).getTime(),
  value,
  unit: run === 0 ? "kg" : "lb",
  run,
  ...extra,
});
/** Oldest first, as `graphInput` returns them. */
const series = (values: (number | null)[], run = 0) => values.map((value) => point(value, run));
const drawn = (layout: ReturnType<typeof graphLayout>) => {
  if (layout.kind !== "graph") throw new Error(`expected a graph, got ${layout.kind}`);
  return layout;
};

describe("graphLayout", () => {
  it("puts the oldest session at the left and a higher value higher up, and labels only the highest and lowest", () => {
    const layout = drawn(graphLayout(series([50, 55, 52, 60, 58]), box, options));
    const xs = layout.points.map((p) => p.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    const ys = layout.points.map((p) => p.y as number);
    expect(ys[3]).toBeLessThan(ys[1]); // 60 is above 55 (a smaller y is higher)
    expect(ys[0]).toBeGreaterThan(ys[2]); // 50 is below 52
    expect(layout.points.filter((p) => p.label).map((p) => p.label?.text)).toEqual(["50", "60"]);
    expect(layout.points[4].latest).toBe(true);
    expect(layout.points.filter((p) => p.latest)).toHaveLength(1);
  });

  it("does not stretch a small change over the whole chart, and puts a flat run in the middle", () => {
    const ripple = drawn(graphLayout(series([57, 58, 59, 59.5, 59.2]), box, options));
    const heights = ripple.points.map((p) => p.y as number);
    const wobble = Math.max(...heights) - Math.min(...heights);
    expect(wobble).toBeLessThan((box.height - 38) * 0.5);

    const flat = drawn(graphLayout(series([40, 40, 40, 40, 40]), box, options));
    expect(new Set(flat.points.map((p) => p.y)).size).toBe(1);
    expect(flat.points.filter((p) => p.label)).toHaveLength(1); // one value, one label
    // A change under the floor fills only its share of the plot: the named fraction of the top value, not a literal.
    const small = drawn(graphLayout(series([100, 106, 100, 100, 100]), box, options));
    const share = (Math.max(...small.points.map((p) => p.y as number)) - Math.min(...small.points.map((p) => p.y as number))) / (box.height - 12 - 26);
    expect(share).toBeCloseTo(6 / (EXERCISE_GRAPH_MIN_SPAN * 106), 5);
  });

  it("breaks the line at a session with no value and draws no point for it", () => {
    const layout = drawn(graphLayout(series([50, 52, null, 54, 56, 58]), box, options));
    expect(layout.points[2].y).toBeNull();
    expect(layout.lines).toHaveLength(3); // 50-52, 54-56, 56-58: nothing across the gap
    expect(layout.points[2].label).toBeNull();
  });

  it("scales each unit on its own, with a break between them, and never compares kg with lb", () => {
    const layout = drawn(graphLayout([...series([10, 12, 11, 15], 1), ...series([40, 50], 0)].map((p, i) => ({ ...p, key: `m${i}` })), box, options));
    const [lb, kg] = [layout.points.filter((p) => p.run === 1), layout.points.filter((p) => p.run === 0)];
    // 40 and 50 would sit far above 10 to 15 on one shared axis; on their own scales both runs reach the top of the plot.
    expect(Math.min(...lb.map((p) => p.y as number))).toBeCloseTo(Math.min(...kg.map((p) => p.y as number)), 5);
    expect(layout.breaks).toHaveLength(1);
    expect(layout.lines.every(([a, b]) => a.run === b.run)).toBe(true);
    expect(layout.unitLabels.map((l) => l.text)).toEqual(["lb", "kg"]);
  });

  it("says how many sessions there are below the minimum, counting the ones with no value, and says so when none has a number", () => {
    expect(graphLayout(series([50, 52]), box, options)).toEqual({ kind: "few", have: 2, need: 5 });
    expect(graphLayout(series([null, null, null, null, null]), box, options)).toEqual({ kind: "no_value" });
  });

  it("draws only the newest sessions up to the limit, with the dates of the drawn ends", () => {
    const layout = drawn(graphLayout(series([1, 2, 3, 4, 5, 6, 7, 8]), box, { ...options, limit: 5 }));
    expect(layout.points.map((p) => p.value)).toEqual([4, 5, 6, 7, 8]);
    expect(layout.from).toMatch(/^[A-Z][a-z]{2} \d+$/);
    expect(graphValueText(59.25)).toBe("59.3");
    expect(graphValueText(10)).toBe("10");
  });
});

describe("lineSegment and peekPosition", () => {
  it("joins two points with one rotated View: its length, its angle, and its centre on their middle", () => {
    expect(lineSegment({ x: 0, y: 10 }, { x: 40, y: 10 }, 2)).toEqual({ left: 0, top: 9, length: 40, angle: 0 });
    const diagonal = lineSegment({ x: 0, y: 0 }, { x: 30, y: 40 }, 2);
    expect(diagonal.length).toBe(50);
    expect(diagonal.angle).toBeCloseTo(53.13, 1);
    expect(diagonal.left + diagonal.length / 2).toBe(15);
    expect(lineSegment({ x: 5, y: 5 }, { x: 5, y: 45 }, 2).angle).toBe(90);
  });

  it("pins the card to the corner away from the tapped point, and to the other corner when a label would be covered", () => {
    const card = { width: 148, height: 32 };
    const none = { lines: [], labels: [] };
    expect(peekPosition({ x: 300, y: 60 }, card, box, none)).toEqual({ left: 0, top: 0 }); // point on the right: card on the left
    expect(peekPosition({ x: 40, y: 60 }, card, box, none)).toEqual({ left: box.width - card.width, top: 0 });
    // A value written in the left corner (the highest point is there): the card goes right, though the tap is on the right too.
    const labels = [{ left: 10, top: 4, width: 48, height: 16 }];
    expect(peekPosition({ x: 300, y: 60 }, card, box, { lines: [], labels })).toEqual({ left: box.width - card.width, top: 0 });
  });

  it("prefers the corner the line does not climb into", () => {
    const card = { width: 148, height: 32 };
    // The line runs along the top at the left and drops at the right.
    const lines: [{ x: number; y: number }, { x: number; y: number }][] = [[{ x: 12, y: 26 }, { x: 150, y: 26 }], [{ x: 150, y: 26 }, { x: 350, y: 100 }]];
    expect(peekPosition({ x: 300, y: 80 }, card, box, { lines, labels: [] })).toEqual({ left: box.width - card.width, top: 0 });
  });
});

describe("graphInput", () => {
  it("lists the log's sessions oldest first, tags each with its unit run, and leaves a session with no average without a value", () => {
    const entry = (key: string, average: LogEntry["average"]) => ({ key, sessionId: key, workoutName: "Push", startedAt: Number(key.slice(1)), average }) as LogEntry;
    const log: ExerciseLog = {
      columns: 3,
      unreadable: 0,
      segments: [
        { unit: "lb", entries: [entry("s9", { kind: "value", value: 40, unit: "lb" })] },
        { unit: "kg", entries: [entry("s3", { kind: "none", reason: "unreadable" }), entry("s1", { kind: "value", value: 15, unit: "kg" })] },
      ],
    };
    expect(graphInput(log).map((p) => [p.key, p.value, p.unit, p.run])).toEqual([
      ["s1", 15, "kg", 1],
      ["s3", null, "kg", 1],
      ["s9", 40, "lb", 0],
    ]);
  });
});
