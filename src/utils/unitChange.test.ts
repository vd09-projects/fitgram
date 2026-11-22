import type { ExerciseField } from "../types/workoutType";
import { carryLastUnits, matchLastField, relabelLine, unitBlocks, unitNotice, unitsSummary } from "./unitChange";

const bench: ExerciseField[] = [
  { name: "Weight", role: "weight", unit: "kg" },
  { name: "Reps", role: "reps" },
];
const benchPlates: ExerciseField[] = [{ name: "Weight", role: "weight", unit: "plates" }, bench[1]];
const walk: ExerciseField[] = [
  { name: "Weight", role: "weight", unit: "kg" },
  { name: "Distance", role: "distance", unit: "m" },
  { name: "Notes", role: "other" },
];

describe("unitBlocks", () => {
  it("makes one block per field with a unit choice: never reps, never a unitless field", () => {
    expect(unitBlocks(walk, null).map((b) => b.name)).toEqual(["Weight", "Distance"]);
    // The assisted machine's "Assistance" is role `other` with kg: a unit, but no chips for it.
    const assisted: ExerciseField[] = [{ name: "Assistance", role: "other", unit: "kg" }, bench[1]];
    expect(unitBlocks(assisted, null)).toEqual([]);
    expect(unitsSummary(assisted)).toBeNull();
    expect(unitBlocks(bench, null)).toEqual([
      { name: "Weight", unit: "kg", options: ["kg", "lb", "plates"], lastUnit: null, hint: null },
    ]);
  });

  it("carries the selected unit's hint, and last time's unit by role even under another name", () => {
    const last: ExerciseField[] = [{ name: "Load", role: "weight", unit: "plates" }, bench[1]];
    const [block] = unitBlocks(benchPlates, last);
    expect(block.lastUnit).toBe("plates");
    expect(block.hint).toMatch(/^Plates or pin number/);
  });
});

describe("matchLastField", () => {
  it("pairs fields of one role by position, not by name", () => {
    const today: ExerciseField[] = [
      { name: "Left", role: "weight", unit: "kg" },
      { name: "Right", role: "weight", unit: "kg" },
    ];
    const last: ExerciseField[] = [
      { name: "Right", role: "weight", unit: "lb" },
      { name: "Left", role: "weight", unit: "plates" },
    ];
    expect(matchLastField(today, 0, last)?.unit).toBe("lb");
    expect(matchLastField(today, 1, last)?.unit).toBe("plates");
    expect(matchLastField(today, 1, [last[0]])).toBeNull();
    expect(matchLastField(today, 0, undefined)).toBeNull();
  });
});

describe("unitsSummary", () => {
  it("lists every changeable unit in field order, and is null when there is none", () => {
    expect(unitsSummary(walk)).toBe("Weight kg · Distance m");
    expect(unitsSummary([bench[1]])).toBeNull();
  });
});

describe("relabelLine", () => {
  const set = { id: 1, segments: [{ Weight: "8", Reps: "15" }] };

  it("is null before any set is logged", () => {
    expect(relabelLine(benchPlates, null, [])).toBeNull();
  });

  it("names the count and one example, keeping the numbers as typed", () => {
    expect(relabelLine(benchPlates, benchPlates, [set, { ...set, id: 2 }])).toEqual({
      count: 2,
      before: "8 plates × 15",
      after: "8 kg × 15",
    });
  });

  it("uses last time's unit as the example when it differs from today's", () => {
    expect(relabelLine(bench, benchPlates, [set])?.after).toBe("8 plates × 15");
    expect(relabelLine(bench, [{ name: "Weight", role: "weight", unit: "lb" }, bench[1]], [set])?.after).toBe("8 lb × 15");
  });
});

