# TICKET-079 spike: Android rest countdown on the lock screen

TEMPORARY reference code, not production. Result and open questions are in TICKETS.md under
TICKET-079, "Stage 0 result". Run on `main` at cc58bd4 (2026-11-10). Delete this folder when the
build lands (an acceptance criterion of TICKET-079).

To run it again:
1. Copy `module/` to `modules/rest-notification/` and `RestSpikePanel.tsx` to `src/spike/`.
2. `git apply docs/spikes/ticket-079-android-rest-notification/App.tsx.patch` (one import, one
   `<RestSpikePanel />` line). It was cut against the `main` above; if `App.tsx` has moved, add
   those two lines by hand.
3. `npx expo run:android --device <AVD name>` (the AVD name, not the adb serial). No `--clean`.
4. The emulator has no lock screen by default. `adb shell locksettings set-pin 1234` gives it one;
   undo with `adb shell locksettings clear --old 1234`.
5. **The timer will not show on the lock screen until you turn on silent notifications there:**
   `adb shell settings put secure lock_screen_show_silent_notifications 1`. The channel is
   low-importance, and at this emulator's default the lock screen hid it (TICKET-079, settle first 1).
   Undo with `adb shell settings delete secure lock_screen_show_silent_notifications`.
6. Tap Start, allow the permission, press the power button, press it again: the countdown is on the
   lock screen. At zero it keeps counting below zero; that is expected and is settle first 2.

## design-probe/ (TICKET-080, 2026-11-10)

TEMPORARY, same rule as above: delete with this folder when the TICKET-079 build lands.

The module as TICKET-080 settled the design: a custom content view with a big ticking
`Chronometer`, a second "done" layout (static 00:00), a day and night colour pair
(`values/` and `values-night/`), and the pulse-bar vector icon. `RestSpikePanel.tsx` has three
buttons (Rest, 0:00, Clear). `screenshots/` holds the emulator shots (Android 16.0, light and
dark shade) the main canvas boards use.

Differences from the module above: `show(endAtMs, title, text, variant)` returns a diagnostic
string, not a boolean, and the strings are passed in from the panel (the build reads them from
one config file). It still has unused imports and no error handling: not the production module.
To run it, follow steps 1 to 6 above with `design-probe/module` as `modules/rest-notification/`
and `design-probe/RestSpikePanel.tsx` as `src/spike/RestSpikePanel.tsx`. Switch themes with
`adb shell cmd uimode night yes|no`.
