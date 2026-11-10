import { restNotificationState } from "./state";

describe("restNotificationState", () => {
  it("is on only when granted and not switched off in Android", () => {
    expect(restNotificationState({ granted: true, enabled: true, refusedForGood: false })).toBe("on");
  });

  it("is blocked when granted but not enabled (defensive): asking again would do nothing", () => {
    expect(restNotificationState({ granted: true, enabled: false, refusedForGood: false })).toBe("blocked");
  });

  it("is off when never asked or refused once, blocked once Android said never ask again", () => {
    expect(restNotificationState({ granted: false, enabled: false, refusedForGood: false })).toBe("off");
    expect(restNotificationState({ granted: false, enabled: false, refusedForGood: true })).toBe("blocked");
  });
});
