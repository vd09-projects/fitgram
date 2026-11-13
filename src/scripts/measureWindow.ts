// src/scripts/measureWindow.ts
//
//   npx tsx src/scripts/measureWindow.ts [--db-dir <dir>] [--json <file>]
//
// TICKET-087 stage 3, second pass: hold only the newest workouts on the phone
// and fetch older ones when asked. Three optimizations, each measured here:
//   1. the held window: the newest workouts, in whole month shards, not all of them
//   2. the old-data fetch: what browsing a month, opening a workout and paging an
//      Exercise log cost past the window, in reads and bytes
//   4. lazy load at start: only the newest shard first, against every held shard
// (3, dropping `recentSessions` from the rollup, is deferred: see TICKET-087.)
//
// Three shapes (the third is new):
//   A  record holds `lifts` only; `exercise_sessions` stays on the server.
//   B  record also holds the sets; `exercise_sessions` dropped.
//   C  as A on the server, and the phone also holds the `exercise_sessions` of
//      the held workouts.
//
// OFFLINE: fixtures only, nothing written outside `--db-dir`. Counts and bytes
// are counted from the fixture docs (doc size: `docSize.ts`). Times are
// `node:sqlite` plus JSON on this computer: a ratio between shapes, not phone
// milliseconds. NOT measured: network time of the old-data fetch (needs a
// device); it is reported as reads and bytes only.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { buildShapes, generateFixture, monthKey, type Shapes } from "./historyFixtures";
import { firestoreBytes } from "./docSize";
import { kb, mb, median, ms, openDb, timed } from "./benchSupport";
import { selectHeldMonths } from "./heldWindow";
import { STATS_RECENT_SESSION_CAP } from "../config/storedData";

/** Workouts on the server: a few months and a few years of the busy user. */
const TOTALS = [500, 1500];
/** Newest workouts to hold, before rounding up to whole months. */
const WINDOWS = [180, 360];
/** Two workouts a day, the user's busy-case example. */
const PER_DAY = 2;
const EX_PAGE = 20;
const UID = "u";

type Held = { key: string; value: string };

