import { useCallback, useEffect, useMemo } from "react";
import { useAuthUser } from "./useAuthUser";
import { usePlansStore } from "../stores/usePlansStore";
import { plansView } from "../utils/planSync";

/**
 * The signed-in user's plans, read from the plans store (TICKET-070): every
 * caller sees the same copy, shown at once from the phone and offline.
 *
 * `check`: when the plans are asked of the server (D4).
 * - "mount" (default): once when the caller mounts, skipped if a check
 *   succeeded within the check skip. For screens that unmount when left.
 * - "none": read only. The mid-workout picker, and `useWorkoutPlansOnFocus`,
 *   which checks on focus instead.
 *
 * `failedToLoad` is true only when nothing is stored and the check failed
 * (D11, `plansView`): a stored copy is shown whatever a check does. It tells a
 * failed first load apart from "no plans yet", so Manage never offers a first
 * plan to someone who has plans but is offline (TICKET-052 D5). Start reads
 * only `loadingWorkoutPlans`, so there a failed first load still shows "No
 * plans yet": a known gap, now only on a first launch offline (D12).
 *
 * `retry` reads every plan now, past the check skip: a full reload (Try
 * again; D5).
 */
export default function useWorkoutPlans({ check = "mount" }: { check?: "mount" | "none" } = {}) {
  const { user } = useAuthUser();
  const uid = user?.uid;
  const plans = usePlansStore((s) => (s.uid === uid ? s.plans : null));
  const storedRead = usePlansStore((s) => s.uid === uid && s.storedRead);
  const checking = usePlansStore((s) => s.checking);
  const waitOver = usePlansStore((s) => s.waitOver);
  const lastResult = usePlansStore((s) => s.lastResult);

  useEffect(() => {
    if (uid) usePlansStore.getState().open(uid, { check: check === "mount" });
  }, [uid, check]);

  const retry = useCallback(() => {
    usePlansStore.getState().check({ force: true, full: true });
  }, []);

  const view = useMemo(
    () => plansView({ plans, storedRead, checking, waitOver, lastResult }),
    [plans, storedRead, checking, waitOver, lastResult]
  );
  return { ...view, retry };
}
