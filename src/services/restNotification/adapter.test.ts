import { extendRest, RestTimer } from "../../utils/restTimer";
import { planRestNotification } from "./adapter";

const START = 1_000_000;
const rest: RestTimer = { exerciseId: "bench", startedAt: START, durationMs: 90_000, setNumber: 1 };
const at = (seconds: number) => START + seconds * 1000;

describe("planRestNotification", () => {
  it("shows a started rest, ending at its end time", () => {
    expect(planRestNotification(null, rest, at(0))).toEqual({ kind: "show", endAt: START + 90_000 });
  });

  it("moves the end on add-time", () => {
    expect(planRestNotification(rest, extendRest(rest, at(10)), at(10))).toEqual({
      kind: "show",
      endAt: START + 90_000 + 30_000,
    });
  });

  it("clears on skip, finish and removal, which all set rest to null", () => {
    expect(planRestNotification(rest, null, at(10))).toEqual({ kind: "clear" });
  });

  it("does nothing when the store changed but the rest did not", () => {
    expect(planRestNotification(rest, { ...rest }, at(10))).toBeNull();
    expect(planRestNotification(null, null, at(10))).toBeNull();
  });

  it("clears at app start, where a post from the last run may still stand", () => {
    expect(planRestNotification(undefined, null, at(0))).toEqual({ kind: "clear" });
  });

  it("posts nothing for a rest that is already over", () => {
    expect(planRestNotification(null, rest, at(600))).toEqual({ kind: "clear" });
  });
});
