// src/services/restNotification/copy.ts
//
// What the lock-screen notification says (TICKET-079; strings in
// src/config/restNotification.ts). Pure, so the cut is tested directly.

import {
  REST_NOTIF_CHANNEL_NAME,
  REST_NOTIF_SUBTEXT,
  REST_NOTIF_TEXT,
  REST_NOTIF_TEXT_BUDGET,
  REST_NOTIF_TEXT_DONE,
  REST_NOTIF_TITLE,
  REST_NOTIF_TITLE_DONE,
} from "../../config/restNotification";
import type { RestCopy } from "../../../modules/rest-notification";

const ELLIPSIS = "…";

/**
 * Fill one template. The exercise gives way: it is cut with an ellipsis until the
 * line fits the budget, and the set number is never touched (TICKET-080,
 * decision 2). A budget too small for any of the name leaves the ellipsis alone
 * rather than a negative slice.
 */
export function fillLine(template: string, exercise: string, setNumber: number): string {
  // No name to show: drop it and its separator, leaving "Next: set 2", not "Next:  · set 2".
  if (exercise.trim() === "") template = template.replace(/\{exercise\}\s*·\s*/, "");
  const withName = (name: string) => template.replace("{exercise}", name).replace("{n}", String(setNumber));
  const full = withName(exercise);
  if (full.length <= REST_NOTIF_TEXT_BUDGET) return full;
  const room = REST_NOTIF_TEXT_BUDGET - withName("").length - ELLIPSIS.length;
  return withName(`${exercise.slice(0, Math.max(0, room)).trimEnd()}${ELLIPSIS}`);
}

/** Every string the native module needs for one rest, for the exercise and the set it leads to. */
export function buildRestCopy(exercise: string, nextSetNumber: number): RestCopy {
  return {
    channelName: REST_NOTIF_CHANNEL_NAME,
    subText: REST_NOTIF_SUBTEXT,
    title: REST_NOTIF_TITLE,
    text: fillLine(REST_NOTIF_TEXT, exercise, nextSetNumber),
    titleDone: REST_NOTIF_TITLE_DONE,
    textDone: fillLine(REST_NOTIF_TEXT_DONE, exercise, nextSetNumber),
  };
}
