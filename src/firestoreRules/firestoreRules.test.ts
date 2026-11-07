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
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  getFirestore,
  onSnapshot,
  setLogLevel,
  collection,
  setDoc,
  terminate,
  type DocumentData,
  type DocumentReference,
  type Firestore,
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

const content = { id: "p1", name: "test plan", exercises: [] };

/** A plan as a Save stored it, at version `rev` with id `s<rev>` (none: a plan saved before 073). */
const stored = (rev?: number): DocumentData => ({
  ...content,
  ...(rev === undefined ? {} : { version: { rev, id: `s${rev}`, base: rev > 1 ? `s${rev - 1}` : null } }),
});

/** A Save as the phone writes it: at `rev`, made on the version `base`, as the new version `id`. */
const save = (rev: number | undefined, base: string | null, id = `new${rev}`): DocumentData => ({
  ...content,
  version: { ...(rev === undefined ? {} : { rev }), id, base },
});

/** A stored doc, written with the rules off (as the admin scripts write). */
const seed = (path: string, data: DocumentData) =>
  env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), path), data));

const alice = () => env.authenticatedContext("alice").firestore();
const PLAN = "users/alice/workouts/p1";

describe("plans: a save must be based on the stored version (D6)", () => {
  it("the stored rev + 1, made on the stored id, passes", async () => {
    await seed(PLAN, stored(3));
    await assertSucceeds(setDoc(doc(alice(), PLAN), save(4, "s3")));
  });

  it("an old rev is refused: another device saved since", async () => {
    await seed(PLAN, stored(4));
    await assertFails(setDoc(doc(alice(), PLAN), save(4, "s4")));
    await assertFails(setDoc(doc(alice(), PLAN), save(3, "s4")));
  });

  it("a rev that skips a number is refused", async () => {
    await seed(PLAN, stored(3));
    await assertFails(setDoc(doc(alice(), PLAN), save(5, "s3")));
  });

  it("a save with no version, or none with a rev, is refused (a build from before 073)", async () => {
    await seed(PLAN, stored(3));
    await assertFails(setDoc(doc(alice(), PLAN), content));
    await assertFails(setDoc(doc(alice(), PLAN), save(undefined, "s3")));
  });

  // PR #50 review, B1: the rev fits (phone A's 4 + 1), but the save is based
  // on a write the server refused, e.g. a draft edited after a queued Save.
  it("a save made on another version is refused, even when its rev fits", async () => {
    await seed(PLAN, stored(4));
    await assertFails(setDoc(doc(alice(), PLAN), save(5, "b4")));
    await assertFails(setDoc(doc(alice(), PLAN), save(5, null)));
  });

  it("a save with no id, or the stored one, is refused", async () => {
    await seed(PLAN, stored(3));
    await assertFails(setDoc(doc(alice(), PLAN), { ...content, version: { rev: 4, base: "s3" } }));
    await assertFails(setDoc(doc(alice(), PLAN), save(4, "s3", "s3")));
  });

  it("a stored plan with no version counts as rev 0, id null: a save at 1 made on none passes", async () => {
    await seed(PLAN, stored());
    await assertSucceeds(setDoc(doc(alice(), PLAN), save(1, null)));
  });

  it("a new plan passes at rev 1 with an id, and only so", async () => {
    await assertFails(setDoc(doc(alice(), PLAN), content));
    await assertFails(setDoc(doc(alice(), PLAN), save(2, null)));
    await assertFails(setDoc(doc(alice(), PLAN), { ...content, version: { rev: 1, base: null } }));
    await assertSucceeds(setDoc(doc(alice(), PLAN), save(1, null)));
  });

  it("delete passes, as before (wipe scripts)", async () => {
    await seed(PLAN, stored(3));
    await assertSucceeds(deleteDoc(doc(alice(), PLAN)));
  });

  it("reads pass for the owner, including the change query's list", async () => {
    await seed(PLAN, stored(3));
    await assertSucceeds(getDoc(doc(alice(), PLAN)));
    await assertSucceeds(getDocs(collection(alice(), "users/alice/workouts")));
  });

  it("another user is refused every access to the plan", async () => {
    await seed(PLAN, stored(3));
    const bob = env.authenticatedContext("bob").firestore();
    await assertFails(getDoc(doc(bob, PLAN)));
    await assertFails(setDoc(doc(bob, PLAN), save(4, "s3")));
    await assertFails(deleteDoc(doc(bob, PLAN)));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), PLAN), save(4, "s3")));
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
describe("queued saves refused after reconnecting (D7)", () => {
  type Seen = { name: unknown; pending: boolean }[];

  /** Phone B: its own client, so it can go offline while others write. */
  async function phoneB(run: (db: Firestore, ref: DocumentReference, seen: Seen) => Promise<void>) {
    const app = initializeApp({ projectId: PROJECT_ID, apiKey: "fake" }, `phone-b-${Date.now()}`);
    const db = getFirestore(app);
    connectFirestoreEmulator(db, host, Number(port), { mockUserToken: { sub: "alice", user_id: "alice" } });
    const ref = doc(db, PLAN);
    const seen: Seen = [];
    const unsubscribe = onSnapshot(ref, { includeMetadataChanges: true }, (snap) =>
      seen.push({ name: snap.get("name"), pending: snap.metadata.hasPendingWrites })
    );
    try {
      await waitFor(() => seen.length > 0);
      await run(db, ref, seen);
    } finally {
      // Always, or a failing run leaves the client connected and jest hangs.
      unsubscribe();
      await terminate(db);
      await deleteApp(app);
    }
  }

  it("its promise rejects with permission-denied, and the local copy rolls back", async () => {
    await seed(PLAN, stored(4));
    await phoneB(async (db, ref, seen) => {
      await disableNetwork(db);
      // Based on rev 3: another device has saved since.
      const write = setDoc(ref, { ...save(4, "s3"), name: "stale edit" });
      let settled = false;
      write.then(() => (settled = true), () => (settled = true));
      await waitFor(() => seen.some((s) => s.pending && s.name === "stale edit"));
      expect(settled).toBe(false); // offline: neither resolves nor rejects

      await enableNetwork(db);
      await expect(write).rejects.toMatchObject({ code: "permission-denied" });
      await waitFor(() => seen[seen.length - 1].pending === false);
      expect(seen[seen.length - 1]).toEqual({ name: "test plan", pending: false });
    });
  });

  // PR #50 review, B1 case 1: phone B queues two Saves offline, the second
  // based on the first (`draftAfterQueued`); phone A saves once meanwhile.
  // B's second Save has rev 5 = A's 4 + 1, so on `rev` alone it erased A's.
  it("a second save based on a refused one is refused too, and the other device's save stays", async () => {
    await seed(PLAN, stored(3));
    await phoneB(async (db, ref) => {
      await disableNetwork(db);
      const first = setDoc(ref, { ...save(4, "s3", "b4"), name: "B edit 1" });
      const second = setDoc(ref, { ...save(5, "b4", "b5"), name: "B edit 2" });
      // Read now, so neither counts as an unhandled rejection meanwhile.
      const outcomes = Promise.allSettled([first, second]);

      await assertSucceeds(setDoc(doc(alice(), PLAN), { ...save(4, "s3", "a4"), name: "A edit" }));

      await enableNetwork(db);
      const [r1, r2] = await outcomes;
      expect(r1).toMatchObject({ status: "rejected", reason: { code: "permission-denied" } });
      expect(r2).toMatchObject({ status: "rejected", reason: { code: "permission-denied" } });
    });
    await env.withSecurityRulesDisabled(async (context) => {
      const snap = await getDoc(doc(context.firestore(), PLAN));
      expect(snap.data()).toMatchObject({ name: "A edit", version: { rev: 4, id: "a4" } });
    });
  });

  // Device run, 2026-11-07: the refusal reload read the phone's own queued
  // Save as the server's copy. The SDK lays writes still queued on top of
  // what a server read returns (latency compensation), even for
  // `getDocFromServer` / `getDocsFromServer`; only `hasPendingWrites` says so.
  it("a server read while a save is still queued returns that save on top, flagged hasPendingWrites", async () => {
    let seenPending = 0;
    for (let attempt = 0; attempt < 5 && seenPending === 0; attempt++) {
      await env.clearFirestore();
      await seed(PLAN, stored(3));
      await phoneB(async (db, ref) => {
        await disableNetwork(db);
        const first = setDoc(ref, { ...save(4, "s3", "b4"), name: "B edit 1" });
        const second = setDoc(ref, { ...save(5, "b4", "b5"), name: "B edit 2" });
        const outcomes = Promise.allSettled([first, second]);
        await assertSucceeds(setDoc(doc(alice(), PLAN), { ...save(4, "s3", "a4"), name: "A edit" }));

        await enableNetwork(db);
        await first.catch(() => undefined); // refused; the second may still be queued
        const reads = await Promise.all([
          getDocFromServer(ref),
          getDocsFromServer(collection(db, "users/alice/workouts")).then((all) => all.docs[0]),
        ]);
        await outcomes;
        for (const read of reads) {
          // The flag is the only tell: with it, the queued save; without, the server's copy.
          expect(read.get("name")).toBe(read.metadata.hasPendingWrites ? "B edit 2" : "A edit");
          if (read.metadata.hasPendingWrites) seenPending++;
        }
      });
    }
    expect(seenPending).toBeGreaterThan(0);
  });
});

async function waitFor(condition: () => boolean, ms = 10_000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > ms) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 20));
  }
}
