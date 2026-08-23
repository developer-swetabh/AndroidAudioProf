/** How to capture and read evidence. AOSP commands + Qualcomm QXDM labeled vendor. */

export const CAPTURE_KIT = [
  {
    id: "pair",
    title: "1. Pair Flinger dumps (motion)",
    body: "One dump is a photograph. Two dumps one second apart prove frames moved. Always pair while the symptom is happening.",
    cmd: `adb shell dumpsys media.audio_flinger > /tmp/af1.txt
sleep 1
adb shell dumpsys media.audio_flinger > /tmp/af2.txt`,
  },
  {
    id: "policy",
    title: "2. Policy + AudioService (+ Car on AAOS)",
    body: "Policy is the live patch and mixes. AudioService is focus/volume/devices. CarAudioService is zones, groups, CarAudioFocus. None of these mix PCM.",
    cmd: `adb shell dumpsys media.audio_policy > /tmp/ap.txt
adb shell dumpsys audio > /tmp/as.txt
adb shell dumpsys car_service --services CarAudioService > /tmp/car.txt`,
  },
  {
    id: "logcat",
    title: "3. logcat threadtime",
    body: "Movie of events. You need tid to tell FastMixer from Binder. Absence of a line is not health. Prefer the lab script filter: AAudio, AudioFlinger, PAL/AGM/AHAL as *tags* (not a whole-line grep for pal).",
    cmd: `adb logcat -v threadtime -b main,system,crash -d > /tmp/logcat.txt
# or: ./labs/capture_audio_lab.sh --label <symptom>`,
  },
  {
    id: "perfetto",
    title: "4. Perfetto (time bugs)",
    body: "Overlap and distortion that are periodic: capture while reproducing. Look for AudioFlinger / mixer / FastMixer slices longer than period_ms. If audio atrace tags are off in the build, empty traces prove nothing.",
    cmd: `# userdebug/eng; enable audio atrace on that build
# Perfetto UI: https://ui.perfetto.dev
# Hunt PlaybackThread / FastMixer / AudioMixer wall time vs period_ms`,
  },
  {
    id: "qxdm",
    title: "5. QXDM / QCAT (Qualcomm-like only)",
    body: "Not AOSP. QXDM is Qualcomm’s diagnostic capture (DIAG). Parse with QCAT for ADSP/AFE/PAL session bring-up. Do this after Flinger looks healthy, or you will debug the DSP for a wrong usage. Invent no module IDs — use the strings your BSP actually prints.",
    cmd: `# Host tool: QXDM while reproducing, save .isf / DIAG
# QCAT: look for use-case start, graph build, AFE port, clip/AGC
# This course will not name proprietary PAL module IDs.`,
  },
  {
    id: "lab",
    title: "6. Fingerprint the capture",
    body: "The repo lab script packs fingerprint + paired Flinger + Policy + Car + logcat. Prefer it over ad-hoc files with no build id.",
    cmd: `./labs/capture_audio_lab.sh --label overlap_aa_radio`,
  },
];

export const ANALYZE = [
  {
    title: "Join keys",
    body: "session, uid, device address, output id. If Flinger bus ≠ Policy patch ≠ Car context map, you have split-brain, not a codec bug.",
  },
  {
    title: "Motion",
    body: "t1−t0 frames at the thread rate is wall time. Frozen ACTIVE is not an XRUN. Dumping once cannot prove silence.",
  },
  {
    title: "How many tracks on one thread",
    body: "Overlap: two ACTIVE tracks on one MixerThread at full scale. Hardware duck cannot exist there — the DSP already received one PCM.",
  },
  {
    title: "Two state machines",
    body: "Flinger software standby vs StreamDescriptor STANDBY vs ALSA PCM state. Do not treat them as one word.",
  },
  {
    title: "Perfetto vs dumpsys",
    body: "dumpsys says what is mixing. Perfetto says whether that mix missed the period. Distortion that is a 10 ms chop is a deadline until proven otherwise.",
  },
  {
    title: "QXDM last",
    body: "If AOSP already shows two MEDIA tracks on BUS00_MEDIA, QXDM will only show a busy AFE. Fix the mix/focus first.",
  },
];

export const RCA_HINT = `Symptom: one user sentence (what works, what does not, when, where).
Immediate failure: the first dump line that is not the expected state.
Root cause: the decision or stalled machine that produced that line.
Contributing factor: why the obvious lever (bus mute, fade XML, amp) will not fix it.
Fix: smallest layer change + what you will measure + what else could break.`;
