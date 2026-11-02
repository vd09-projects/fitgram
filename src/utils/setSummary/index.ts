// src/utils/setSummary/
//
// How a past exercise is summarised, in one place (TICKET-065): no screen
// formats a past exercise itself. One set's own values ("60 kg × 12", in the
// logger and the history sheet) are `setValuesText` in setDeltas.ts.
export { lastTimeSummary, neverLogged } from "./lastTime";
export type { MeasuredTopSet, TopSet } from "./topSet";
export { formatTopSet, lastTopSet } from "./topSet";
