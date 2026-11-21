# Testing notes (raw material for a testing skill)

A running log of what testing a ticket actually needed: what found bugs, what
was wasted, how the emulator and scripts were driven. Not a spec. At the end of
the History build (TICKET-081 to 086) this is turned into a skill, so write
**what happened**, with the ticket, and mark whether a run or a reading found it.

How to add an entry: one bullet under the right heading, with the ticket id.
Prefer "ran X, saw Y" over "should test Z". Delete nothing; if an entry turns out
wrong, add a correction under it.

Entry tags: **[run]** found by running something; **[read]** found by reading
code or the diff; **[waste]** cost time and found nothing.

---

## 1. What found real bugs, and how

- **[run] A fixture that goes through the app's own builder finds shape bugs a
  hand-written one hides.** TICKET-081: `historyFixtures.ts` builds sessions with
  the importer's `buildSessionDocs`. Adding `lifts` to that builder changed every
  fixture at once, with no fixture edit. Reuse the real path to build test data.
- **[run] Simulating the save with the code the transaction runs found a gap no
  reading did.** TICKET-081: saving the same workouts in start order gave 0
  mismatches; saving one late gave wrong verdicts on its successors and different
  rollups (which session holds a tied best). The ticket had named only the
  verdicts. Pattern: replay the write path in a different order and compare.
- **[run] The first draft of a check can be wrong about its own fixture.**
  TICKET-081: "a late upload leaves its own lifts correct" failed because the
  fixture had more sessions than the rollup window holds, so they were `pending`.
  The code was right, the expectation was not. When a new test fails, check the
  test's setup before the code.
- **[run] A real account found what fixtures did not.** TICKET-081: running the
  compare script on the other accounts showed it reporting "48 mismatches, run
  the rebuild" for old-shape data, where the rebuild writes nothing. Run any
  checking script on every real account that has data, read-only, before calling
  it done.
- **[run] The device found a case nobody planned.** TICKET-081: a Freestyle add of
  Shoulder Press uses kg while the plan's history is in plates, so the verdict is
  `unit_changed`. A real, reachable case from using the app; no unit test had
  picked that pair.
- **[read] The ticket was wrong, and the code said so.** TICKET-081: "a swapped
  lift has no previous session" would label a Bench Press First time after it
  replaced an Incline Press. Found by reading `swapExercise` (the slot takes the
  new id and its history is prefetched). Verify the ticket's claims in code first
  (CLAUDE.md 2.1, 2.2).

- **[read] A test that quietly avoids a dependency is a finding, not a fixture
  choice.** TICKET-081: the mixed-account test made the *newest* session old-shape
  "so no later verdict was judged against it". That sentence was the bug: a verdict
  depends on the previous session, so an old-shape session in the middle makes the
  compare script and the rebuild call correct verdicts wrong (8 false mismatches
  on a 24-workout fixture, and a repair that would write false First times).
  Found in review pass 2, not by a test. When you write "chosen so that X does not
  matter", write the test where X does matter too.

## 2. Unit tests: what earned its place

- A verdict or any derived number: 6 to 8 cases of the computation, including
  empty, one set, fewer sets than last time, unit change, unreadable set, a tie,
  a renamed field. Each seen failing once by breaking the line it covers.
- **Mutation by hand is the check that matters.** TICKET-081: of 11 mutations on
  the first pass of stage 2, 10 turned a test red; the survivor was a guard that
  was redundant (so it was removed, not tested). Two more survivors on stage 3 (a
  tie-break, an `exerciseIds` check) had no test; tests were added. A script that
  applies one mutation, runs the tests, restores the file, and prints which
  tests failed is cheap; keep it in the scratchpad, not the repo.
- A guard test that pins a measured number (writes per Finish) must be updated in
  the same change that moves the number: `measureFinishOps.test.ts` went red on
  purpose when phase 2 added a write.
- Tests that touched a type: a required field breaks every constructor of it.
  TICKET-081 made `lifts` required and ~11 test and script sites needed a patch;
  one was hidden behind a cast (`as WorkoutSessionDoc`) and only a failing test
  found it. Prefer no cast in test builders.

## 3. Emulator / device testing

Setup that worked (TICKET-081, `pinky`, Pixel_9_Pro_XL, `emulator-5554`):

- Metro is not always running. Check `localhost:8081/status`; start with
  `npx expo start --dev-client --port 8081` in the background, and
  `adb reverse tcp:8081 tcp:8081`.
- The dev launcher shows "Error loading app / unexpected end of stream" on the
  first load: the first bundle is slow. `curl` the bundle URL once to warm it,
  then relaunch. Pick the `http://10.0.2.2:8081` entry, not the LAN one.
- Unlock in one adb burst (see memory `emulator-lock-screen-driving`).
- Screenshots: `adb exec-out screencap -p`, `sips -Z 900`, then look. Tap
  coordinates are the 404-wide screenshot x 3.327. **Layout shifts after the
  first set (the rest timer and effort prompt open), so re-screenshot before each
  tap; a blind loop of taps opened the History sheet instead of logging sets.**
- Number fields: tap the field, `adb shell input text N`, tap Log set. The ghost
  values (last time) are placeholders, not entered values; you must type them or
  the set is refused ("Enter Weight to log set").
- **Plan the data first:** read last time's sets from the rollup and choose today's
  so the expected verdict is known (better, lower, same) before logging.
  (`exercise_stats` sets read back with keys sorted, so the order is Reps then
  Weight; read it carefully or you invert the expectation.)
- Offline: `adb shell cmd connectivity airplane-mode enable|disable`. The app
  still showed last time (the held summaries) and the recent list while offline.
- Which accounts, which plans: only plans named "test..." are editable; a
  Freestyle workout needs no plan. Say up front which writes the run makes.
- Verify the result in the database, not on screen: a read-only script printing
  the newest session's lifts, then the compare script. The screen said "Saved";
  only the read-back showed `unit_changed`, `swappedFrom` and `added`.
- **Clean up what the run wrote**, with a dry run first, and record that the
  emulator's held copy still lists deleted sessions (a hard delete is invisible
  to the change check).
- **[waste]** Repeated blind taps; the first Metro launch; a script in the
  scratchpad that could not import `firebase-admin` (import it by absolute path
  or put the script in `src/scripts`).

## 4. Scripts that touch a real account

- Dry run by default; `--confirm` writes (`isConfirmedRun`). A read-only script
  has no write mode at all (nothing to forget).
- Run the dry run on the real account, read the counts, then write. The narrow
  wipe printed 15/122/48 and "kept: info, workouts" before deleting, which is
  what made it safe to say yes.
- A fleet-wide script (`wipeTestData.ts` wipes every tester) is not a narrow
  one. Check the scope in the script's header before suggesting it.
- After a write: the checking script on the same account, expecting 0.
- Old-shape data: say "cannot be checked", never "0 mismatches", about sets
  nobody read.

- **A backfill is a test of the model's assumptions.** TICKET-081, `vikrantdhawan9`
  (the manual-testing account): the dry run of "lifts from exercise_sessions" found
  6 docs in the pre-055 shape that the app's decoder cannot read; the compare script
  then showed exactly those 6 rollups differing. Inspecting one raw doc showed the
  old shape was lossless to convert (bare map per set, marks in a parallel array, no
  splits). Order that worked: dry run printing counts and anything unreadable, write,
  compare, look at what differs before running the repair, convert, rebuild, compare.
  Accounts used for manual testing should hold data in the current shape, or the
  first manual test starts from a state no user can reach.

- **Test a repair by breaking the data on purpose, on a test account.** TICKET-081:
  the rebuild's verdict-repair write had never executed for real (every real run
  had 0 sessions to correct), and "a replay keeps a note" had only a mocked merge
  behind it. A scratch script wrote a wrong verdict and a note, the compare script
  found it, the repair fixed it, the note survived, and a replayed phase-1 write
  left the note too. Ten minutes; it turned two "unverified" lines into measured
  ones. Always restore the session and finish with the compare script at 0.

## 5. Open questions for the skill

- What a scenario writer should take as input: the diff, the ticket, or both?
  (081: the ticket was partly wrong; the diff alone would have missed the swap
  claim.)
- Where the line is between "unit test" and "script on a fixture" (081's
  simulated saves were in `historyCompare.test.ts`, a unit test that is really a
  scenario).
- A regression run needs a seeded account and a reset script; neither exists.
  `pinky` plus a cleanup script was the nearest thing. Build that first.

## 6. Log by ticket

### TICKET-081 (history data foundation)
- Unit: 769 tests before, 789 after (12 for the verdict, the rest for the record,
  the validator, the import and the compare script), mutation-checked. All
  existing tests passed after the required `lifts` field once ~11 constructors
  were patched.
- Script: 27 accounts listed, 3 with history; the compare script ran read-only on
  all 3; a real wipe and import on one, an in-place import on another.
- Emulator: T1 online Freestyle, T2 swap + added on "Test 070", T3 offline then
  reconnect, 0 mismatches after each; cleaned up. Not tested: late upload on a
  device, phase 2 failing after phase 1, phase 2 latency, server write count.

### TICKET-082 stage 1 (held window, pure layer)
- **[run] A guard assertion caught a test that could not test.** The boundary tests set
  `process.env.TZ` in the test file; the guard (`getTimezoneOffset()` is the expected
  480) failed on the first run: Jest's sandbox copies `process.env`, so `Date` never saw
  it, and the machine's own zone (IST) was in force. Without the guard every
  local-vs-UTC test would have passed or failed by the developer's location. Fix: a
  `globalSetup` pin. Any test that depends on an environment fact should assert the fact first.
- **[run] A negative assertion passed against broken code.** "A late upload from a month
  not held is not held" stayed green with the cut filter removed, because the month trim
  dropped the workout anyway (minimum 2, October already held 2). Found by mutating each
  rule in a throwaway worktree; fixed by setting the minimum above what October holds,
  so only the cut keeps it out, then seen red. Mutation-check every "not held / not
  called" test; they are the ones that lie.
- **[run] Mutations seen red (7):** cut at UTC month start (4 red), local month key as UTC
  (1), never drop the oldest month (1), marker not dropped (2), label from the oldest
  snapshot (1), late upload kept (1, after the fix), no `lifts[].name` fallback (1).
- **[read] The ticket's claim was backwards.** 082 said the oldest shard can hold workouts
  before the cut. Reading the first-load queries showed it holds none; it is the oldest
  shard that may hold only part of its UTC month. Written down as a deviation, pinned by a test.
