// src/config/display.ts
//
// How much each screen shows, and how many docs it reads to show it. Rule for
// this folder: src/config/README.md.

/** Most tiles the Workout hub shows (TICKET-066). The rest are under All plans. */
export const HUB_TILE_LIMIT = 6;

/** Recent rows shown in the exercise picker (user, 2026-10-27, D5). */
export const RECENT_LIMIT = 10;

/** Search results shown at once. Totals beyond it are not listed; a longer query narrows them. */
export const PICKER_RESULT_LIMIT = 100;

/** The history sheet's `sessions` window. */
export const HISTORY_RECENT_SESSION_COUNT = 3;

/**
 * The history sheet's `volumeTrend` window.
 *
 * Must not exceed `STATS_RECENT_SESSION_CAP` (10) while `VolumePoint` carries
 * no unit. The history sheet hides the trend when `unitMismatch` is set, and
 * `unitMismatch` only scans `recentSessions`. Past that cap a shown point can
 * come from a session it never scanned, and kg and lb volumes would share one
 * chart with no notice. Asserted in config.test.ts; TICKET-036 removes
 * the limit by putting a unit on `VolumePoint`.
 */
export const HISTORY_TREND_SESSION_COUNT = 6;

/**
 * The History home's Workouts rail shows the current month in full; when that month has fewer
 * workouts than this, it runs back into earlier months until it has this many (TICKET-085a). A
 * month that gets cut is split: its newest workouts are in the rail, the rest sit in its Earlier
 * row. What is shown is a count of workouts, not days, so a quiet month does not leave the top of
 * History nearly empty.
 */
export const HISTORY_RAIL_MIN_FULL = 10;

/**
 * How many older workouts one tap on "Older workouts" loads (TICKET-085a, decided in TICKET-088).
 * Each is one document read, so a tap costs about this many reads. The row's label reads this value.
 */
export const OLDER_WORKOUTS_PAGE_SIZE = 20;


/**
 * How many of a lift's earlier sessions the Session screen's compare sets beside today's (TICKET-083).
 * They come from the exercise summaries already held, so a bigger number costs no read, only width.
 */
export const SESSION_COMPARE_COUNT = 3;

/**
 * How many sets a closed lift card on the Session screen lists before "+N more" (TICKET-083). Opening the card
 * lists every set in the compare. Boards 07 and 12 do not agree on a number (their rows differ in width), so
 * this is the ticket's "up to 4 sets" read as a count, to be judged against the boards on the device.
 */
export const SESSION_CARD_SETS_SHOWN = 4;

/**
 * How many of a lift's newest sessions the Exercise screen's graph draws (TICKET-084). They come from the held log,
 * so a bigger number costs no read. Stage 4's "Last 5, 10, 20, All" view option replaces the fixed use of this value.
 */
export const EXERCISE_GRAPH_SESSIONS = 10;

/**
 * Below this many sessions the Exercise screen draws no graph and says how many there are (board HistExercise10): a
 * line through two or three points reads as a trend that is not there.
 */
export const EXERCISE_GRAPH_MIN_SESSIONS = 5;

/**
 * The graph's vertical scale never spans less than this fraction of its highest value (TICKET-084). Without a floor a
 * 2.5 kg wobble in a 60 kg lift fills the whole chart and reads as a swing; with it the same wobble is a ripple.
 * The boards fit this exactly (HistExercise01 and 09).
 */
export const EXERCISE_GRAPH_MIN_SPAN = 0.12;

/**
 * How many of a lift's sessions one tap on "Older sessions" loads on the Exercise screen (TICKET-084 stage 3). Each is one
 * document read, and each document carries every lift of its workout (about 3 KB), so a tap costs about this many reads and
 * about 64 KB. The row's label reads this value.
 */
export const EXERCISE_LOG_PAGE_SIZE = 20;

/**
 * The "Sessions shown" choices of the Exercise screen's view options (TICKET-084 stage 4, board HistExercise03), besides
 * "All": how many of a lift's newest sessions the graph draws and the log lists. The default is `EXERCISE_GRAPH_SESSIONS`.
 */
export const EXERCISE_VIEW_SESSION_CHOICES = [5, 10, 20] as const;
