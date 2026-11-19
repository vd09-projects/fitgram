// src/utils/exerciseGraph.ts
//
// TICKET-084 stage 2: where the Exercise screen's graph puts everything, as numbers (boards HistExercise01, 09, 10).
// Pure: the log in, positions out, so the scale, the breaks and the peek card are tested without a screen, and a
// wrong placement cannot hide as a plausible chart (CLAUDE.md 3.2). The graph is drawn from Views, not SVG
// (decided in TICKET-087): `lineSegment` turns two points into the one rotated View that joins them.

import { averageText, type ExerciseLog } from "./exerciseLog";
import { MONTHS } from "./sessionView";
import { EXERCISE_GRAPH_MIN_SPAN } from "../config/display";

/** One session as the graph reads it, oldest first. `value` is null where the session has no number to plot. */
export type GraphInput = {
  key: string;
  sessionId: string;
  workoutName: string;
  startedAt: number;
  value: number | null;
  unit: string | null;
  /** Which run of one weight unit it belongs to (0 is the newest run): a unit change starts a new scale. */
  run: number;
};

/**
 * The log's sessions as graph input, oldest first. The measure is the session's average weight (stage 4 lets a
 * session's total be drawn instead); a session with no average is a point with no value, never a zero.
 */
export function graphInput(log: ExerciseLog): GraphInput[] {
  return log.segments
    .flatMap((segment, run) =>
      segment.entries.map((entry): GraphInput => ({
        key: entry.key,
        sessionId: entry.sessionId,
        workoutName: entry.workoutName,
        startedAt: entry.startedAt,
        value: entry.average.kind === "value" ? entry.average.value : null,
        unit: segment.unit,
        run,
      }))
    )
    .reverse();
}

export type LabelAnchor = "start" | "middle" | "end";

export type GraphPoint = GraphInput & {
  x: number;
  /** Null when the session has no value: the line breaks here and nothing is drawn. */
  y: number | null;
  /** The newest session: drawn larger. */
  latest: boolean;
  /** The value written above the point: the highest and the lowest of its run, and `null` for every other. */
  label: { text: string; anchor: LabelAnchor } | null;
};

export type GraphLayout =
  | { kind: "few"; have: number; need: number }
  | { kind: "no_value" }
  | {
      kind: "graph";
      points: GraphPoint[];
      /** Pairs of consecutive points of one run that both have a value: where a line is drawn. */
      lines: [GraphPoint, GraphPoint][];
      /** X of the line between two runs of different units. */
      breaks: number[];
      /** Written above a run when there is more than one: its unit. */
      unitLabels: { text: string; x: number; anchor: LabelAnchor }[];
      /** "Sep 14" and "Nov 9": the dates under the graph's two ends. */
      from: string;
      to: string;
    };

export type GraphBox = { width: number; height: number };

// Insets, in dp: the points keep clear of the edges so a dot and its label are not cut, and the top leaves a label's room.
const INSET_X = 12;
const TOP = 26;
const BOTTOM = 12;
const LABEL_EDGE = 40;

/** "59.2", "10", "1,700": one decimal, trailing zero dropped. The board writes a whole figure whole. */
export const graphValueText = (value: number): string => String(Number(averageText(value)));

