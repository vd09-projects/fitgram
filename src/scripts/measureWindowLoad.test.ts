// TICKET-082 proof (3.1): what the workouts store reads and keeps on a first load, a restart and a Finish,
// counted by running the REAL store against a fake server that serves the TICKET-087 fixtures.
// A measurement that also guards: it prints the numbers, and fails if a claim the ticket makes stops holding.
//
// Counted: Firestore reads (the store's own `billedReads`: a query bills its docs, 1 when empty), Firestore
// bytes of the docs served (`docSize.ts`, an estimate of the documented rule), and what AsyncStorage holds.
// NOT measured: time on a phone, network time (CLAUDE.md 1.4).
//
// Two phones: "4 busy plans" (the 087 fixtures as they are) and "20 plans, 16 idle": the same 4 busy plans
// plus 16 plans done 3 times each, all before the window, which is what the floor exists for.
//
// To reproduce the numbers in TICKET-082, run `TZ=UTC npx jest src/scripts/measureWindowLoad.test.ts`: the fixtures
// are dated in UTC and the window is cut at the local month. Other zones move a few workouts across a month
// edge and change the counts slightly; the guards below hold in any zone. The "before" figures in the ticket come
// from the same harness run against the per-plan store (commit c247fcc), with the same idle plans added.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { waitFor } from "@testing-library/react-native";
import { useRecentWorkoutsStore } from "../stores/useRecentWorkoutsStore";
import { usePlansStore } from "../stores/usePlansStore";
import {
  getChangedSessions,
  getLastWorkoutOfPlan,
  getNewestSessionStamp,
  getWorkoutWindowFromServer,
} from "../services/db/workoutSessions";
import type { WorkoutSessionDoc } from "../types/workoutSession";
import { WORKOUTS_ON_PHONE_MIN } from "../config/sync";
import { compareSessions, secondQueryStart } from "../utils/workoutWindow";
import { buildShapes, generateFixture } from "./historyFixtures";
import { firestoreBytes } from "./docSize";

jest.mock("../services/firebase/firebase", () => ({ db: {} }));
jest.mock("../services/db/workoutSessions", () => ({
  getNewestSessionStamp: jest.fn(),
  getWorkoutWindowFromServer: jest.fn(),
  getLastWorkoutOfPlan: jest.fn(),
  getChangedSessions: jest.fn(),
}));
jest.mock("../services/db/userDB", () => ({
  getAllWorkoutPlans: jest.fn(),
  getChangedPlans: jest.fn(async () => []),
  getPlanFromServer: jest.fn(),
}));

const UID = "u";
const PER_DAY = 2;
const DAY = 86_400_000;
const BUSY_PLANS = ["chest", "back", "legs", "shoulders"].map((key) => `fixture_${key}`);
const IDLE_PLANS = Array.from({ length: 16 }, (_, i) => `idle_${i}`);

/** What the fake server has served: docs, and their Firestore bytes. */
let servedDocs = 0;
let servedBytes = 0;
const served = <T extends WorkoutSessionDoc | null>(docs: T[]) => {
  for (const s of docs) {
    if (!s) continue;
    servedDocs += 1;
    servedBytes += firestoreBytes(`users/${UID}/sessions/${s.sessionId}`, s as unknown as Record<string, unknown>);
  }
  return docs;
};

function fixtureSessions(total: number, withIdlePlans: boolean): WorkoutSessionDoc[] {
  const busy = buildShapes(generateFixture(total, 1, PER_DAY)).b as unknown as WorkoutSessionDoc[];
  if (!withIdlePlans) return busy;
  const oldest = busy.reduce((a, b) => (a.startedAt < b.startedAt ? a : b));
  // Three workouts each, on the days before the oldest busy workout: far outside the newest months.
  const idle = IDLE_PLANS.flatMap((workoutId, i) =>
    [0, 1, 2].map((k) => ({ ...oldest, sessionId: `${workoutId}_${k}`, workoutId, startedAt: oldest.startedAt - (i * 3 + k + 1) * DAY }))
  );
  return [...busy, ...idle];
}

async function savedSizes() {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith("recentWorkouts"));
  const rows = await AsyncStorage.multiGet(keys);
  const sizes = Object.fromEntries(rows.map(([key, value]) => [key, Buffer.byteLength(value ?? "")]));
  const head = sizes.recentWorkouts ?? 0;
  const shards = Object.entries(sizes).filter(([key]) => key !== "recentWorkouts").map(([, bytes]) => bytes);
  return { keys: rows.length, totalBytes: head + shards.reduce((a, b) => a + b, 0), headBytes: head, largestShardBytes: Math.max(0, ...shards) };
}

const mb = (n: number) => (n / 1e6).toFixed(2);
const reads = () => useRecentWorkoutsStore.getState().billedReads;
const floorOf = () => useRecentWorkoutsStore.getState().workoutWindow?.lastByPlan ?? {};

