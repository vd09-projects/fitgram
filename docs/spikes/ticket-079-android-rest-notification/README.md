# TICKET-079 spike: Android rest countdown on the lock screen

TEMPORARY reference code, not production. Result and open questions are in TICKETS.md under
TICKET-079, "Stage 0 result". Run on `main` at cc58bd4 (2026-11-10).

To run it again:
1. Copy `module/` to `modules/rest-notification/` and `RestSpikePanel.tsx` to `src/spike/`.
2. Apply `App.tsx.patch` (one import, one `<RestSpikePanel />` line).
3. `npx expo run:android --device <AVD name>` (the AVD name, not the adb serial). No `--clean`.
4. The emulator has no lock screen by default. `adb shell locksettings set-pin 1234` gives it one;
   undo with `adb shell locksettings clear --old 1234`.
