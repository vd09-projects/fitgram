# Working rules

How to work on a ticket in this repo. Read the triage gate first — most of this
does not apply to most tickets, and applying all of it to a small change is its
own failure.

---

## 0. Triage gate — decide how much of this applies

Answer these before starting. They take a minute and they set the budget.

1. **Does anything outside this change depend on its output?** A type, a stored
   data shape, a function signature another ticket will call.
2. **Does the ticket rest on a claim that could be false?** "so it's faster",
   "so logging never waits", "so the user can X". Anything measurable.
3. **Can the user judge the result by using the app?** Or is it invisible —
   a data layer, a cache, a migration.
4. **Is it hard to reverse?** Writes to stored data, changes a stored shape,
   deletes, deploys.

**Scoring:**

- **0 yes → Tier 1 only.** A typo, a copy change, a one-file mechanical edit.
  The main risk here is over-engineering. Do what was asked, nothing more.
- **1–2 yes → Tier 1 + 2.** Normal feature work.
- **3–4 yes, or question 1 is yes → all three tiers.** Load-bearing work: data
  models, shared contracts, anything several later tickets read from.

**You may skip any rule whose cost exceeds its value for this task — but say
which you skipped and why, in one line.** A silent skip is the thing this gate
exists to prevent. A stated skip is a judgment call the user can overrule.

---

## Tier 1 — always, even for one-line changes

**1.1 Retract the moment confidence drops.** If you said something earlier and
now doubt it, correct it before the user acts on it. A wrong statement in a test
plan costs them a debugging session and costs you the credibility of the next
one. Correct plainly, once, then continue.

**1.2 Attribute bugs with evidence, never by assumption.** Before saying a bug is
pre-existing, check: `git show <base>:<file>`, `git log -S '<symbol>'`. Before
saying it is yours, check the same way. "Not mine" without evidence is a guess
wearing a fact's clothes.

**1.3 Never act outward without being asked.** Pushing, opening or merging PRs,
deploying rules or indexes, running a script that writes to a real database,
deleting a branch. Prepare it, describe it, let the user trigger it. Approval for
one such action does not carry to the next.

**1.4 Report what you did and did not verify.** Name the parts you could not
test and why. "Typechecks and 77 unit checks pass; the Firestore round trip,
indexes and rules are untested and need a device run" is useful. "Done" is not.

**1.5 When the user reports something odd, check whether they are right before
explaining why they are wrong.** They usually are right about what they saw,
even when their diagnosis is off. If their observation is correct and the
behaviour is intended, the gap is that your work gave them no way to see it.

---

## Tier 2 — anything with a design choice in it

**2.1 Name the load-bearing fact, then verify it in code.** Every design rests on
one or two facts that, if false, make it wrong. Find them and check them before
proposing anything. Reading three files to confirm an assumption is cheaper than
building on a wrong one.

> Example: re-keying history by exercise only works if the same exercise carries
> one id across plans. That was one grep. It decided the entire approach.

**2.2 Treat the ticket as a hypothesis, not an instruction.** Specs are written
before the code is understood and can encode the bug they exist to fix. If
implementing it literally reproduces the problem, say so, deviate, and record the
deviation where the ticket lives. Do not silently comply; do not silently
deviate.

**2.3 Write the decision where the code is.** Any choice with a defensible
alternative gets a comment stating what was chosen, what was rejected, and why.
Definitions especially — if a word like "best" or "volume" or "active" could be
read two ways, pin it in a comment on the function that implements it.

**2.4 Degrade to an explicit absence, never to a plausible number.** Missing,
unparseable or incomparable input yields `null` and a flag, not `0`, `NaN`, an
empty string or a partial sum. A wrong number looks like data and survives for
years. Carry enough context alongside to explain the gap — "unavailable, 3 of 4
inputs parsed" beats a blank.

**2.5 Stop guessing before the guess deepens.** When logic starts inferring
meaning from user-authored text, and the fix is to add one more alias or special
case, stop. That is the signal the data model is missing a field. Raise it rather
than extending the guess.

**2.6 Check the edge of every instruction you are given.** "Don't migrate old
data" may be about logs and not about config. "No UI changes" may be impossible
once a shared type changes. Find where the instruction stops covering the
problem, say so, and handle it.

**2.7 State scope growth before you grow it.** If the task turns out to require
touching things the ticket fenced off, say what and why first. Deliver the whole
thing once stated — do not quietly narrow it either.

---

## Tier 3 — load-bearing work

**3.1 Find the sentence that justifies the work, and measure it.** Every
non-trivial ticket has one: "so it's faster", "one fetch, many readers", "so the
user never waits". That sentence is the deliverable. Instrument it and produce a
number. If it cannot be measured end to end, measure the layer you can and say
exactly what remains unproven.

> "Starting a workout issues 1 fetch; 300 reads and 100 writes issue 0" is a
> result. "The cache works" is a hope.

**3.2 Test the computation, not the rendering.** Bugs in derived values are
invisible in a UI — they render as a plausible wrong number. Put the maths in
exported pure functions and exercise them directly, including the degenerate
cases: empty, one element, duplicates, mixed units, unparseable input, ties.

> This caught a real bug: a record keyed by rep count alone let a value in one
> unit silently overwrite a record in another. No screen would ever have shown it.

**Test what the change touched, and stop there.** This applies whenever you write
tests, at any tier. A test earns its place by covering behaviour this change added
or a bug it fixed — not coverage for its own sake, not every branch of every helper.
For a screen, 4 or 5 tests covering its main behaviours is enough. For a pure
function, pick the degenerate cases above that can actually occur, not all of them.
A test file too long to read gets skimmed, then ignored, then deleted; a short one
gets maintained.

Keep a test only once you have seen it fail: break the line it covers, watch it go
red for the reason it names, restore. Negative assertions — "not called twice",
"does not delete" — are the ones that pass against broken code.

> TICKET-017's harness grew to 58 checks for one screen, including a check that
> could never fail. Five well-chosen tests would have said more.

**3.3 Build a disposable instrument when the work is invisible.** A data layer
with no UI cannot be judged by the user. Build the temporary screen, counter or
dump that makes it observable, mark every part `TEMPORARY` with removal
instructions, and keep removal to a handful of edits. Same for anything that
writes externally: give it `--dry-run` so it can be verified without side
effects.

**3.4 Stage a large change into independently runnable commits.** If the diff is
too big for the user to hold in their head, split it. Each stage must typecheck,
run, and be testable on its own, with its own short test plan. Land each before
starting the next.

**3.5 Make a risky reorganisation reversible, then prove nothing was lost.** Park
the full work somewhere recoverable before reducing or splitting it. When
finished, verify mechanically — diff the file lists, not your memory — and show
the result before deleting the safety net.

**3.6 Prioritise remaining gaps by when the cost lands, not by severity.** At the
end you will have a list of known issues. The one to fix now is not the worst
one; it is the one that will bite during the next ticket, especially if it fails
*silently* and sends the user debugging the wrong layer. Loud, late failures can
wait. Say which you deferred and why.

---

## Finishing

Before saying it is done:

- the build/typecheck is clean, and you ran it
- every claim you made has either a number behind it or an explicit "untested"
- decisions and deviations are written down where the ticket and the code live
- known gaps are listed, each with a reason it was deferred
- nothing was pushed, merged or deployed that was not asked for
- you named the rules above you skipped, and why
