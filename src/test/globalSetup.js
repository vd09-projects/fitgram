// Runs once before the suite (jest.config.js `globalSetup`). Pins the time zone, because
// setting `process.env.TZ` inside a test file does not reach `Date` in Jest's sandbox.
//
// Why a zone behind UTC: the held workouts' window is cut at the phone's local month
// but stored in UTC-month shards (TICKET-082), and a test of that boundary must see the two
// disagree. In Los Angeles 03:00 UTC on the 1st is still last month. The window tests are
// written for such a zone and fail under UTC or a zone ahead of it, so a run that sets `TZ`
// itself keeps it and gets those failures (the measurement harnesses in src/scripts/ ask for
// UTC and are run on their own).
module.exports = async () => {
  process.env.TZ = process.env.TZ || "America/Los_Angeles";
};
