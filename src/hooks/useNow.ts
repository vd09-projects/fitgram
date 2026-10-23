import { useEffect, useState } from "react";

/**
 * Re-reads the clock every `intervalMs`. The interval only triggers a re-render
 * and holds no count (as `ElapsedTime` in WorkoutHeader): every value is derived
 * from a stored timestamp, so unmounting, backgrounding or a suspended JS thread
 * loses nothing. The rest panel and the edit card's rest line (TICKET-040) both
 * use it at half a second, so the shown second never lags the real one by most
 * of a second, and the two never disagree by more than a tick.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
