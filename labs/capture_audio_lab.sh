#!/usr/bin/env bash
# Capture the minimum Android 15 / AIDL audio dump set.
# Run while the symptom is reproducible. See labs/README.md.
#
# Qualcomm-like (PAL/AGM/AHAL) tags vary by CAF branch. This script matches
# *log tags and prefixes*, not proprietary module IDs. Confirm strings on your BSP.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: capture_audio_lab.sh [--label NAME] [-s SERIAL]

Captures fingerprint, HAL classification, paired AudioFlinger dumps,
AudioPolicy, AudioService, CarAudioService, CarMediaService, a short logcat
(AOSP + Qualcomm-like tags), vendor XML *names*, and /proc/asound if visible.

Writes labs/captures/<timestamp>_<label>/.
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
    -s|--serial)
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

STATE="$(command adb "${SERIAL[@]}" get-state 2>/dev/null || true)"
if [[ "$STATE" != "device" ]]; then
  echo "adb device not ready (state=${STATE:-unknown}). Start the device and authorize the host." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(date +%Y%m%d_%H%M%S)"
SAFE_LABEL="$(printf '%s' "$LABEL" | tr -cs 'A-Za-z0-9._-' '_' )"
OUT="$ROOT/captures/${STAMP}_${SAFE_LABEL}"
mkdir -p "$OUT"

echo "Writing $OUT"

# --- 00 fingerprint --------------------------------------------------------
{
  echo "host_time=$(date -Iseconds 2>/dev/null || date)"
  echo "device_time=$(adb shell date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || true)"
  echo "adb_serial=$(adb get-serialno 2>/dev/null || true)"
  echo
  echo "=== getprop (selected) ==="
  for p in \
    ro.build.fingerprint \
    ro.build.version.release \
    ro.build.version.sdk \
    ro.product.device \
    ro.hardware \
    ro.board.platform \
    ro.boot.hardware \
    ro.build.type \
    ro.debuggable \
    aaudio.hw_burst_min_usec \
    aaudio.mmap_policy
  do
    printf '%s=' "$p"
    adb shell getprop "$p" 2>/dev/null || echo
  done
  echo
  echo "=== getprop audio* / vendor.audio* / persist.vendor.audio* (names+values) ==="
  adb shell getprop 2>/dev/null | grep -iE 'audio|aaudio|offload|fluence|acdb|\.pal' || true
  echo
  echo "=== features (automotive?) ==="
  adb shell pm has-feature android.hardware.type.automotive 2>/dev/null || \
    adb shell pm list features 2>/dev/null | grep -i automotive || \
    echo "feature query not available"
  echo
  echo "=== vendor audio XML names only (not contents) ==="
  adb shell sh -c 'ls /vendor/etc/car_audio*.xml /vendor/etc/audio_policy*.xml /vendor/etc/mixer_paths*.xml /vendor/etc/audio_platform_info*.xml /vendor/etc/audio/*.xml 2>/dev/null' || echo "not visible"
} >"$OUT/00_fingerprint.txt"

# --- 01 HAL classification -------------------------------------------------
{
  echo "=== service list (audio) ==="
  adb shell service list 2>/dev/null | grep -i audio || true
  echo
  echo "=== IModule / audio.core / AudioControl ==="
  adb shell service list 2>/dev/null | grep -iE 'audio.core|IModule|audio.effect|audiocontrol' || true
  echo
  echo "=== HIDL leftover (lshal); empty is OK on AIDL-only ==="
  adb shell lshal 2>/dev/null | grep -E 'android.hardware.audio@|android.hardware.audio.effect@' || true
  echo
  echo "=== AudioFlinger header (HAL generation) ==="
  adb shell dumpsys media.audio_flinger 2>/dev/null | head -n 40 || true
} >"$OUT/01_hal_classification.txt"

