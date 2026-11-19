// src/utils/olderRow.ts
//
// The words on a row that loads the next page of older things on tap (TICKET-085a's "Older workouts", TICKET-084's
// "Older sessions"): one copy, so the two rows cannot drift apart. Pure; the read's own states are `onDemandReads.ts`'s.

import type { OnDemandState } from "../stores/onDemandReads";

/**
 * What the row says beside its name: "Show 20" when idle, "Loading…" while a read is inside its wait, "Needs a
 * connection, still trying" once it has outlasted it (offline, Firestore takes 10 to 30 s to refuse), "Needs a
 * connection" after a refusal for want of one, "Could not load · try again" after any other rejection.
 */
export function olderRowDetail(read: OnDemandState<{ status: "ready" }> | null | undefined, pageSize: number): string {
  switch (read?.status) {
    case "loading":
      return read.waitOver ? "Needs a connection, still trying" : "Loading…";
    case "offline":
      return "Needs a connection";
    case "failed":
      return "Could not load · try again";
    default:
      return `Show ${pageSize}`;
  }
}

/** Is a read inside its wait? Then the row is not pressable (the store joins the read; a tap would show no change). */
export const olderRowBusy = (read: OnDemandState<{ status: "ready" }> | null | undefined): boolean =>
  read?.status === "loading" && !read.waitOver;
