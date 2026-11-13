// TICKET-081 stage 3: the compare script's checks and the repair, on seeded fixtures built by the
// importer's own path, with saves simulated by the same functions the stats transaction runs.
import type { ExerciseStatsDoc, WorkoutSessionDoc } from "../types/workoutSession";
import { applySessionToStats, rebuildStatsFromSessions } from "../utils/exerciseStats";
import { exerciseSessionsOf, repairedSessions, verdictsFromHistory, withVerdicts } from "../utils/liftRecord";
import { compareHistory, rebuildRefusal, totalMismatches } from "./historyCompare";
import { generateFixture } from "./historyFixtures";
import { sessionMinutes } from "../utils/sessionDuration";
import { settleVerdicts } from "./historyImport";

// Enough workouts that every lift has far more sessions than the rollup's window holds.
const fixture = generateFixture(60);
const settled = fixture.sessions;

/** What the user's account holds once the sessions are saved in `order`, as the app saves them. */
function saveInOrder(order: readonly WorkoutSessionDoc[]) {
  const stats = new Map<string, ExerciseStatsDoc>();
  const saved: WorkoutSessionDoc[] = [];
  for (const session of order) {
    const lifts = withVerdicts(session, (id) => stats.get(id) ?? null);
    const record = { ...session, lifts };
    for (const doc of exerciseSessionsOf([record])) stats.set(doc.exerciseId, applySessionToStats(stats.get(doc.exerciseId) ?? null, doc));
    saved.push(record);
  }
  return { sessions: saved, stats: [...stats.values()] };
}
const inStartOrder = [...settled].sort((a, b) => a.startedAt - b.startedAt);
const compare = (sessions: WorkoutSessionDoc[], stats: ExerciseStatsDoc[]) =>
  compareHistory(sessions, exerciseSessionsOf(sessions.filter((s) => Array.isArray(s.lifts))), stats);

describe("compareHistory", () => {
  it("finds 0 mismatches in saves made in start order, past the rollup's window", () => {
    const { sessions, stats } = saveInOrder(inStartOrder);
    const report = compare(sessions, stats);
    expect(report.lifts).toBeGreaterThan(0);
    expect(totalMismatches(report)).toBe(0);
  });

  it("finds what a late upload left wrong, only on the lifts it shares, then the repair clears it", () => {
    const late = inStartOrder[10];
    const { sessions, stats } = saveInOrder([...inStartOrder.filter((s) => s !== late), late]);
    const report = compare(sessions, stats);
    expect(report.verdictMismatches.length).toBeGreaterThan(0);
    expect(report.statsDiffer.length).toBeGreaterThan(0);
    const lateLifts = new Set(late.lifts.map((l) => l.id));
    // Known gap (a): the successors' stored verdicts are stale, no other lift's.
    report.verdictMismatches.forEach((m) => expect(lateLifts.has(m.liftId)).toBe(true));
    // Known gap (c): it is older than the 10 sessions each lift's rollup holds, so its own lifts stay pending, not First time.
    const own = report.verdictMismatches.filter((m) => m.sessionId === late.sessionId);
    expect(own.length).toBe(late.lifts.length);
    own.forEach((m) => expect(m.stored.reason).toBe("pending"));

    // The rebuild's two writes: corrected verdicts, and rollups rebuilt from the sets (a fold out of
    // order is not a rebuild: two rollups differ here too).
    const repaired = new Map(repairedSessions(sessions).map((s) => [s.sessionId, s]));
    expect(repaired.size).toBeGreaterThan(0);
    const fixed = sessions.map((s) => repaired.get(s.sessionId) ?? s);
    const rebuilt = stats.map((s) => rebuildStatsFromSessions(s.exerciseId, exerciseSessionsOf(fixed))!);
    expect(totalMismatches(compare(fixed, rebuilt))).toBe(0);
  });

  it("a replayed second phase writes what it wrote before", () => {
    // Replayed right after the fold, with its own entry already in the rollups, as a retry finds them.
    const { sessions, stats } = saveInOrder(inStartOrder.slice(0, 21));
    const target = sessions[20];
    const replayed = withVerdicts(target, (id) => stats.find((s) => s.exerciseId === id) ?? null);
    expect(replayed).toEqual(target.lifts);
  });

  it("finds a changed verdict, a pending one, a different exercise_sessions doc, an orphan and a drifted rollup", () => {
    const { sessions, stats } = saveInOrder(inStartOrder);
    const [first, second, ...rest] = sessions;
    const flipped = { ...first, lifts: first.lifts.map((l, i) => (i === 0 ? { ...l, verdict: "better" as const, reason: null } : l)) };
    const pending = { ...second, lifts: second.lifts.map((l, i) => (i === 0 ? { ...l, verdict: null, reason: "pending" as const } : l)) };
    const stored = [flipped, pending, ...rest];
    const docs = exerciseSessionsOf(sessions);
    docs[0] = { ...docs[0], sets: [] };
    docs.push({ ...docs[1], sessionId: "gone" });
    const drifted = stats.map((s, i) => (i === 0 ? { ...s, lastPerformedAt: 1 } : s));

    const report = compareHistory(stored, docs, drifted);
    expect(report.verdictMismatches.map((m) => [m.sessionId, m.stored.reason])).toEqual([
      [first.sessionId, null],
      [second.sessionId, "pending"],
    ]);
    expect(report.exerciseSessionsDiffer).toHaveLength(1);
    const reordered = compareHistory([{ ...rest[0], exerciseIds: [...rest[0].exerciseIds].reverse() }], [], []);
    expect(reordered.exerciseIdsMismatches).toEqual([rest[0].sessionId]);
    expect(report.exerciseSessionsOrphan).toHaveLength(1);
    expect(report.statsDiffer).toEqual([drifted[0].exerciseId]);
  });

  it("skips a session in the old shape and says so, instead of counting it as agreeing or not", () => {
    const { sessions, stats } = saveInOrder(inStartOrder);
    // The newest, so no later verdict was judged against it.
    const old = { ...sessions[sessions.length - 1], lifts: undefined } as unknown as WorkoutSessionDoc;
    // Its exercise_sessions docs exist, as an old-shape session's do.
    const docs = exerciseSessionsOf(sessions);
    const report = compareHistory([...sessions.slice(0, -1), old], docs, stats);
    expect(report.unreadable).toEqual([old.sessionId]);
    expect(report.verdictMismatches).toEqual([]);
    // Not 0 mismatches: sets nobody checked. And no rollup is called different for what it cannot be rebuilt from.
    expect(totalMismatches(report)).toBe(1);
    expect(report.statsDiffer).toEqual([]);
    expect(report.exerciseSessionsOrphan).toEqual([]);
  });
});

