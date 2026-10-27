// src/scripts/benchmarkSearch.ts
//
//   npx tsx src/scripts/benchmarkSearch.ts           # measure, print beside the baseline
//   npx tsx src/scripts/benchmarkSearch.ts --check   # also exit 1 on a regression
//   npx tsx src/scripts/benchmarkSearch.ts --write   # measure and save as the new baseline
//
// The exercise picker's open and per-keystroke search times (TICKET-043), in
// two engines: Node (V8, with a JIT) and Hermes, the engine the app runs, from
// the CLI React Native ships (`react-native/sdks/hermesc`, macOS only),
// compiled to bytecode with -O as a release build is. Hermes here is a laptop
// CPU, not a phone: a phone is slower by a factor this does not measure.
//
// The baseline is benchmarks/exercise-search.json. --check fails when a
// figure is more than REGRESSION times its baseline. Three identical runs on
// one machine differed by at most 6% on the checked figures (2026-10-27); the
// last real slowdown, stage 2's joined-word check, was 3.6× on the median.
// Only meaningful on the machine the baseline was measured on; it warns when
// the CPU differs. Not in CI: timing on a shared runner is noise.
//
// What this cannot measure: React rendering the list and the time from the
// tap to the first frame. Those need a device.

import { execFileSync } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { cpus, platform, tmpdir } from "os";
import { join, resolve } from "path";
import { build } from "esbuild";
import { runSearchBenchmark, type BenchmarkResult, type Stats } from "./searchBenchmark";

const ROOT = resolve(__dirname, "../..");
const BASELINE = join(ROOT, "benchmarks/exercise-search.json");
const HERMES_DIR = join(ROOT, "node_modules/react-native/sdks/hermesc/osx-bin");
const REGRESSION = 1.5;
/** Whole runs per engine; each figure is their median. One run alone once caught a 2.5× outlier. */
const RUNS = 3;

type Engine = "node" | "hermes";
type Baseline = { measuredAt: string; commit: string; cpu: string; engines: Partial<Record<Engine, BenchmarkResult>> };

/** Field by field, the median of several runs' results. */
function medianOf<T>(runs: readonly T[]): T {
  const first = runs[0] as unknown;
  if (typeof first === "number") return [...(runs as unknown as number[])].sort((a, b) => a - b)[Math.floor(runs.length / 2)] as T;
  return Object.fromEntries(
    Object.keys(first as object).map((k) => [k, medianOf(runs.map((r) => (r as Record<string, unknown>)[k]))])
  ) as T;
}

async function runHermes(): Promise<BenchmarkResult | null> {
  if (platform() !== "darwin" || !existsSync(join(HERMES_DIR, "hermes"))) return null;
  const dir = mkdtempSync(join(tmpdir(), "search-bench-"));
  try {
    const js = join(dir, "bench.js");
    const hbc = join(dir, "bench.hbc");
    await build({
      stdin: {
        contents: `import { runSearchBenchmark } from "./searchBenchmark";\nprint(JSON.stringify(runSearchBenchmark(Date.now)));`,
        resolveDir: __dirname,
        loader: "ts",
      },
      bundle: true,
      format: "iife",
      target: "es2019",
      outfile: js,
      logLevel: "error",
    });
    execFileSync(join(HERMES_DIR, "hermesc"), ["-O", "-emit-binary", "-out", hbc, js]);
    const runs = Array.from({ length: RUNS }, () =>
      JSON.parse(execFileSync(join(HERMES_DIR, "hermes"), [hbc], { encoding: "utf8" })) as BenchmarkResult
    );
    return medianOf(runs);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The figures --check holds to the baseline, with where they live in a result. */
const CHECKED: Array<[string, (r: BenchmarkResult) => number]> = [
  ["open: index + A–Z, median", (r) => r.open.picker.median],
  ["search: normal, p95", (r) => r.search.normal.p95],
  ["search: typo, p95", (r) => r.search.typo.p95],
];

const ms = (x: number) => `${x < 1 ? x.toFixed(3) : x.toFixed(1)} ms`;
const line = (label: string, s: Stats) =>
  `  ${label.padEnd(22)} median ${ms(s.median)}, p90 ${ms(s.p90)}, p95 ${ms(s.p95)}, max ${ms(s.max)} (n=${s.n})`;

function print(engine: Engine, r: BenchmarkResult) {
  console.log(`${engine}`);
  console.log(`  open, first call       ${ms(r.open.first)}`);
  console.log(line("open: index + A–Z", r.open.picker));
  console.log(line("open: index only", r.open.index));
  console.log(line("search: normal", r.search.normal));
  console.log(line("search: typo", r.search.typo));
  console.log(line("search: all", r.search.all));
  if (r.open.recents) console.log(line("open: recents", r.open.recents));
  if (r.search.filtered) console.log(line("search: filtered", r.search.filtered));
}

async function main() {
  const write = process.argv.includes("--write");
  const check = process.argv.includes("--check");
  const cpu = cpus()[0]?.model ?? "unknown";
  const results: Partial<Record<Engine, BenchmarkResult>> = {
    node: medianOf(Array.from({ length: RUNS }, () => runSearchBenchmark(() => performance.now()))),
  };
  const hermes = await runHermes();
  if (hermes) results.hermes = hermes;
  else console.log("hermes: skipped (the Hermes CLI ships for macOS only)");
  for (const [engine, r] of Object.entries(results) as Array<[Engine, BenchmarkResult]>) print(engine, r);

  if (write) {
    const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
    const baseline: Baseline = { measuredAt: new Date().toISOString().slice(0, 10), commit, cpu, engines: results };
    // Microseconds are all a ratio check needs.
    const rounded = (_: string, v: unknown) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v);
    writeFileSync(BASELINE, JSON.stringify(baseline, rounded, 2) + "\n");
    console.log(`\nbaseline written: ${BASELINE}`);
    return;
  }
  if (!existsSync(BASELINE)) {
    console.log("\nno baseline yet: run with --write");
    return;
  }
  const baseline: Baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  console.log(`\nagainst baseline ${baseline.measuredAt} (${baseline.commit}), fail above ${REGRESSION}×:`);
  if (baseline.cpu !== cpu) console.log(`  WARNING: baseline CPU "${baseline.cpu}", this one "${cpu}": not comparable`);
  let failed = false;
  for (const [engine, r] of Object.entries(results) as Array<[Engine, BenchmarkResult]>) {
    const base = baseline.engines[engine];
    if (!base) continue;
    for (const [label, pick] of CHECKED) {
      const ratio = pick(r) / pick(base);
      const bad = ratio > REGRESSION;
      failed ||= bad;
      console.log(`  ${bad ? "FAIL" : "ok  "} ${engine.padEnd(6)} ${label.padEnd(27)} ${ms(pick(r))} vs ${ms(pick(base))} (${ratio.toFixed(2)}×)`);
    }
  }
  if (check && failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
