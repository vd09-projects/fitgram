// src/utils/startWorkout.ts
//
// View models for the Start Workout screen (TICKET-022). Pure: the screen reads
// the recent workouts store (TICKET-075) and the saved exercise summaries
// (TICKET-076), and everything it shows is derived here from those plus local state.
//
// What an exercise did last time ("3 sets · top 40 kg × 8") is not here: it
// lives in `src/utils/setSummary/` (TICKET-065), the one place that summarises
// a past exercise.

import { SessionTotalVolume, WorkoutSessionDoc } from "../types/workoutSession";
import { WorkoutPlan, isArchived } from "../types/workoutType";
import { PendingUpload } from "../types/zustandWorkoutType";
import { unitLabel } from "./exerciseFields";
import { buildSessionDocs, computeSessionTotalVolume } from "./exerciseStats";
import { HUB_TILE_LIMIT } from "../config/display";

// What `sessions` holds: each plan's newest `WORKOUTS_PER_PLAN`, value and
// reason in src/config/sync.ts (TICKET-075; it was the newest 20 overall).

export type PlanRow = {
  id: string;
  name: string;
  exerciseCount: number;
  /** `startedAt` of the plan's latest session, or null when none is known. */
  lastDoneAt: number | null;
  /**
   * `endedAt` of that same session, for the plan card's "about 50 min last
   * time" (TICKET-065). null with `lastDoneAt`.
   */
  lastEndedAt: number | null;
  /** "pending" when the latest session is finished but not uploaded yet. */
  lastDoneSource: "uploaded" | "pending" | null;
  /**
   * Volume of that same latest session — never of an older one, so the date and
   * the figure always describe one workout. null when there is no latest
   * session or it predates the stored field.
   */
  volume: SessionTotalVolume | null;
  /** TICKET-061: hidden on Start until "Show archived". */
  archived: boolean;
};

type Candidate = {
  startedAt: number;
  endedAt: number;
  source: "uploaded" | "pending";
  volume: SessionTotalVolume | null;
};

/**
 * One row per plan whose name matches `query`, in plan order.
 *
 * **last done** = the newest session of the plan, across two sources:
 *
 * - `sessions`, the most recent uploaded sessions (one query, `startedAt desc`).
 *   A plan absent from that window has no date rather than a guessed one, and no
 *   per-plan fallback query is made.
 * - `pendingUploads` belonging to `uid` — finished workouts not uploaded yet
 *   (TICKET-028). Without them, a workout finished offline yesterday reads as
 *   "8 days ago". Other accounts' entries on this device are ignored.
 *
 * Joined on `workoutId`, never on name, which can change. Compared on start
 * time on both sides: sessions are ordered by `startedAt`, so comparing it with a
 * pending entry's `endedAt` would mix two clocks. On a tie (the same session,
 * mid-upload, in both places) the uploaded copy wins.
 *
 * `sessions === null` means the query has not returned or failed. Then no plan
 * gets a date, pending included: a pending entry can be older than an uploaded
 * session we could not read, and showing it would be a wrong date, not a
 * missing one.
 */
export function buildPlanRows(
  plans: WorkoutPlan[],
  sessions: WorkoutSessionDoc[] | null,
  pendingUploads: PendingUpload[],
  uid: string | null | undefined,
  query: string
): PlanRow[] {
  const latest = new Map<string, Candidate>();

  if (sessions !== null) {
    const consider = (workoutId: string, candidate: Candidate) => {
      const current = latest.get(workoutId);
      // The tie clause is order-independence insurance, redundant today: the
      // sessions loop runs before the pending loop, so on equal `startedAt` the
      // uploaded copy is already `current` and kept. It decides the outcome only
      // if the loops are reordered. No test covers it for that reason.
      if (
        !current ||
        candidate.startedAt > current.startedAt ||
        (candidate.startedAt === current.startedAt && candidate.source === "uploaded")
      ) {
        latest.set(workoutId, candidate);
      }
    };

    for (const session of sessions) {
      consider(session.workoutId, {
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        source: "uploaded",
        volume: session.volume ?? null,
      });
    }

    for (const entry of pendingUploads) {
      if (!uid || entry.uid !== uid) continue;
      // Same builder the upload will use, so this figure is what gets stored.
      const { exerciseSessions } = buildSessionDocs(entry.workout, entry.endedAt);
      consider(entry.workout.id, {
        startedAt: entry.workout.startTime,
        endedAt: entry.endedAt,
        source: "pending",
        volume: computeSessionTotalVolume(exerciseSessions),
      });
    }
  }

  const needle = query.trim().toLowerCase();
  return plans
    .filter((plan) => plan.name.trim().toLowerCase().includes(needle))
    .map((plan) => {
      const candidate = latest.get(plan.id) ?? null;
      return {
        id: plan.id,
        name: plan.name,
        exerciseCount: plan.exercises.length,
        lastDoneAt: candidate?.startedAt ?? null,
        lastEndedAt: candidate?.endedAt ?? null,
        lastDoneSource: candidate?.source ?? null,
        volume: candidate?.volume ?? null,
        archived: isArchived(plan),
      };
    })
    .sort(comparePlanRows);
}

