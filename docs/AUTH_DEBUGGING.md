# Auth debugging notes

Findings from the 2026-10-03 session. Two unrelated auth bugs, both triggered by
coming back to the project after ~7 months away.

---

## 1. Successful login bounced straight back to the sign-in screen

**Symptom.** Correct password, "Login Successful" toast appears, app stays on
`SignInScreen`. Retrying never helps.

**Cause.** `src/services/initAuth.ts` ran the 10-day inactivity gate on *every*
`onAuthStateChanged` callback. That callback fires in two situations and the code
treated them identically:

- a session restored from AsyncStorage at cold start — the gate belongs here
- credentials the user just entered — the gate must not apply here

`lastActiveAt` in Firestore was from 2026-02-20, so `daysSinceActive ≈ 225 >= 10`
and the listener called `signOut()` immediately after the sign-in succeeded. The
toast fired first because `signInUser()` resolves before the async listener runs.

It could never self-heal: `writeLastActive()` sat on the non-expired branch, so
the stale timestamp was never refreshed.

**Introduced by** `8531d51` (2026-02-20), which in one commit added AsyncStorage
persistence, the expiry gate, and moved `setInitialized(true)` into the async
callback. Before that commit `getAuth()` gave memory-only persistence, so no
long-lived session existed and the bug was impossible.

**Fixed in** `ac406da` (branch `fix-fresh-login-signout`):

- skip the expiry check when `firebaseUser.metadata.lastSignInTime` is under 5
  minutes old — restored sessions still go through the gate
- `writeLastActive` uses `setDoc(..., {merge:true})` instead of `updateDoc`,
  which throws `not-found` for accounts missing the `users/{uid}` root doc
- the session check is wrapped in try/catch, with `setUser` + `setInitialized`
  after it, so a Firestore failure can no longer strand the app on the splash

**Note.** `INACTIVE_EXPIRY_DAYS` is a hardcoded client constant. A shipped build
cannot be retuned remotely. Consider moving it to Remote Config or a Firestore
config doc if this policy ever needs a kill switch.

---

## 2. Google Sign-In failing with DEVELOPER_ERROR

**Symptom.** `DEVELOPER_ERROR` ("Follow troubleshoot instruction") on the
Play-installed app. Worked on the emulator.

**Two causes stacked.**

**2a. The web OAuth client had been flagged for deletion.** Google deletes OAuth
clients with no recorded usage for 6+ months. The project sat unused from
2026-02-21 to 2026-10-03 (~7.5 months), so the client was flagged and stopped
appearing in `google-services.json`. Reviving it in Cloud Console restored the
`client_type: 3` entry.

Real usage resets the clock, so this only bites during long quiet stretches.

**2b. The Play app signing fingerprint was never registered.** This was the one
that actually kept the phone broken. Play App Signing means Google discards your
upload signature and re-signs with its own key, so the fingerprint on the device
is Google's — not your EAS upload key.

Confirmed by pulling the APK off the phone:

```
Signer #1 certificate DN: CN=Android, OU=Android, O=Google Inc., ...
Signer #1 certificate SHA-1 digest: 5b117ce952a8d7481b76056a0bcc6716fadc7c70
```

---

## Fingerprint map

Which key signs a build depends entirely on how it got onto the device.

| Install source | Signed with | SHA-1 |
|---|---|---|
| local gradle build (emulator, USB) | `android/app/debug.keystore` (committed, key from 2014) | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
| EAS internal-distribution APK | EAS upload keystore | `DC:67:8F:58:64:28:98:B8:C5:E6:78:26:AA:8E:96:A1:2A:86:40:43` |
| **Play Store, any track** | **Play app signing key** | **`5B:11:7C:E9:52:A8:D7:48:1B:76:05:6A:0B:CC:67:16:FA:DC:7C:70`** |
| Play Internal App Sharing | separate Play key | see Play Console → App signing |
| (unused) `~/.android/debug.keystore`, regenerated 2026-02-20 | global debug keystore | `17:BD:B5:B8:5F:42:2C:56:FC:AF:62:D8:A1:69:11:BA:3D:80:63:34` |

All of these are registered in Firebase. A fingerprint is a property of the
**signing key**, not of the device or the build — register once per key and every
future build with that key works. Registering a fingerprint is server-side and
takes effect on already-installed apps without a rebuild.

---

## Diagnosing without a rebuild

Everything below reads an existing artifact. No build, no app launch.

```bash
# which key signed an installed app
adb shell pm path com.vd09.fitgram
adb pull <base.apk path> ~/Downloads/installed.apk
~/Library/Android/sdk/build-tools/36.0.0/apksigner verify --print-certs ~/Downloads/installed.apk
```

`keytool -printcert -jarfile` returns nothing on these APKs — they are v2/v3
signed only. Use `apksigner`.

```bash
# what env values were baked in at build time
unzip -p installed.apk assets/app.config      # APK
unzip -p build.aab base/assets/app.config     # AAB
```

`expo-constants` writes `app.config` into every build at preBuild
(`node_modules/expo-constants/scripts/get-app-config-android.gradle`), so
`extra` is always readable from the artifact.

```bash
# what google-services.json currently declares
node -e "const g=require('./google-services.json');console.log(g.client.flatMap(c=>(c.oauth_client||[]).map(o=>({type:o.client_type,sha1:o.android_info?.certificate_hash||'-'}))))"
```

Split APKs with per-language `split_config.*.apk` entries mean the app came from
an AAB — i.e. the Play Store — which implies Play App Signing.

---

## Config drift trap

There are **two** `google-services.json` files and they are both gitignored:

- `./google-services.json` — what `app.config.ts` references
- `./android/app/google-services.json` — **what Gradle actually reads**

`expo prebuild` is what copies root → `android/app/`, and this project avoids
prebuild because it would overwrite the manual `AndroidManifest.xml` edits
(`screenOrientation="userPortrait"`, `windowOptOutEdgeToEdgeEnforcement="true"`).
So the two drift apart silently — they were 2 days apart when this bug was
investigated, and Gradle was using the stale one.

Always update both. `scripts/release.sh check` verifies they match.

Longer-term fix: move those manifest edits into a config plugin so `expo prebuild`
becomes safe to run.

---

## Dev-server gotcha (unrelated to auth, cost an hour)

Dev client showed `unexpected end of stream on http://192.168.88.6:8081/`.
Metro was healthy on `127.0.0.1` but unreachable on the LAN IP, because the macOS
application firewall had the Homebrew Node binary set to **Block incoming
connections** — a `brew upgrade node` created a new binary path, which macOS
treats as a new app and defaults to Block.

Fix either way:

```bash
npx expo start --dev-client --localhost     # emulator: uses adb reverse, firewall never involved
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "$(readlink -f "$(which node)")"
```

The path contains the Node version, so the block returns after every
`brew upgrade node`.