describe("unitNotice", () => {
  const session = (fields: ExerciseField[], sets: Record<string, string | number>[]) => ({
    lastSession: { fields, sets: sets.map((values, i) => ({ setNumber: i + 1, segments: [values] })) } as never,
  });
  const walkLb: ExerciseField[] = [{ ...walk[0], unit: "lb" }, walk[1], walk[2]];

  it("is null with no last session, and when every unit matches", () => {
    expect(unitNotice(bench, { lastSession: null }, 1)).toBeNull();
    expect(unitNotice(bench, session(bench, [{ Weight: 60, Reps: 8 }]), 1)).toBeNull();
  });

  it("one field differs: names last time's unit and its numbers", () => {
    expect(unitNotice(bench, session(benchPlates, [{ Weight: 8, Reps: 15 }]), 1)).toBe(
      "Last time was in plates (8 plates × 15)"
    );
  });

  it("two fields, one differs: names the field; works with no reps", () => {
    expect(unitNotice(walk, session(walkLb, [{ Weight: 50, Distance: 40 }]), 1)).toBe(
      "Last time weight was in lb (50 lb · 40 m)"
    );
  });

  it("two fields differ: one line for last time's units", () => {
    const last: ExerciseField[] = [{ ...walk[0], unit: "lb" }, { ...walk[1], unit: "km" }, walk[2]];
    expect(unitNotice(walk, session(last, [{ Weight: 50, Distance: 1 }]), 1)).toBe(
      "Last time used different units (50 lb · 1 km)"
    );
  });

  it("matches by role, not name, and says nothing for a last unit the role does not have", () => {
    const renamed: ExerciseField[] = [{ name: "Load", role: "weight", unit: "plates" }, bench[1]];
    expect(unitNotice(bench, session(renamed, [{ Load: 8, Reps: 15 }]), 1)).toBe("Last time was in plates (8 plates × 15)");
    const odd = [{ name: "Weight", role: "weight", unit: "m" }, bench[1]] as ExerciseField[];
    expect(unitNotice(bench, session(odd, [{ Weight: 8, Reps: 15 }]), 1)).toBeNull();
  });

  it("quotes no numbers when last session stopped before this set", () => {
    expect(unitNotice(bench, session(benchPlates, [{ Weight: 8, Reps: 15 }]), 3)).toBe("Last time was in plates");
  });
});

// TICKET-101. Only what a swap or add can meet: a unit that differs, nothing known, and the
// refusals that keep a wrong unit out.
describe("carryLastUnits", () => {
  it("takes last time's unit by role even under another name, and leaves reps alone", () => {
    const last: ExerciseField[] = [{ name: "Load", role: "weight", unit: "plates" }, bench[1]];
    expect(carryLastUnits(bench, last)).toEqual(benchPlates);
  });

  it("matches weight fields by position among their role, not by index", () => {
    const today: ExerciseField[] = [
      { name: "Weight", role: "weight", unit: "kg" },
      bench[1],
      { name: "Per hand", role: "weight", unit: "kg" },
    ];
    // Reps comes first last time: matching by index would pair today's Weight with Reps.
    const last: ExerciseField[] = [
      bench[1],
      { name: "A", role: "weight", unit: "lb" },
      { name: "B", role: "weight", unit: "plates" },
    ];
    expect(carryLastUnits(today, last).map((f) => f.unit)).toEqual(["lb", undefined, "plates"]);
  });

  it("returns the same array when last time used the same units", () => {
    expect(carryLastUnits(bench, bench)).toBe(bench);
  });

  it("gives a field with no unit none, even when last time had one", () => {
    const unitless: ExerciseField[] = [{ name: "Weight", role: "weight" }, bench[1]];
    expect(carryLastUnits(unitless, benchPlates)).toBe(unitless);
  });

  it("keeps the version's own unit, and the same array, when last time is unknown or not offered", () => {
    expect(carryLastUnits(bench, null)).toBe(bench);
    expect(carryLastUnits(bench, [bench[1]])).toBe(bench);
    // a time unit is not one a weight offers: no guess
    expect(carryLastUnits(bench, [{ name: "Weight", role: "weight", unit: "min" as never }, bench[1]])).toBe(bench);
  });
});