- **[read] "The readers keep working" hid a behaviour change.** Per-plan loading gave a
  rarely-done plan its last date at any age; a window by time does not. Found by tracing
  what `hubTileFace` does with a plan with no held session, before writing the store.
- **[run] Read-only run on a real account for an index claim.** Both first-load queries
  and a month-range query ran against `pinky` with the admin SDK: no
  FAILED_PRECONDITION, and the two first-load answers together equal the docs at or after the cut (14 of 14).
  Cost: a 20-line scratch script, 3 queries plus one full read of 15 docs.
- **[waste] One jest timeout:** `setTimeout` inside a test under `jest.useFakeTimers()`
  (the suite's setup) never fires. Use `waitFor` on the observable instead.
- **[waste] A mechanical rename needs a read-through.** A word-boundary replace of
  `heldWorkouts` also renamed an output property in a script, and `cut` became
  `windowStart` inside sentences ("windowStart back to the window"). tsc found the first
  (one test property), reading found the second. Rewrite the prose of a renamed
  module by hand; run tsc and the suite after.

### TICKET-082 stage 2 (floor, store, readers)
- **[read] A review caught what I had called a cost.** I wrote that a plan idle longer than the
  window "costs a plan done rarely". The reviewer pointed at `chooseHubTiles`, which sorts by
  longest-since-done, and the idle plan has no date under a window. Re-reading the two
  functions showed the claim was backwards (it hid the plan most due). Always trace what a
  reader does with the absent value before calling it cheap.
- **[run] A screen test found a race in code I was replacing.** The hub test for "Legs: not in recent
  workouts" read "last session unknown": the plans arrived while the first check ran, so the
  trigger joined that check, which did not have them. The old `followPlans` had the same blind
  spot, hidden because its plans were few. Fixed by re-checking when a check ends, once per set
  of ids. Seen red (3 tests) with the re-run removed; the loop guard's mutation did not fail, it hung (killed the
  orphaned jest worker by hand).
- **[run] Mutations seen red (stage 2):** floor: Finish does not replace (3 red), late upload older replaces (1),
  drop empties the floor (1), unlooked-up plan claims a workout (1), plan filter counts the floor (1),
  pre-floor copy errors (1), marker leaves the entry (1). Store and readers: no re-run after a
  check ends (3), lookups skipped inside the skip (5), lookups never applied (6), old month's
  shard stays on disk (1), unlooked-up plan reads never done (1), pending upload dates an
  unlooked-up plan (1), loop guard removed (hang).
- **[run] A before/after harness caught a wrong plan for "before".** The old per-plan code is
  gone from the tree, so its numbers had to come from a worktree at the stage 1 commit with
  the idle plans patched into the harness. Take "before" numbers before replacing the code;
  here they were taken for four plans only and the idle scenario had to be rebuilt after.
- **[run] Read-only probes on a real account for index claims, twice.** Window queries (stage 1)
  and the per-plan limit-1 lookup including a plan never done (stage 2): no
  FAILED_PRECONDITION, 1 read each. Admin SDK, not the client; the same server rule.
- **[waste] Two shell mistakes cost a run each:** `timeout` does not exist on macOS (a silent
  no-output run looked like a hang), and a `--testPathIgnorePatterns` on the command line
  replaces the config's list and ran the emulator-only rules tests.

### TICKET-082 stage 3 (older months, proof, device run)
- **[run] A device run found what no unit test could: offline does not refuse at once.** The store test
  mocks a rejection, which is instant. On the emulator the older-month read sat in `loading` for 10 to 30 s
  before Firestore rejected with `unavailable`. Added `waitOver` and a test (seen red with the timer
  removed). Any "refused offline" claim needs a device run with airplane mode on, not a mocked rejection.
- **[run] Desktop timing was two orders of magnitude off the emulator for storage.** Whole-copy write 2.8 ms
  in `node:sqlite`, 233 ms for the same 1.00 MB in the emulator's AsyncStorage (read 56 ms). The desktop
  number is a ratio between shapes, never a time; the probe button on the debug page is what answered it.
- **[run] An airplane-mode cold start needs `adb reverse`.** A dev build loads its bundle from Metro, which
  airplane mode cuts; `adb reverse tcp:8081 tcp:8081` and "Enter URL manually" with `http://localhost:8081`
  worked. Then: force-stop, airplane on, launch, hub dates shown, 0 reads billed.
- **[run] The device found a state I had not written down:** the first read after leaving airplane mode took
  about 45 s to answer. Nothing to fix (the checks have a bounded wait); recorded so a test plan expects it.
- **[run] A reboot of the emulator can come back with "System UI isn't responding";** tapping Wait cleared it.
  Network was down for the first minute after boot (the hub read "last session unknown", then filled in).
- **[read] A test passed for the wrong reason, again:** "a key that is not a month is refused" stayed green
  with the guard removed, because `match[1]` on null threw a TypeError. Asserting the message made the
  mutation red. When a test says "throws", pin which error.
- **[waste] A scripted edit landed in the wrong component:** `str.replace(a, b, 1)` on a line that
  appears in two components put a `useState` in the Plans section, and the page crashed on the device
  with a render error ("Property 'probe' doesn't exist"). tsc had flagged it first; I read it late. Anchor
  an edit on the enclosing function, not on a line that repeats.
- **[waste] Two scratch scripts failed on module resolution:** a script outside the repo cannot import
  `firebase-admin`; import it by absolute path.

### TICKET-082 stage 3, second device run (emulator, `pinky`, 2026-11-15)
Plan, in order: hub dates and sort; restart reads; older month online, offline, then retry online; a real
Finish on the test plan; kill and airplane-mode cold start; the picker's recents. Results are in TICKETS.md.

- **[run] A changed config constant does not re-window a phone that already holds a copy.** I set the
  minimum low for the older-month cases, did a full reload, then reverted it. After the revert the
  phone still held the low-minimum window (14 workouts from 1 Oct) until another full reload, because a
  restart only reads the stored copy and then asks for changes. In any test plan that changes a window
  constant: press "full reload" after setting it and again after reverting it, and read "Last full reload"
  on the debug page to know which one is held. (A raised or lowered constant in a release also does not
  re-window existing copies; harmless pre-launch, noted in the ticket.)
- **[run] The first check after a Finish returned 0 docs, and that is correct.** The Finish adds its workout
  to the held copy at once (hub shows "Today" before any read), marked "unstamped" on the debug page
  because it has no server time yet. The check one second later saw nothing, because the upload had not
  landed. A forced check a minute later returned 1 doc and the entry was stamped. So a phone's own Finish
  costs 1 read when it comes back, and 0 at Finish. A plan that expects "Finish adds 0 reads" has to say
  which of the two it means.
- **[waste] Two taps missed because the page shifted, and two identical screenshots looked like success.**
  An error line appearing under "Older months" moved every button down. I tapped the old coordinates twice
  and could not tell a fresh "offline" from the stale one, because the text is the same. Re-screenshot
  after any state change before the next tap, and read a field that changes on a retry (the billed-read
  count did: 16 to 17 on the successful retry). A debug row that reads the same before and after a retry
  is a poor probe; a per-attempt counter would have settled it.
- **[run] Offline older month: `loading` then `offline`, rejected inside about 50 s, and the retry works.**
  Not timed more finely than that (screenshots were 10 to 15 s apart and I missed the `loading` frame in
  both attempts, so the `waitOver` text itself was not seen on this run; it was seen on the first run).
  After airplane mode off and 25 s for the network, the same button gave "2026-09: 1 workouts" and billed
  1 read. A rejected month is not stuck. A read that never settles was not seen and cannot be made to
  happen from the debug page.
- **[run] A real Finish on a never-done plan fills the floor and the hub at once, and survives a kill.**
  Test 070 went from "not in recent workouts" to "Today", the floor row appeared, and after force-stop plus
  airplane-mode cold start the hub still read "Today" with 0 reads billed and the failed check keeping the
  copy. This is the case the whole floor exists for, seen on a device.
- **[run] The picker reads the window.** Add exercise: the newest lift (just done, 15 Nov) is first, then the
  older lifts by date. This closes the "reasoned, not measured" note for recents.
- **[run] Offline cold start shows a dev-only red LogBox** (Firestore's own `console.error` "Could not reach
  Cloud Firestore backend"); Dismiss clears it. Not an app error. The Feed also read "Hi, Guest" on that
  start; not attributed to this ticket, not checked against `main`.
- **[waste] Not testable here, so not run:** another phone's Finish (needs a second writer, one test write to
  the real account); a second account signing in after sign-out (needs that account's login); a busy month
  of 60+ workouts (pinky has 15). Unit tests cover the sign-out and epoch rules.

### TICKET-082, handling the PR review (2026-11-15)
- **[read] A fresh reviewer found a bug the builder's own tests and a device run could not: a case that only
  exists in a later ticket.** A `deleted` marker keeps its `startedAt`, so as a plan's newest it answered the
  floor's lookup with no date, and the plan was asked again on every check. No test or screen could show it,
  because nothing writes markers until TICKET-086. When a store stores a rule for data a later ticket will
  write, test that rule's resolution too, not only its removal.
- **[read] A proof harness had two assertions that could not fail.** "A restart reads 0 to show the list" was
  a hardcoded `0` compared with itself; "a Finish adds 0 reads" read the store's own `billedReads` counter,
  which the code under test can never increment. Fixed by counting calls into the mocked services, at the
  moment the list first appears and around the Finish. Both seen red by adding one service call to the code.
  A counter the code maintains about itself is not a measurement of what the code does.
- **[run] Mutation testing found two guards no test covered.** Removing the "no window yet" guard and the
  "already loading" guard from `loadMonth` left 15 of 15 tests green. The test for the first called `clear()`,
  which nulls `uid`, so an earlier guard returned first; the second was never exercised because the "once" test
  awaited each call. Write the test so the guard under test is the first one that can fire.
- **[run] A negative assertion that cannot fail was deleted, not strengthened.** "The saved copy does not
  contain the older month" passed whatever the store did, because the save is built from the window alone.
  The real claim (the window still holds only the held month) was already asserted.
- **[waste] My first mutation of the bad-key guard tested nothing:** it changed the argument but the throw still
  happened inside the `try`. The test stayed green and I almost read that as a passing test. Make the mutation
  remove the behaviour (rethrow in the catch), then confirm it goes red.
- **[run] Restoring a mutated file by copy, not by git, kept the unstaged work safe.** Each mutation copied the
  file aside, changed one line, ran the one test file, copied it back; `git diff --stat` after the batch matched
  the size before. Do not `git checkout` a file with unstaged work to undo a probe.
- **[run] A review's "could not verify" can be closed cheaply:** the 199, 223, 215 and 239 reads the ticket
  quotes were confirmed by running the harness under `TZ=UTC`; the suite default is Los Angeles.
- **[run] A claim in the ticket was false and a cheap run showed it:** "the full suite passes under Los Angeles
  and UTC alike". Under `TZ=UTC`, `Asia/Kolkata` and `Pacific/Auckland` 31 tests fail (30 already at the stage 2
  commit, found by running the committed tree in a throwaway worktree). Those tests assert a boundary where the
  UTC month and the local month disagree, which needs a zone behind UTC. Corrected in the ticket and the
  `globalSetup.js` comment. When a test is built on a time zone, run it under two other zones before writing
  "passes under any zone".
