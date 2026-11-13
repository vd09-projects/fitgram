// src/scripts/measureShapes.ts
//
//   npx tsx src/scripts/measureShapes.ts [--db-dir <dir>] [--json <file>]
//
// TICKET-087 stage 3: shape A (the workout record holds `lifts` only,
// `exercise_sessions` stays) against shape B (the record also holds each lift's
// `fields` and `sets`, `exercise_sessions` dropped), on fixtures of 150, 500 and
// 1500 workouts of 8 lifts with 5 sets and drop sets. OFFLINE: no Firestore, no
// credentials, nothing written outside `--db-dir` (a scratch SQLite file).
//
// What is measured and what is modelled, per section:
// - bytes, counts, reads and writes of a listed operation: counted from the
//   fixture docs by the rules in the section; doc size is `docSize.ts`.
// - Finish writes: a MODEL of 081's two phases, not the app (081 is not built).
//   The app's present Finish was counted by measureFinishOps.test.ts: 17.
// - AsyncStorage time: Android's AsyncStorage is a SQLite table with
//   `INSERT OR REPLACE` per key, so the same statement runs in `node:sqlite`,
//   after the same `JSON.stringify`. That is the storage layer on this
//   computer. It is NOT Hermes, the React Native bridge, or a phone's flash:
//   read the times as a ratio between shapes, not as phone milliseconds.
// - The Android database cap: the library's own `config.gradle` sets 6 MB for
//   the whole database unless `AsyncStorage_db_size_in_MB` is set; this repo
//   does not set it. Every key counts, not one entry.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { buildShapes, generateFixture, LIFTS_PER_WORKOUT, monthKey, SETS_PER_LIFT, type Shapes } from "./historyFixtures";
import { firestoreBytes, jsonBytes, summarise } from "./docSize";
import { kb, mb, median, ms, openDb, timed } from "./benchSupport";
import { rebuildStatsFromSessions } from "../utils/exerciseStats";
import { STATS_RECENT_SESSION_CAP } from "../config/storedData";

const SIZES = [150, 500, 1500];
const ANDROID_DB_CAP = 6 * 1024 * 1024;
/** The row size above which Android's reader is said to fail; unverified here (library behaviour), flagged in the output. */
const ROW_LIMIT = 2 * 1024 * 1024;
const UID = "u";
const EX_PAGE = 20;

