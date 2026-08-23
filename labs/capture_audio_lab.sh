#!/usr/bin/env bash
# Capture the minimum Android 15 / AIDL audio dump set.
# Run while the symptom is reproducible. See labs/README.md.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: capture_audio_lab.sh [--label NAME] [-s SERIAL]

Captures fingerprint, HAL classification, paired AudioFlinger dumps,
AudioPolicy, AudioService, CarAudioService, a short logcat, and /proc/asound
if visible. Writes labs/captures/<timestamp>_<label>/.
EOF
}

LABEL="capture"
SERIAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --label)
      LABEL="${2:-capture}"
      shift 2
      ;;
    -s)
      SERIAL=(-s "$2")
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

adb() {
  command adb "${SERIAL[@]}" "$@"
}

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found in PATH" >&2
  exit 1
fi
if ! command adb "${SERIAL[@]}" get-state >/dev/null 2>&1; then
  echo "adb device not ready. Start the emulator/device and authorize the host." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(date +%Y%m%d_%H%M%S)"
SAFE_LABEL="$(printf '%s' "$LABEL" | tr -cs 'A-Za-z0-9._-' '_' )"
OUT="$ROOT/captures/${STAMP}_${SAFE_LABEL}"
mkdir -p "$OUT"

echo "Writing $OUT"

{
  echo "host_time=$(date -Iseconds 2>/dev/null || date)"
  echo "adb_serial=$(adb get-serialno 2>/dev/null || true)"
  echo
  echo "=== getprop (selected) ==="
  adb shell getprop ro.build.fingerprint
  adb shell getprop ro.build.version.release
  adb shell getprop ro.build.version.sdk
  adb shell getprop ro.product.device
  adb shell getprop ro.hardware
  adb shell getprop ro.build.type
  echo
  echo "=== features (automotive?) ==="
  adb shell pm has android.hardware.type.automotive 2>/dev/null || \
    adb shell pm list features 2>/dev/null | grep -i automotive || true
} >"$OUT/00_fingerprint.txt"

{
  echo "=== service list (audio) ==="
  adb shell service list | grep -i audio || true
  echo
  echo "=== IModule / audio.core ==="
  adb shell service list | grep -i 'audio.core\|IModule\|audio.effect\|audiocontrol' || true
  echo
  echo "=== HIDL leftover (lshal); empty is OK on AIDL-only ==="
  adb shell lshal 2>/dev/null | grep -E 'android.hardware.audio@|android.hardware.audio.effect@' || true
  echo
  echo "=== AudioFlinger header ==="
  adb shell dumpsys media.audio_flinger 2>/dev/null | head -n 40 || true
} >"$OUT/01_hal_classification.txt"

echo "dumpsys media.audio_flinger (t0)"
adb shell dumpsys media.audio_flinger >"$OUT/02_audio_flinger_t0.txt" 2>&1 || true
sleep 1
echo "dumpsys media.audio_flinger (t1)"
adb shell dumpsys media.audio_flinger >"$OUT/03_audio_flinger_t1.txt" 2>&1 || true

echo "dumpsys media.audio_policy"
adb shell dumpsys media.audio_policy >"$OUT/04_audio_policy.txt" 2>&1 || true

echo "dumpsys audio"
adb shell dumpsys audio >"$OUT/05_audio_service.txt" 2>&1 || true

echo "dumpsys car_service --services CarAudioService"
if ! adb shell dumpsys car_service --services CarAudioService >"$OUT/06_car_audio.txt" 2>&1; then
  echo "car_service not present (phone image is OK)" >>"$OUT/06_car_audio.txt"
fi

# logcat tag filters (AHAL_* is a prefix — logcat cannot glob, so we
# pull a short ring and keep matching tags with grep).
LOG_TAG_REGEX='[[:space:]](AudioTrack|AudioRecord|AudioManager|AudioService|AudioFlinger|APM_AudioPolicyManager|CarAudioService|CarAudioFocus|android\.hardware\.audio|MediaSessionService|CAR\.MEDIA|MediaFocusControl|AHAL_StreamOut_QTI|AHAL_[A-Za-z0-9_.]+)[[:space:]]*:'

echo "logcat snapshot (filtered tags, including AHAL_*)"
if adb logcat -d -v threadtime -t 2000 >"$OUT/07_logcat_ring.txt" 2>&1; then
  {
    echo "=== filtered logcat tags ==="
    echo "AudioTrack AudioRecord AudioManager AudioService AudioFlinger"
    echo "APM_AudioPolicyManager CarAudioService CarAudioFocus"
    echo "android.hardware.audio"
    echo "MediaSessionService CAR.MEDIA MediaFocusControl"
    echo "AHAL_StreamOut_QTI AHAL_*"
    echo
    grep -E "$LOG_TAG_REGEX" "$OUT/07_logcat_ring.txt" || \
      echo "(no matching lines in the logcat ring)"
  } >"$OUT/07_logcat_threadtime.txt"
else
  echo "logcat -d failed" >"$OUT/07_logcat_threadtime.txt"
fi

{
  echo "=== /proc/asound/cards ==="
  adb shell cat /proc/asound/cards 2>/dev/null || echo "not visible"
  echo
  echo "=== /proc/asound/pcm ==="
  adb shell cat /proc/asound/pcm 2>/dev/null || echo "not visible"
} >"$OUT/08_asound.txt"

cat >"$OUT/NOTES.txt" <<'EOF'
Fill this in before you ask for help.

Symptom (one user sentence):

Expected path (usage → zone → bus/address → IModule stream → PCM):

Last-known-good layer (and which file proved it):

Hypotheses (at least two layers):
A.
B.
C.

Android 15 + AIDL? (see 01_hal_classification.txt):
Car XML version / fade flag if AAOS:

Do not paste this whole folder into chat without a question.
Point at the 20 lines that distinguish A vs B.
EOF

echo
echo "Done: $OUT"
echo "Next: fill NOTES.txt, then annotate like workbook/README.md"