# --- paired Flinger (motion). Sequential on purpose. ----------------------
echo "dumpsys media.audio_flinger (t0)"
{
  echo "device_time=$(adb shell date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || true)"
  adb shell dumpsys media.audio_flinger 2>&1 || true
} >"$OUT/02_audio_flinger_t0.txt"
sleep 1
echo "dumpsys media.audio_flinger (t1)"
{
  echo "device_time=$(adb shell date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || true)"
  adb shell dumpsys media.audio_flinger 2>&1 || true
} >"$OUT/03_audio_flinger_t1.txt"

echo "dumpsys media.audio_policy"
adb shell dumpsys media.audio_policy >"$OUT/04_audio_policy.txt" 2>&1 || true

echo "dumpsys audio"
adb shell dumpsys audio >"$OUT/05_audio_service.txt" 2>&1 || true

echo "dumpsys car_service --services CarAudioService"
if ! adb shell dumpsys car_service --services CarAudioService >"$OUT/06_car_audio.txt" 2>&1; then
  echo "car_service not present (phone image is OK)" >>"$OUT/06_car_audio.txt"
fi

echo "dumpsys car_service --services CarMediaService"
if ! adb shell dumpsys car_service --services CarMediaService >"$OUT/06b_car_media.txt" 2>&1; then
  echo "CarMediaService not present (phone image is OK)" >>"$OUT/06b_car_media.txt"
fi

# --- logcat ----------------------------------------------------------------
# threadtime: DATE TIME PID TID PRIO TAG: message
# logcat cannot glob tags (AHAL_*, pal_stream*). Filter the ring by tag/prefix.
#
# AOSP / client (exact or prefix):
#   AAudio, AAudioStream — native path (Oboe usually logs as AAudio)
#   AudioTrack / AudioRecord / AudioFlinger / FastMixer
#   APM_AudioPolicyManager / AudioPolicyService / android.hardware.audio
#   CarAudio* / CAR.MEDIA / MediaFocusControl / VolumeShaper / FadeOutManager
#
# Qualcomm-like (vendor; names vary by CAF — do not invent module IDs):
#   AHAL_*              QTI AIDL HAL stream/module
#   PAL, PalClient, PalStream, PAL_*, pal_stream*
#                       PAL is HLOS. Stream type is often in the *message*
#                       (StreamPCM / StreamCompress) with tag PAL.
#   AGM, agm_server, AGM*   Audio Graph Manager (builds the graph PAL requested)
#   GSL, Gsl*           Graph services toward DSP on some chips
#   ACDB, Acdb, GPR, APR    Cal / IPC. QXDM still wins for ADSP internals.

LOG_AWK='
function classify(tag,    c) {
  c = "none"
  if (tag ~ /^(AAudio|AAudioStream|AudioStreamInternal|AudioTrack|AudioRecord|AudioManager|AudioService|AudioFlinger|AudioHwDevice|AudioPolicyService|APM_AudioPolicyManager|AudioPolicy|FastMixer|FastCapture|FastThread|VolumeShaper|FadeOutManager|CarAudioService|CarAudioFocus|CarAudioDump|MediaSessionService|MediaFocusControl|android\.hardware\.audio)/) c = "aosp"
  if (tag ~ /^(AHAL)([_.]|$)/) c = "vendor"
  if (tag ~ /^(PAL|PalClient|PalStream|pal_stream)/) c = "vendor"
  if (tag ~ /^(AGM|Agm|agm)([_.]|$)/) c = "vendor"
  if (tag ~ /^(GSL|Gsl)([_.]|$)/ || tag ~ /^SessionAlsa/) c = "vendor"
  if (tag ~ /^(ACDB|Acdb|GPR|APR)([_.]|$)/) c = "vendor"
  if (tag ~ /^(CAR\.MEDIA|CAR_AUDIO)/) c = "aosp"
  return c
}
{
  prio = ""; tag = ""
  for (i = 1; i <= NF; i++) {
    if ($i ~ /^[VDIWEFS]$/ && (i + 1) <= NF) {
      prio = $i
      tag = $(i + 1)
      sub(/:$/, "", tag)
      break
    }
  }
  if (tag == "") next
  kind = classify(tag)
  if (kind == "none") next
  print kind "\t" $0
}
'