describe("the import's verdicts", () => {
  it("are the full history's: none pending, none first-time past a lift's first session, same as a rebuild from the sets", () => {
    expect(settled.every((s) => s.lifts.every((l) => l.reason !== "pending"))).toBe(true);
    expect(verdictsFromHistory(settled)).toEqual(settled);
    const firsts = settled.flatMap((s) => s.lifts).filter((l) => l.reason === "first_time").length;
    expect(firsts).toBe(new Set(settled.flatMap((s) => s.lifts.map((l) => l.id))).size);
  });

  it("do not depend on the order the sessions are given in", () => {
    const shuffled = [...settled].reverse();
    expect(verdictsFromHistory(shuffled)).toEqual([...settled].reverse());
    expect(rebuildStatsFromSessions("x", [])).toBeNull();
  });

  it("break a tie in start time by session id, so two workouts at the same minute give one answer", () => {
    const a = { ...settled[0], sessionId: "a" };
    const b = { ...settled[0], sessionId: "b", lifts: settled[0].lifts.map((l) => ({ ...l, sets: l.sets.slice(1) })) };
    const forward = verdictsFromHistory([a, b]);
    const backward = verdictsFromHistory([b, a]);
    expect(forward[1]).toEqual(backward[0]);
    expect(forward[0]).toEqual(backward[1]);
    expect(forward[0].lifts[0].reason).toBe("first_time");
  });
});

describe("settleVerdicts and the limited repair", () => {
  const [oldest, ...later] = inStartOrder;

  it("compares an import against the sessions the user already has, and ignores one in the old shape", () => {
    const next = later.find((s) => s.lifts.some((l) => oldest.lifts.some((o) => o.id === l.id)))!;
    const solo = { plans: [], sessions: [{ session: next, exerciseSessions: [] }] };
    const alone = settleVerdicts(solo).sessions[0].session;
    const withHistory = settleVerdicts(solo, [oldest, { ...oldest, sessionId: "old", lifts: undefined } as unknown as WorkoutSessionDoc]);
    const sharedLift = next.lifts.find((l) => oldest.lifts.some((o) => o.id === l.id))!;
    expect(alone.lifts.find((l) => l.id === sharedLift.id)!.reason).toBe("first_time");
    expect(withHistory.sessions[0].session.lifts.find((l) => l.id === sharedLift.id)!.reason).not.toBe("first_time");
  });

  it("an imported session ends when it starts, which reads as no duration", () => {
    expect(sessionMinutes(settled[0].startedAt, settled[0].endedAt)).toBeNull();
    settled.forEach((s) => expect(s.endedAt).toBe(s.startedAt));
  });

  it("corrects only the exercises it was limited to", () => {
    const wrong = settled.map((s) => ({ ...s, lifts: s.lifts.map((l) => ({ ...l, verdict: null, reason: "pending" as const })) }));
    const only = new Set([wrong[0].lifts[0].id]);
    const changed = repairedSessions(wrong, only);
    expect(changed.length).toBeGreaterThan(0);
    changed.forEach((s) =>
      s.lifts.forEach((l) => expect(only.has(l.id) ? l.reason !== "pending" : l.reason === "pending").toBe(true))
    );
  });
});

describe("rebuildRefusal", () => {
  it("refuses a write while sessions are unreadable, unless told to go on; never refuses a dry run or a clean account", () => {
    expect(rebuildRefusal(2, { confirm: true, ignoreUnreadable: false })).toMatch("2 session(s)");
    expect(rebuildRefusal(2, { confirm: true, ignoreUnreadable: true })).toBeNull();
    expect(rebuildRefusal(2, { confirm: false, ignoreUnreadable: false })).toBeNull();
    expect(rebuildRefusal(0, { confirm: true, ignoreUnreadable: false })).toBeNull();
  });
});
