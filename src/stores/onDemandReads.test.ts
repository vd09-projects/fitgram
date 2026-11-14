import { createOnDemandReads, type OnDemandState } from "./onDemandReads";

type Ready = { status: "ready"; value: string };
const WAIT = 1_000;
const GAP = 500;

function setup() {
  const ask = createOnDemandReads<Ready>({ waitMs: WAIT, retryGapMs: GAP });
  const states = new Map<string, OnDemandState<Ready>>();
  let signedIn = true;
  const call = (key: string, read: () => Promise<Ready>) =>
    ask(key, { current: states.get(key), setState: (s) => states.set(key, s), isCurrent: () => signedIn, read });
  return { call, states, signOut: () => (signedIn = false) };
}
const ready = (value: string): Ready => ({ status: "ready", value });
const never = () => new Promise<Ready>(() => {});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("one read per key, in memory", () => {
  it("reads once and never again once ready", async () => {
    const { call, states } = setup();
    const read = jest.fn(async () => ready("a"));
    await call("k", read);
    await call("k", read);
    expect(read).toHaveBeenCalledTimes(1);
    expect(states.get("k")).toEqual(ready("a"));
  });

  it("an ask inside the wait joins the read; keys do not affect each other", () => {
    const { call } = setup();
    const read = jest.fn(never);
    void call("k", read);
    void call("k", read);
    void call("other", read);
    expect(read).toHaveBeenCalledTimes(2);
  });
});

describe("a read that outlasts its wait", () => {
  it("says the wait is over, and still takes the answer when it lands", async () => {
    const { call, states } = setup();
    let answer: (r: Ready) => void = () => {};
    const done = call("k", () => new Promise<Ready>((resolve) => (answer = resolve)));
    jest.advanceTimersByTime(WAIT);
    expect(states.get("k")).toEqual({ status: "loading", waitOver: true });
    answer(ready("late"));
    await done;
    expect(states.get("k")).toEqual(ready("late"));
  });

  it("an ask after the wait starts a new read with its own wait, and the older answer is dropped", async () => {
    const { call, states } = setup();
    const answers: Array<(r: Ready) => void> = [];
    const read = jest.fn(() => new Promise<Ready>((resolve) => answers.push(resolve)));
    const first = call("k", read);
    jest.advanceTimersByTime(WAIT);
    const second = call("k", read);
    expect(read).toHaveBeenCalledTimes(2);
    expect(states.get("k")).toEqual({ status: "loading", waitOver: false });
    answers[1](ready("new"));
    await second;
    answers[0](ready("stale"));
    await first;
    expect(states.get("k")).toEqual(ready("new"));
  });
});

describe("a refusal", () => {
  it("is offline for Firestore's unavailable and failed for anything else", async () => {
    const { call, states } = setup();
    await call("a", () => Promise.reject(Object.assign(new Error("no connection"), { code: "unavailable" })));
    await call("b", () => Promise.reject(new Error("permission-denied")));
    expect(states.get("a")).toEqual({ status: "offline", error: "no connection" });
    expect(states.get("b")).toEqual({ status: "failed", error: "permission-denied" });
  });

  it("is not asked again inside the gap, and is after it", async () => {
    const { call, states } = setup();
    const read = jest.fn(async (): Promise<Ready> => { throw new Error("denied"); });
    await call("k", read);
    await call("k", read);
    expect(read).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(GAP);
    read.mockResolvedValueOnce(ready("ok"));
    await call("k", read);
    expect(read).toHaveBeenCalledTimes(2);
    expect(states.get("k")).toEqual(ready("ok"));
  });
});

it("an answer that lands after a sign-out is dropped", async () => {
  const { call, states, signOut } = setup();
  let answer: (r: Ready) => void = () => {};
  const done = call("k", () => new Promise<Ready>((resolve) => (answer = resolve)));
  signOut();
  answer(ready("theirs"));
  await done;
  expect(states.get("k")).toEqual({ status: "loading", waitOver: false }); // never replaced by the answer
});