- **[run] A throttle added after a review question broke an earlier test, which was the right signal.** The
  "retried on the next ask" test asked three times back to back; with the retry gap it had to advance the fake
  clock between asks. The new test (three asks right after a refusal read once, an ask after the gap reads
  again) was seen red with the check replaced by `false`. A test that makes several asks in a row is a test of
  the rate, whether it meant to be or not.
- **[run] Mutation testing of an extracted helper found dead code, and the right fix was to delete it.** After
  moving the on-demand read rules out of the store into `onDemandReads.ts`, one of seven mutations survived:
  the "newest read" check in the wait timer. Tracing it showed a new read only starts after the old read's timer
  has fired or been cleared, so the check could never matter, and the test written for it passed against
  broken code. Removed the guard and the test. A mutation that survives means a missing test or an unreachable
  line; decide which before adding a test.
- **[run] Extracting kept the old tests as the proof of "same behaviour":** the store's 20 `loadMonth` tests ran
  unchanged on the helper before any new test was written, and only then did the helper get its own 7.

### TICKET-082, device run after the review fixes (emulator, `pinky`, 2026-11-15)
- **[run] The blocker was only testable by writing the data a later ticket will write.** Nothing in the app
  writes a `deleted` marker until 086, so the case could not be reached by using the app. A scratch admin
  script (dry run first) set `deleted: true` on the one Test 070 workout I had made, then restored it.
  Seen: the hub read "last session unknown" until the next trigger, a forced check ran the lookup once and
  the plan settled as "never done", and the following check made no lookup (`1 queries`, not `2`). Before the
  fix the lookup would have returned the marker and the plan would have stayed unknown, with a lookup on every
  check. When a bug needs data the app cannot yet write, write one real example through the admin SDK, on a
  doc you own, and put it back.
- **[run] "Unknown" between the marker and the next focus is by design and looks like the bug.** The check that
  carries the marker ends with the plan not looked up; the lookup runs on the next trigger (a focus), by the
  once-per-set-of-ids rule. A tester who stops after 8 seconds sees the broken state. A plan for this test must
  say: after the marker, force a second check.
- **[run] The restore needed a second look, not an assumption:** after `deleted` was removed the floor went
  from "never done" back to the date on the next check (`1 queries, 1 docs`). A null entry being replaced by a
  restored workout is a path no unit test named.
- **[run] The probe with JSON in it changed the number that matters.** The old probe saved plain strings: save
  233 ms, read 56 ms. With stringify and parse: stringify 153, save 227, read 128, parse 94 ms. A restart pays
  about 220 ms (read plus parse) and a save about 380 ms, before validation. A storage-only probe understates
  the cost by the whole CPU part; time the JSON in the same run.
- **[waste] Taps missed twice on the debug page** because scroll position and layout differ between visits. A
  tap that changes nothing looks like a result; check the check log for a new line before reading anything.
- **[run] The throttle cannot be seen on a device:** a refused read bills nothing and the row text is the same,
  so unit tests are the only proof. Say so in a plan instead of looking for it.
- **[waste] A scratch script outside the repo could not import `firebase-admin`** (module resolution, as noted
  before); it ran once copied into `src/scripts/` and was deleted. Check `git status` for the temp file at the
  end of the run.

### TICKET-082, handling pass 2 of the PR review (2026-11-15)
- **[read] A fix for a case nothing can produce yet was paid for by every real run.** The lookup read 3 docs
  per plan to step past markers, so each idle plan's first load cost up to 3 reads, while the test mocked one
  doc per call and the readout billed 1. Neither the mock nor the readout could show it. For a rule about data
  that does not exist yet, make the common path cost what it did before and charge only the rare path.
- **[run] The mock hid the cost because nothing asserted on the query.** Mutating the page size from 1 to 3
  left the old tests green; the new test asserts `limit` was called with 1, and went red when the size was
  changed. If a test mocks the query builder, assert what it was asked for, not only what it answered.
- **[run] A cursor test must check the cursor, not the order of the answers.** The old paging test served
  pages in order, so removing `startAfter` stayed green. The new one asserts each `startAfter` receives the
  marker before it.
- **[read] A rule that holds for the window held for the batch only if the batch was filtered the same way.** The
  marker rule picked a plan's next newest from the window plus the batch, before the window cut applied; a late
  upload from before the cut in the same batch could be taken for the newest. Found by a reviewer tracing the
  order of two steps. Test it with the late upload and the marker in the same call, and with a second plan and a
  third session so the plan filter and the sort are both exercised (the first test had one plan and two
  sessions, so mutating either stayed green).
- **[run] Mutation testing found three guards in a helper nobody tested:** the timer cleared on settle, the
  timer ignoring a sign-out, and the clock. Each needed a test that advances the clock after the event
  (after settle, after sign-out), not only before it.
- **[run] Setting the clock back needed `jest.setSystemTime`:** with fake timers it moves `Date.now()`, and the
  test showed a refused key stayed refused until the clock caught up, which the fix removes.
- **[waste] One mutation did nothing:** the search text matched, the test stayed green, and I nearly read it as
  a passing guard. The `limitFn(1)` text appears twice in the file (a second query uses it), so my "once"
  assertion on a longer string had failed before any change. Count occurrences before mutating.

### TICKET-088, analysis: counts of older months (2026-11-16 to 17, `pinky`, dummy data)
- **[run] The emulator cannot prove an index.** `where("deleted", "!=", true)` with a range failed only on
  production (`FAILED_PRECONDITION`); the emulator enforces no indexes. A probe about an index runs read-only
  against the real project or proves nothing.
- **[run] A `!=` filter skips every doc that lacks the field.** On the whole collection it matched 0 of 35 live
  workouts (they carry no `deleted`). Any count or query that "excludes markers" with `!=` silently returns
  nothing for normal data. Test it on docs without the field, not only on docs with it set to false.
- **[run] A bare `count()` over a range counted deleted markers:** July gave 5 where 3 workouts were live. The
  number looked right next to the others. Always seed markers into the months a count probe checks.
- **[run] My own ground-truth query needed an index too:** an equality on a probe tag plus a range on `startedAt`
  failed, and at first I read the error as the design's. Keep a probe's checking queries to the same indexes as
  the design under test, or the failure points at the wrong thing.
- **[run] A retried write is the test for a counter.** Committing the same Finish twice moved an `increment()`
  counter by 2 and left a map keyed by session id at 1. Any stored count must survive the replay the upload
  queue already does.
- **[run] Two simulated phones showed the staleness a single client hides:** phone 2 was wrong until its next
  refresh. Name that window in the design rather than claim "invalidated".
- **[run] Time zones: run the same probe under two `TZ` values** (Asia/Kolkata, America/Los_Angeles) with a
  workout at 00:30 on 1 January; month bucketing is where a UTC/local mix-up shows.
- **[read] What was not verified:** phone timing (every time was from a laptop to the real project); billing
  beyond the pricing page's rule; the chosen paging design itself (it is built and measured in 085a).
- **[waste] Three designs were simulated before the user asked whether the UI needed a count at all.** The
  cheapest answer was a design change. Ask "does the screen need this number" before measuring how to get it.

### Bug report: keyboard hides the picker's search box and the plan name field (emulator, `pinky`, 2026-11-17)
- **[run] The emulator never showed the bug because it never showed a keyboard.** With the host keyboard
  attached, Gboard only draws its floating toolbar. `adb shell settings put secure show_ime_with_hard_keyboard 1`
  brings the full on-screen keyboard back; with it, the bug reproduced on the first try. Any test of a text
  field near the bottom needs this set (it is left on now).
- **[read] The picker's comment said Android resizes the window for the keyboard.** True before targetSdk 36;
  at 36 the app is edge-to-edge and `adjustResize` no longer shrinks anything. The picker (TICKET-043) was
  written after the bump (0210068), on that assumption. Grep for `Platform.OS === "ios" ? "padding"` when the
  target SDK moves again.
- **[run] KeyboardAvoidingView under-lifted by exactly the status bar.** Logged numbers: keyboard `screenY` 661
  (screen coordinates), picker `measureInWindow` y 4 (counted from below the status bar). Hence
  `StatusBar.currentHeight` in `KeyboardLift`'s offset. Log both numbers before guessing an offset.
- **[run] KAV's "padding" overrides the style's own `paddingBottom`.** The picker lost its bottom gap (search
  label moved 8 dp lower) until the style moved to an outer View.
- **[run] Checked on device:** picker search box above the keyboard (Manage Workout and active-workout Add);
  tapping an exercise, a custom exercise or a filter closes the keyboard; Plan sheet "New plan" field above the
  keyboard; picking a plan while typing closes it and creates nothing; Manage Workout's field editor (a
  ScrollableScreen) still ends at the keyboard. **Not checked:** iOS (no simulator run), gesture-navigation
  phones (emulator uses 3-button nav), the other ScrollableScreen screens beyond Manage Workout.

