// src/scripts/measureBaseline.ts
//
//   npx tsx src/scripts/measureBaseline.ts <userId>
//
// TICKET-087 stage 2: today's numbers, from one real account. READ-ONLY: it
// lists three collections of one user (`sessions`, `exercise_sessions`,
// `exercise_stats`) and writes nothing, anywhere. Admin credentials
// (firebaseAdmin.ts).
//
// It prints: doc counts and sizes by lift count, the verdict split from the
// app's own volume comparison (`todaySummary`) run over every lift of every
// workout, how often "Better" is only more sets, and old-format sets.
//
// Definitions pinned here, because the ticket words them loosely:
// - "previous session" of a lift is its last session before this one, by
//   `performedAt`, in any workout: what the app's history holds as `lastSession`.
// - "no verdict" is the app's `comparison.kind === "none"`, grouped by why.
// - "more sets only": the lift reads Better against the full previous session,
//   today has more sets than last time, and the same comparison over only the
//   first as-many-sets-as-last-time no longer reads Better.
import { getAdminFirestore } from "./firebaseAdmin";
import { firestoreBytes, jsonBytes, summarise } from "./docSize";
import type { ExerciseSessionDoc, StatsSessionEntry, WorkoutSessionDoc } from "../types/workoutSession";
import type { ExerciseField } from "../types/workoutType";
import { deriveExerciseHistory } from "../utils/exerciseHistory";
import { buildStatsSessionEntry } from "../utils/exerciseStats";
import { decodeStoredSet, decodeStoredSets } from "../utils/storedSets";
import { todaySummary } from "../utils/setDeltas";

type Bucket = string;
const bump = (map: Map<Bucket, number>, key: Bucket) => map.set(key, (map.get(key) ?? 0) + 1);

/** Why a measure has no weight x reps pair, by what it does have. */
function noPairKind(fields: ExerciseField[]): string {
  const roles = new Set(fields.map((f) => f.role));
  if (roles.has("time") || roles.has("distance")) return "time or distance";
  if (roles.has("reps") && roles.has("other")) return "assisted (other + reps)";
  if (roles.has("reps") && fields.length === 1) return "reps only";
  return "other";
}

type Verdict = { bucket: Bucket; moreSetsOnly: boolean; percent?: number };

function verdictFor(previous: ExerciseSessionDoc | null, today: ExerciseSessionDoc): Verdict {
  const stats = previous
    ? {
        exerciseId: today.exerciseId,
        exerciseName: today.exerciseName,
        lastPerformedAt: previous.performedAt,
        fields: today.fields,
        recentSessions: [buildStatsSessionEntry(previous) as StatsSessionEntry],
        bestByReps: {},
        volumeHistory: [],
      }
    : null;
  const history = deriveExerciseHistory({ exerciseId: today.exerciseId, status: "ready", stats, error: null }, today.fields);
  const todaySets = decodeStoredSets(today.sets);
  const summary = todaySummary(history, todaySets, today.fields);
  const c = summary.comparison;
  if (c.kind === "percent") {
    const bucket = c.direction > 0 ? "Better" : c.direction < 0 ? "Lower" : "Same";
    let moreSetsOnly = false;
    if (c.direction > 0 && previous && todaySets.length > previous.sets.length) {
      const trimmed = todaySummary(history, todaySets.slice(0, previous.sets.length), today.fields);
      moreSetsOnly = trimmed.comparison.kind === "percent" && trimmed.comparison.direction <= 0;
    }
    return { bucket, moreSetsOnly, percent: c.percent };
  }
  if (c.reason === "noComparison") return { bucket: `none: ${noPairKind(today.fields)}`, moreSetsOnly: false };
  return { bucket: `none: ${c.reason}`, moreSetsOnly: false };
}