async function measure(n: number, dir: string) {
  const fixture = generateFixture(n);
  const shapes: Shapes = buildShapes(fixture);
  const L = LIFTS_PER_WORKOUT;
  const rowsOf = (records: { sessionId: string }[]) => records.map((r) => ({ path: `users/${UID}/sessions/${r.sessionId}`, data: r as unknown as Record<string, unknown> }));
  const fsA = rowsOf(shapes.a).map((r) => firestoreBytes(r.path, r.data));
  const fsB = rowsOf(shapes.b).map((r) => firestoreBytes(r.path, r.data));
  const jsA = shapes.a.map((r) => jsonBytes(r));
  const jsB = shapes.b.map((r) => jsonBytes(r));
  const exFs = shapes.exerciseSessions.map((e) => firestoreBytes(`users/${UID}/exercise_sessions/${e.sessionId}__${e.exerciseId}`, e as unknown as Record<string, unknown>));
  const sumA = fsA.reduce((a, b) => a + b, 0);
  const sumB = fsB.reduce((a, b) => a + b, 0);

  // Held summaries (the same in both shapes: the rollup stays).
  const liftIds = [...new Set(shapes.exerciseSessions.map((e) => e.exerciseId))];
  const stats = liftIds.map((id) => rebuildStatsFromSessions(id, shapes.exerciseSessions)!);
  const summariesBytes = jsonBytes(stats);

  const db = openDb(dir);
  const put = db.prepare("INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES (?, ?)");
  const all = db.prepare("SELECT key, value FROM catalystLocalStorage");

  const storage = (records: unknown[], byMonth: Map<string, unknown[]>) => {
    db.exec("DELETE FROM catalystLocalStorage");
    const single = timed(() => {
      const value = JSON.stringify(records);
      put.run("single", value);
      return value.length;
    });
    const singleBytes = Buffer.byteLength(JSON.stringify(records));
    const shards = [...byMonth.entries()].map(([k, v]) => [k, JSON.stringify(v)] as const);
    const shardBytes = shards.map(([, v]) => Buffer.byteLength(v));
    // A Finish rewrites the newest month's shard (and the head).
    const newest = [...byMonth.keys()].sort().pop()!;
    const oneShard = timed(() => {
      put.run(`m_${newest}`, JSON.stringify(byMonth.get(newest)));
      put.run("head", JSON.stringify({ formatVersion: 1, uid: UID, shards: byMonth.size }));
    });
    db.exec("DELETE FROM catalystLocalStorage");
    for (const [k, v] of shards) put.run(`m_${k}`, v);
    const load = timed(() => (all.all() as { value: string }[]).map((r) => JSON.parse(r.value)).length);
    return {
      singleBytes,
      singleWriteMs: single.ms,
      shardCount: shards.length,
      shardMedian: median(shardBytes),
      shardMax: Math.max(...shardBytes),
      oneShardWriteMs: oneShard.ms,
      allShardsWriteMs: timed(() => shards.forEach(([k, v]) => put.run(`m_${k}`, v))).ms,
      loadMs: load.ms,
    };
  };
  const monthsOf = <T extends { startedAt: number }>(records: T[]) => {
    const map = new Map<string, T[]>();
    records.forEach((r) => map.set(monthKey(r.startedAt), [...(map.get(monthKey(r.startedAt)) ?? []), r]));
    return map;
  };
  const stA = storage(shapes.a, monthsOf(shapes.a));
  const stB = storage(shapes.b, monthsOf(shapes.b));

  // Per lift: its sessions oldest first, and the position of each session from the newest.
  const byLift = new Map<string, string[]>();
  [...shapes.exerciseSessions]
    .sort((x, y) => x.performedAt - y.performedAt)
    .forEach((e) => byLift.set(e.exerciseId, [...(byLift.get(e.exerciseId) ?? []), e.sessionId]));
  const rankFromNewest = (lift: string, sessionId: string) => {
    const list = byLift.get(lift)!;
    return list.length - 1 - list.indexOf(sessionId);
  };

  // Reads to open an old workout, in A: a lift whose session is not among the lift's held
  // newest sessions (the summaries' cap) needs its exercise_sessions doc.
  const openAges = [0, 9, 39, 99, n - 1].filter((a, i, arr) => a < n && arr.indexOf(a) === i);
  const opens = openAges.map((age) => {
    const rec = shapes.a[n - 1 - age];
    const reads = rec.lifts.filter((l) => rankFromNewest(l.id, rec.sessionId) >= STATS_RECENT_SESSION_CAP).length;
    return { age, readsA: reads, readsB: 0 };
  });

  // The Exercise log past the held sessions: the lift with the most sessions.
  const [bigLift, bigList] = [...byLift.entries()].sort((x, y) => y[1].length - x[1].length)[0];
  const exDocBytes = median(exFs);
  const pagesA = Math.ceil(bigList.length / EX_PAGE);
  const filterB = timed(() => {
    let sets = 0;
    for (const r of shapes.b) for (const l of r.lifts) if (l.id === bigLift) sets += l.sets.length;
    return sets;
  }, 25);

  // Delete the workout 40% back: what the rebuild must read and write.
  const victim = shapes.a[Math.floor(n * 0.6)];
  const perLiftCounts = victim.lifts.map((l) => byLift.get(l.id)!.length);
  const successors = new Set<string>();
  victim.lifts.forEach((l) => {
    const list = byLift.get(l.id)!;
    const next = list[list.indexOf(victim.sessionId) + 1];
    if (next) successors.add(next);
  });
  const deleteA = {
    reads: perLiftCounts.reduce((a, b) => a + b, 0),
    readBytes: perLiftCounts.reduce((a, b) => a + b, 0) * exDocBytes,
    writes: 1 + victim.lifts.length + victim.lifts.length + successors.size,
  };
  const deleteB = {
    readsServer: perLiftCounts.reduce((a, b) => a + b, 0),
    readBytesServer: perLiftCounts.reduce((a, b) => a + b, 0) * median(fsB),
    readsHeld: 0,
    writes: 1 + victim.lifts.length + successors.size,
  };

  // Finish: a model of 081's phases, bytes from the newest fixture workout.
  const lastA = rowsOf([shapes.a[n - 1]])[0];
  const lastB = rowsOf([shapes.b[n - 1]])[0];
  const lastEx = shapes.exerciseSessions.filter((e) => e.sessionId === shapes.a[n - 1].sessionId);
  const exBytes = lastEx.reduce((s, e) => s + firestoreBytes(`users/${UID}/exercise_sessions/${e.sessionId}__${e.exerciseId}`, e as unknown as Record<string, unknown>), 0);
  const statsBytes = stats.filter((s) => lastEx.some((e) => e.exerciseId === s.exerciseId)).reduce((s, d) => s + firestoreBytes(`users/${UID}/exercise_stats/${d.exerciseId}`, d as unknown as Record<string, unknown>), 0);
  const sessionA = firestoreBytes(lastA.path, lastA.data);
  const sessionB = firestoreBytes(lastB.path, lastB.data);
  const finish = {
    writesNow: 2 * L + 1,
    writesA: 2 * L + 2,
    writesB: L + 2,
    writesBSingle: L + 1,
    writesBDual: 2 * L + 2,
    bytesA: 2 * sessionA + exBytes + statsBytes,
    bytesB: 2 * sessionB + statsBytes,
    bytesBDual: 2 * sessionB + exBytes + statsBytes,
  };

  // Rebuild script, whole user.
  const rebuild = {
    readsA: shapes.exerciseSessions.length,
    bytesA: exFs.reduce((a, b) => a + b, 0),
    readsB: n,
    bytesB: sumB,
  };

  const total = (st: ReturnType<typeof storage>, records: number) => ({ records, withSummaries: records + summariesBytes });
  return {
    n, liftIds: liftIds.length, sessions: shapes.a.length, exerciseSessions: shapes.exerciseSessions.length,
    record: { aFs: summarise(fsA), bFs: summarise(fsB), aJs: summarise(jsA), bJs: summarise(jsB) },
    held: { a: stA.singleBytes, b: stB.singleBytes, summaries: summariesBytes, totA: total(stA, stA.singleBytes).withSummaries, totB: total(stB, stB.singleBytes).withSummaries },
    stA, stB,
    firstLoad: { reads: n, bytesA: sumA, bytesB: sumB },
    finish, opens, log: { bigLift, sessions: bigList.length, pagesA, readsA: bigList.length, bytesA: bigList.length * exDocBytes, filterBMs: filterB.ms },
    deleteA, deleteB, rebuild,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const base = arg("--db-dir") ?? os.tmpdir();
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(path.join(base, "shapes-"));
  const results = [];
  try {
    for (const n of SIZES) {
      const r = await measure(n, dir);
      results.push(r);
      const cap = (x: number) => `${mb(x)} MB (${((x / ANDROID_DB_CAP) * 100).toFixed(0)}% of the 6 MB cap)`;
      console.log(`\n===== ${n} workouts of ${LIFTS_PER_WORKOUT} lifts x ${SETS_PER_LIFT} sets (${r.liftIds} distinct lifts, ${r.exerciseSessions} lift-sessions) =====`);
      console.log(`record, Firestore bytes median/max   A ${r.record.aFs.median}/${r.record.aFs.max}   B ${r.record.bFs.median}/${r.record.bFs.max}   (1 MiB doc limit: ${1048576})`);
      console.log(`record, JSON bytes median/max        A ${r.record.aJs.median}/${r.record.aJs.max}   B ${r.record.bJs.median}/${r.record.bJs.max}`);
      console.log(`held copy of every workout           A ${cap(r.held.a)}   B ${cap(r.held.b)}`);
      console.log(`  plus the held summaries (${kb(r.held.summaries)} KB, same in both) = A ${cap(r.held.totA)}   B ${cap(r.held.totB)}`);
      for (const [name, s] of [["A", r.stA], ["B", r.stB]] as const) {
        console.log(`AsyncStorage ${name}: one entry ${kb(s.singleBytes)} KB${s.singleBytes > ROW_LIMIT ? " (OVER the 2 MB row limit)" : ""}, write ${ms(s.singleWriteMs)} ms | ${s.shardCount} month shards, median ${kb(s.shardMedian)} KB, max ${kb(s.shardMax)} KB; one shard + head write ${ms(s.oneShardWriteMs)} ms; all shards write ${ms(s.allShardsWriteMs)} ms | cold load (read + parse) ${ms(s.loadMs)} ms`);
      }
      console.log(`first load: ${r.firstLoad.reads} reads (one query) | bytes A ${mb(r.firstLoad.bytesA)} MB, B ${mb(r.firstLoad.bytesB)} MB | restart: 0 reads, then 1 per change check`);
      console.log(`Finish writes (reads ${LIFTS_PER_WORKOUT} in all): today ${r.finish.writesNow} | A ${r.finish.writesA} | B ${r.finish.writesB} (${r.finish.writesBSingle} if the session is written once) | B while dual-writing ${r.finish.writesBDual}`);
      console.log(`Finish bytes written: A ${kb(r.finish.bytesA)} KB | B ${kb(r.finish.bytesB)} KB | B dual ${kb(r.finish.bytesBDual)} KB`);
      console.log(`open an old workout, reads A / B: ${r.opens.map((o) => `${o.age} back: ${o.readsA}/0`).join("  ")}`);
      console.log(`Exercise log of the busiest lift (${r.log.bigLift}, ${r.log.sessions} sessions): A ${r.log.pagesA} queries, ${r.log.readsA} reads, ${mb(r.log.bytesA)} MB | B 0 reads, filter ${ms(r.log.filterBMs)} ms`);
      console.log(`delete one workout: A ${r.deleteA.reads} reads (${mb(r.deleteA.readBytes)} MB), ${r.deleteA.writes} writes | B ${r.deleteB.readsServer} reads (${mb(r.deleteB.readBytesServer)} MB) or ${r.deleteB.readsHeld} from the held copy, ${r.deleteB.writes} writes`);
      console.log(`rebuild script, whole user: A ${r.rebuild.readsA} reads (${mb(r.rebuild.bytesA)} MB) | B ${r.rebuild.readsB} reads (${mb(r.rebuild.bytesB)} MB)`);
    }
    const out = arg("--json");
    if (out) writeFileSync(out, JSON.stringify(results, null, 1));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
