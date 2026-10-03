#!/usr/bin/env bash
# Fitgram release helper — preflight, build, verify, submit.
# Usage: ./scripts/release.sh [check|build|verify <artifact>|submit <artifact>|all]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PACKAGE="com.vd09.fitgram"
BUILD_PROFILE="production"
SUBMIT_PROFILE_DEFAULT="internal"   # Play track; override with: submit <artifact> production

# Fingerprints that must be registered in Firebase. Keep in sync with docs/AUTH_DEBUGGING.md.
FP_DEBUG="5e8f16062ea3cd2c4a0d547876baa6f38cabf625"   # android/app/debug.keystore (local builds)
FP_UPLOAD="dc678f58642898b8c5e67826aa8e96a12a864043"  # EAS upload key (signs the AAB)
FP_PLAY="5b117ce952a8d7481b76056a0bcc6716fadc7c70"    # Play app signing key (what devices verify)

REQUIRED_ENV="FS_DB_API_KEY FS_DB_AUTH_DOMAIN FS_DB_PROJECT_ID FS_DB_STORAGE_BUCKET FS_DB_MESSAGING_SENDER_ID FS_DB_API_ID GOOGLE_WEB_CLIENT_ID"

ok()   { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAILED=1; }
warn() { printf '  \033[33mWARN\033[0m %s\n' "$1"; }
head_() { printf '\n\033[1m%s\033[0m\n' "$1"; }

