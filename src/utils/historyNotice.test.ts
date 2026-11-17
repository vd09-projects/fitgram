import { historyNotice } from "./historyNotice";

const entry = (uid: string, failedAttempts = 0) => ({ uid, failedAttempts });

describe("historyNotice", () => {
  it("is null with nothing pending and no failed check", () => {
    expect(historyNotice([], "u1", false)).toBeNull();
  });

  it("counts only this user's entries, never another account's", () => {
    expect(historyNotice([entry("u2"), entry("u2", 3)], "u1", false)).toBeNull();
    expect(historyNotice([entry("u1"), entry("u2")], "u1", false)?.text).toBe("1 workout waiting to upload");
  });

  it("offers Try again only when the server rejected an entry", () => {
    expect(historyNotice([entry("u1"), entry("u1")], "u1", false)).toMatchObject({ kind: "waiting", tryAgain: false });
    expect(historyNotice([entry("u1"), entry("u1", 1)], "u1", false)).toMatchObject({
      kind: "didNotUpload",
      text: "1 workout didn’t upload",
      tryAgain: true,
    });
  });

  it("puts a rejected upload before a failed check, and a waiting one too", () => {
    expect(historyNotice([entry("u1", 2)], "u1", true)?.kind).toBe("didNotUpload");
    expect(historyNotice([entry("u1")], "u1", true)?.kind).toBe("waiting");
    expect(historyNotice([], "u1", true)?.kind).toBe("checkFailed");
  });

  it("shows nothing about pending entries while signed out", () => {
    expect(historyNotice([entry("u1", 1)], undefined, false)).toBeNull();
  });
});
