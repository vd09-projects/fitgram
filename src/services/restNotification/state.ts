// src/services/restNotification/state.ts
//
// What the settings row shows (TICKET-080 boards "Lock 3" and "Lock 4"): On, Off
// or Blocked. Pure, so the three-way answer is tested directly.

export type RestNotificationState = "on" | "off" | "blocked";

/**
 * - `granted`: the app holds POST_NOTIFICATIONS. Below Android 13 there is no such
 *   permission, so the caller passes true and `enabled` is the only real signal.
 * - `enabled`: Android's own "will a notification from this app show" answer
 *   (`areNotificationsEnabled`), the same call the native module checks on every post.
 * - `refusedForGood`: the dialog was refused as often as Android allows
 *   (REST_NOTIF_MAX_REFUSALS). Android has no call that reads this later, so the
 *   store counts it.
 *
 * On Android 13+ `granted` and `enabled` move together: on an Android 16 emulator,
 * revoking the permission turned the app-ops flag behind the switch off with it, and
 * forcing that flag to deny did not change the permission. So why both? `enabled`
 * is the only gate below Android 13, and `granted` plus the refusal count is what
 * tells Off (a dialog may still show) from Blocked (only Android's settings page
 * can help). `enabled=false` alone cannot tell those apart.
 *
 * Granted but not enabled reads Blocked, as a defensive case: no way to reach it was
 * found on 13+ (not observed, not ruled out on other versions). Rejected: reading it
 * as Off, which would offer a "Turn on" that cannot work.
 */
export function restNotificationState(input: {
  granted: boolean;
  enabled: boolean;
  refusedForGood: boolean;
}): RestNotificationState {
  if (input.granted) return input.enabled ? "on" : "blocked";
  return input.refusedForGood ? "blocked" : "off";
}