const printMap = (title: string, map: Map<Bucket, number>) => {
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  console.log(`\n${title} (${total})`);
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${k.padEnd(34)} ${String(v).padStart(5)}  ${((v / total) * 100).toFixed(1)}%`));
};

async function run() {
  const userId = process.argv[2];
  if (!userId) throw new Error("Usage: npx tsx src/scripts/measureBaseline.ts <userId>");
  const db = await getAdminFirestore();
  const user = db.collection("users").doc(userId);
  const [sessionsSnap, exSnap, statsSnap] = await Promise.all([
    user.collection("sessions").get(),
    user.collection("exercise_sessions").get(),
    user.collection("exercise_stats").get(),
  ]);
  console.log(`Read (read-only): users/${userId}/{sessions,exercise_sessions,exercise_stats}`);
  console.log(`Docs: sessions ${sessionsSnap.size}, exercise_sessions ${exSnap.size}, exercise_stats ${statsSnap.size}`);
  console.log(`Billed reads for this measurement: ${sessionsSnap.size + exSnap.size + statsSnap.size}`);

  // Sizes
  const sessions = sessionsSnap.docs.map((d) => ({ path: d.ref.path, data: d.data() as Record<string, unknown> }));
  const exs = exSnap.docs.map((d) => ({ path: d.ref.path, data: d.data() as Record<string, unknown> }));
  const stats = statsSnap.docs.map((d) => ({ path: d.ref.path, data: d.data() as Record<string, unknown> }));
  const sizes = (docs: typeof sessions) => ({
    firestore: summarise(docs.map((d) => firestoreBytes(d.path, d.data))),
    json: summarise(docs.map((d) => jsonBytes(d.data))),
  });
  console.log("\nDoc sizes in bytes (median / max):");
  for (const [name, docs] of [["sessions", sessions], ["exercise_sessions", exs], ["exercise_stats", stats]] as const) {
    const s = sizes(docs);
    console.log(`  ${name.padEnd(18)} n=${s.firestore.n}  firestore ${s.firestore.median}/${s.firestore.max}  json ${s.json.median}/${s.json.max}`);
  }
  const byLifts = new Map<number, number[]>();
  const bySessionExercises = new Map<string, ExerciseSessionDoc[]>();
  const exDocs = exSnap.docs.map((d) => d.data() as ExerciseSessionDoc);
  exDocs.forEach((e) => bySessionExercises.set(e.sessionId, [...(bySessionExercises.get(e.sessionId) ?? []), e]));
  sessions.forEach((s) => {
    const n = (s.data as unknown as WorkoutSessionDoc).exerciseIds?.length ?? 0;
    byLifts.set(n, [...(byLifts.get(n) ?? []), firestoreBytes(s.path, s.data)]);
  });
  console.log("\nsessions doc by lift count (firestore bytes, median/max):");
  [...byLifts.entries()].sort((a, b) => a[0] - b[0]).forEach(([n, v]) => {
    const s = summarise(v);
    console.log(`  ${String(n).padStart(2)} lifts  n=${s.n}  ${s.median}/${s.max}`);
  });
  // All of one workout's exercise_sessions together = what shape B would add to the workout doc.
  const perWorkoutSets = [...bySessionExercises.entries()].map(([sessionId, list]) => ({
    lifts: list.length,
    bytes: list.reduce((sum, e) => sum + jsonBytes({ sets: e.sets, fields: e.fields }), 0),
    sessionId,
  }));
  const pw = summarise(perWorkoutSets.map((p) => p.bytes));
  console.log(`\nSets+fields of one whole workout, json bytes: n=${pw.n} median ${pw.median} max ${pw.max}`);
  const liftsPer = summarise(perWorkoutSets.map((p) => p.lifts));
  console.log(`Lifts per workout (exercise_sessions grouped by session): median ${liftsPer.median}, max ${liftsPer.max}`);
  const setsPer = summarise(exDocs.map((e) => e.sets.length));
  console.log(`Sets per lift: median ${setsPer.median}, max ${setsPer.max}`);
  const withSplit = exDocs.flatMap((e) => e.sets).filter((s) => Array.isArray((s as { segments?: unknown }).segments) && (s as { segments: unknown[] }).segments.length > 1).length;
  const totalSets = exDocs.reduce((a, e) => a + e.sets.length, 0);
  console.log(`Sets in total ${totalSets}; with a split (drop-set) segment ${withSplit}`);

  // Verdicts
  const byExercise = new Map<string, ExerciseSessionDoc[]>();
  exDocs.forEach((e) => byExercise.set(e.exerciseId, [...(byExercise.get(e.exerciseId) ?? []), e]));
  const split = new Map<Bucket, number>();
  let moreSets = 0;
  let better = 0;
  const percents: number[] = [];
  for (const list of byExercise.values()) {
    list.sort((a, b) => a.performedAt - b.performedAt || a.sessionId.localeCompare(b.sessionId));
    list.forEach((today, i) => {
      const v = verdictFor(i === 0 ? null : list[i - 1], today);
      bump(split, v.bucket);
      if (v.bucket === "Better") better += 1;
      if (v.percent !== undefined) percents.push(v.percent);
      if (v.moreSetsOnly) moreSets += 1;
    });
  }
  printMap("Verdict per lift per workout (app's own comparison)", split);
  const pc = summarise(percents.map((p) => Math.abs(p)));
  console.log(`Compared lifts: ${percents.length}; abs % change median ${pc.median?.toFixed(1)}, max ${pc.max?.toFixed(1)}; within 5%: ${percents.filter((p) => Math.abs(p) <= 5).length}; Better within 5%: ${percents.filter((p) => p > 0 && p <= 5).length}`);
  console.log(`\n"Better" only because of more sets: ${moreSets} of ${better} Better`);

  // Old History page reads (WorkoutHistoricalLogsFilter): one Freestyle query per visit
  // (up to FREESTYLE_HISTORY_WINDOW docs, 1 billed when none) and one exercise query per
  // pick (up to HISTORY_FILTER_SESSION_WINDOW docs, across every plan). Billed = docs returned.
  const freestyle = sessions.filter((x) => (x.data as unknown as WorkoutSessionDoc).workoutId === "freestyle").length;
  const perExercise = summarise([...byExercise.values()].map((l) => l.length));
  console.log(`\nFreestyle sessions: ${freestyle}. Sessions per lift: median ${perExercise.median}, max ${perExercise.max}.`);

  // Old format
  let oldFormat = 0;
  let incomplete = 0;
  const oldSessions = new Set<string>();
  for (const e of exDocs) {
    for (const raw of e.sets as unknown[]) {
      const hasSegments = typeof raw === "object" && raw !== null && Array.isArray((raw as { segments?: unknown }).segments);
      if (!hasSegments) {
        oldFormat += 1;
        oldSessions.add(e.sessionId);
      } else if (decodeStoredSet(raw).segmentsIncomplete) incomplete += 1;
    }
  }
  console.log(`\nOld-format sets (no segments, before TICKET-055): ${oldFormat} in ${oldSessions.size} session(s); unreadable segments in new format: ${incomplete}`);
  const ranges = sessions.map((s) => (s.data as unknown as WorkoutSessionDoc).startedAt).sort((a, b) => a - b);
  if (ranges.length) console.log(`Workouts span ${new Date(ranges[0]).toISOString().slice(0, 10)} to ${new Date(ranges[ranges.length - 1]).toISOString().slice(0, 10)}`);
  const imported = sessions.filter((s) => (s.data as unknown as WorkoutSessionDoc).startedAt === (s.data as unknown as WorkoutSessionDoc).endedAt).length;
  console.log(`Sessions with endedAt equal to startedAt (imported): ${imported}`);
}

run().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