### Bug report: no Add button on Bench Press's version sheet (emulator at phone size, `pinky`, 2026-11-17)
- **[run] The emulator's screen hid the bug.** At its own 1344×2992 / 480 dpi (448×997 dp) the Bench Press sheet
  fits. `adb shell wm size 1080x2340; adb shell wm density 440` (393×851 dp, near the reporter's phone) cut it
  off at "Last logged" with no Add button, as in the report. Reset with `wm size reset; wm density reset`.
  Check tall sheets at a short phone's size, not only at the emulator's.
- **[read] Cause: the tour wrapper takes the sheet's style.** `MultiTourSteps` wraps a tour step in a View and
  moves most of the child's style onto it, `maxHeight: "80%"` included. The wrapper was capped; the sheet
  inside kept its full height and overflowed. Only Manage Workout's picker passes a tour prefix, so only there
  is the sheet wrapped (the active-workout picker never had the bug). Since TICKET-043 (e45837f).
- **[run] A guessed fix did nothing:** `flexShrink` on the sheet's list could not help while the sheet itself
  was unconstrained. Removing the tour wrapper as a probe showed the cap working, which located the cause.
- **[run] The unit test needed the Manage Workout prefix.** Without `tourStepPrefix` the sheet is not a tour
  step, there is no wrapper, and the test passed against the bug. It goes red with the fix removed.
- **[run] Checked at phone size:** Bench Press sheet shows Add, its options scroll down to Side, Add puts
  Bench Press · Machine in the plan (removed again, not saved); Lat Pulldown's sheet still sizes to its content.
  **Not run:** the guided tour's highlight of the sheet (it measures the wrapper, whose style did not change);
  iOS.
- **[run] Plan sheet with many plans (review question):** a long list doesn't push the "New plan" field up,
  because only the list (`flexShrink: 1`) gives way under the sheet's cap. To test "more plans than fit"
  without creating plans, shrink the screen instead (`wm size 1080x1700`, 393×618 dp): field and Create
  stayed visible, the list squeezed to a sliver.

### PR #72 review suggestions (emulator, `pinky`, 2026-11-17)
- **[run] Each keyboard-dismiss site seen failing on its own:** removing `Keyboard.dismiss()` from `pickCustom`
  failed the picker test at the custom-exercise press, from `openMenu` at the filter press, and from the Plan
  sheet's row the new AddExerciseScreen test. The spy is cleared before each press, so one site can't cover
  another.
- **[run] `ScrollableScreen` screens checked after the change:** an active workout's set input (number pad up,
  input and Log set visible; workout discarded, nothing logged) and Profile → Sign-in & Security's Confirm
  password, the lowest field, which scrolled up into view above the keyboard (nothing saved).

### TICKET-091: change an exercise's units mid-workout (emulator, `pinky`, 2026-11-17)
- **[run] Android does not repaint a mounted `TextInput` when only its placeholder changes.** After a unit
  change the inputs went blank: the new unit ("km") and the new ghost number never showed. 886 jest tests
  passed with it, because jest has no native repaint; only the screenshot showed it, on the first unit change.
  Fixed by keying each `RowInput` by field name and unit so it remounts. Not covered by a unit test; checked
  km ↔ m on device. Any prop that only a placeholder carries needs a screenshot after it changes.
- **[read] The board's notice for Farmer's Walk had no code path.** `ghostNotice` judges a weight and reps
  pair; Farmer's Walk (weight and distance) got "No weight and reps to target" and never a unit notice. The
  notice and its button are now decided by `unitMismatch` (role and position matching), not `ghostNotice`.
- **[run] Two existing tests broke for a reason unrelated to the logic:** `getByLabelText(/^Weight/)` also
  matched the new `Weight unit: kg. Change unit` button. A new control whose label starts like an input's
  breaks loose regexes; label it so it doesn't, or tighten the queries (done: `/^Weight · /`).
- **[run] Mutation-checked, each test red for the reason it names:** store action (role check, sets dropped,
  `planned` cleared, no-op write, unit-less field), helper (position match, example unit, role filter, count),
  screens (label not a button, note shown at 0 sets, tap does nothing, Done, stepper). The `!field.unit`
  refusal survived the first test set: `Notes: kg` was already caught by the role check. Added a weight field
  with no unit. A split-label test was deleted: no mutation could fail it.
- **[run] Device, Freestyle (the workout is local until Finish; correction: the last session of the day was finished by a mistaken tap, see the [waste] entry below):** Bench Press · Machine in
  kg shows "Last time was in plates (…)" and Use plates; one tap relabels, the set's 8 stays 8, the delta and
  Last-time pill return. ▾ and ⋯ → Units at set 2 (Swap and Remove locked, Units not); sheet note says
  "8 plates × 15 becomes 8 kg × 15" before the tap. lb → "Use kg" offered. Swap after setting lb: the new slot
  is fresh kg, nothing carried; Use plates then applied. Farmer's Walk: two ▾ labels, two blocks, distance
  has no stepper, km does not touch weight.
- **[run] Review follow-up, same day:**
  - *The placeholder fix was incomplete.* Keying inputs by unit left Reps blank after a unit change: it has no
    unit, but its ghost came and went. Keying by placeholder would have fixed it and would also remount a
    focused input when history arrives mid-typing, closing the keyboard. Final: `RowInput` remounts only when
    its placeholder changed and it is not focused. Device: typed 40 with the keyboard up, tapped Use plates,
    kept 40 and the keyboard, and Reps showed its ghost.
  - *A 3-field label cannot be reproduced without a 3-field exercise.* `wm density 770` breaks the whole
    layout, and system font scale does not scale this app's text. Checked by temporarily capping the label cell
    at 100 dp (reverted): the name shortened to "WEI…", the unit stayed whole.
  - History sheet after a unit change shows "8 plates × 15 = matched": the ticket's first load-bearing fact,
    now seen on device.
- **[run] The button was cut after the user saw it on the emulator** (2026-11-17): the line is clear, the
  button crowded the card. Unit tests had passed with it; only the screenshot showed the cost. The helper
  became `unitNotice` (a string), with `units` and `buttonLabel` deleted rather than left unused.
- **[waste] A blind tap sequence finished and saved a test workout on `pinky`.** After a hot reload the app
  came back on the Workout hub, not the logger; a tap meant for the Units sheet's Done sat at the same
  screen position as **Finish workout**, and the run ended with "Saved · Freestyle · 477 min". The rule in
  this file ("re-screenshot before each tap; a blind loop of taps opened the History sheet") was already
  written and I did not follow it. Do not chain taps after anything that can reload the app.
- **[run] Cleanup of that session on `pinky`** (user approved, 2026-11-17). No script deletes one session
  (TICKET-086 is unbuilt) and `wipeTestData.ts` deletes every user's data, so a throwaway untracked script
  was used: dry run listing exactly two docs (the `sessions` doc and its `exercise_sessions` doc), JSON backup,
  `--confirm`, read back (0 left). `compareHistory.ts` then showed one mismatch, the `bench_press__machine`
  rollup still holding the deleted session; `rebuildExerciseStats.ts <uid> bench_press__machine --confirm`
  (its dry run listed no unreadable sessions, so no best was lowered); compare again: 0 mismatches. The
  emulator's held summaries still offered "Last logged: Machine, 17 Nov" until the next check (a hard delete
  is invisible to the change check, as noted above). The rebuild's dry run prints only "would write", not the
  difference: `compareHistory.ts` is what shows it.
- **[read] Not verified:** the two-fields-differ notice ("Use last time's units") on device: pinky has no
  Farmer's Walk history (unit test only); the rest panel notice on device (screen test only); light theme;
  iOS; a narrow phone (the emulator is 448 dp wide). The distance chips are 124 px against the weight chips'
  120 on the 404 px screenshot: the board's grid is thirds minus the gap, mine is `maxWidth: 33%`.

### TICKET-085a stage 1: History home shell (emulator, `pinky`, 2026-11-17)

Built and unit-tested only; nothing here has been seen on the emulator. To run: hub, **History** (it was **History (new)** until TICKET-085b made it the entry).
1. Opens on Workouts, All workouts; Exercises is greyed and does not switch.
2. Filter pill → sheet lists All workouts and each plan with "N on this phone"; choosing one narrows the list; the pill shows its name; open Session and Back, the filter is still set.
3. Tap a workout → placeholder with its name and date; Back returns. Tap two different workouts in a row: two screens (per-session `getId`), not one moved.
4. Finish a workout offline: the strip says "1 workout waiting to upload"; online it goes. A rejected upload (rules) shows "didn't upload" with **Try again**.
5. Airplane mode, cold start: the saved workouts show, the strip says the check failed (not "Offline", see TICKET-085a deviations).
6. Debug builds: the hub's debug row has History Debug and Plans Store only.
Untested: all of the above on a device; the per-session `getId` (the test stack replaces the navigator, so no test covers it; mutating it left every test green); iOS is not raised (Android first).
- **[run] Passed on the emulator:** plan items 1, 2, 3, 5, 6, and scrolling to the last workout. Item 4 (the "waiting to upload" and "didn't upload" notices) is **pending, deferred by the user (2026-11-17)**: it needs a test workout written to `pinky`, and nothing in the app deletes one. Run it once TICKET-086 (Delete a Workout) is built. Until then these notices are covered by `historyNotice.test.ts` and the screen test only.
- **[bug] Found only on the device, all fixed:** (a) the third hub pill squeezed "Workout" to one letter a line, so "History (new)" has its own row; (b) a blank band above History, the Layout already owns the safe-area inset and the screens added it again; (c) the offline strip wrapped to two lines, now "Couldn't check for new workouts"; (d) **the list did not scroll** (a `View` with `.map`; the user saw it, I had called items 1 to 3 passed from screenshots without scrolling, and the last row was already cut off in them). Now a `FlatList`. No unit test covers the scroll: jest does not lay out.


### TICKET-085a stage 2: the Workouts rail (emulator, `pinky`, 2026-11-17)

- **[run] Passed on the emulator, read-only** (`pinky` has 17 workouts, all inside the window, so `windowStart` is null): the current month in full (November, then October to the 10-workout minimum, split), amber dots and "4 better", capsules with the up marker for a better lift, Earlier rows "October · 6 more workouts" and "September · 1 workout", October opened in place (chevron flips, its workouts continue under the row), the list ending "Your first workout, 29 September 2026".
- **[pending] Not run on a device:** the **Older workouts** row, its states (loading, "needs a connection", failed), paging per filter, quiet gap lines, and a Finish on another phone appearing on the next check. All of them need history past the window: dummy data on `pinky`, created and removed by a script with `--dry-run` (as 088 did) and, per the same deferral as stage 1, a delete. Covered by unit tests only: `historyRail.test.ts`, `getOlderWorkoutsPage` in `workoutSessions.test.ts`, `loadOlder` in `useRecentWorkoutsStore.test.ts`, and the screen test.
- **[waste] Two taps landed on the wrong row** because I scaled a smaller screenshot by the 1344-px factor (3.33) instead of its own (3.74); the Session placeholder opened. Derive the factor from each image's width.
- **[read] Not measured:** the proof's read counts and the "20 workouts of 8 lifts scroll without dropped frames" check. Neither was run.

