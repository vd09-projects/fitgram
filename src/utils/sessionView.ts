// src/utils/sessionView.ts
//
// TICKET-083 stage 1: what the Session screen shows, as data. Pure: a session in, cards out, so every
// rule here is tested without a screen and a wrong word cannot hide as a plausible one (CLAUDE.md 3.2).
// The screen draws and owns the taps. Boards HistSession01 to 17.
//
// One record feeds every source. A workout from the queue, the held window or a fetch by id is a
// `WorkoutSessionDoc` with `lifts`; the queue's is built by `mergePending` (provisional verdicts, never
// stored), so no source needs a second read for its sets.

import { FREESTYLE_ID } from "../constants/freestyle";
import { SESSION_CARD_SETS_SHOWN, SESSION_COMPARE_COUNT } from "../config/display";
import { SESSION_NOTE_MAX_LENGTH } from "../config/storedData";
import type { Effort, ExerciseStatsDoc, LiftRecord, StatsSessionEntry, WorkoutSessionDoc } from "../types/workoutSession";
import type { PendingUpload } from "../types/zustandWorkoutType";
import type { ExerciseField } from "../types/workoutType";
import { mergePending, type RailWorkout } from "./historyRail";
import { areFieldsComparable, parseSet, resolveNumericFields } from "./exerciseFields";
import { previousSessionOf } from "./liftRecord";
import type { LiftSession } from "./liftVerdict";
import { matchLastField } from "./unitChange";
import { sessionMinutes } from "./sessionDuration";
import { compareSets, setValuesText } from "./setDeltas";
import { decodeStoredSets, plannedSegment, splitSegments } from "./storedSets";

/** The held rollup of one exercise, or null when it is not held. Same shape `mergePending` takes. */
export type SummaryOf = (exerciseId: string) => Pick<ExerciseStatsDoc, "recentSessions"> | null;

export type SessionLookup = { kind: "found"; workout: RailWorkout } | { kind: "notOnPhone" };

/**
 * Where a workout opened by id is on the phone: the queue and the held window and the loaded older pages
 * are all searched as one list (`mergePending`), and a session in both the queue and the window is the
 * held copy, so a Session opened from the queue follows the move to held when the upload lands.
 * `notOnPhone` means the screen must fetch by id: it is never guessed from an empty list (CLAUDE.md 2.4).
 */
export function resolveSession(
  sessionId: string,
  input: {
    held: readonly WorkoutSessionDoc[];
    older: readonly WorkoutSessionDoc[];
    pending: readonly PendingUpload[];
    uid: string | undefined;
    summaryOf: SummaryOf | null;
  }
): SessionLookup {
  const all = mergePending([...input.held, ...input.older], input.pending, input.uid, input.summaryOf);
  const workout = all.find((entry) => entry.session.sessionId === sessionId);
  return workout ? { kind: "found", workout } : { kind: "notOnPhone" };
}

/** The strip above a workout that has not reached the server, or null once it has (boards 08, 09). */
export const uploadNotice = (state: RailWorkout["state"]): string | null =>
  state === "waiting" ? "Not uploaded yet" : state === "failed" ? "Didn't upload" : null;

/**
 * The word beside a lift (boards 02, 08). Null means no word, for one of two reasons the screen need not tell
 * apart: `pending` (not computed, or older than the rollup's window: a word would be a guess), and a first
 * time in Freestyle, where every lift is new and the label would say it on every card (board 10).
 * `no_volume` and `unreadable` are both "Not compared": the user cannot act on the difference.
 */
export function liftLabel(lift: Pick<LiftRecord, "verdict" | "reason">, workoutId: string): string | null {
  switch (lift.verdict) {
    case "better":
      return "Better";
    case "lower":
      return "Lower";
    case "same":
      return "Same";
  }
  switch (lift.reason) {
    case "first_time":
      return workoutId === FREESTYLE_ID ? null : "New lift";
    case "unit_changed":
      return "Unit changed";
    case "no_volume":
    case "unreadable":
      return "Not compared";
    default:
      return null;
  }
}

