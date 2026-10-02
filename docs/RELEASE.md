# Release process — Android / Play Store

Driven by `scripts/release.sh`. Four stages, each runnable on its own.

```bash
./scripts/release.sh check                  # preflight only, changes nothing
./scripts/release.sh build                  # preflight + EAS production build
./scripts/release.sh verify <artifact.aab>  # inspect the built artifact
./scripts/release.sh submit <artifact.aab>  # verify, then upload (asks first)
```

---

## Why verification exists

Two failure modes have already shipped to users from this project, and both are
invisible until someone installs the app:

- **Env vars missing from the build.** `.env` is listed in `.easignore`, so it
  never reaches the EAS builder. Values come from EAS environment variables
  instead. If one is absent or wrong, `extra` is baked as `undefined` and the app
  fails at runtime — `GOOGLE_WEB_CLIENT_ID: undefined` surfaces as
  `DEVELOPER_ERROR`, nothing more specific.
- **Fingerprint not registered.** A build signed with a key Firebase doesn't know
  breaks Google Sign-In for everyone who installs it.

`verify` reads the real artifact — the `app.config` baked inside it and its
signing certificate — so both are caught before upload rather than after.

---

## Stage 0 — set the version

```bash
./scripts/release.sh version          # show all three sources, fail if they disagree
./scripts/release.sh version 1.0.3    # set all three together
```

`versionName` lives in **three** places and nothing syncs them automatically:

| File | Drives |
|---|---|
| `app.config.ts` (`VERSION`) | what `expo-constants` reports to JS |
| `android/app/build.gradle` (`versionName`) | **what the Android manifest actually ships** |
| `ios/Fitgram/Info.plist` (`CFBundleShortVersionString`) | what iOS ships |

Because `android/` is committed and `expo prebuild` is never run, **build.gradle
wins on Android**. Editing `app.config.ts` alone changes only what JS sees.

EAS manages `versionCode` through `appVersionSource: "remote"` with
`autoIncrement`, but it does **not** touch `versionName`. This bit once: release
1.0.1 was built with `app.config.ts` saying 1.0.2 and the manifest saying 1.0.1,
and nothing caught it until the artifact was inspected. `check` now fails when
the three disagree, and `verify` reads `versionName` out of the artifact manifest
and fails on mismatch.

`versionCode 11` in `build.gradle` and `app.config.ts` is stale and ignored —
EAS overwrites it. Leave it or delete it; it has no effect.

## Stage 1 — preflight (`check`)

| Check | Why |
|---|---|
| on `main`, working tree clean | EAS archives committed state; uncommitted work silently won't ship |
| both `google-services.json` copies identical | Gradle reads `android/app/`, `app.config.ts` points at root — see [AUTH_DEBUGGING.md](AUTH_DEBUGGING.md) |
| all 3 fingerprints + web client present | missing Play fingerprint = broken Google Sign-In in production |
| 7 env vars exist in EAS `production` | `.env` never reaches the builder |
| `eas.json` sane | `environment` pinned, `appVersionSource: remote`, submit configured |

Preflight exits non-zero on failure and `build` will not proceed.

## Stage 2 — build

```bash
./scripts/release.sh build
```

Runs `eas build --platform android --profile production`. `autoIncrement: true`
with `appVersionSource: "remote"` means EAS owns `versionCode` — the hardcoded
`versionCode: 11` in `app.config.ts` is ignored for EAS builds. Bump `VERSION` in
`app.config.ts` by hand when you want a new user-visible version name.

Download the `.aab` when the build finishes.

## Stage 3 — verify

```bash
./scripts/release.sh verify ~/Downloads/fitgram.aab
```

Reports:

- `GOOGLE_WEB_CLIENT_ID` baked into the artifact vs. the value in `.env`
- `PROJECT_ID` and `API_KEY` present (not `undefined`)
- version name and versionCode actually built
- signing key, matched against the known fingerprints

An AAB is signed with your **upload** key; Play re-signs with the app signing key
before any device sees it, so there is no on-device signature to check at this
stage. For a direct-install APK, the signing key is checked against the known
fingerprint list and an unrecognised key fails verification.

Do not upload an artifact that fails this stage.

`submit` re-runs `verify` and refuses to upload on failure, with no bypass flag —
that is the point of it. To ship an artifact that deliberately fails a check
(as release 1.0.1 did, built before the versionName fix), call EAS directly and
own the decision:

```bash
npx eas submit --platform android --profile internal --id <build-id>
```

## Stage 4 — submit

```bash
./scripts/release.sh submit <artifact.aab>              # Play internal testing (default)
./scripts/release.sh submit <artifact.aab> production   # Play production, as a draft release
```

**The track is explicit, and it is not the same thing as the build profile.**
`eas.json` now defines two submit profiles:

| Profile | Play track | Effect |
|---|---|---|
| `internal` (default) | `internal` | goes to your internal testers only |
| `production` | `production`, `releaseStatus: "draft"` | uploads a **draft** release — nothing reaches users until you roll it out manually in Play Console |

The script re-runs verification, prints the target in plain language, and requires
you to type the profile name to confirm. There is no path that silently publishes
to production: the default is internal testing, and the production profile still
stops at a draft.

Historically `submit.production` was `{}`, which relied on EAS Submit's implicit
default of `track: "internal"`. That was safe but invisible — now it is written down.

### Service account

`eas submit` needs a Google Play service account key. Add it per profile:

```json
"submit": {
  "internal": {
    "android": { "track": "internal", "serviceAccountKeyPath": "../play-service-account.json" }
  }
}
```

Keep that file outside the repo, or gitignored. It grants publishing rights.

---

## After release

Verify on a real device, not just the emulator — the emulator runs a
debug-signed build and therefore exercises a different fingerprint path entirely.
That difference is exactly what hid the `DEVELOPER_ERROR` bug.

---

## Known rough edges

- **`eas.json` is gitignored** (`.gitignore:11`). Build configuration should be
  version-controlled; it holds no secrets today. Consider removing that line.
- **Release builds are signed with the committed debug keystore.**
  `android/app/build.gradle` sets `release { signingConfig signingConfigs.debug }`
  — the Expo prebuild default, whose private key ships in every Expo project and
  is therefore public. Play App Signing protects Play-distributed builds, but any
  APK you hand out directly is signed with a publicly-known key. Generate a real
  release keystore before distributing APKs outside Play. Note `.gitignore`
  covers `*.jks` and `*.key` but **not** `*.keystore`.
- **Google deletes OAuth clients unused for 6+ months.** Long gaps between
  releases can silently break Google Sign-In. See AUTH_DEBUGGING.md §2a.
- **Keystore hygiene.** `@vd09__fitgram.jks` sits in the repo root (gitignored),
  and `~/Downloads/@vd09__fitgram-keystore-backup/` stores its password in
  plaintext beside it. EAS holds the authoritative copy — prefer re-downloading
  over keeping loose copies, and keep them out of synced folders.