- **[run] Older workouts, device-tested later the same day (2026-11-18), read-only.** `pinky`'s 17 workouts fit the 180 window, so `WORKOUTS_ON_PHONE_MIN` was set to 8 in a local, uncommitted edit (reverted) and the app reloaded: the store held 16 workouts from 1 Oct, one past the window. Passed: the **Older workouts · Show 20** row under Earlier; a tap loaded the 29 Sep workout ("First time"), then the list ended "Your first workout, 29 September 2026"; the plan filter (Chest & Triceps AJ) keeps its own older list, so Show 20 appears again there and its tap loads the same 29 Sep workout; wifi and data off, tap: "Loading…" for about the wait (10 s), then "Needs a connection"; wifi back: the first tap went straight back to "Needs a connection" (the SDK was still reconnecting, about 6 s after enabling), the second tap loaded the page.
- **[pending] Still not run on a device:** "Needs a connection, still trying" (not seen: the read failed before its wait ran out), "Could not load · try again", gap lines (`pinky` has no empty month past the window), the "waiting to upload" and "didn't upload" notices (need a written workout, wait for TICKET-086), a Finish on another phone, reads per tap and the 20-workout scroll check.
- **[run] Review fixes (PR #75), unit-tested only:** the clock re-read on foregrounding and a plan's older workouts derived from All's list once All reached the start (each test seen to fail with its fix broken). The memo on the rail row is not measured on a device.

### TICKET-083 stages 1 to 3: the Session screen (unit-tested only, nothing seen on the emulator, 2026-11-18)

To run, from the History home (hub, **History**; it was **History (new)** until TICKET-085b). Compare each screenshot to boards `HistSession01` to `17`.
1. Tap a workout in the current month: headline ("X beat last time."), counts line, one card per lift with its word, captions and set chips. No read happens (a held workout).
2. Tap a card: the compare opens, Today beside up to three earlier sessions, one row per set number; a split set makes its row taller and the columns stay aligned. Tap again: it closes. A lift with more than the closed-card limit of sets shows "+N".
3. A lift that beat last time: amber edge and word; a set better or lower than the same set last time has its arrow; a unit-changed lift reads "Unit changed" with "Changed from kg to lb" under its name (or the word alone when last time is no longer held).
4. ⋯ → **Add a note**: type, Save; the note shows above the headline and is still there after Back and reopening. ⋯ → **Edit note** shows the text; saving an empty box removes it. Airplane mode, Save: "Needs a connection to save a note." and the sheet stays. A note past the limit cannot be saved.
5. ⋯ on a workout waiting to upload: Add a note is greyed with its reason. Edit session and Delete session are greyed (086).
6. An older workout (from **Older workouts** on the home) opens from memory; an id the phone does not hold is read once ("needs a connection" offline, Try again).
- **[pending] Not run:** all of the above; the per-set arrows and compare columns at a real phone width (cells hold "62.5 kg × 8" with its unit, the board shows the number and "×8" only, so a 4-column row may wrap); the closed-card limit against boards 07 and 12, which disagree (a width-dependent rule on the boards, a fixed count in code); the note write against Firestore (the transaction is mocked; the rules file allows it, nothing was deployed); waiting and did-not-upload states (need a written workout, as stage 1).
- **[deviation] From the boards:** the headline is bold throughout (bold-only weights, the board bolds only the names); "No lift beat last time." is my wording (no board shows it); the compare shows each earlier session's unit (never converted) where the board drops it.

### TICKET-083 stage 4: the Finish landing (unit-tested only, nothing seen on the emulator, 2026-11-18)

1. Finish online from the **Workout stack** (hub → Start → log a set → Finish): you land on that workout's Session with **Workout saved** beside the date; no "Saved" toast. Back goes to the History home, Back again to the hub.
2. Same from the **Log Workout footer tab**. The footer then lights Workout, not Log Workout.
3. Finish **offline**: you land on the Session with "Not uploaded yet" and no "Workout saved". Go online: the notice goes and the "Saved" toast appears (the upload landed after Finish returned).
4. Finish when the server rejects the upload: the Session says "Didn't upload" with Retry; the existing "Saved on this phone, upload failed" alert still shows.
5. Discard still goes to the hub. A Finish with no sets logged is refused and stays on the logger.
6. Footer highlight on other paths (it is derived now): hub → Start → begin a workout lights **Log Workout** (the logger is the front screen); back to the hub lights Workout; Home and Feed taps light themselves.
- **[pending] Not run:** all of the above. The reset of a mounted Workout stack and the Layout-level `popTo` with a `state` param are checked on the real navigators in `LayoutScreen.test.tsx`, with a hand-made dispatch standing in for the logger; the logger's own dispatch is checked only against stub stacks (it lands on Session), so the **Back chain from a real Finish** is unverified. A Finish whose queue write fails (the workout returns to the active slot) could briefly navigate away first: an old hazard, now towards the Session instead of the hub.
- **[deviation] TICKET-025 closed in part:** the footer highlight is derived from navigation state for every path, not only this one (the path fix would have been a special case in the same listener). Rule for the logger, registered in both stacks: it lights Log Workout wherever it is; the rest of the Workout stack lights Workout. 025's header Home/Profile taps and the first acceptance item are covered by tests; the ticket stays OPEN for the user to close.

### TICKET-083 device run (emulator, `pinky`, 2026-11-18)

- **[run] Passed:** Session from the home (cards, words, captions, chips, arrows, effort marks, split set, imported workout with no minutes); the compare from a cold start; "Unit changed" with "Changed from plates to kg"; the options sheet in all three states (note, switched-off Edit and Delete, Add a note greyed for a queued workout); a note saved, shown, kept across Back and reopen, seen on the server, and removed (the field is gone on the server); the offline refusal; Finish from the Workout stack and from the Log Workout tab (lands on the Session with "Workout saved", no toast, Back to the home and then the hub, footer on Workout, logger lights Log Workout); Finish offline ("Not uploaded yet", no "Workout saved"), then reconnect (the Session follows the queue to held by itself, the late "Saved" toast shows as well); an older workout opened after **Older workouts** (with the temporary `WORKOUTS_ON_PHONE_MIN` edit, reverted).
- **[bug] Found and fixed:** the compare said "not loaded yet" beside a Better word after a cold start (the summaries store was never opened); the headline said "No lift beat last time." when nothing was compared (now "Nothing to compare with last time."); a note on a workout the server does not have said "Try again" (now says the server does not have it). The stale Freestyle workout of 17 Nov is a phone-held copy of a doc removed by an admin script: the server sent no delete marker, so it stays until a full reload.
- **[pending] Not run:** the "Didn't upload" notice and Retry (needs a server rejection); the read by id (no screen path reaches it); a side-by-side with the boards (known differences: units in the compare cells make them wrap, the headline is bold throughout).
- **[write] The run wrote** three Test 070 workouts to `pinky` (sessions and exercise_sessions docs, and the hip-stretch rollup). The app cannot delete them; a cleanup script (dry run listing the three ids) and `rebuildExerciseStats` for that exercise are waiting on the user's go-ahead.

### TICKET-083 PR #76 review fixes (unit-tested only, 2026-11-18)

- A Finish whose queue write fails no longer lands on a Session with no workout behind it: the landing waits for `queuedSessionId` (set after the queue write succeeds). Seen to fail with the wait removed. **Not run on a device:** a real failed disk write cannot be produced on the emulator; the screen tests drive the guard with an `endWorkout` double.
- A workout that was waiting and lands later no longer shows "Workout saved" beside the "Saved" toast. The first version (the Session remembering it had shown "not uploaded") hid the banner on every online Finish too, because the Session mounts while the workout is still queued; pass 2 of the review caught it. Now the store records which uploads showed the toast (`toastedSessionId`) and the Session says "Workout saved" only when the toast did not. **[run] Passed on the emulator (2026-11-18, `pinky`):** an online Finish shows "Workout saved" and no "Saved" toast; an offline Finish then reconnect shows the "Saved" toast, the notice goes, and no banner.
- **[write] The review-fix runs wrote two more Test 070 workouts to `pinky`** (five in all, with the three from the device run); the cleanup is still waiting on the owner.
- `getWorkoutById`, `setWorkoutNote` and `loadSession` have their own tests (each seen to fail when its line is broken). The read by id has still never run against Firestore or on a device.

### TICKET-084 stage 1: the Exercise log (emulator, `pinky`, 2026-11-20; unit tests 2026-11-19)

To run: History home → a workout → tap a lift card to open its compare → **<Lift> history ›** under it. Compare each screenshot to boards `HistExercise05` to `12`.
1. The screen opens on "History · Bench Press": the newest session's average weight as the figure ("Average weight · last session"), then the log newest first. No read happens (held workouts only).
2. Each row: the date, its average weight under it, one column per set with the effort badge (H or E). The newest row has a dot and a raised background. Freestyle sessions say "Freestyle"; a drop set says "Drop set" and shows its split rows under the set.
3. The table has as many columns as the newest session had sets. A longer older session shows "+N" for the sets that do not fit. The set columns share the width but are never narrower than a floor (a value, an H badge and a mark need about that much), so with more than three they scroll sideways with the date column staying put.
4. A lift logged in kg and later in lb: a line between them ("Before this the sets were in kg, so they are not compared") with its own Date and Set header above the older block.
5. Tap a row: that workout's Session. Back returns with the log where it was.
6. A queued workout with this lift: the strip says "1 workout waiting to upload"; after a rejection "1 workout didn't upload" with Try again. A queued workout without this lift: no strip.
7. A lift none of the held workouts has (done only before the window): "No sessions of this exercise in the workouts on this phone." Stage 3 pages past the window.
- **[pending] Not run:** all of the above on a device. In particular the layout at a real phone width: row heights are fixed (the date column and the set columns are two stacks that must line up), so a larger system font could misalign them; the waiting and did-not-upload strips need a written workout (wait for TICKET-086); a workout whose lifts could not be read shows "N workouts with this exercise could not be read" (unit-tested, not seen).
- **[deviation] From the board:** the tap on the compare's link says "<Lift> history" as the board does; the options icon, the graph and the measure label's chevron are absent until stages 2 and 4. The "N could not be read" line and the empty-state sentence are mine (no board shows them).

**Device run, 2026-11-20 (emulator, `pinky`, read-only: nothing was written).**
- **[run] Passed:** the **<Lift> history** link under an open compare opens the screen; the figure, rows, dot on the newest, pinned date column and set columns (Lateral Raise, 3 sets, kg); a row tap opens that day's Session, and Back retraces the stack and keeps the History home's scroll; a drop set (Leg Extension: the split rows under the set, "Drop set" under the date, rows still aligned, the average counting each set's first weight); 4 columns with older 3-set rows leaving Set 4 empty (Bent-Over Row); at 393 dp (`wm size 1080x2340`, density 440) the fourth column peeks in, a swipe scrolls the sets with the date column pinned and rows aligned; a unit break (Seated Row kg then plates; Bench Press · Machine plates then kg) with its own Date and Set header; a lift with no weight (90/90 Hip Stretch): figure "–", "No weight to average", "–" per row; the Freestyle caption; older 3-set rows under a 1-set newest session show "+2".
- **[measured] Reads:** from the History home visit through a Session to the Exercise screen, every check in the Plans Store log read "skipped" (the 60 s throttle); the Exercise screen added no check and no query. The one billed read around it (1 query, 0 docs) was the hub's own change check just before. A visit after the throttle expires costs the store's 1-read change check, as every History screen does; the log itself reads nothing.
- **[bug] Found and fixed:** (1) a set cell read "8 kg × 10" and cut off its H badge at 3 shared columns: cells are now "8 ×10" with the unit in the date column (as the board); a lift with no weight × reps pair keeps the unit in the cell. (2) Several sessions on one day all read "18 Nov": the clock `compareHeaders` adds did not fit the 58 dp of the date column and was cut off; the year and clock now stack under the date. (3) A word unit ("plates") was cut to nothing under the date: rows write only a symbol unit (kg, lb); a word unit stays on the figure and the break line. (4) "Freestyle" was cut to "Freestyl": captions shrink to one line. Each seen failing in a test where a test could see it (1, 2, 3).
- **[pending] Not run:** the "waiting to upload" and "didn't upload" strips (need a written workout, and there is no delete until 086; the user deferred the same item for 085a); "No sessions of this exercise in the workouts on this phone." and "N workouts … could not be read" (`pinky`'s window holds every workout, and no unreadable `lifts` exist: unit-tested only); more than 4 set columns (no lift in `pinky` has 5 sets).
- **[gap, deferred to TICKET-092 by the user, 2026-11-20] A lift with no weight shows the measure "Average weight" and "–".** The board has no state for a time or distance lift. Inventing its measure (total time? best set?) would be a guess; raised for stage 4's measure sheet, where the measure options are decided.
- **[bug] Found by the user on their screen, fixed and seen on the emulator (2026-11-20):** (5) a set read "15 ×15", with no space after the ×: now "15 × 15", as everywhere else in the app (test updated). (6) The average sat on the row's bottom border: the row height (50) was 8 dp short of the date line, the average line and the padding (58). (7) My fix for the Freestyle caption (shrink to fit) made "Drop set" unreadably small on their screen: replaced by 2 dp more room in the date column, no shrinking. Seen on the emulator for Cable Crossover (a drop set) and Bench Press · Machine (Freestyle).

### TICKET-084 stage 2: the graph (emulator, `pinky`, read-only, 2026-11-20)

To run: any lift's Exercise screen. Compare to boards `HistExercise01`, `09`, `10`.
1. A lift with 5 or more sessions: a line across its newest sessions (up to the named limit), a dot each, the highest and lowest value written above their dots, the newest dot larger with a guide line, "Oct 1 · last 5 sessions · Oct 29" under it.
2. Tap a dot: it turns amber and a one-line card (date, value) appears in the top corner away from it. Tap the card: that session's workout. Tap the same dot again or anywhere else on the graph: the card closes.
3. Fewer than 5 sessions: "The graph starts after 5 sessions. N so far." and no graph.
4. A lift that changed weight unit: each unit has its own scale, a line between them, and its unit written over it.
5. A lift with no weight (a time hold): "There is no weight in these sessions to graph."
- **[run] Passed:** 1 (Bent-Over Row: 5 sessions, 46.7 and 40 labelled), 2 (card pinned top-left, off the line and off the "46.7" label; the card opened the 15 Oct Session), 3 (Cable Crossover: "4 so far"), 4 (Seated Row: one kg point labelled 33.3, a break, a flat run of plates sitting mid-chart labelled 11, "kg" and "plates" over each), 5 (90/90 Hip Stretch).
- **[bug] Found on the emulator and fixed:** the card first sat beside the dot, covered the line on both sides of the peak and hid the peak's own label; a first fix (try four places around the dot, take the least overlap) still did, since in a graph this short every place around the dot touches the line. It is now a single line pinned to a top corner, chosen to avoid the line and the labels. The corner choice is tested; a test that "moves the card off the peak" first passed with the logic switched off (a weak mutation), so it was replaced.
- **[pending] Not run:** a graph with a missing value in the middle (a break in the line): unit-tested, and `pinky` has no such lift; more than 10 sessions (the limit; unit-tested, `pinky`'s most-done lift has 6); more than two unit runs.
- **[deviation] From the board:** the break between two units is a solid hairline where the board dashes it (a dashed border is not reliable on Android); the peek card is a corner chip, as above (no board shows one); a time lift's "–" figure and this message are unchanged from stage 1's gap (its own measure is stage 4's decision).

### TICKET-084 stage 3: the log past the window (emulator, `pinky`, read-only, 2026-11-20; index deployed and run)

To run, once the index is deployed (`firebase deploy --only firestore:indexes`, from the user): `pinky`'s history fits the window, so lower `WORKOUTS_ON_PHONE_MIN` locally (as 085a's run did; do not commit it), reload the app, then Plans Store → **Workouts: full reload now**. Open a lift whose first sessions fall before the window.
1. At the end of the log: **Older sessions · Show 20** (the same row wording as the History home's Older workouts). Tap: the sessions appear in the log, in order, and feed the graph; Plans Store → "Reads billed" went up by the number of sessions loaded (a page is at most 20).
2. When a page comes back short, the row goes: that is the lift's first session. Tapping the row again after loading to the start reads nothing.
3. Open the History home's **Older workouts** first, then a lift: the lift's page starts below what the home loaded (no document read twice); once the home reached the first workout the lift has no row at all.
4. Airplane mode, tap the row: "Loading…", then "Needs a connection"; what was loaded stays; wifi back and tap again loads it.
5. A lift none of the held workouts has, history past the window: "No sessions of this exercise in the workouts on this phone." with the row under it; the whole history held: "No sessions of this exercise." and no row.
- **[run] Passed on the emulator:** the row appears at the end of the log once the window is lowered (Cable Crossover); tap: "Could not load · try again" because the index is not deployed (confirmed with the admin SDK: `FAILED_PRECONDITION: The query requires an index`, and the console link's fields are `exerciseIds` array-contains + `startedAt` descending, as in `firestore.indexes.json`); airplane mode: "Loading…", then "Needs a connection", the log kept.
- **[pending] Not run:** a page that loads (needs the index), the short page ending the log, the home-then-lift cursor, reads billed per page, "Needs a connection, still trying" (the refusal came before its wait ran out), a Finish during paging. All unit-tested: the store (cursor from the window, the home's list and the lift's own pages; the start inferred from the home's list; pages add up and bill; each lift keeps its own answer; offline and failed), the service query (the lift filter), the row's words and the screen.
- **[write] None:** read-only. The run did lower `pinky`'s phone-held window to 8 workouts (local copy only, restored by a full reload); the constant is reverted in the tree.
- **[note] The instrument is the existing Plans Store page:** `bill()` counts each page's documents into "Reads billed", so no new TEMPORARY counter was added (CLAUDE.md 3.3 met by what 085a built).

**Stage 3 device run with the index live (2026-11-20, emulator, `pinky`, read-only).** The user created the composite index in the console (their first attempt saved field 2 as `sessions`; the second is `exerciseIds` array-contains + `startedAt` descending, READY; the admin query returns the 5 Cable Crossover documents). The service account may list indexes but not create them (403), so the user made it.
- **[run] Passed (window lowered to 8 locally, reverted):** steps 1 and 2: Cable Crossover held 4 sessions and the row said Show 20; one tap loaded the 29 Sep session into the log, the graph then drew (5 sessions, the label on the newest of the two equal values), and the row went because the page came back short. **Reads billed went to 2: the History home's change check (1) and the page's one document (1).** Step 3: after the History home's Older workouts had loaded to "Your first workout, 29 September 2026", the lift opened with all 5 sessions, the graph and no row, and **Reads billed was 3: two change checks and the home's one document; the lift cost none.**
- **[pending] Still not run:** "Needs a connection, still trying" (the offline refusal came before the wait ran out, both times); a full page of 20 (`pinky` has at most 5 sessions of a lift); a Finish while a page is loading.
- **[cleanup, user] A wrong index remains in the console** (`exerciseIds | sessions`): READY, indexes a field that does not exist, harmless; delete it.

### TICKET-084 stage 4: view options, Total lifted and the set marks (emulator, `pinky`, read-only, 2026-11-20)

To run: any lift's Exercise screen (Bent-Over Row has 5 sessions, 4 sets, a hard set and marks). Compare to boards `HistExercise02`, `03`, `04`, `05`, `06`.
1. Header: the options icon (right) and the measure label with its chevron ("Average weight ⌄ · last session"). The icon has a dot only while something is not the default.
2. Each set shows an amber ▲ when it beat the same-numbered set in the session just older, a muted ▼ when it went down, nothing otherwise; the oldest session loaded has none.
3. Tap the options icon: **Measure** (Average weight, Total lifted), **Show** (Graph and list, Graph, List), **Sessions shown** (Last 5, 10, 20, All), **Details** switches (Effort badges, Better / lower marks). Each change applies at once behind the sheet.
4. Total lifted: the figure ("1,870 kg"), the graph's labels and each row's number under its date are weight × reps over every set, a drop set's later segments included.
5. Graph: a taller graph and no log. List: no graph. Last 5: only the newest five rows, and no Older sessions row when five are already shown; All: every session loaded, and the row back.
6. Tap the measure label: a sheet with both measures and what each means.
7. Leave the lift and open it again: every setting is back to its default.
- **[run] Passed, all seven**, on Bent-Over Row, 29 Oct session. Total checked by hand: 30×15 + 40×12 + 50×10 + 55×8 = 1,870 (the figure and the graph's high label); the lower rows 1,590, 1,550, 1,565, 1,455 follow the same sum.
- **[bug] Found on the emulator and fixed:** (1) cells ran into each other at 4 columns once marks were on ("50 × 10 ▾50 × 9 H ▾"): the set columns now share the width but never go under a floor wide enough for a value, a badge and a mark, and scroll sideways when they do not fit (this replaced the old "3 share, more scroll at a fixed width" rule); (2) a total's unit was cut off under the date ("1,870" for "1,870 kg"): the unit is now written smaller than the number, as the board has it. Each seen on the device; no test could see either (layout).
- **[omission, mine] Stage 1 left out the per-set marks the boards show in every log cell** (and the Details switch for them): they were never on the screen until now. They are in the ticket's own list ("per-set marks"); I should have found them when reading the boards for stage 1.
- **[pending] Not run:** the options sheet at a phone width narrower than the emulator's (the segmented choices at 393 dp); a lift with no weight under the options (its reason line reads "No weight to total": unit-tested, not seen); 5 or more set columns with marks (no lift in `pinky` has that).
- **[deviation] From the boards:** the measure choices open as a bottom sheet (the board anchors a small popup under the label); the sessions count limits both the graph and the log (the board shows one count and does not say); Details switches are the platform's Switch, not the board's drawn one.

### TICKET-084 PR #77 review fixes (unit-tested; each seen failing with its fix broken, 2026-11-20)

- The table's columns come from the newest session that has sets; a set's mark is against the previous session, never the other slot of its own workout; one date label per workout; a row's spoken label carries its numbers, sets, effort and marks; the screen ignores older lists loaded before the window moved; a page that lands after the window moved is dropped. One test (the slot mark) first passed with the fix broken, because its numbers gave the same answer either way; it was changed until it failed.
- **[pending] Not run:** the spoken labels with TalkBack (their text is checked, not how a screen reader reads it aloud); the 48 dp touch area of the sheet's choices (set as a hit slop, not measured).
- **Also (user's call, 2026-11-20): the History home's `loadOlder` drops a page that lands after the window moved**, as `loadOlderExercise` does; unit-tested and seen failing without the guard. Not run on a device (a window moving mid-read cannot be produced on the emulator).
- **Pass 2 (2026-11-20): the 48 dp touch area is now a real 48 dp touchable** (the pass-1 hit slop could not extend past its 36 dp parent, so it did nothing); the spoken labels name the measure and the sets row its date. **Run on the emulator:** a tap 11 px above the drawn "Last 5" pill (outside its edge, inside the new target) selected it. Not run: TalkBack.

### TICKET-085b: the switch and the old page removed (emulator, `pinky`, read-only, 2026-11-20)

To run: Workout tab, **History**.
1. The hub's header has **Plans** and **History** only; no "History (new)".
2. History opens the home on **Workouts**, **All workouts**; Exercises is greyed.
3. Tap a workout: its Session. Back returns to the home with the same list; Back again, the hub.
4. Choose a plan in the filter, Back to the hub, History again: **All workouts** (the home is a fresh visit).
5. Session, open a lift's card, **<Lift> history**, then Back three times: Session, the home, the hub.
6. Airplane mode, force-stop, cold start (with `adb reverse tcp:8081 tcp:8081`): hub, History shows the workouts and the strip "Couldn't check for new workouts"; Plans Store → Recent workouts store → **Reads billed**.
- **[run] Passed, all six**, on a build with the old page already deleted. Session: Shoulders AJ, 30 Oct; lift: Shoulder Press · Machine (4 sessions, "The graph starts after 5 sessions. 4 so far."); filter: Back & Biceps AJ.
- **[run] The ticket's proof: offline cold start shows Workouts, Reads billed 0 this app run.** The Plans store's own line reads "Server reads: 2 this app run": two failed attempts (its error text is on the page), not billed documents; that counter is the plans store's, not the History home's.
- **[write] None:** read-only.
- **[pending] Not run:** a Finish landing on the home then the Session (a write to the real database, not asked for; the `LayoutScreen` test covers the stack); the empty state's "Start a workout" (`pinky` has workouts, so the empty state cannot be reached without deleting them); a `TypeError: Cannot convert undefined value to object` in the logcat, 3 lines from before this work began, none added by this run; not traced.
- **[note] The offline cold start repeats what earlier entries recorded:** the Feed reads "Hi, Guest" and a dev-only LogBox shows Firestore's "Could not reach Cloud Firestore backend"; dismissed, not an app error.
- **[note] No instrument built:** removing code adds nothing to observe (CLAUDE.md 3.3 skipped, said so in the ticket).

## TICKET-086 stages 1 and 2: delete a workout, data layer (2026-11-21)

No screen yet; nothing to see on a phone. Checked by unit tests only.

- **[unit] Passed (1037 tests, typecheck clean):** `mergeSummaries` with a `deleted` marker (newer or equal removes, older ignored, a later Finish restores); a Finish onto a marker starts the lift from nothing; `summaryWithout` (a typo's best gone, only session gives null, markers and the deleted workout left out, an unreadable session refuses); `deleteWorkout` (marker, `exercise_sessions` docs deleted, replace not merge, marker for a lift with none left, offline writes nothing, old shape refuses, already deleted writes nothing, dry run); the compare script reads a deleted workout and a stats marker as absent. Each test was seen failing with its line broken.
- **[pending] Not run on Firestore:** the transaction, the server stamp on the markers, another phone's change check dropping the workout and the summary, and the read count for a lift with about 100 sessions (the ticket's proof, needs stage 3's button or a dry-run script on `pinky`).
- **[note] Scripts:** `compareHistory.ts` will report one verdict mismatch per lift the deleted workout touched (the next session's verdict is not rewritten, TICKET-095); the other lists should stay at 0.

## TICKET-086 stage 3: Delete session, the phone side (2026-11-21)

**Unit [run], 1045 tests, typecheck clean.** New: `removeFromWindow` (floor moves to the plan's next newest with no lookup; a plan's only workout sends it to be looked up; a floor entry the window does not hold is dropped; an unheld id returns the same window), `applyDeleted` on both stores (window, floor, older lists, a lift's log, read by id; 0 reads; another user ignored), `withDeletedSummaries`, and the screen (Keep it deletes nothing; Delete calls the service, tells both stores, lands on the History home with no read by id; offline says so and keeps the workout). Each was seen failing with its line broken.

**Device plan [pending, needs the user's go-ahead: it writes to `pinky`'s real data].** Emulator, `pinky`, writes: one test workout finished and then deleted (a `sessions` marker, its `exercise_sessions` docs gone, the summaries of the lifts it used replaced). Pick a lift pinky has no history for, or one whose best the test workout will clearly set, so the record is visible.
1. Finish a test workout (one lift, one set at a weight above pinky's best for that lift). Session opens; open the lift's history: the new best shows.
2. ⋯ → **Delete session** → **Keep it**: dialog closes, nothing changes.
3. ⋯ → **Delete session** → **Delete**: lands on the History home; the workout is not in the list; the plan's date is the previous workout's. Plans Store → Recent workouts: Reads billed did not rise by a read of the deleted workout.
4. Open the lift's history: the test workout and its best are gone (back to the earlier best, or "First time" if it had none).
5. Airplane mode, open an older workout → ⋯ → Delete → **Delete**: "Needs a connection to delete a workout." and the workout is still there. Airplane off.
6. Force-stop, relaunch: the deleted workout does not come back (the marker is on the server and in the saved copy).
7. Finish a workout offline (waiting to upload): ⋯ shows Delete session switched off with its reason. This also runs 085a's open proof (the "waiting to upload" strip); let it upload, then delete it as in 3.
8. Run `compareHistory.ts <pinky uid>` (read-only): `exercise_stats`, `exercise_sessions` and orphan lists at 0; only verdict mismatches for the lifts the test workout shared with a later workout (none if it was the newest).
9. Two phones: not testable on one emulator; the other phone's check is covered by `mergeSummaries` and `addToWindow` marker tests only.

### TICKET-086 device run (emulator, `pinky`, 2026-11-21)

**Writes made (told up front, kept minimal):** two test workouts finished and then deleted: `Test 070` (a 45 s hip stretch, finished offline) and a Freestyle `Deadlift · Barbell` 100 kg x 5 (a lift `pinky` had never done). Left behind: 2 `deleted` markers on `sessions` docs and 1 `deleted` marker on `exercise_stats/deadlift__barbell`. Nothing else was written.

- **[run] Passed:** (2) Keep it closes the dialog, nothing changes. (3) Delete lands on the History home, the workout is not in the list. (5) Offline Delete: "Needs a connection to delete a workout.", the workout stays. (6) Force-stop and relaunch: neither deleted workout comes back. (7) A workout finished offline shows "Not uploaded yet" / "Saved on this phone" and its Delete session is switched off with its reason; after it uploaded, Delete was enabled. This is also 085a's open "waiting to upload" proof.
- **[run] Server, read-only, after each delete:** `Test 070` run: marker on the session, `exercise_sessions` 129 back to 128, the hip-stretch summary back to 6 sessions with last = 17 Nov. Deadlift run: marker on the session, `exercise_stats/deadlift__barbell` is a marker, its `exercise_sessions` 0. `compareHistory.ts`: 0 mismatches both times (22 and 23 sessions read, 21 live: the marker is not counted). Both deleted workouts were the newest of their lift, so no verdict mismatch was expected and none appeared.
- **[bug found and fixed] Back after a delete reached a dead Session.** `navigation.navigate(HistoryHome)` pushed a second home on top (React Navigation 7), leaving the deleted Session under it, which showed "Loading data" forever. Now `popTo`. Re-run on the fixed bundle (the Deadlift run, which lands from a Finish: hub, home, Session): delete, History home, Back, hub. The screen test fails with `navigate` and passes with `popTo`.
- **[pending] Not run:** (4) the lift's history in the app after the delete (covered by `withDeletedSummaries` unit tests and the server marker, not seen on screen); the plan tile's date after deleting the plan's newest workout, in the same app run (unit-tested in `removeFromWindow`; the tile read "3d" after a relaunch, from the server); the read count for a lift with about 100 sessions (the largest lift on `pinky` has 6); another phone's check seeing a delete (one emulator); the dialog and the error line at a phone narrower than the emulator.

### TICKET-086 review fixes (PR #79, pass 1)

**Unit [run], 1051 tests, typecheck clean; each new test seen failing with its line broken** (the F1 guard in the service and in the drain, the F2 stamp compare, both halves of the F5 ids, the F4 focus guard). `measureFinishOps` now pins 9 reads per Finish of 8 lifts (was 8): the F1 guard reads the workout doc.

**Device plan for the fixes [see the run below].** Emulator, `pinky`, writes: two more test workouts finished and deleted.
1. F1 on a device: finish a workout offline (Freestyle, a never-done lift), and with it still in the queue delete nothing; instead finish it online, delete it, then check the server shows no `exercise_sessions` doc and a marker (the replay path itself needs a second phone or a forced re-upload; unit-tested only).
2. Cost: Finish still lands "Workout saved"; Reads billed unchanged (the extra read is inside the Finish transaction, not billed to the History stores).
3. F4: "Deleting…" shows while the delete runs; Back mid-delete does not throw the user to the home.
4. A delete still lands on History and Back goes to the hub.

**[run] Device run of the review fixes (emulator, `pinky`, 2026-11-21, HEAD 12ce7e8 bundle).** Writes: one more Freestyle `Deadlift · Barbell` 110 kg x 5, finished then deleted (a third `sessions` marker; `exercise_stats/deadlift__barbell` ends as a marker again).
- **Passed:** a fresh app run reads the deleted lift as "First time on this exercise" (the stats marker, dropped by the full load). **A real Finish onto the stats marker** lands "Workout saved" and the server holds a whole summary (1 session, no flag; the deleted workout is not counted): the stage 1 guard and the new Finish transaction read, on a device. "Deleting…" shows while the delete runs. Delete lands on History, **Back goes to the hub** (the `popTo` fix, from a Finish landing). Server after: marker on the session, `exercise_stats` marker, `exercise_sessions` back to 128; `compareHistory.ts` 0 mismatches.
- **[pending] Not run on a device:** F1's replay itself (an upload of a workout deleted while it was queued) needs a queue entry that outlives its upload or a second phone: unit-tested in the service and in the drain only. Back mid-delete (F4's focus guard): unit-tested only; the delete is too quick to race by hand.

**PR #79 review pass 3 (2026-11-21).** `importHistory.ts` now filters deleted workouts (`liveSessions`) before rebuilding stats: unit-untested, not run (it writes to a real database; needs a confirmed run on `pinky`). New store tests: `useExerciseHistoryStore.applyDeleted` and the saved copy in `useRecentWorkoutsStore.applyDeleted`, each seen failing with its persist call / uid guard removed. Unit [run]: `tsc` clean.

## TICKET-096: Confirm before Finish workout (2026-11-21)

**Unit [run], 1059 tests, typecheck clean.** New: `finishSummary` (counts, nothing logged); the screen (Finish opens the dialog and saves nothing; Keep logging saves nothing; the confirmation's Finish saves once; the summary card counts exercises with no sets without naming them; all-logged shows one sentence and no card; no set logged skips the dialog and reaches the store's refusal). Seen failing with its line broken: the gate always saving, the gate always opening, the summary counting every exercise as logged (first pass); see the review fixes below for the rest. The existing Finish tests now tap the confirmation; the two-taps-in-one-frame test taps the confirmation twice.

**Device plan [run, results below]: the confirm path finishes and uploads a workout, so it wrote to `pinky`.** Emulator, `pinky`.
1. Start a Freestyle workout with two exercises, log one set on one. Tap Finish workout: the dialog shows "Will be saved 1 set · 1 exercise" and "No sets, left out 1 exercise", no yellow, Finish in the accent fill. **Keep logging**: closes, nothing saved, still on the logger.
2. Android Back while the dialog is open: closes it (as Keep logging), nothing saved. A tap outside the card does nothing, as in the Discard dialog.
3. Log a set on the second exercise, Finish workout: one sentence, "2 sets in 2 exercises will be saved.", no card. Finish: lands on the Session as before (writes one test workout; delete it after, 086).
4. A workout with no set logged: Finish workout shows "Could not save workout" with no dialog first.
5. Phone width narrower than the emulator and a large system font: the dialog text wraps, nothing clips.
6. Guided tour step "Finish Workout" still points at the button (tour notes go to TICKET-053: its text could now mention the confirmation).

### TICKET-096 device run (emulator, `pinky`, 2026-11-21)

**Writes made:** one test workout (`Test 070` plus an added Arnold Press, 30 s hip stretch and 8 kg x 15), finished through the new dialog and then deleted from History. Left behind: one `deleted` marker on a `sessions` doc and on the summaries of the two lifts. The narrow-phone part finished nothing: a workout started and discarded locally.

- **[run] Passed:** (1) one set on one of two exercises: "Will be saved 1 set · 1 exercise", "No sets, left out 1 exercise", no yellow, Finish in the accent fill; **Keep logging** closes it and nothing is saved. (2) Android Back closes the dialog, nothing saved (seen open, then closed). (3) Both exercises logged: "2 sets in 2 exercises will be saved." with no card; **Finish** lands on the Session with "Workout saved", as before. Deleting it from History (⋯, Delete session, Delete) removed it from the list. (4) No set logged: Finish shows "Nothing to save", no dialog first.
- **[bug found and fixed] The summary card's label and value touched** at 393 x 851 dp with the system font at 1.3 ("Will be saved1 set · 1 exercise"). The row had no gap. It has `gap: SPACING.medium` and both texts may shrink, so the longer one wraps ("Will be / saved", "1 set · 1 / exercise"). Seen on the device before and after. No unit test: it is layout.
- **[pending] Not run:** a tap outside the card (plan item 2's second half; the dialog has no backdrop press, from the Discard dialog's `AlertBase`, so it is by reading only); (6) the guided tour step (the tour is rewritten in TICKET-053); the server-side `compareHistory.ts` after the delete (the delete is seen in the app only); iOS.

### TICKET-096 review fixes (PR #80, pass 1)

**Unit [run], typecheck clean, full suite run before the push.** Fixed: (F1) a Finish already running makes `handleFinish` return, so a second dialog-Finish tap in one frame no longer clears the landing and sends the user to the hub (the two-taps test now asserts the Session route; the same bug existed with two footer taps on `origin/main`, the dialog added a second button that reaches it); (F2) Keep logging and the put-back after a failed write are asserted to leave no dialog; (F3) the card's values are `numeric`; (F4) spacing tokens and the board's 14 px message size; the card's radius stays the board's 12 (no token); (F5) doc slips; (F6) the dead `activeWorkout &&` guard and the `AlertBase` `children` comment.

**Each seen failing with its line broken:** F1 (guard removed: the two-taps test), F2 (`onKeep` a no-op: the saves-only-after test; `setConfirmFinish(false)` removed from `handleFinish`: the failed-write test). F3 and F4 are styling, read against the boards and not run on a device again.


## TICKET-097: Rest-over sound (Android, 2026-11-21)

**Unit [run], `tsc` clean.** The change is native (Kotlin) plus the copy and a stored sound preference: unit-tested only where it is TS (`buildRestCopy` names both channels and carries the sound, `restSoundStore` load and set; each seen failing with its line broken: `isRestSound` loosened to any string and `buildRestCopy`'s `sound` hardcoded, 3 tests went red, then restored, during the session and not recorded elsewhere). The Kotlin has no test harness (no JVM or Robolectric setup in the module); adding one was left out of this PR. The sound, the alarm, the Handler and the wake lock have no unit test: they need a device.

**Device plan [run on the emulator, 2026-11-21; phone run pending].** Android 16 emulator, a 1:30 rest from a 30 s hip stretch, `adb logcat | grep RestNotification`.
1. Rest runs to 0:00 with the screen on: `done via=handler first=true lateMs=10`, then the app's repeat `via=js first=false`. One sound.
2. Same with the screen off for the whole rest: the Handler at +71 ms (the emulator never suspends its CPU, so this says nothing about a phone). The inexact alarm (option A as first built) fired 58.9 s late: the reason for the wake lock.
3. After 0:00 rang, tap **+30s**: the countdown replaces the done post, and 30 s later `done via=handler first=true lateMs=12`. It rings again. `dumpsys power` shows `fitgram:rest` acquired for that +30 and released at done.
4. Skip, finish and discard each release the wake lock and clear the post (`dumpsys power`, `dumpsys notification` show neither).
5. Channels: `rest_timer` silent; the done channel importance 4 with sound and vibration on (`dumpsys notification`).

**Phone run [run, 2026-11-22].** OnePlus 7T, Android 12, a dev copy (`com.vd09.fitgram.dev`, side by side with the real app). Run 1: no sound. Read off the phone: the done post was on `rest_done`, importance 4, vibration on, volume full, not silent, no Do Not Disturb, and the phone's default notification sound was None. Fixed (alarm-sound fallback, new channel id). Run 2, screen locked for the rest: the user heard the sound at 0:00, "working as expected". Not measured: the delay in ms (no number was read), a killed or OEM-frozen app, +30 and Skip on the phone, silent mode, Do Not Disturb.

**[pending] Not run:**
- The delay in ms with the CPU asleep (the `SHOW_LATENESS` text is removed, unread).
- Silent mode, Do Not Disturb, +30 and Skip on the phone.
- A killed or OEM-frozen app: only the late inexact alarm remains.
- The race the stale-post guard covers (add-time tapped while the alarm's receiver runs): by reading only.
- iOS.

**PR #81 review fixes (pass 1) [run on the emulator, 2026-11-22; phone not re-run].** Fixed: (B1) a done post whose sound already played is dropped when the notification has been swiped away, and a post that goes out cancels the alarm; (B2) `clear` records the end it ended and a done post for that end is refused; (S1) `OnDestroy` cancels the queued Handler; (S2) a done post with no end time is refused, no key `0`; (S3) channels are created or deleted only when missing or stale; (S4) a failed `show` clears the old alarm, wake lock and end, and a failing wake lock no longer stops the Handler; (S6) the sound falls back through alarm, ringtone, the first installed sound; minor: the legacy `rest_done` id and `applicationContext`. Left: (S7) the 098 groundwork stays, its ids are the settings screen's; empty `doneChannelName` not guarded (the string comes from `src/config`).

Emulator results after the fixes (1:30 rest; `logcat -b events` `notification_enqueue`, `dumpsys power`, `dumpsys alarm`): (B1) rest to 0:00: one alerting done post (`flags=0`), then the app's repaint quiet (`ONLY_ALERT_ONCE`), the wake lock released and **no RestDoneReceiver alarm left pending**; swiped the done post away, left the screen and came back (the rest panel remounts and calls `showDone`): **no new post**; then +30: rang again at the new end (`flags=0`), repaint quiet. (Skip) skipped a rest: wake lock released, alarm gone, **no done post at the old end time** 95 s later. [pending] Not run: the (B2) race itself (a receiver already running when Skip is tapped: needs a millisecond window), (S1) a module reload, (S4) a failed `postCountdown`, (S6) a phone with all three defaults None, and the dead-process alarm path on any device.

**PR #81 review pass 2 (2026-11-22): approved, with nits fixed.** `firstInstalled` reads its uri from the one cursor; `scheduleAlarm` has its own try so a failing alarm cannot stop the Handler; a comment says why the three early refusals in `postDone` leave the wake lock and alarm to their own cleanup; TICKET-098 cites Android's documented channel behaviour, not the emulator listing. Not changed, with reasons: `endedMs` holds one value (a receiver spanning two skips is negligible); `OnDestroy` also runs on host teardown with the process alive (leaves only the late alarm; whether a back-press exit triggers it is unconfirmed). Not run: the MediaStore read in `firstInstalled`, and any of this on the phone.