/**
 * "Changed from kg to lb": the first field whose unit differs from the matching field last time (matched
 * by role and position, `matchLastField`, never by name). Null when the lift's previous session is not in
 * the held rollup or no unit differs (a weight × reps lift that became a time lift): then the label
 * "Unit changed" stands alone, and nothing is invented.
 */
export function unitChangeCaption(fields: readonly ExerciseField[], previousFields: readonly ExerciseField[] | null): string | null {
  if (!previousFields) return null;
  for (let i = 0; i < fields.length; i++) {
    const before = matchLastField([...fields], i, [...previousFields]);
    if (before?.unit && fields[i].unit && before.unit !== fields[i].unit) {
      return `Changed from ${before.unit} to ${fields[i].unit}`;
    }
  }
  return null;
}

/** One set of a card. `text` is null when the stored set could not be read: shown as such, never as an empty row. */
export type SetView = {
  number: number;
  text: string | null;
  split: string[];
  effort: Effort | null;
  /** Against the same-numbered set of the previous session: `up` improved, `down` went down, null anything else (`setArrows`). */
  arrow: "up" | "down" | null;
};

/**
 * A lift's sets, by position. A split set (TICKET-033) lists its later segments in `split`; the first segment
 * is the set as planned. A set with an unreadable segment keeps what did read and is flagged by `text`/`split`
 * only when nothing read; a partly readable one shows what it has.
 */
export function setViews(
  fields: readonly ExerciseField[],
  sets: LiftRecord["sets"],
  arrows: readonly ("up" | "down" | null)[] = []
): SetView[] {
  return decodeStoredSets(sets).map((set, index) => {
    const first = plannedSegment(set);
    const readable = Object.keys(first).length > 0;
    return {
      number: index + 1,
      text: readable ? setValuesText([...fields], first) : null,
      split: splitSegments(set).map((segment) => setValuesText([...fields], segment)),
      effort: set.effort,
      arrow: arrows[index] ?? null,
    };
  });
}

/**
 * Each set's arrow against the same-numbered set of the lift's previous session (boards 01, 02): `up` when its
 * volume (weight × reps) went up, `down` when it went down, null for equal, and for every case that is not
 * comparable: no previous session, a unit changed (nothing is converted), no weight × reps pair (a reps-only or
 * timed lift has no per-set arrow, as it has no verdict word beside "Unit changed"), a set that does not parse, or
 * a set the previous session did not have. A null is "no arrow", never "same": `even` and `matched` both read null.
 * The rule is `compareSets`, the one the live card uses.
 */
export function setArrows(
  current: Pick<LiftSession, "fields" | "sets">,
  previous: Pick<LiftSession, "fields" | "sets"> | null
): ("up" | "down" | null)[] {
  const numeric = resolveNumericFields([...current.fields]);
  const none = current.sets.map(() => null);
  if (!previous || !numeric || !areFieldsComparable([...current.fields], [...previous.fields])) return none;
  const before = resolveNumericFields([...previous.fields]);
  if (!before) return none;
  const past = decodeStoredSets(previous.sets);
  return decodeStoredSets(current.sets).map((set, index) => {
    const then = past[index];
    if (!then) return null;
    const today = parseSet(plannedSegment(set), numeric);
    const was = parseSet(plannedSegment(then), before);
    if (today.weight === null || today.reps === null || was.weight === null || was.reps === null) return null;
    const { verdict } = compareSets({ weight: today.weight, reps: today.reps }, { weight: was.weight, reps: was.reps }, numeric.weight.unit);
    return verdict === "improved" ? "up" : verdict === "down" ? "down" : null;
  });
}

/** A closed card's sets: the first `SESSION_CARD_SETS_SHOWN`, and how many are left under "+N". */
export function closedSets<T>(sets: readonly T[]): { shown: T[]; more: number } {
  return { shown: sets.slice(0, SESSION_CARD_SETS_SHOWN), more: Math.max(0, sets.length - SESSION_CARD_SETS_SHOWN) };
}