echo "logcat snapshot (main,system,crash · last 4000 lines · tag-filtered)"
RING="$OUT/07_logcat_ring.txt"
if adb logcat -d -b main,system,crash -v threadtime -t 4000 >"$RING" 2>&1; then
  FILTERED="$(awk "$LOG_AWK" "$RING" || true)"
  {
    echo "=== filtered logcat (AOSP + client) ==="
    echo "Tags: AAudio AAudioStream AudioTrack AudioRecord AudioManager AudioService"
    echo "      AudioFlinger AudioHwDevice FastMixer APM_AudioPolicyManager AudioPolicyService"
    echo "      android.hardware.audio CarAudioService CarAudioFocus CAR.MEDIA"
    echo "      MediaSessionService MediaFocusControl VolumeShaper FadeOutManager"
    echo
    printf '%s\n' "$FILTERED" | awk -F'\t' '$1=="aosp" { sub(/^[^\t]+\t/, ""); print }' || true
    echo
    echo "=== filtered logcat (Qualcomm-like vendor; names vary — invent no module IDs) ==="
    echo "Tags/prefixes: AHAL_*  PAL PalClient PalStream pal_stream*  AGM agm_server"
    echo "               SessionAlsa*  GSL  ACDB GPR APR"
    echo "PAL is HLOS. AGM is the graph. AFE/ADSP internals are QXDM/QCAT, not this file."
    echo
    printf '%s\n' "$FILTERED" | awk -F'\t' '$1=="vendor" { sub(/^[^\t]+\t/, ""); print }' || true
  } >"$OUT/07_logcat_threadtime.txt"
  if ! grep -qE '^[0-9][0-9]-' "$OUT/07_logcat_threadtime.txt"; then
    echo "(no matching lines in the logcat ring — event missed the 4000-line window, or this BSP uses different tags; inspect 07_logcat_ring.txt)" >>"$OUT/07_logcat_threadtime.txt"
  fi
else
  echo "logcat -d failed" >"$OUT/07_logcat_threadtime.txt"
fi

# --- ALSA ------------------------------------------------------------------
{
  echo "=== /proc/asound/cards ==="
  adb shell cat /proc/asound/cards 2>/dev/null || echo "not visible"
  echo
  echo "=== /proc/asound/pcm ==="
  adb shell cat /proc/asound/pcm 2>/dev/null || echo "not visible"
  echo
  echo "=== first playback status (if sysfs exists; RUNNING vs XRUN) ==="
  adb shell sh -c 'for f in /proc/asound/card*/pcm*p/sub0/status; do echo "== $f =="; cat "$f" 2>/dev/null; done' 2>/dev/null || echo "not visible"
} >"$OUT/08_asound.txt"

cat >"$OUT/NOTES.txt" <<'EOF'
Fill this in before you ask for help.

Symptom (one user sentence):

Expected path (usage → zone → bus/address → IModule stream → PCM):

Last-known-good layer (and which file proved it):

Client path (AudioTrack vs AAudio vs MediaPlayer):

Hypotheses (at least two layers; at least one AOSP and one vendor if Qualcomm-like):
AOSP:
Vendor (PAL/AGM/AHAL — or n/a):

Android 15 + AIDL? (see 01_hal_classification.txt):
Car XML version / fade flag if AAOS:
ro.board.platform:

If AOSP already shows the wrong bus or two tracks on one mix, do not open QXDM yet.
QXDM/QCAT is last (ADSP/AFE). Invent no PAL module IDs — copy strings your BSP printed.

Do not paste this whole folder into chat without a question.
Point at the 20 lines that distinguish A vs B.
EOF

echo
echo "Done: $OUT"
echo "Next: fill NOTES.txt, then annotate like workbook/README.md"
echo "Log tags: AAudio + PAL/AGM/AHAL prefixes in 07_logcat_threadtime.txt (ring is unfiltered)."
