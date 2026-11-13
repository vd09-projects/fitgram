// src/scripts/benchSupport.ts
//
// Shared by the TICKET-087 measurement scripts: median timing and the scratch
// SQLite table that stands in for Android's AsyncStorage (`INSERT OR REPLACE`
// per key). Times from it are the storage layer on this computer, not Hermes or
// a phone: read them as ratios.
import path from "path";
import { summarise } from "./docSize";

// Fixtures put each workout at an hour of the local day while shards are keyed by
// UTC month, so the machine's time zone would move evening workouts between months
// and change the counts. Pinned for every script that imports this file.
process.env.TZ = "UTC";

export const RUNS = 7;

export const median = (xs: number[]) => summarise(xs).median as number;
export const kb = (n: number) => (n / 1024).toFixed(1);
export const mb = (n: number) => (n / 1024 / 1024).toFixed(2);
export const ms = (n: number) => n.toFixed(1);

export function timed<T>(fn: () => T, runs = RUNS): { ms: number; value: T } {
  const times: number[] = [];
  let value!: T;
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    value = fn();
    times.push(performance.now() - t);
  }
  return { ms: median(times), value };
}

export type Db = { exec: (sql: string) => void; prepare: (sql: string) => { run: (...a: unknown[]) => void; all: (...a: unknown[]) => unknown[] } };

export function openDb(dir: string): Db {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (p: string) => Db };
  const db = new DatabaseSync(path.join(dir, "asyncstorage.db"));
  // The table AsyncStorage creates on Android.
  db.exec("CREATE TABLE IF NOT EXISTS catalystLocalStorage (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  return db;
}