async function measure(total: number, windowSize: number, dir: string) {
  const shapes: Shapes = buildShapes(generateFixture(total, 1, PER_DAY));
  const exBySession = new Map<string, Shapes["exerciseSessions"]>();
  shapes.exerciseSessions.forEach((e) => exBySession.set(e.sessionId, [...(exBySession.get(e.sessionId) ?? []), e]));

  const months = new Map<string, number[]>();
  shapes.a.forEach((r, i) => months.set(monthKey(r.startedAt), [...(months.get(monthKey(r.startedAt)) ?? []), i]));
  const { held: heldMonths, older: oldMonths } = selectHeldMonths(new Map([...months].map(([k, idx]) => [k, idx.length])), windowSize);
  const monthKeys = [...months.keys()].sort().reverse();

  const shardOf = (shape: "a" | "b" | "c", k: string): string => {
    const idx = months.get(k)!;
    if (shape === "a") return JSON.stringify(idx.map((i) => shapes.a[i]));
    if (shape === "b") return JSON.stringify(idx.map((i) => shapes.b[i]));
    return JSON.stringify({ records: idx.map((i) => shapes.a[i]), exerciseSessions: idx.flatMap((i) => exBySession.get(shapes.a[i].sessionId) ?? []) });
  };

  const db = openDb(dir);
  const put = db.prepare("INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES (?, ?)");
  const all = db.prepare("SELECT key, value FROM catalystLocalStorage");
  const one = db.prepare("SELECT key, value FROM catalystLocalStorage WHERE key = ?");

  const heldOf = (shape: "a" | "b" | "c", ks: string[]): Held[] => ks.map((k) => ({ key: `m_${k}`, value: shardOf(shape, k) }));
  const storage = (shape: "a" | "b" | "c") => {
    const shards = heldOf(shape, heldMonths);
    const everyShard = heldOf(shape, monthKeys);
    const bytes = (xs: Held[]) => xs.reduce((s, h) => s + Buffer.byteLength(h.value), 0);
    const newest = heldMonths[0];
    // Load = read the rows and parse them, as a cold start does.
    db.exec("DELETE FROM catalystLocalStorage");
    shards.forEach((h) => put.run(h.key, h.value));
    const loadWindow = timed(() => (all.all() as { value: string }[]).map((r) => JSON.parse(r.value)).length);
    const loadNewest = timed(() => (one.all(`m_${newest}`) as { value: string }[]).map((r) => JSON.parse(r.value)).length);
    const finish = timed(() => {
      put.run(`m_${newest}`, shardOf(shape, newest));
      put.run("head", JSON.stringify({ formatVersion: 1, uid: UID, shards: shards.length }));
    });
    return {
      heldBytes: bytes(shards),
      heldAllBytes: bytes(everyShard),
      shardCount: shards.length,
      newestBytes: Buffer.byteLength(shards[0].value),
      maxShardBytes: Math.max(...shards.map((h) => Buffer.byteLength(h.value))),
      loadWindowMs: loadWindow.ms,
      loadNewestMs: loadNewest.ms,
      finishShardMs: finish.ms,
    };
  };
  const st = { a: storage("a"), b: storage("b"), c: storage("c") };

  // First load on a new phone: Firestore reads and bytes for the held window, against all of it.
  const heldIdx = heldMonths.flatMap((k) => months.get(k)!);
  const fs = (xs: unknown[], pathOf: (x: never) => string) => xs.reduce<number>((s, x) => s + firestoreBytes(pathOf(x as never), x as Record<string, unknown>), 0);
  const recA = (r: Shapes["a"][number]) => `users/${UID}/sessions/${r.sessionId}`;
  const recB = (r: Shapes["b"][number]) => `users/${UID}/sessions/${r.sessionId}`;
  const exPath = (e: Shapes["exerciseSessions"][number]) => `users/${UID}/exercise_sessions/${e.sessionId}__${e.exerciseId}`;
  const heldExercise = heldIdx.flatMap((i) => exBySession.get(shapes.a[i].sessionId) ?? []);
  const firstLoad = {
    heldWorkouts: heldIdx.length,
    aReads: heldIdx.length,
    aBytes: fs(heldIdx.map((i) => shapes.a[i]), recA as never),
    bReads: heldIdx.length,
    bBytes: fs(heldIdx.map((i) => shapes.b[i]), recB as never),
    cReads: heldIdx.length + heldExercise.length,
    cBytes: fs(heldIdx.map((i) => shapes.a[i]), recA as never) + fs(heldExercise, exPath as never),
    allAReads: total,
    allBReads: total,
    allCReads: total + shapes.exerciseSessions.length,
  };

  // Old data, past the window. A month to browse: the oldest not held, and the biggest.
  const oldMonth = oldMonths[oldMonths.length - 1] ?? null;
  const exDocBytes = median(shapes.exerciseSessions.map((e) => firestoreBytes(exPath(e), e as unknown as Record<string, unknown>)));
  const recBBytes = median(shapes.b.map((r) => firestoreBytes(recB(r), r as unknown as Record<string, unknown>)));
  const oldIdx = oldMonth ? months.get(oldMonth)! : [];
  const lifts = shapes.a[0].lifts.length;
  const old = {
    month: oldMonth,
    monthWorkouts: oldIdx.length,
    monthReadsAB: oldIdx.length,
    monthBytesA: fs(oldIdx.map((i) => shapes.a[i]), recA as never),
    monthBytesB: fs(oldIdx.map((i) => shapes.b[i]), recB as never),
    // Open one workout from that list: A and C fetch its lifts' exercise_sessions, B already has the sets.
    openFromListA: lifts,
    openFromListB: 0,
    openBytesA: lifts * exDocBytes,
    // Open one with no list in hand (a link): the record too.
    openDirectA: 1 + lifts,
    openDirectB: 1,
    // A page of one lift's Exercise log. A and C query exercise_sessions by lift; B queries sessions by
    // `exerciseIds` and gets every lift's sets in each record back.
    pageReads: EX_PAGE,
    pageBytesAC: EX_PAGE * exDocBytes,
    pageBytesB: EX_PAGE * recBBytes,
  };

  // Exercise log inside the window: the busiest lift, sessions beyond the rollup's held ones.
  const counts = new Map<string, number>();
  heldIdx.forEach((i) => shapes.a[i].lifts.forEach((l) => counts.set(l.id, (counts.get(l.id) ?? 0) + 1)));
  const [bigLift, bigCount] = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];
  const logInWindow = { bigLift, sessions: bigCount, readsA: Math.max(0, bigCount - STATS_RECENT_SESSION_CAP), readsBC: 0 };

  return { total, windowSize, heldMonths: heldMonths.length, monthsOnServer: monthKeys.length, st, firstLoad, old, logInWindow, exDocBytes, recBBytes };
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const base = arg("--db-dir") ?? os.tmpdir();
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(path.join(base, "window-"));
  const results = [];
  try {
    for (const total of TOTALS) {
      for (const w of WINDOWS) {
        const r = await measure(total, w, dir);
        results.push(r);
        const { st, firstLoad: f, old, logInWindow: l } = r;
        console.log(`\n===== ${total} workouts on the server, ${PER_DAY}/day; hold the newest ${w} -> ${f.heldWorkouts} workouts in ${r.heldMonths} month shards (of ${r.monthsOnServer}) =====`);
        console.log(`held on the phone (records, no summaries)   A ${mb(st.a.heldBytes)} MB | B ${mb(st.b.heldBytes)} MB | C ${mb(st.c.heldBytes)} MB      hold all: A ${mb(st.a.heldAllBytes)} | B ${mb(st.b.heldAllBytes)} | C ${mb(st.c.heldAllBytes)} MB`);
        console.log(`shards: newest / largest KB                 A ${kb(st.a.newestBytes)}/${kb(st.a.maxShardBytes)} | B ${kb(st.b.newestBytes)}/${kb(st.b.maxShardBytes)} | C ${kb(st.c.newestBytes)}/${kb(st.c.maxShardBytes)}`);
        console.log(`Finish rewrites newest shard + head, ms     A ${ms(st.a.finishShardMs)} | B ${ms(st.b.finishShardMs)} | C ${ms(st.c.finishShardMs)}`);
        console.log(`cold load, every held shard, ms (4)         A ${ms(st.a.loadWindowMs)} | B ${ms(st.b.loadWindowMs)} | C ${ms(st.c.loadWindowMs)}`);
        console.log(`cold load, newest shard only, ms (4)        A ${ms(st.a.loadNewestMs)} | B ${ms(st.b.loadNewestMs)} | C ${ms(st.c.loadNewestMs)}`);
        console.log(`new-phone first load, window: reads / MB    A ${f.aReads}/${mb(f.aBytes)} | B ${f.bReads}/${mb(f.bBytes)} | C ${f.cReads}/${mb(f.cBytes)}      hold all: A ${f.allAReads} | B ${f.allBReads} | C ${f.allCReads} reads`);
        console.log(`Exercise log inside window (${l.bigLift}, ${l.sessions} sessions): reads A ${l.readsA} | B ${l.readsBC} | C ${l.readsBC}`);
        if (old.month === null) console.log("past the window (2): no month is older than the window, so there is no old-data fetch to measure");
        else {
          console.log(`past the window (2): browse ${old.month} (${old.monthWorkouts} workouts): ${old.monthReadsAB} reads, A/C ${kb(old.monthBytesA)} KB, B ${kb(old.monthBytesB)} KB`);
          console.log(`  open one old workout from that list: A/C ${old.openFromListA} reads (${kb(old.openBytesA)} KB), B ${old.openFromListB} | opened direct: A/C ${old.openDirectA}, B ${old.openDirectB} reads`);
          console.log(`  one page (${old.pageReads}) of a lift's Exercise log: ${old.pageReads} reads, A/C ${kb(old.pageBytesAC)} KB, B ${kb(old.pageBytesB)} KB`);
        }
      }
    }
    const out = arg("--json");
    if (out) writeFileSync(out, JSON.stringify(results, null, 1));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