/**
 * What a typed note becomes: trimmed, and an empty one is `null`, which clears the note (the field is removed,
 * never stored as ""). Past `SESSION_NOTE_MAX_LENGTH` it is refused whole, not cut: the user would otherwise
 * find the end of their note missing.
 */
export function normalizeNote(text: string): { kind: "ok"; note: string | null } | { kind: "tooLong"; length: number } {
  const note = text.trim();
  if (note.length > SESSION_NOTE_MAX_LENGTH) return { kind: "tooLong", length: note.length };
  return { kind: "ok", note: note === "" ? null : note };
}

export type LiftCardView = {
  id: string;
  name: string;
  label: string | null;
  /** Swapped in for X, Added, Changed from kg to lb: in that order, each only when true. */
  captions: string[];
  sets: SetView[];
};

/** A session's lift cards, in the workout's order. A session whose lifts could not be read has none: the screen says so. */
export function liftCards(session: WorkoutSessionDoc, summaryOf: SummaryOf | null): LiftCardView[] {
  return session.lifts.map((lift) => {
    const previous = summaryOf ? previousSessionOf(summaryOf(lift.id), session.startedAt) : null;
    const captions: string[] = [];
    if (lift.swappedFrom) captions.push(`Swapped in for ${lift.swappedFrom.name}`);
    if (lift.added) captions.push("Added");
    if (lift.reason === "unit_changed" && previous) {
      const caption = unitChangeCaption(lift.fields, previous.kind === "found" ? previous.session.fields : null);
      if (caption) captions.push(caption);
    }
    return {
      id: lift.id,
      name: lift.name,
      label: liftLabel(lift, session.workoutId),
      captions,
      sets: setViews(lift.fields, lift.sets, setArrows(lift, previous?.kind === "found" ? previous.session : null)),
    };
  });
}

/** Names as a sentence part: "A", "A and B", "A, B and C". */
const joinNames = (names: readonly string[]): string =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const countWord = (n: number): string => NUMBER_WORDS[n] ?? String(n);

/**
 * The header's two lines (boards 02, 08, 10): the headline, which lifts beat last time, and under it how many
 * were the same, lower, not compared or new. Null when any lift is `pending`, the lifts could not be read, or
 * there are none: half the verdicts would read as the whole answer (the same rule as `workoutVerdict`).
 * - Nothing beat last time and every lift is a first time (a first workout, Freestyle): "Three lifts, no earlier
 *   session to compare with.", and no counts, which would only say "3 new".
 * - Nothing beat last time otherwise: "No lift beat last time." Wording chosen here, no board shows this case.
 * `detail` is null, not an empty string, when it has nothing to say. "New" counts lifts, not workouts, and
 * Freestyle does not count a first time (every lift is new there).
 */
