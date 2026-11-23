// src/utils/workoutSlot.ts
//
// The workout slot holds one thing at a time: a workout being done, or an edit draft of a past one (TICKET-102,
// `ActiveWorkout.editOf`). Every screen that asks "is something running" or says why a start is blocked reads it
// through here, so the two meanings and their wording live in one place. Pure: no store.

import type { ActiveWorkout } from "../types/zustandWorkoutType";

/**
 * The slot's workout when it is one being done now, or null. A draft is not "a workout in progress": no timer, no
 * Resume bar, no running tile. The slot itself still blocks a second one (`startWorkout`, `startEdit`).
 */
export const liveWorkoutOf = (slot: ActiveWorkout | null): ActiveWorkout | null => (slot && !slot.editOf ? slot : null);

/** The store's refusal when the slot is taken (board ESL8Blocked's "Finish or discard Legs first"). */
export function slotTakenReason(slot: ActiveWorkout): string {
  return slot.editOf ? `You are editing ${slot.name}. Save or cancel the edit first.` : `Finish or discard ${slot.name} first.`;
}

/** A card's blocked line, ending in what it would have started: "this one" (a plan), "a Freestyle". */
export function blockedStartReason(slot: ActiveWorkout, toStart: string): string {
  return slot.editOf
    ? `You are editing ${slot.name}. Save or cancel the edit to start ${toStart}.`
    : `${slot.name} is in progress. Finish or discard it to start ${toStart}.`;
}

/** The blocked card's way back to what holds the slot. A draft has no clock, so only a workout gets the timer beside it. */
export const backToSlotLabel = (slot: ActiveWorkout): string => (slot.editOf ? `Back to editing ${slot.name}` : `Back to ${slot.name}`);