describe.each([
  { name: "4 busy plans", withIdlePlans: false },
  { name: "20 plans, 16 idle for longer than the window", withIdlePlans: true },
])("$name", ({ withIdlePlans }) => {
  describe.each([500, 1500])("%i workouts on the server", (total) => {
    const sessions = fixtureSessions(total, withIdlePlans);
    const planIds = withIdlePlans ? [...BUSY_PLANS, ...IDLE_PLANS] : BUSY_PLANS;
    const newestFirst = [...sessions].sort(compareSessions);

    beforeEach(async () => {
      servedDocs = 0;
      servedBytes = 0;
      jest.clearAllMocks();
      jest.mocked(getNewestSessionStamp).mockResolvedValue({ seconds: 10, nanoseconds: 0 });
      jest.mocked(getChangedSessions).mockResolvedValue([]);
      jest.mocked(getWorkoutWindowFromServer).mockImplementation(async (_uid, min) => {
        const newest = newestFirst.slice(0, min);
        const from = secondQueryStart(newest, min);
        const rest = from === null ? null : newestFirst.slice(min).filter((s) => s.startedAt >= from);
        served([...newest, ...(rest ?? [])]);
        return { newest, rest };
      });
      jest.mocked(getLastWorkoutOfPlan).mockImplementation(async (_uid, planId) => {
        const [doc] = served([newestFirst.find((s) => s.workoutId === planId) ?? null]);
        return doc;
      });
      usePlansStore.getState().clear();
      useRecentWorkoutsStore.getState().clear();
      useRecentWorkoutsStore.setState({ billedReads: 0 });
      await AsyncStorage.clear();
      usePlansStore.setState({ uid: UID, plans: planIds.map((id) => ({ id, name: id, exercises: [] })), storedRead: true });
    });

    it("first load, restart, Finish", async () => {
      // ---- First load
      await useRecentWorkoutsStore.getState().open(UID);
      await waitFor(() => expect(useRecentWorkoutsStore.getState().lastResult).toBe("ok"));
      const state = useRecentWorkoutsStore.getState();
      await waitFor(async () => expect((await savedSizes()).keys).toBeGreaterThan(1));
      const first = {
        reads: reads(),
        docs: servedDocs,
        mbOverTheWire: mb(servedBytes),
        workoutsInWindow: state.workoutWindow!.sessions.length,
        planLookups: jest.mocked(getLastWorkoutOfPlan).mock.calls.length,
        saved: await savedSizes(),
      };

      // ---- Restart: memory gone, the saved copy kept. Showing the list reads nothing; the check after asks for changes.
      const keep = await AsyncStorage.getAllKeys().then((keys) => AsyncStorage.multiGet(keys));
      useRecentWorkoutsStore.getState().clear();
      useRecentWorkoutsStore.setState({ billedReads: 0 });
      await AsyncStorage.clear();
      await AsyncStorage.multiSet(keep as [string, string][]);
      jest.clearAllMocks();
      await useRecentWorkoutsStore.getState().open(UID);
      const restart = {
        readsToShowTheList: 0, // the saved copy is read from disk: no Firestore call has run before `open` returns the window
        onPhoneAtOnce: useRecentWorkoutsStore.getState().workoutWindow?.sessions.length,
        readsOfTheCheckAfter: reads(),
        planLookups: jest.mocked(getLastWorkoutOfPlan).mock.calls.length,
      };

      // ---- A Finish: held at once, no read.
      const before = reads();
      const finished = { ...newestFirst[0], sessionId: "finished-now", startedAt: newestFirst[0].startedAt + DAY, updatedAt: undefined };
      useRecentWorkoutsStore.getState().applyFinished(UID, finished);
      const afterFinish = { readsAdded: reads() - before, plansFloorIsTheFinish: floorOf()[finished.workoutId]?.sessionId === "finished-now" };

      // The after-the-fact value of the floor: every plan has an entry, a date or null.
      const floor = floorOf();
      const idleWithDate = IDLE_PLANS.filter((id) => floor[id]?.sessionId?.startsWith(id)).length;
      console.log(
        `AFTER (window + floor), ${withIdlePlans ? "20 plans, 16 idle" : "4 busy plans"}, ${total} workouts: first load ${JSON.stringify(first)}; ` +
          `restart ${JSON.stringify(restart)}; Finish ${JSON.stringify(afterFinish)}; idle plans with a date: ${idleWithDate}/${withIdlePlans ? IDLE_PLANS.length : 0}`
      );

      // Guards: the claims the ticket makes.
      expect(first.workoutsInWindow).toBeGreaterThanOrEqual(WORKOUTS_ON_PHONE_MIN);
      expect(first.planLookups).toBe(withIdlePlans ? IDLE_PLANS.length : 0);
      expect(restart.readsToShowTheList + restart.planLookups).toBe(0);
      expect(restart.readsOfTheCheckAfter).toBe(1);
      expect(afterFinish).toEqual({ readsAdded: 0, plansFloorIsTheFinish: true });
      if (withIdlePlans) expect(idleWithDate).toBe(IDLE_PLANS.length);
    });
  });
});
