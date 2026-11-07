// TICKET-073: firestore.rules against the Firestore emulator. A wrong plans
// rule refuses every user's Save, so this runs before every rules deploy.
//
//   npm run test:rules
//
// Needs Java (firebase-tools 13 runs on Java 17; 14+ wants 21). Not part of
// `npm test` or CI: jest.config.js ignores this folder, and
// jest.rules.config.js runs it inside `firebase emulators:exec`, which starts
// the emulator, sets FIRESTORE_EMULATOR_HOST and stops it after. The project
// id is a `demo-` one, so nothing here can reach the real project.

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteApp, initializeApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  deleteDoc,
  disableNetwork,
  doc,
  enableNetwork,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  setLogLevel,
  collection,
  setDoc,
  terminate,
  type DocumentData,
} from "firebase/firestore";

const PROJECT_ID = "demo-fitgram";
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");

let env: RulesTestEnvironment;

beforeAll(async () => {
  // Refused writes are the point here; the SDK warns on each one.
  setLogLevel("error");
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host, port: Number(port), rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8") },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const plan = (rev?: number): DocumentData => ({
  id: "p1",
  name: "test plan",
  exercises: [],
  ...(rev === undefined ? {} : { rev }),
});

/** A stored doc, written with the rules off (as the admin scripts write). */
const seed = (path: string, data: DocumentData) =>
  env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), path), data));

const alice = () => env.authenticatedContext("alice").firestore();
const PLAN = "users/alice/workouts/p1";

describe("plans: a save carries the stored rev + 1 (D6)", () => {
  it("the stored rev + 1 passes", async () => {
    await seed(PLAN, plan(3));
    await assertSucceeds(setDoc(doc(alice(), PLAN), plan(4)));
  });

  it("an old rev is refused: another device saved since", async () => {
    await seed(PLAN, plan(4));
    await assertFails(setDoc(doc(alice(), PLAN), plan(4)));
    await assertFails(setDoc(doc(alice(), PLAN), plan(3)));
  });

  it("a rev that skips a number is refused", async () => {
    await seed(PLAN, plan(3));
    await assertFails(setDoc(doc(alice(), PLAN), plan(5)));
  });

  it("a save with no rev is refused (a build from before 073)", async () => {
    await seed(PLAN, plan(3));
    await assertFails(setDoc(doc(alice(), PLAN), plan()));
  });

  it("a stored plan with no rev counts as 0: a save at 1 passes", async () => {
    await seed(PLAN, plan());
    await assertSucceeds(setDoc(doc(alice(), PLAN), plan(1)));
  });

  it("a new plan passes at rev 1, and only at 1", async () => {
    await assertFails(setDoc(doc(alice(), PLAN), plan()));
    await assertFails(setDoc(doc(alice(), PLAN), plan(2)));
    await assertSucceeds(setDoc(doc(alice(), PLAN), plan(1)));
  });

  it("delete passes, as before (wipe scripts)", async () => {
    await seed(PLAN, plan(3));
    await assertSucceeds(deleteDoc(doc(alice(), PLAN)));
  });

  it("reads pass for the owner, including the change query's list", async () => {
    await seed(PLAN, plan(3));
    await assertSucceeds(getDoc(doc(alice(), PLAN)));
    await assertSucceeds(getDocs(collection(alice(), "users/alice/workouts")));
  });

  it("another user is refused every access to the plan", async () => {
    await seed(PLAN, plan(3));
    const bob = env.authenticatedContext("bob").firestore();
    await assertFails(getDoc(doc(bob, PLAN)));
    await assertFails(setDoc(doc(bob, PLAN), plan(4)));
    await assertFails(deleteDoc(doc(bob, PLAN)));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), PLAN), plan(4)));
  });
});

describe("everything else behaves as before", () => {
  const userPaths = [
    "users/alice",
    "users/alice/sessions/s1",
    "users/alice/exercise_sessions/s1__e1",
    "users/alice/exercise_stats/e1",
    "users/alice/workouts/p1/anything/x",
  ];

  it.each(userPaths)("%s: the owner reads, writes with no rev, deletes", async (path) => {
    await assertSucceeds(setDoc(doc(alice(), path), { any: 1 }));
    await assertSucceeds(setDoc(doc(alice(), path), { any: 2 }));
    await assertSucceeds(getDoc(doc(alice(), path)));
    await assertSucceeds(deleteDoc(doc(alice(), path)));
  });

  it.each(userPaths)("%s: another user and no user are refused", async (path) => {
    await seed(path, { any: 1 });
    const bob = env.authenticatedContext("bob").firestore();
    const nobody = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(bob, path)));
    await assertFails(setDoc(doc(bob, path), { any: 2 }));
    await assertFails(getDoc(doc(nobody, path)));
  });

  it("the catalog: any signed-in user reads, nobody writes", async () => {
    await seed("exercise_catalog/meta", { v: 1 });
    await assertSucceeds(getDoc(doc(alice(), "exercise_catalog/meta")));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "exercise_catalog/meta")));
    await assertFails(setDoc(doc(alice(), "exercise_catalog/meta"), { v: 2 }));
  });
});

// D7's "a refusal that lands late from the queue is only logged" rests on what
// the SDK does with a queued write the server refuses after reconnecting. The
// same SDK as the app (firebase 11, modular, memory cache), signed in as alice.
describe("a queued save refused after reconnecting (D7)", () => {
  it("its promise rejects with permission-denied, and the local copy rolls back", async () => {
    await seed(PLAN, plan(4));
    const app = initializeApp({ projectId: PROJECT_ID, apiKey: "fake" }, "queued-save-probe");
    const db = getFirestore(app);
    connectFirestoreEmulator(db, host, Number(port), { mockUserToken: { sub: "alice", user_id: "alice" } });
    const ref = doc(db, PLAN);
    const seen: { name: unknown; pending: boolean }[] = [];
    const unsubscribe = onSnapshot(ref, { includeMetadataChanges: true }, (snap) =>
      seen.push({ name: snap.get("name"), pending: snap.metadata.hasPendingWrites })
    );
    try {
      await waitFor(() => seen.length > 0);

      await disableNetwork(db);
      // Based on rev 3: another device has saved since.
      const write = setDoc(ref, { ...plan(4), name: "stale edit" });
      let settled = false;
      write.then(() => (settled = true), () => (settled = true));
      await waitFor(() => seen.some((s) => s.pending && s.name === "stale edit"));
      expect(settled).toBe(false); // offline: neither resolves nor rejects

      await enableNetwork(db);
      await expect(write).rejects.toMatchObject({ code: "permission-denied" });
      await waitFor(() => seen[seen.length - 1].pending === false);
      expect(seen[seen.length - 1]).toEqual({ name: "test plan", pending: false });
    } finally {
      // Always, or a failing run leaves the client connected and jest hangs.
      unsubscribe();
      await terminate(db);
      await deleteApp(app);
    }
  });
});

async function waitFor(condition: () => boolean, ms = 10_000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > ms) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 20));
  }
}
