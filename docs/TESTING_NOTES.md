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

Built and unit-tested only; nothing here has been seen on the emulator. To run: hub, **History (new)** (the old **History** is unchanged).
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