export const axisDate = (startedAt: number, now: number): string => {
  const d = new Date(startedAt);
  const year = d.getFullYear() === new Date(now).getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${year}`;
};

const anchorAt = (x: number, width: number): LabelAnchor => (x < LABEL_EDGE ? "start" : x > width - LABEL_EDGE ? "end" : "middle");

/**
 * The graph of `input` (oldest first, all of the lift's sessions the phone holds) in `box`.
 *
 * - `few`: fewer than `minSessions` sessions in all (not only the ones drawn): the screen says how many there are.
 * - `no_value`: none of the drawn sessions has a number to plot (a time lift): nothing to draw, said so.
 * - Only the newest `limit` sessions are drawn, evenly spaced by order, not by date: a gap of a month between two
 *   sessions is not a longer line, as the boards draw it.
 * - Each run of one weight unit has its own scale and the line stops between runs (nothing is converted, 087). A run
 *   is scaled from its lowest to its highest value, but never narrower than `EXERCISE_GRAPH_MIN_SPAN` of its highest,
 *   centred on its data, and a flat run sits in the middle.
 * - The highest and lowest point of each run are labelled, the newest of them where values tie, so a label is never
 *   written twice for one value.
 */
export function graphLayout(
  input: readonly GraphInput[],
  box: GraphBox,
  options: { limit: number; minSessions: number; now: number }
): GraphLayout {
  if (input.length < options.minSessions) return { kind: "few", have: input.length, need: options.minSessions };
  const drawn = input.slice(-options.limit);
  if (drawn.every((point) => point.value === null)) return { kind: "no_value" };

  // One slot per point, and one more where the unit changes, which is where the break is drawn.
  const slotOf: number[] = [];
  let slot = 0;
  drawn.forEach((point, i) => {
    if (i > 0) slot += point.run === drawn[i - 1].run ? 1 : 2;
    slotOf.push(slot);
  });
  const step = slot === 0 ? 0 : (box.width - 2 * INSET_X) / slot;
  const xOf = (i: number) => INSET_X + slotOf[i] * step;

  const bottom = box.height - BOTTOM;
  const yOf = new Map<number, (value: number) => number>();
  for (const run of new Set(drawn.map((point) => point.run))) {
    const values = drawn.flatMap((point) => (point.run === run && point.value !== null ? [point.value] : []));
    if (values.length === 0) continue;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = Math.max(hi - lo, EXERCISE_GRAPH_MIN_SPAN * hi);
    const mid = (lo + hi) / 2;
    yOf.set(run, (value) => (span === 0 ? (TOP + bottom) / 2 : bottom - ((value - (mid - span / 2)) / span) * (bottom - TOP)));
  }

  // Newest of equal values wins: scan newest first.
  const extreme = new Map<number, { max: number; min: number }>();
  for (let i = drawn.length - 1; i >= 0; i--) {
    const { run, value } = drawn[i];
    if (value === null) continue;
    const found = extreme.get(run);
    if (!found) extreme.set(run, { max: i, min: i });
    else {
      if (value > (drawn[found.max].value as number)) found.max = i;
      if (value < (drawn[found.min].value as number)) found.min = i;
    }
  }

  const points = drawn.map((point, i): GraphPoint => {
    const x = xOf(i);
    const found = extreme.get(point.run);
    const labelled = point.value !== null && found !== undefined && (found.max === i || found.min === i);
    return {
      ...point,
      x,
      y: point.value === null ? null : (yOf.get(point.run) as (v: number) => number)(point.value),
      latest: i === drawn.length - 1,
      label: labelled ? { text: graphValueText(point.value as number), anchor: anchorAt(x, box.width) } : null,
    };
  });

  const lines: [GraphPoint, GraphPoint][] = [];
  const breaks: number[] = [];
  const unitLabels: { text: string; x: number; anchor: LabelAnchor }[] = [];
  const runs = new Set(drawn.map((point) => point.run)).size;
  points.forEach((point, i) => {
    const before = points[i - 1];
    if (before && before.run === point.run && before.y !== null && point.y !== null) lines.push([before, point]);
    if (before && before.run !== point.run) breaks.push((before.x + point.x) / 2);
    if (runs > 1 && point.unit !== null && (!before || before.run !== point.run)) {
      unitLabels.push({ text: point.unit, x: point.x, anchor: anchorAt(point.x, box.width) });
    }
  });

  return {
    kind: "graph",
    points,
    lines,
    breaks,
    unitLabels,
    from: axisDate(drawn[0].startedAt, options.now),
    to: axisDate(drawn[drawn.length - 1].startedAt, options.now),
  };
}

/** Where the one View that joins two points goes: its left and top before rotating, its length, and its angle in degrees. */
export function lineSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
  thickness: number
): { left: number; top: number; length: number; angle: number } {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  return {
    // A View rotates about its centre: put the centre on the middle of the two points.
    left: (a.x + b.x) / 2 - length / 2,
    top: (a.y + b.y) / 2 - thickness / 2,
    length,
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  };
}

type Pt = { x: number; y: number };
export type Rect = { left: number; top: number; width: number; height: number };

/** A label is written inside a box this wide, aligned by its anchor, and about this tall. */
export const LABEL_WIDTH = 48;
const LABEL_HEIGHT = 16;

/** The box a label at `x` occupies (its text starts, ends or centres on `x`), `top` down from the plot's top. */
export const labelRect = (x: number, anchor: LabelAnchor, top: number): Rect => ({
  left: anchor === "start" ? x : anchor === "end" ? x - LABEL_WIDTH : x - LABEL_WIDTH / 2,
  top,
  width: LABEL_WIDTH,
  height: LABEL_HEIGHT,
});

/** The box above a labelled point: where its value is written. */
export const pointLabelRect = (point: GraphPoint): Rect | null =>
  point.label && point.y !== null ? labelRect(point.x, point.label.anchor, point.y - 24) : null;

const intersects = (a: Rect, b: Rect) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

/** How many points, sampled along `lines` every couple of dp, fall inside the rectangle (grown a little so a near miss counts). */
function overlap(rect: Rect, lines: readonly (readonly [Pt, Pt])[]): number {
  const margin = 2;
  let hits = 0;
  for (const [a, b] of lines) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
    for (let i = 0; i <= steps; i++) {
      const x = a.x + ((b.x - a.x) * i) / steps;
      const y = a.y + ((b.y - a.y) * i) / steps;
      if (x >= rect.left - margin && x <= rect.left + rect.width + margin && y >= rect.top - margin && y <= rect.top + rect.height + margin) hits++;
    }
  }
  return hits;
}

/**
 * Where the peek card for a tapped point goes: pinned to the top-left or the top-right corner of the plot, whichever
 * covers less, never beside the point. A card next to the dot cannot be kept clear in a graph this short: on the emulator
 * it sat on both sides of a peak's line and hid the peak's own label, and every place around the dot did the same.
 * A corner costs the line only where it climbs into the top 30 dp, and a label is a much worse thing to cover, so a
 * covered label weighs as much as `LABEL_PENALTY` points of line. On a tie, the corner farther from the tapped point.
 */
export function peekPosition(
  point: Pt,
  card: { width: number; height: number },
  box: GraphBox,
  obstacles: { lines: readonly (readonly [Pt, Pt])[]; labels: readonly Rect[] }
): { left: number; top: number } {
  const LABEL_PENALTY = 50;
  const corners = [
    { left: 0, top: 0 },
    { left: box.width - card.width, top: 0 },
  ];
  const score = (corner: { left: number; top: number }) => {
    const rect = { ...corner, ...card };
    return overlap(rect, obstacles.lines) + LABEL_PENALTY * obstacles.labels.filter((label) => intersects(rect, label)).length;
  };
  const distance = (corner: { left: number }) => Math.abs(corner.left + card.width / 2 - point.x);
  return [...corners].sort((a, b) => score(a) - score(b) || distance(b) - distance(a))[0];
}
