// src/services/restNotification/soundRow.ts
//
// What the rest-over sound row says and whether it can be opened (TICKET-098, board "Sound 2"). Pure, so the
// three-way answer is tested directly.

import {
  REST_SOUND_LABELS,
  RestSound,
  SOUND_ROW_NEEDS_ANDROID,
  SOUND_ROW_NEEDS_ON,
} from "../../config/restNotification";
import type { RestNotificationState } from "./state";

/**
 * The row's second line, and whether the row opens.
 *
 * The sound is an Android notification, so it needs the same permission as the lock-screen timer: with it Off
 * or Blocked, `postDone` posts nothing and no choice here could ever be heard. The row then says which step
 * comes first instead of offering a choice that does nothing. Decided over hiding the row, which would leave
 * a user who turned the timer off with no hint that a sound exists.
 */
export function soundRowLine(
  state: RestNotificationState,
  sound: RestSound
): { text: string; enabled: boolean } {
  if (state === "on") return { text: REST_SOUND_LABELS[sound].name, enabled: true };
  return { text: state === "off" ? SOUND_ROW_NEEDS_ON : SOUND_ROW_NEEDS_ANDROID, enabled: false };
}
