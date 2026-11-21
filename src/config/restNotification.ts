// src/config/restNotification.ts
//
// Every string and tunable behind the lock-screen rest timer (TICKET-079, copy
// decided in TICKET-080). One file, the way TICKET-080's copy table asked, even
// though src/config/README.md keeps other copy out of this folder: the
// notification's text is drawn by Android, so it travels to Kotlin as data and
// has to be findable in one place. `{exercise}` and `{n}` are filled by
// `buildRestCopy`. Each string's character limit is the "Max" column of
// TICKET-080's copy table, kept there and not repeated here.

export const REST_NOTIF_CHANNEL_NAME = "Rest timer";
// The second channel, the one with the sound (TICKET-097): its name is what Android's notification settings list.
export const REST_NOTIF_DONE_CHANNEL_NAME = "Rest over";

/**
 * The sounds the user can pick for the end of a rest (TICKET-098): the phone's own default notification,
 * alarm and ringtone sounds, resolved by name in Kotlin (`RestNotifier.doneSound`). Built in, so there is
 * no file to supply or license. Each is its own notification channel, because a channel's sound cannot
 * change once it exists. A name here needs a branch there; an unknown name falls back to the default.
 */
export const REST_SOUNDS = ["notification", "alarm", "ringtone"] as const;
export type RestSound = (typeof REST_SOUNDS)[number];
/** Today's sound before any choice existed, so an unset or unknown value changes nothing. */
export const DEFAULT_REST_SOUND: RestSound = "notification";

/**
 * The settings row for the sound (TICKET-098; boards "Sound 1" and "Sound 2"). The name is what the row's line
 * shows once chosen; the detail sits under each choice. The sounds themselves are the phone's, so the detail
 * says whose they are, not what they sound like.
 */
export const SOUND_ROW_TITLE = "Rest-over sound";
export const REST_SOUND_LABELS: Record<RestSound, { name: string; detail: string }> = {
  notification: { name: "Notification sound", detail: "Your phone's notification sound" },
  alarm: { name: "Alarm sound", detail: "Your phone's alarm sound" },
  ringtone: { name: "Ringtone", detail: "Your phone's ringtone" },
};
// The sound is a notification, so it needs the lock-screen row's permission. These name the step above it.
export const SOUND_ROW_NEEDS_ON = "Turn on rest time on lock screen first";
export const SOUND_ROW_NEEDS_ANDROID = "Allow notifications in Android settings first";
export const SOUND_PLAY_LABEL = "Play {name}";

export const REST_NOTIF_SUBTEXT = "Workout";
export const REST_NOTIF_TITLE = "Catch your breath";
export const REST_NOTIF_TITLE_DONE = "Go time";
export const REST_NOTIF_TEXT = "Next: {exercise} · set {n}";
export const REST_NOTIF_TEXT_DONE = "{exercise} · set {n} is up";

/**
 * How many characters of the text line stay readable before Android cuts it with
 * an ellipsis. The exercise is cut to fit so the set number is never the part
 * that goes (TICKET-080, decision 2). An estimate from one emulator card, not a
 * measurement: check it with the longest exercise names on a phone.
 */
export const REST_NOTIF_TEXT_BUDGET = 30;

export const PERM_PROMPT_TITLE = "Rest time on your lock screen";
export const PERM_PROMPT_BODY =
  "See how much rest is left without unlocking your phone. Android will ask you to allow notifications.";
export const PERM_PROMPT_ALLOW = "Turn on";
export const PERM_PROMPT_SKIP = "Not now";

export const SETTINGS_ROW_TITLE = "Rest time on lock screen";
export const SETTINGS_ROW_ON = "Shows on your lock screen while you rest";
export const SETTINGS_ROW_OFF = "Off";
export const SETTINGS_ROW_BLOCKED = "Blocked in Android settings";
export const SETTINGS_ACTION_TURN_ON = "Turn on";
export const SETTINGS_ACTION_OPEN = "Open settings";

/**
 * How many times the user may answer Android's notification dialog "Don't allow"
 * before the app stops offering it. It is Android's own limit (13+): past it the
 * dialog no longer shows, so one more "Turn on" would do nothing.
 */
export const REST_NOTIF_MAX_REFUSALS = 2;
