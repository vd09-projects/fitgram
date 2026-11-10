// src/config/restNotification.ts
//
// Every string and tunable behind the lock-screen rest timer (TICKET-079, copy
// decided in TICKET-080). One file, the way TICKET-080's copy table asked, even
// though src/config/README.md keeps other copy out of this folder: the
// notification's text is drawn by Android, so it travels to Kotlin as data and
// has to be findable in one place. `{exercise}` and `{n}` are filled by
// `buildRestCopy`. Limits are in characters (the copy table's "Max").

export const REST_NOTIF_CHANNEL_NAME = "Rest timer"; // 40
export const REST_NOTIF_SUBTEXT = "Workout"; // 16
export const REST_NOTIF_TITLE = "Catch your breath"; // 20
export const REST_NOTIF_TITLE_DONE = "Go time"; // 20
export const REST_NOTIF_TEXT = "Next: {exercise} · set {n}"; // 40
export const REST_NOTIF_TEXT_DONE = "{exercise} · set {n} is up"; // 40

/**
 * How many characters of the text line stay readable before Android cuts it with
 * an ellipsis. The exercise is cut to fit so the set number is never the part
 * that goes (TICKET-080, decision 2). An estimate from one emulator card, not a
 * measurement: check it with the longest exercise names on a phone.
 */
export const REST_NOTIF_TEXT_BUDGET = 30;

export const PERM_PROMPT_TITLE = "Rest time on your lock screen"; // 34
export const PERM_PROMPT_BODY =
  "See how much rest is left without unlocking your phone. Android will ask you to allow notifications."; // 120
export const PERM_PROMPT_ALLOW = "Turn on"; // 12
export const PERM_PROMPT_SKIP = "Not now"; // 12

export const SETTINGS_ROW_TITLE = "Rest time on lock screen"; // 30
export const SETTINGS_ROW_ON = "Shows on your lock screen while you rest"; // 44
export const SETTINGS_ROW_OFF = "Off"; // 12
export const SETTINGS_ROW_BLOCKED = "Blocked in Android settings"; // 32
export const SETTINGS_ACTION_TURN_ON = "Turn on"; // 12
export const SETTINGS_ACTION_OPEN = "Open settings"; // 16

/**
 * How many times the user may answer Android's notification dialog "Don't allow"
 * before the app stops offering it. Android's own rule (13+): after two refusals
 * it no longer shows the dialog, so a third "Turn on" would do nothing.
 */
export const REST_NOTIF_MAX_REFUSALS = 2;
