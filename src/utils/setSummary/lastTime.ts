// src/utils/setSummary/lastTime.ts
//
// One line per exercise: what it did last time (TICKET-065). The plan card's
// rows read it; nothing else formats a past exercise. Tests: lastTime.test.ts.

import { ExerciseHistory } from "../../types/exerciseHistory";
import { TextPart } from "../startWorkout";
import { formatTopSet, lastTopSet } from "./topSet";

const num = (text: string): TextPart => ({ text, numeric: true });
const txt = (text: string): TextPart => ({ text });

/**
 * **last time** = the exercise's most recent session, in any plan, as one line:
 *
 *   "3 sets · top 40 kg × 8"  weight + reps: `lastTopSet`'s heaviest set
 *   "3 sets · best 12 reps"   no weight + reps pair: the best on the first
 *   "2 sets · best 45 s"      measured field (`lastTopSet` says which)
 *   "3 sets · unit changed"   logged in another unit than today's; not converted
 *   "3 sets"                  sets were logged but no figure can be read
 *   "new"                     never logged
 *   "…"                       not fetched yet, or loading: unknown, not "new"
 *   "unavailable"             the fetch failed and nothing is cached
 *
 * "new" is a true statement: history is the all-time `exercise_stats` rollup,
 * so no last session means never done (not "outside a window"). It needs
 * `ready`; before that, "never done" and "not loaded" look the same.
 *
 * The count is every set of that session. A session with no sets is never
 * saved (`buildSessionDocs` drops the exercise), so it is never "0 sets".
 * "unit changed" keeps the count: how many sets were done does not depend on
 * the unit. Rejected (user, 2026-11-02): every set, total volume, minutes, and
 * the last set alone. See TICKET-065.
 */
export function lastTimeSummary(
  history: Pick<ExerciseHistory, "status" | "lastSession" | "numericFields" | "fields">
): TextPart[] {
  if (history.status === "idle" || history.status === "loading") return [txt("…")];
  if (history.status === "error") return [txt("unavailable")];
  const session = history.lastSession;
  if (!session) return [txt("new")];

  const count = session.sets.length;
  const sets = [num(String(count)), txt(count === 1 ? " set" : " sets")];
  const top = lastTopSet(history);
  switch (top.kind) {
    case "set":
      return [...sets, txt(" · top "), ...formatTopSet(top)];
    case "best":
      return [...sets, txt(" · best "), ...formatTopSet(top)];
    case "none":
      return top.reason === "unit_changed" ? [...sets, txt(" · unit changed")] : sets;
  }
}

/** True when `lastTimeSummary` says "new": loaded, and never logged. The card colours it. */
export function neverLogged(history: Pick<ExerciseHistory, "status" | "lastSession">): boolean {
  return history.status === "ready" && history.lastSession === null;
}