/**
 * TICKET-061's list order: **last done first**, newest at the top. A plan with
 * no known date (never done, or its plan's workouts not loaded yet) comes
 * after every dated one; those, and ties, go A–Z so the order never depends on
 * Firestore's document order, which is what the list showed before.
 *
 * Since TICKET-075 "no date" is never done, or a plan whose workouts are not
 * loaded yet (they load as soon as the plan is held); it no longer mixes in
 * plans done long ago, which the old 20-session window dropped.
 *
 * Known limit: until the recent workouts' first load answers (a fresh install
 * or sign-in; otherwise the stored copy shows at once), no plan has a date, so
 * the list is A–Z and then reorders; a tap in that moment can select another row.
 * Accepted (PR #37 review): Start names the plan on its button before starting.
 * Rejected: holding the list until sessions load, because `null` also means the
 * query failed, and the list would then never show.
 */
function comparePlanRows(a: PlanRow, b: PlanRow): number {
  if (a.lastDoneAt !== b.lastDoneAt) {
    if (a.lastDoneAt === null) return 1;
    if (b.lastDoneAt === null) return -1;
    return b.lastDoneAt - a.lastDoneAt;
  }
  return compareNames(a, b);
}

const compareNames = (a: PlanRow, b: PlanRow) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

// HUB_TILE_LIMIT: value and reason in src/config/display.ts.

/**
 * The Workout hub's tiles (TICKET-066), from `buildPlanRows(…, "")`.
 *
 * - **Recent** = a non-archived plan with a known last-done date, i.e. a session
 *   among its plan's held workouts (TICKET-075) or one of this user's pending
 *   uploads (both via `buildPlanRows`). These come first, **longest since done
 *   first** (oldest `lastDoneAt` at the top), the reverse of All plans' order:
 *   the hub suggests what is due, All plans finds what was just done.
 * - **Fill**: fewer than `HUB_TILE_LIMIT` recent plans → the other non-archived
 *   plans, A–Z. Archived plans never get a tile, recent or not; All plans is the
 *   only way to them.
 * - **Ties** (same `lastDoneAt` to the millisecond, or two undated plans) break
 *   A–Z by name, case-insensitively, then by id, so the order never depends on
 *   Firestore's document order, even for two plans with the same name.
 * - **Still loading** (`sessions === null`): `buildPlanRows` gives no plan a
 *   date, so every tile is fill, A–Z, and reorders once sessions land. Same
 *   accepted limit as `comparePlanRows`.
 *
 * Deviation from the ticket's "fill with the other plans in plan order": plans
 * have no order. They load in Firestore document-id order, and plan ids are
 * auto-ids, so that order is random to the user and changes with every new
 * plan. A–Z is the order All plans already gives undated plans.
 * Rejected: longest since done over all plans, which with 34 plans shows the six
 * you abandoned (user, 2026-11-02).
 *
 * A Freestyle session (TICKET-067) matches no plan id in `buildPlanRows`, so it
 * never becomes a tile; its workouts are held under `FREESTYLE_ID`, apart from the plans'.
 */
