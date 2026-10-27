// TICKET-051 D4: Save shows "saved" only when this resolves, so a write it
// skips must reject instead of logging and returning.

import { overrideWorkoutDetails } from "./userDB";

it("rejects a plan with no exercises instead of skipping the write silently", async () => {
  await expect(overrideWorkoutDetails("uid", { id: "push", name: "Push", exercises: [] })).rejects.toThrow(
    "Missing user, plan id or exercises"
  );
});
