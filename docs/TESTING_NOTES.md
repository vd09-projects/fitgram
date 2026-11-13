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