export function chooseHubTiles(rows: PlanRow[]): PlanRow[] {
  const active = rows.filter((row) => !row.archived);
  const byNameThenId = (a: PlanRow, b: PlanRow) =>
    compareNames(a, b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const recent = active
    .filter((row) => row.lastDoneAt !== null)
    .sort((a, b) => a.lastDoneAt! - b.lastDoneAt! || byNameThenId(a, b));
  const fill = active.filter((row) => row.lastDoneAt === null).sort(byNameThenId);
  return [...recent, ...fill].slice(0, HUB_TILE_LIMIT);
}

export type HubTileFace = {
  /** The large figure: "9d", "Today" (capitalised: it stands alone, user call 2026-11-04), or "—" when there is no date. */
  big: TextPart[];
  /** Under it: "since last · 6 exercises", "not in recent workouts · 6 exercises". */
  caption: TextPart[];
};

/**
 * A hub tile's number and caption (TICKET-066), when its plan is not running.
 *
 * **Nd** = `daysSince`, the plan card's count, so a tile and the card it opens
 * never disagree. Always in days, even past two weeks where the card switches
 * to weeks: a tile is half a row wide, and "3 weeks" does not fit its big
 * number.
 *
 * No date is an explicit absence, never "new" or 0 (CLAUDE.md 2.4), with the
 * card's `sessionsKnown` rule:
 * - sessions read, plan not among them → "—" "not in recent workouts". Not
 *   "never done": kept from the 20-session window, though since TICKET-075 it
 *   is never done but for a plan not loaded yet (until the next check after
 *   the check skip). A copy change is a
 *   follow-up (TICKET-075 known gaps), not part of this ticket
 * - nothing held yet, or the first load failed (`useRecentWorkouts` is null) →
 *   "—" "last session unknown", the card's own words
 */
export function hubTileFace(
  row: Pick<PlanRow, "exerciseCount" | "lastDoneAt">,
  sessionsKnown: boolean,
  now: number
): HubTileFace {
  const count = [
    txt(" · "),
    num(String(row.exerciseCount)),
    txt(row.exerciseCount === 1 ? " exercise" : " exercises"),
  ];
  if (row.lastDoneAt === null) {
    const status = sessionsKnown ? "not in recent workouts" : "last session unknown";
    return { big: [txt("—")], caption: [txt(status), ...count] };
  }
  const days = daysSince(row.lastDoneAt, now);
  return days === 0
    ? { big: [txt("Today")], caption: [txt("done"), ...count] }
    : { big: [num(`${days}d`)], caption: [txt("since last"), ...count] };
}

export type PlanGroups = {
  /** Plans that are not archived, in list order. */
  plans: PlanRow[];
  /** Archived plans to show: empty while they are hidden. */
  archived: PlanRow[];
  /**
   * Archived rows that matched but are hidden. Start uses it only when `plans`
   * is empty, to say "1 archived plan matches" rather than a bare "No plans
   * match" when the user is searching for one they archived.
   */
  hiddenArchived: number;
};

/**
 * Split already-filtered rows (`buildPlanRows`) into the two groups. Search
 * follows the toggle (user, 2026-11-01): hidden archived plans stay out of
 * results, they are only counted.
 */
export function groupPlanRows(rows: PlanRow[], showArchived: boolean): PlanGroups {
  const plans = rows.filter((row) => !row.archived);
  const archived = rows.filter((row) => row.archived);
  return showArchived
    ? { plans, archived, hiddenArchived: 0 }
    : { plans, archived: [], hiddenArchived: archived.length };
}

/**
 * A run of display text. `numeric` runs render in the mono face, which is the
 * only face numbers may use; everything else in the display face.
 */
export type TextPart = { text: string; numeric?: true };

const num = (text: string): TextPart => ({ text, numeric: true });
const txt = (text: string): TextPart => ({ text });

/** Plain-text form of parts, for accessibility labels and tests. */
export const partsToString = (parts: TextPart[]) => parts.map((p) => p.text).join("");

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfLocalDay = (time: number) => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/**
 * Whole local calendar days from `time` to `now`, not 24-hour blocks: a workout
 * at 23:00 read at 08:00 is 1, which is how the user remembers it. A time in the
 * future (device clock moved back) is 0. Shared by the list's "last done" and
 * the plan card's big number, so the two never disagree.
 */
export function daysSince(time: number, now: number): number {
  return Math.max(0, Math.round((startOfLocalDay(now) - startOfLocalDay(time)) / DAY_MS));
}

/**
 * "today", "yesterday", "N days ago" under two weeks, "N weeks ago" under 60
 * days, then "N months ago" (30-day months). Days per `daysSince`.
 */
export function formatSince(time: number, now: number): TextPart[] {
  const days = daysSince(time, now);
  if (days === 0) return [txt("today")];
  if (days === 1) return [txt("yesterday")];
  if (days < 14) return [num(String(days)), txt(" days ago")];
  if (days < 60) return [num(String(Math.floor(days / 7))), txt(" weeks ago")];
  return [num(String(Math.floor(days / 30))), txt(" months ago")];
}

/**
 * Thousands-separated, at most one decimal. Hand-rolled because Hermes'
 * `toLocaleString` grouping varies by build and locale data.
 */
export function formatNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const [whole, fraction] = String(rounded).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/**
 * The row's volume figure. Every state of `SessionTotalVolume` says something,
 * so the stored shape can be judged on a device:
 *
 *   totals            "4,980 kg", "1,955 kg · 115 plates" (one per unit, never
 *                     converted; + " · 1 not weighted" when a plank was excluded)
 *   unparseable       "volume n/a · 2 of 3 lifts readable"
 *   no weighted lifts "no weighted lifts"
 *   field absent      "volume not recorded" (a session saved before TICKET-022,
 *                     or in the single-total shape before TICKET-044)
 *
 * `null` input (no known session) renders nothing — the row has no date either.
 */
export function formatVolume(
  volume: SessionTotalVolume | null,
  hasSession: boolean
): TextPart[] {
  if (!hasSession) return [];
  // A doc stored before TICKET-044 has `value`/`unit` and no `totals`.
  if (!volume || !Array.isArray(volume.totals)) return [txt("volume not recorded")];

  const excluded = volume.exercisesTotal - volume.exercisesWeighted;
  switch (volume.unavailableReason) {
    case "no_weighted_exercises":
      return [txt("no weighted lifts")];
    case "unparseable":
      return [
        txt("volume n/a · "),
        num(String(volume.exercisesCounted)),
        txt(" of "),
        num(String(volume.exercisesWeighted)),
        txt(" lifts readable"),
      ];
    case null:
      break;
  }

  const parts: TextPart[] = [];
  volume.totals.forEach((total, index) => {
    const value = formatNumber(total.value);
    if (index > 0) parts.push(txt(" · "));
    parts.push(num(value));
    if (total.unit) parts.push(txt(` ${unitLabel(value, total.unit)}`));
  });
  if (excluded > 0) parts.push(txt(" · "), num(String(excluded)), txt(" not weighted"));
  return parts;
}
