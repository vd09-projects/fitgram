# src/config/

The app's tuning values (how much, how long, how often) and the phone's storage
keys, one file per area, so each can be found and changed in one place
(TICKET-074).

**Rule: a new tuning value goes here, with its reason.** The comment that explains
the number sits beside it in the config file; the code that uses it keeps a
one-line pointer. One home per constant: nothing is re-exported from the old file.

| File | Holds |
| --- | --- |
| `sync.ts` | how often the phone checks the server, how long it waits. No store re-reads everything on a timer: every app write is stamped, so a change check finds it (TICKET-076) |
| `display.ts` | how much each screen shows or reads to show |
| `workout.ts` | rest timer, default target sets, save and upload grace, plan name length |
| `auth.ts` | inactivity sign-out, fresh sign-in window |
| `storedData.ts` | caps that set the shape of data stored in Firestore |
| `storageKeys.ts` | every AsyncStorage key, each beside its format number |
| `restNotification.ts` | the lock-screen rest timer's strings and the one text budget (TICKET-079). The exception to "copy is not here" below: Android draws that text, so it travels to Kotlin as data and sits in one file, as TICKET-080 asked |
| `envConfig.ts` | build-time environment (Firebase keys, debug flag) |

A value marked **Changes stored data** is not a free knob: its note says what to
do when you change it. `config.test.ts` checks the values that depend on each
other.

Not here: catalog vocabulary, copy and error strings, ids and collection names
(`constants/tables`, `FREESTYLE_ID`), routes, styles and theme tokens, tour steps,
and layout numbers that belong to one component (hit sizes, row heights).
