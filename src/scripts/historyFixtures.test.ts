// TICKET-087 stage 3: the computations behind the shape comparison, not the numbers.
// If these are wrong the measurements are plausible and wrong (CLAUDE.md 3.2).
import { firestoreBytes, summarise } from "./docSize";
import { buildShapes, generateFixture, LIFTS_PER_WORKOUT, monthKey, SETS_PER_LIFT } from "./historyFixtures";

const fixture = generateFixture(24);
const shapes = buildShapes(fixture);

describe("the fixture", () => {
  it("is the same bytes for the same seed", () => {
    expect(JSON.stringify(generateFixture(24))).toBe(JSON.stringify(fixture));
  });

  it("has the asked-for lifts and sets per workout, and some drop sets", () => {
    expect(fixture.sessions).toHaveLength(24);
    shapes.b.forEach((record) => {
      expect(record.lifts).toHaveLength(LIFTS_PER_WORKOUT);
      record.lifts.forEach((lift) => expect(lift.sets).toHaveLength(SETS_PER_LIFT));
    });
    const dropSets = shapes.b.flatMap((r) => r.lifts.flatMap((l) => l.sets)).filter((s) => s.segments.length > 1);
    expect(dropSets.length).toBeGreaterThan(0);
  });
});

describe("workouts a day", () => {
  it("two a day puts two workouts on each date, with distinct ids, and the default spacing is unchanged", () => {
    const busy = generateFixture(24, 1, 2).sessions;
    const days = new Set(busy.map((s) => new Date(s.startedAt).toDateString()));
    expect(days.size).toBe(12);
    expect(new Set(busy.map((s) => s.sessionId)).size).toBe(24);
    expect(new Set(fixture.sessions.map((s) => new Date(s.startedAt).toDateString())).size).toBe(24);
  });
});

describe("shapes A and B", () => {
  it("B is A plus each lift's fields and sets, and nothing else", () => {
    const stripped = shapes.b.map((record) => ({
      ...record,
      lifts: record.lifts.map(({ fields: _fields, sets: _sets, ...lift }) => lift),
    }));
    expect(stripped).toEqual(shapes.a);
  });

  it("the sets B holds are the sets exercise_sessions holds, per lift", () => {
    shapes.b.forEach((record) =>
      record.lifts.forEach((lift) => {
        const doc = fixture.exerciseSessions.find((e) => e.sessionId === record.sessionId && e.exerciseId === lift.id);
        expect(lift.sets).toEqual(doc?.sets);
      })
    );
  });

  it("a lift with no earlier session is first_time with no verdict, never a number", () => {
    const oldest = shapes.a[0];
    oldest.lifts.forEach((lift) => expect(lift).toMatchObject({ verdict: null, reason: "first_time" }));
  });
});

describe("the meters", () => {
  it("counts Firestore bytes by the documented rule, worked by hand", () => {
    // name: "u" 2 + "x" 2 + 16 = 20; +32; field "a": 1 + 1 for the name, "bb" is 2 + 1.
    expect(firestoreBytes("u/x", { a: "bb" })).toBe(20 + 32 + 2 + 3);
  });

  it("a month shard key is the UTC month, so it does not move with the time zone", () => {
    expect(monthKey(Date.UTC(2020, 0, 31, 23, 59))).toBe("2020-01");
    expect(monthKey(Date.UTC(2020, 1, 1, 0, 0))).toBe("2020-02");
  });

  it("an empty list has no median, not 0", () => {
    expect(summarise([])).toEqual({ n: 0, median: null, max: null });
  });
});
