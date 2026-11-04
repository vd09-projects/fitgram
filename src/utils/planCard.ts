// src/utils/planCard.ts
//
// The plan card's header numbers (TICKET-065): how long since the plan was last
// done, and how long it took. Pure, so the degenerate cases are tested here and
// not judged off a screen. Tests: planCard.test.ts. The exercise rows' "last
// time" is src/utils/setSummary/.

import { PlanRow, TextPart, daysSince } from "./startWorkout";
import { sessionMinutes } from "./sessionDuration";

const num = (text: string): TextPart => ({ text, numeric: true });
const txt = (text: string): TextPart => ({ text });

export type PlanCardHeader = {
  /** The large figure: "9", "3", "today", or "—" when there is no date. */
  big: TextPart[];
  /** Beside it: "days since last", "weeks since last", "no recent session". */
  caption: string;
  /** Under the name: "6 exercises · about 50 min last time". */
  meta: TextPart[];
  /** The one-line header while the list is scrolled: "9 days since last · 20 exercises". */
  compact: TextPart[];
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * **since last** = local calendar days since the plan's latest session started
 * (`daysSince`, as the list's "last done"), shown as days under two weeks,
 * weeks under 60 days, then 30-day months: the same steps as `formatSince`, so
 * the card and the row it was opened from read the same "3 weeks".
 *
 * No date is an explicit absence, never "new" or 0 (CLAUDE.md 2.4). The
 * window (`RECENT_SESSIONS_WINDOW`) cannot tell never-done from done-long-ago,
 * so "new" would be a guess:
 * - sessions read, plan not among them → "—" "no recent session"
 * - sessions not read yet, or the read failed (`sessionsKnown` false) →
 *   "—" "last session unknown"; "no recent session" would be a claim
 *
 * **about N min last time** = that same session's minutes (`sessionMinutes`,
 * shared with the "Saved" message after Finish). Dropped, not shown as 0, when
 * there is no session or the span is not a positive finite number (a clock
 * moved back). Under a minute reads "under 1 min": "about 0 min" is the
 * plausible wrong number.
 */
export function planCardHeader(
  row: Pick<PlanRow, "exerciseCount" | "lastDoneAt" | "lastEndedAt">,
  sessionsKnown: boolean,
  now: number
): PlanCardHeader {
  const count = [
    num(String(row.exerciseCount)),
    txt(plural(row.exerciseCount, " exercise", " exercises")),
  ];

  if (row.lastDoneAt === null) {
    const caption = sessionsKnown ? "no recent session" : "last session unknown";
    return { big: [txt("—")], caption, meta: count, compact: [txt(caption), txt(" · "), ...count] };
  }

  const days = daysSince(row.lastDoneAt, now);
  let big: TextPart[];
  let caption: string;
  if (days === 0) {
    big = [txt("today")];
    caption = "last done";
  } else if (days < 14) {
    big = [num(String(days))];
    caption = plural(days, "day since last", "days since last");
  } else if (days < 60) {
    const weeks = Math.floor(days / 7);
    big = [num(String(weeks))];
    caption = "weeks since last";
  } else {
    const months = Math.floor(days / 30);
    big = [num(String(months))];
    caption = plural(months, "month since last", "months since last");
  }

  const minutes = sessionMinutes(row.lastDoneAt, row.lastEndedAt);
  const meta =
    minutes === null
      ? count
      : minutes < 1
        ? [...count, txt(" · under "), num("1"), txt(" min last time")]
        : [...count, txt(" · about "), num(String(minutes)), txt(" min last time")];

  const compactSince = days === 0 ? [txt("last done today")] : [...big, txt(` ${caption}`)];
  return { big, caption, meta, compact: [...compactSince, txt(" · "), ...count] };
}