export function sessionSummary(session: WorkoutSessionDoc): { headline: string; detail: string | null } | null {
  if (session.liftsUnreadable || session.lifts.length === 0 || session.lifts.some((lift) => lift.reason === "pending")) {
    return null;
  }
  const names = (verdict: string) => session.lifts.filter((lift) => lift.verdict === verdict).map((lift) => lift.name);
  const reasoned = (reason: string) => session.lifts.filter((lift) => lift.reason === reason).length;
  const better = names("better");
  if (better.length === 0 && session.lifts.every((lift) => lift.reason === "first_time")) {
    const n = session.lifts.length;
    return { headline: `${countWord(n)} ${n === 1 ? "lift" : "lifts"}, no earlier session to compare with.`, detail: null };
  }
  const freestyle = session.workoutId === FREESTYLE_ID;
  const parts = [
    [names("same").length, "the same"],
    [names("lower").length, "a bit lower"],
    [reasoned("no_volume") + reasoned("unreadable") + reasoned("unit_changed"), "not compared"],
    [freestyle ? 0 : reasoned("first_time"), "new"],
  ] as const;
  const counts = parts.filter(([n]) => n > 0).map(([n, word]) => `${n} ${word}`);
  return {
    headline: better.length > 0 ? `${joinNames(better)} beat last time.` : "No lift beat last time.",
    detail: counts.length > 0 ? counts.join(" · ") : null,
  };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * "Mon 9 Nov · 58 min" under the title. The minutes are left out, with their dot, when `sessionMinutes` has none
 * (an imported workout, or a clock moved back): never "0 min" (CLAUDE.md 2.4). Under a minute reads "under 1 min".
 */
export function sessionDateLine(startedAt: number, endedAt: number | null): string {
  const d = new Date(startedAt);
  const date = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const minutes = sessionMinutes(startedAt, endedAt);
  return minutes === null ? date : `${date} · ${minutes < 1 ? "under 1" : minutes} min`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Column headers for a compare, one per time given: "2 Nov". Two sessions on the same day (TICKET-037) would
 * read identically, so every one of such a day gets its time too: "2 Nov 18:30". The year is added when it is
 * not `now`'s, so an old session is not mistaken for this year's. Local time throughout, as the rail's months.
 */
export function compareHeaders(times: readonly number[], now: number): string[] {
  const dayOf = (time: number) => {
    const d = new Date(time);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };
  const perDay = new Map<string, number>();
  times.forEach((time) => perDay.set(dayOf(time), (perDay.get(dayOf(time)) ?? 0) + 1));
  return times.map((time) => {
    const d = new Date(time);
    const year = d.getFullYear() === new Date(now).getFullYear() ? "" : ` ${d.getFullYear()}`;
    const clock = (perDay.get(dayOf(time)) ?? 0) > 1 ? ` ${pad(d.getHours())}:${pad(d.getMinutes())}` : "";
    return `${d.getDate()} ${MONTHS[d.getMonth()]}${year}${clock}`;
  });
}

export type CompareColumn = {
  /** "Today" for the workout itself; otherwise the session's date (`compareHeaders`). */
  header: string;
  /** The session's own fields, so a cell is in the unit it was logged in: nothing is converted. */
  sessionId: string | null;
  /** One per row, `null` where this session had no such set. */
  cells: (SetView | null)[];
};

/**
 * - `unavailable`: the exercise summaries are not held, so the compare cannot be drawn. Not "no earlier sessions".
 * - `none`: held, and the lift has no earlier session in them.
 * - `columns`: today then earlier sessions, newest first, aligned by set number (row i is set i + 1 in every
 *   column). A session is left out of the earlier ones when it is the workout itself or starts at or after it:
 *   a workout uploaded late must not compare with its own successor.
 */
export type LiftCompare =
  | { kind: "unavailable" }
  | { kind: "none" }
  | { kind: "columns"; columns: CompareColumn[]; rows: number };

export function liftCompare(
  session: Pick<WorkoutSessionDoc, "sessionId" | "startedAt">,
  lift: Pick<LiftRecord, "id" | "fields" | "sets">,
  summaryOf: SummaryOf | null,
  now: number
): LiftCompare {
  const stats = summaryOf?.(lift.id);
  if (summaryOf === null || stats === undefined) return { kind: "unavailable" };
  const earlier: Pick<StatsSessionEntry, "sessionId" | "performedAt" | "fields" | "sets">[] = (stats?.recentSessions ?? [])
    .filter((entry) => entry.performedAt < session.startedAt && entry.sessionId !== session.sessionId)
    .sort((a, b) => b.performedAt - a.performedAt)
    .slice(0, SESSION_COMPARE_COUNT);
  if (earlier.length === 0) return { kind: "none" };

  const views = [setViews(lift.fields, lift.sets), ...earlier.map((entry) => setViews(entry.fields, entry.sets))];
  const rows = Math.max(...views.map((sets) => sets.length));
  const headers = compareHeaders(earlier.map((entry) => entry.performedAt), now);
  const columns = views.map((sets, i): CompareColumn => ({
    header: i === 0 ? "Today" : headers[i - 1],
    sessionId: i === 0 ? session.sessionId : earlier[i - 1].sessionId,
    cells: Array.from({ length: rows }, (_, row) => sets[row] ?? null),
  }));
  return { kind: "columns", columns, rows };
}
