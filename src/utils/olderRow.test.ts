import { olderRowBusy, olderRowDetail } from "./olderRow";

describe("olderRowDetail", () => {
  it("says Show N when idle, then Loading, then that it needs a connection once the wait is over, and what a refusal was", () => {
    expect(olderRowDetail(null, 20)).toBe("Show 20");
    expect(olderRowDetail({ status: "loading", waitOver: false }, 20)).toBe("Loading…");
    expect(olderRowDetail({ status: "loading", waitOver: true }, 20)).toBe("Needs a connection, still trying");
    expect(olderRowDetail({ status: "offline", error: "x" }, 20)).toBe("Needs a connection");
    expect(olderRowDetail({ status: "failed", error: "x" }, 20)).toBe("Could not load · try again");
    expect(olderRowDetail({ status: "ready" }, 20)).toBe("Show 20");
  });

  it("is busy only inside the wait: after it a tap starts a new read", () => {
    expect(olderRowBusy({ status: "loading", waitOver: false })).toBe(true);
    expect(olderRowBusy({ status: "loading", waitOver: true })).toBe(false);
    expect(olderRowBusy(null)).toBe(false);
  });
});
