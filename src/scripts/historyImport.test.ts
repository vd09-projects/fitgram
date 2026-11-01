import { buildImport, parseSet, planExercise, type ImportFile } from "./historyImport";

const file = (exercises: ImportFile["sessions"][number]["exercises"]): ImportFile => ({
  email: "test@example.com",
  plans: [{ key: "p", id: "plan_1", name: "Plan" }],
  sessions: [{ date: "2026-10-01", plan: "p", source: "test", exercises }],
});

describe("parseSet", () => {
  it("reads segments and a trailing mark", () => {
    expect(parseSet("17.5-8 / 15-4 H")).toEqual({
      segments: [{ weight: 17.5, reps: 8 }, { weight: 15, reps: 4 }],
      effort: "hard",
    });
  });

  it("refuses what it cannot read instead of guessing", () => {
    expect(() => parseSet("12.5,-10")).toThrow("Unreadable");
    expect(() => parseSet("6-15up")).toThrow("Unreadable");
  });
});

describe("buildImport", () => {
  it("stores a barbell load as bar + 2 x per side, as a string", () => {
    const { sessions } = buildImport(file([{ id: "bicep_curl__barbell", unit: "kg", bar: 10, sets: ["7.5-8 H"] }]));
    expect(sessions[0].exerciseSessions[0].sets).toEqual([{ segments: [{ Weight: "25", Reps: "8" }], effort: "hard" }]);
  });

  it("logs plates in plates, never converted", () => {
    const { sessions, plans } = buildImport(file([{ id: "lat_pulldown__cable", unit: "plates", sets: ["8-15"] }]));
    expect(sessions[0].exerciseSessions[0].fields.find((f) => f.role === "weight")?.unit).toBe("plates");
    expect(plans[0].exercises[0].fields.find((f) => f.role === "weight")?.unit).toBe("plates");
    expect(sessions[0].session.volume?.totals).toEqual([{ unit: "plates", value: 120 }]);
  });

  it("refuses a set that does not fit the exercise's fields", () => {
    expect(() => buildImport(file([{ id: "dip__bodyweight", sets: ["10-12"] }]))).toThrow("does not match");
    expect(() => planExercise({ id: "bench_press__machine", sets: [] })).toThrow("needs a unit");
  });
});
