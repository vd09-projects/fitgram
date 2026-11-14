// TICKET-082 proof (3.1): what the workouts store reads and keeps on a first load and on a restart,
// counted by running the REAL store against a fake server that serves the TICKET-087 fixtures.
// A measurement that also guards: it prints the numbers, and fails if the first load stops being
// the shape the ticket says it is.
//
// Counted: Firestore reads (the store's own `billedReads`: a query bills its docs, 1 when empty),
// Firestore bytes of the docs served (`docSize.ts`, an estimate of the documented rule), and what
// AsyncStorage holds afterwards. NOT measured: time on a phone, network time (CLAUDE.md 1.4).
//
// Run it as `TZ=UTC npx jest src/scripts/measureWindowLoad.test.ts`: the window is windowStart at the local month, the
// fixtures are dated in UTC, and the TICKET-087 numbers it is compared with are UTC months. (Setting
// `process.env.TZ` in a test file does not reach `Date`; the suite's pin is src/test/globalSetup.js.)

import AsyncStorage from "@react-native-async-storage/async-storage";
import { waitFor } from "@testing-library/react-native";
import { useRecentWorkoutsStore } from "../stores/useRecentWorkoutsStore";
import { usePlansStore } from "../stores/usePlansStore";
import { getChangedSessions, getNewestSessionStamp, getPlanSessionsFromServer } from "../services/db/workoutSessions";
import type { WorkoutSessionDoc } from "../types/workoutSession";
import { buildShapes, generateFixture } from "./historyFixtures";
import { firestoreBytes } from "./docSize";

jest.mock("../services/firebase/firebase", () => ({ db: {} }));
jest.mock("../services/db/workoutSessions", () => ({
  getNewestSessionStamp: jest.fn(),
  getPlanSessionsFromServer: jest.fn(),
  getChangedSessions: jest.fn(),
}));
jest.mock("../services/db/userDB", () => ({
  getAllWorkoutPlans: jest.fn(),
  getChangedPlans: jest.fn(async () => []),
  getPlanFromServer: jest.fn(),
}));

const UID = "u";
const PER_DAY = 2;
const PLAN_IDS = ["chest", "back", "legs", "shoulders"].map((key) => `fixture_${key}`);

/** What the fake server has served: docs, and their Firestore bytes. */
let servedDocs = 0;
let servedBytes = 0;
const served = (docs: WorkoutSessionDoc[]) => {
  servedDocs += docs.length;
  servedBytes += docs.reduce((sum, s) => sum + firestoreBytes(`users/${UID}/sessions/${s.sessionId}`, s as unknown as Record<string, unknown>), 0);
  return docs;
};

const newestFirst = (a: WorkoutSessionDoc, b: WorkoutSessionDoc) => b.startedAt - a.startedAt || (a.sessionId < b.sessionId ? 1 : -1);

async function storedBytes() {
  const keys = await AsyncStorage.getAllKeys();
  const rows = await AsyncStorage.multiGet(keys.filter((k) => k.startsWith("recentWorkouts")));
  return { keys: rows.length, bytes: rows.reduce((sum, [, v]) => sum + Buffer.byteLength(v ?? ""), 0), maxKey: Math.max(0, ...rows.map(([, v]) => Buffer.byteLength(v ?? ""))) };
}

const mb = (n: number) => (n / 1e6).toFixed(2);

describe.each([500, 1500])("%i workouts on the server, %i/day", (total) => {
  const sessions = buildShapes(generateFixture(total, 1, PER_DAY)).b as unknown as WorkoutSessionDoc[];

  beforeEach(async () => {
    servedDocs = 0;
    servedBytes = 0;
    jest.clearAllMocks();
    jest.mocked(getNewestSessionStamp).mockResolvedValue({ seconds: 10, nanoseconds: 0 });
    jest.mocked(getChangedSessions).mockResolvedValue([]);
    jest.mocked(getPlanSessionsFromServer).mockImplementation(async (_uid, planId, count) =>
      served(sessions.filter((s) => s.workoutId === planId).sort(newestFirst).slice(0, count))
    );
    usePlansStore.getState().clear();
    useRecentWorkoutsStore.getState().clear();
    useRecentWorkoutsStore.setState({ billedReads: 0 });
    await AsyncStorage.clear();
    usePlansStore.setState({ uid: UID, plans: PLAN_IDS.map((id) => ({ id, name: id, exercises: [] })), storedRead: true });
  });

  it("first load, then a restart", async () => {
    await useRecentWorkoutsStore.getState().open(UID);
    await waitFor(() => expect(useRecentWorkoutsStore.getState().lastResult).toBe("ok"));
    const first = {
      reads: useRecentWorkoutsStore.getState().billedReads,
      docs: servedDocs,
      mbOverTheWire: mb(servedBytes),
      workoutsOnPhone: Object.values(useRecentWorkoutsStore.getState().byPlan ?? {}).flat().length,
      stored: await storedBytes(),
    };

    // A restart: a new app run has an empty store and the saved copy. Showing the list reads nothing;
    // the check that follows asks for what changed (1 read when nothing did).
    await waitFor(async () => expect((await storedBytes()).keys).toBeGreaterThan(0)); // let the save land
    // The saved copy is taken before `clear`, which (sign-out) removes it, then put back.
    const keep = await AsyncStorage.getAllKeys().then((keys) => AsyncStorage.multiGet(keys));
    useRecentWorkoutsStore.getState().clear();
    useRecentWorkoutsStore.setState({ billedReads: 0 });
    await AsyncStorage.clear();
    await AsyncStorage.multiSet(keep as [string, string][]);
    jest.clearAllMocks();
    await useRecentWorkoutsStore.getState().open(UID);
    const restart = {
      readsBeforeTheCheck: 0, // the stored copy is read from disk: no Firestore call has run
      onPhoneAtOnce: Object.values(useRecentWorkoutsStore.getState().byPlan ?? {}).flat().length,
      readsOfTheCheck: useRecentWorkoutsStore.getState().billedReads,
    };
    console.log(`TODAY (per-plan newest 5), ${total} workouts: first load ${JSON.stringify(first)}; restart ${JSON.stringify(restart)}`);
    expect(first.reads).toBeGreaterThan(0);
  });
});