apksigner_bin() {
  ls -d "$HOME"/Library/Android/sdk/build-tools/*/apksigner 2>/dev/null | sort -V | tail -1
}

# ---------------------------------------------------------------- versions
# versionName lives in THREE places and nothing keeps them in sync automatically:
#   app.config.ts   -> what expo-constants reports to JS
#   build.gradle    -> what the Android manifest actually ships  (source of truth)
#   ios Info.plist  -> what iOS ships
# EAS manages versionCode (appVersionSource: remote) but never versionName.
read_versions() {
  V_CFG=$(grep -oE 'const VERSION = "[0-9]+\.[0-9]+\.[0-9]+"' app.config.ts | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)
  V_GRADLE=$(grep -oE 'versionName "[0-9]+\.[0-9]+\.[0-9]+"' android/app/build.gradle | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)
  V_IOS=$(awk '/CFBundleShortVersionString/{getline; print}' ios/Fitgram/Info.plist 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)
}

cmd_version() {
  read_versions
  local new="${1:-}"
  if [ -z "$new" ]; then
    printf '  app.config.ts  : %s\n  build.gradle   : %s\n  ios Info.plist : %s\n' "${V_CFG:-?}" "${V_GRADLE:-?}" "${V_IOS:-?}"
    if [ "$V_CFG" = "$V_GRADLE" ] && [ "$V_CFG" = "$V_IOS" ]; then
      ok "in sync"
    else
      bad "out of sync — run: $0 version <x.y.z>"
      return 1
    fi
    return 0
  fi
  echo "$new" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' || { echo "version must look like 1.2.3" >&2; return 2; }
  sed -i '' "s/const VERSION = \"[0-9]*\.[0-9]*\.[0-9]*\"/const VERSION = \"$new\"/" app.config.ts
  sed -i '' "s/versionName \"[0-9]*\.[0-9]*\.[0-9]*\"/versionName \"$new\"/" android/app/build.gradle
  if [ -f ios/Fitgram/Info.plist ]; then
    /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $new" ios/Fitgram/Info.plist >/dev/null 2>&1 || true
  fi
  read_versions
  printf '  app.config.ts  : %s\n  build.gradle   : %s\n  ios Info.plist : %s\n' "${V_CFG:-?}" "${V_GRADLE:-?}" "${V_IOS:-?}"
  ok "version set to $new — commit this before building"
}

# ---------------------------------------------------------------- check
cmd_check() {
  FAILED=0

  head_ "git"
  local branch dirty
  branch=$(git branch --show-current)
  dirty=$(git status --porcelain)
  [ "$branch" = "main" ] && ok "on main" || warn "on '$branch', not main"
  [ -z "$dirty" ] && ok "working tree clean" || bad "uncommitted changes — EAS builds what is committed:
$(echo "$dirty" | sed 's/^/        /')"

  head_ "google-services.json"
  for f in google-services.json android/app/google-services.json; do
    [ -f "$f" ] || { bad "$f missing"; continue; }
  done
  if [ -f google-services.json ] && [ -f android/app/google-services.json ]; then
    if diff -q google-services.json android/app/google-services.json >/dev/null; then
      ok "both copies identical"
    else
      bad "root and android/app copies differ — Gradle reads android/app, app.config.ts points at root"
    fi
    node -e '
      const g=require("./google-services.json");
      const want={"'"$FP_DEBUG"'":"local debug","'"$FP_UPLOAD"'":"EAS upload","'"$FP_PLAY"'":"Play app signing"};
      const have=new Set(g.client.flatMap(c=>(c.oauth_client||[]).filter(o=>o.client_type===1).map(o=>o.android_info.certificate_hash.toLowerCase())));
      let bad=0;
      for(const [h,l] of Object.entries(want)){ if(!have.has(h)){ console.log("MISSING:"+l+":"+h); bad=1; } }
      const webs=new Set(g.client.flatMap(c=>(c.oauth_client||[]).filter(o=>o.client_type===3).map(o=>o.client_id)));
      if(!webs.size){ console.log("MISSING:web client (client_type 3):-"); bad=1; }
      process.exit(bad);
    ' 2>/dev/null && ok "all 3 fingerprints + web client present" || {
      node -e '
        const g=require("./google-services.json");
        const want={"'"$FP_DEBUG"'":"local debug","'"$FP_UPLOAD"'":"EAS upload","'"$FP_PLAY"'":"Play app signing"};
        const have=new Set(g.client.flatMap(c=>(c.oauth_client||[]).filter(o=>o.client_type===1).map(o=>o.android_info.certificate_hash.toLowerCase())));
        for(const [h,l] of Object.entries(want)) if(!have.has(h)) console.log("        missing fingerprint: "+l+" "+h);
        const webs=new Set(g.client.flatMap(c=>(c.oauth_client||[]).filter(o=>o.client_type===3).map(o=>o.client_id)));
        if(!webs.size) console.log("        missing web client (client_type 3)");
      '
      bad "google-services.json incomplete — re-download from Firebase (see docs/AUTH_DEBUGGING.md)"
    }
  fi

  head_ "versionName sources"
  read_versions
  printf '  ---- app.config.ts %s | build.gradle %s | ios Info.plist %s\n' "${V_CFG:-?}" "${V_GRADLE:-?}" "${V_IOS:-?}"
  if [ -n "$V_GRADLE" ] && [ "$V_CFG" = "$V_GRADLE" ] && [ "$V_CFG" = "$V_IOS" ]; then
    ok "all three agree ($V_CFG)"
  else
    bad "versionName sources disagree — android/app/build.gradle is what ships. Run: $0 version <x.y.z>"
  fi

  head_ "target API level"
  # Play rejects uploads below this; Google raises the floor annually.
  local MIN_TARGET_SDK=36
  local tsdk
  tsdk=$(grep -oE "targetSdkVersion = Integer.parseInt\(findProperty\('android.targetSdkVersion'\) \?: '[0-9]+'" android/build.gradle | grep -oE "'[0-9]+'\$" | tr -d "'" || true)
  if [ -z "$tsdk" ]; then
    warn "could not read targetSdkVersion from android/build.gradle"
  elif [ "$tsdk" -ge "$MIN_TARGET_SDK" ]; then
    ok "targetSdkVersion $tsdk (Play requires >= $MIN_TARGET_SDK)"
  else
    bad "targetSdkVersion $tsdk is below Play's minimum of $MIN_TARGET_SDK — the upload will be rejected"
  fi

  head_ "EAS environment ($BUILD_PROFILE)"
  local listed
  listed=$(npx eas env:list "$BUILD_PROFILE" 2>/dev/null || true)
  for v in $REQUIRED_ENV; do
    echo "$listed" | grep -q "^$v=" && ok "$v" || bad "$v not set in EAS $BUILD_PROFILE — .env is gitignored and never reaches the builder"
  done

  head_ "eas.json"
  node -e '
    const e=require("./eas.json");
    const p=e.build?.production||{};
    if(p.environment==="production") console.log("OK:environment pinned to production");
    else console.log("WARN:build.production.environment not set — EAS env vars may not be injected");
    if(e.cli?.appVersionSource==="remote") console.log("OK:appVersionSource remote (EAS owns versionCode)");
    else console.log("WARN:appVersionSource not remote");
    if(Object.keys(e.submit?.production||{}).length) console.log("OK:submit.production configured");
    else console.log("WARN:submit.production empty — eas submit will prompt for a Play service account key");
  ' | while IFS=: read -r kind msg; do
      case "$kind" in OK) ok "$msg";; WARN) warn "$msg";; esac
    done

  head_ "result"
  if [ "${FAILED:-0}" -eq 0 ]; then
    ok "preflight passed"
  else
    bad "preflight failed — fix the above before building"
    return 1
  fi
}

# ---------------------------------------------------------------- build
cmd_build() {
  cmd_check
  head_ "build"
  echo "  running: eas build --platform android --profile $BUILD_PROFILE"
  npx eas build --platform android --profile "$BUILD_PROFILE"
  echo
  echo "  When it finishes, download the .aab and verify it BEFORE submitting:"
  echo "    ./scripts/release.sh verify  ~/Downloads/<artifact>.aab"
  echo "    ./scripts/release.sh submit  ~/Downloads/<artifact>.aab              # internal testing"
  echo "    ./scripts/release.sh submit  ~/Downloads/<artifact>.aab production   # production, as draft"
}

# ---------------------------------------------------------------- verify
cmd_verify() {
  local art="${1:?usage: release.sh verify <artifact.aab|artifact.apk>}"
  [ -f "$art" ] || { echo "no such file: $art" >&2; return 1; }
  FAILED=0

  head_ "artifact"
  ok "$art ($(du -h "$art" | cut -f1))"

  head_ "baked config"
  # AAB keeps assets under base/assets/, APK under assets/
  local cfg
  cfg=$(unzip -p "$art" base/assets/app.config 2>/dev/null || unzip -p "$art" assets/app.config 2>/dev/null || true)
  if [ -z "$cfg" ]; then
    bad "app.config not found inside artifact"
  else
    echo "$cfg" | node -e '
      let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
        const c=JSON.parse(s), e=c.extra||{};
        const want=process.argv[1];
        const out=[];
        out.push((e.GOOGLE_WEB_CLIENT_ID===want?"OK:":"FAIL:")+"GOOGLE_WEB_CLIENT_ID matches .env");
        out.push((e.PROJECT_ID?"OK:":"FAIL:")+"PROJECT_ID = "+(e.PROJECT_ID||"undefined"));
        out.push((e.API_KEY?"OK:":"FAIL:")+"API_KEY present");
        out.push("INFO:version name "+c.version);
        out.push("NOTE:app.config versionCode "+(c.android&&c.android.versionCode)+" — ignored when appVersionSource is remote; EAS sets the real manifest value");
        console.log(out.join("\n"));
      });
    ' "$(grep '^GOOGLE_WEB_CLIENT_ID=' .env | cut -d= -f2- | tr -d ' \r')" \
    | while IFS=: read -r kind msg; do
        case "$kind" in OK) ok "$msg";; FAIL) bad "$msg";; INFO) printf '  ---- %s\n' "$msg";; NOTE) warn "$msg";; esac
      done
  fi

  head_ "manifest vs app.config"
  # The native android/ dir is committed and prebuild is never run, so
  # android/app/build.gradle owns versionName — app.config.ts does NOT.
  local tmpm mver cfgver gver
  tmpm=$(mktemp -t fitgram-manifest)
  unzip -p "$art" base/manifest/AndroidManifest.xml > "$tmpm" 2>/dev/null \
    || unzip -p "$art" AndroidManifest.xml > "$tmpm" 2>/dev/null || true
  mver=$(strings "$tmpm" 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | grep -vE '^(35|36|8)\.' | sort -u | head -1 || true)
  rm -f "$tmpm"
  cfgver=$(grep -oE 'const VERSION = "[0-9]+\.[0-9]+\.[0-9]+"' app.config.ts | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)
  gver=$(grep -oE 'versionName "[0-9]+\.[0-9]+\.[0-9]+"' android/app/build.gradle | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)
  printf '  ---- app.config.ts VERSION      : %s\n' "${cfgver:-?}"
  printf '  ---- build.gradle versionName   : %s\n' "${gver:-?}"
  printf '  ---- manifest versionName (AAB) : %s\n' "${mver:-?}"
  if [ -z "$mver" ]; then
    warn "could not read versionName from the artifact manifest"
  elif [ "$mver" = "$cfgver" ]; then
    ok "artifact versionName matches app.config.ts"
  else
    bad "artifact ships versionName $mver but app.config.ts says ${cfgver:-?} — build.gradle owns this value"
  fi

  head_ "16 KB page alignment"
  # Play rejects apps targeting Android 15+ whose 64-bit .so files are not
  # 16 KB aligned. 32-bit ABIs cannot use 16 KB pages and are not checked.
  local align_out
  if align_out=$(python3 "$ROOT/scripts/check-16kb.py" "$art" 2>&1); then
    ok "$align_out"
  else
    printf '%s\n' "$align_out" | sed 's/^/        /'
    bad "native libraries are not 16 KB aligned — Play will reject this upload"
  fi

  head_ "signature"
  local as; as=$(apksigner_bin)
  if [ -z "$as" ]; then
    warn "apksigner not found — skipping signature check"
  elif [[ "$art" == *.aab ]]; then
    printf '  ---- AAB is signed with your UPLOAD key; Play re-signs with %s… before devices see it\n' "${FP_PLAY:0:12}"
    ok "no on-device signature to check at this stage"
  else
    local sha
    sha=$("$as" verify --print-certs "$art" 2>/dev/null | grep -i "SHA-1 digest" | head -1 | awk '{print $NF}')
    case "$sha" in
      "$FP_UPLOAD") ok "signed with EAS upload key" ;;
      "$FP_DEBUG")  warn "signed with the local debug keystore — not a Play artifact" ;;
      "$FP_PLAY")   ok "signed with the Play app signing key" ;;
      *)            bad "unrecognised signing key: $sha — register it in Firebase before shipping" ;;
    esac
  fi

  head_ "result"
  if [ "${FAILED:-0}" -eq 0 ]; then
    ok "artifact verified — safe to submit"
  else
    bad "artifact FAILED verification — do not upload"
    return 1
  fi
}

# ---------------------------------------------------------------- submit
cmd_submit() {
  local art="${1:?usage: release.sh submit <artifact.aab> [internal|production]}"
  local profile="${2:-$SUBMIT_PROFILE_DEFAULT}"
  case "$profile" in
    internal)   local desc="Play INTERNAL TESTING track — visible to your internal testers only" ;;
    production) local desc="Play PRODUCTION track, created as a DRAFT release — it does NOT go live until you roll it out in Play Console" ;;
    *) echo "unknown submit profile '$profile' (expected: internal | production)" >&2; return 2 ;;
  esac

  cmd_verify "$art"

  head_ "submit"
  printf '  artifact : %s\n' "$art"
  printf '  profile  : %s\n' "$profile"
  printf '  target   : %s\n' "$desc"
  echo
  echo "  Uploading to Google Play cannot be undone from here."
  read -r -p "  Type the profile name ('$profile') to confirm: " a
  [ "$a" = "$profile" ] || { echo "  aborted"; return 1; }
  npx eas submit --platform android --profile "$profile" --path "$art"
}

case "${1:-check}" in
  check)   cmd_check ;;
  version) shift; cmd_version "${1:-}" ;;
  build)  cmd_build ;;
  verify) shift; cmd_verify "$@" ;;
  submit) shift; cmd_submit "$@" ;;
  all)    cmd_build ;;
  *) echo "usage: $0 [version [x.y.z]|check|build|verify <artifact>|submit <artifact> [internal|production]]" >&2; exit 2 ;;
esac
