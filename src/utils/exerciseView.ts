// src/utils/exerciseView.ts
//
// TICKET-084 stage 4: the Exercise screen's view options (boards HistExercise02, 03, 04, 05, 06) as data: what can be set,
// what the defaults are, when a setting is not the default (the dot on the options icon), and what a setting implies for the
// rest of the screen. Pure, so each rule is tested without a screen. Kept in memory for the visit, never saved
// (user, 2026-11-19): leaving the screen puts every setting back to its default.

import { EXERCISE_GRAPH_SESSIONS } from "../config/display";
import type { Measure } from "./exerciseLog";

export type ExerciseShow = "both" | "graph" | "list";

export type ExerciseView = {
  measure: Measure;
  show: ExerciseShow;
  /** The newest this many sessions are drawn and listed; null: every one the phone has loaded. */
  sessions: number | null;
  /** The H and E badges on a set. */
  effort: boolean;
  /** The ▲ and ▼ on a set against the same set last time. */
  marks: boolean;
};

export const DEFAULT_EXERCISE_VIEW: ExerciseView = {
  measure: "average",
  show: "both",
  sessions: EXERCISE_GRAPH_SESSIONS,
  effort: true,
  marks: true,
};

/** Is any setting not the default? The options icon wears a dot then, so a changed view is never a surprise. */
export const isChangedView = (view: ExerciseView): boolean =>
  (Object.keys(DEFAULT_EXERCISE_VIEW) as (keyof ExerciseView)[]).some((key) => view[key] !== DEFAULT_EXERCISE_VIEW[key]);

/** "Last 10", "All". */
export const sessionsLabel = (sessions: number | null): string => (sessions === null ? "All" : `Last ${sessions}`);

/**
 * Is another page of older sessions of any use? Only when it would be shown: with "Last 10" and ten sessions already
 * loaded, an older page changes nothing the screen draws, and a row that does nothing visible would read as broken. "All"
 * always can. (Whether older sessions exist at all is `exercisePaging`'s.)
 */
export const olderPageUseful = (sessions: number | null, loaded: number): boolean => sessions === null || loaded < sessions;

/** The graph and the log: which of the two a `show` setting draws. */
export const showsGraph = (show: ExerciseShow): boolean => show !== "list";
export const showsList = (show: ExerciseShow): boolean => show !== "graph";
