// src/stores/onDemandReads.ts
//
// TICKET-082 (extracted in its PR review): the rules for a read the user asks for, one per key, whose
// answer is kept in memory and never saved: an older month (082), a workout opened by id (083), a lift's
// log past the window (084). One copy of the rules, so each caller does not write its own race:
//
// - `loading` carries `waitOver` once `waitMs` has passed: the wait is bounded for the screen, not for
//   the read, and the answer still applies when it lands (as a check's, D9).
// - An ask while a read is inside its wait joins it. After the wait is over, an ask starts a new read
//   (a read that never settles must not leave the key stuck), and the older read's late answer is dropped.
// - `ready` is read once. `offline` (Firestore `unavailable`, nothing guessed from the empty cache) and
//   `failed` (any other rejection) can be asked again, but not within `retryGapMs` of the refusal: a
//   refusal that returns at once must not become a read per render. An ask inside the gap is ignored and
//   the refusal stays shown.
// - A sign-out while it ran (`isCurrent` false): the answer is dropped, the next user must not receive it.
//
// It owns no state of its own that a screen reads: the caller keeps `OnDemandState` where its screens
// subscribe (a store field) and passes it in and out. Not covered, on purpose: a result that grows by
// pages (084's log), which may need a small extension when that ticket is written.

export type OnDemandState<Ready extends { status: "ready" }> =
  | { status: "loading"; waitOver: boolean }
  | Ready
  | { status: "offline" | "failed"; error: string };

export type OnDemandOptions = {
  /** How long a read is waited for before `waitOver` is set. */
  waitMs: number;
  /** The least time between a refusal and the next read of the same key. */
  retryGapMs: number;
};

export type OnDemandAsk<Ready extends { status: "ready" }> = {
  /** What the caller holds for this key now. */
  current: OnDemandState<Ready> | undefined;
  /** Puts a state where the screens read it. */
  setState: (state: OnDemandState<Ready>) => void;
  /** False once the user signed out or changed since the ask began. */
  isCurrent: () => boolean;
  /** The read itself; its result is the `ready` state. Anything it bills it bills itself, even for an answer that is dropped. */
  read: () => Promise<Ready>;
};

/** Firestore says `unavailable` when it cannot reach the server; anything else is a failure. */
const isOffline = (error: unknown) => (error as { code?: string } | null)?.code === "unavailable";

export function createOnDemandReads<Ready extends { status: "ready" }>({ waitMs, retryGapMs }: OnDemandOptions) {
  /** Which read of each key is the newest, so an older read's answer is dropped. */
  const attempts = new Map<string, number>();
  const refusedAt = new Map<string, number>();

  return async function ask(key: string, { current, setState, isCurrent, read }: OnDemandAsk<Ready>): Promise<void> {
    if (current?.status === "ready" || (current?.status === "loading" && !current.waitOver)) return;
    if ((current?.status === "offline" || current?.status === "failed") && Date.now() - (refusedAt.get(key) ?? 0) < retryGapMs) return;

    const attempt = (attempts.get(key) ?? 0) + 1;
    attempts.set(key, attempt);
    setState({ status: "loading", waitOver: false });
    const waitTimer = setTimeout(() => {
      if (isCurrent()) setState({ status: "loading", waitOver: true });
    }, waitMs);

    let next: OnDemandState<Ready>;
    try {
      next = await read();
    } catch (error) {
      next = { status: isOffline(error) ? "offline" : "failed", error: error instanceof Error ? error.message : String(error) };
    }
    clearTimeout(waitTimer);
    // A sign-out while it ran, or a newer read of the same key: the answer that counts is not this one.
    if (!isCurrent() || attempts.get(key) !== attempt) return;
    if (next.status === "offline" || next.status === "failed") refusedAt.set(key, Date.now());
    setState(next);
  };
}
