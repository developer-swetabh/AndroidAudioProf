/** Teaching reconstructions. Field *ideas* from Module 20 / workbook — not a byte-accurate dumpsys. */

export const SERVICES = [
  { id: "flinger", name: "media.audio_flinger", cmd: "adb shell dumpsys media.audio_flinger" },
  { id: "policy", name: "media.audio_policy", cmd: "adb shell dumpsys media.audio_policy" },
  { id: "audio", name: "audio (AudioService)", cmd: "adb shell dumpsys audio" },
  { id: "car", name: "CarAudioService", cmd: "adb shell dumpsys car_service --services CarAudioService" },
  { id: "hal", name: "StreamDescriptor / HAL", cmd: "adb logcat -s AudioFlinger android.hardware.audio" },
  { id: "alsa", name: "ALSA PCM", cmd: "adb shell cat /proc/asound/pcm" },
  { id: "perfetto", name: "Perfetto", cmd: "Perfetto UI · mixer slices vs period_ms" },
  { id: "qxdm", name: "QXDM / QCAT", cmd: "Qualcomm DIAG capture · not AOSP" },
];

const NOTE = "Teaching reconstruction (Module 20 ideas). Formatting varies by branch.";

export const DUMPS = {
  "flinger/healthy-media": {
    service: "flinger",
    note: NOTE,
    text: `HAL: AIDL IModule/default
Output thread MIXER 48000 Hz ch=2 fmt=PCM_16_BIT
  device=AUDIO_DEVICE_OUT_BUS address=bus0_media_out
  software standby=no
  StreamDescriptor.state=ACTIVE
  observable.frames t0=480000  t1=528000   ← dump twice; motion
  xrunFrames=0  latencyMs=20
  Track session=77 uid=10080 ACTIVE usage=MEDIA vol=1.000 muted=0
    framesWritten t0=479000 t1=527000`,
  },
  "flinger/wrong-usage": {
    service: "flinger",
    note: NOTE,
    text: `Thread MIXER bus0_media_out standby=no State=ACTIVE
  Track session=77  uid=10080 ACTIVE usage=MEDIA vol=1.0 frames moving
  Track session=129 uid=10095 ACTIVE usage=MEDIA vol=1.0 frames moving
Thread MIXER bus1_navigation_out standby=yes State=STANDBY
  (no tracks)`,
  },
  "flinger/standby-chime": {
    service: "flinger",
    note: NOTE,
    text: `Thread MIXER bus7_system_sound_out
  software standby=yes → leaving
  StreamDescriptor.state=STANDBY
  Track session=201 ACTIVE usage=ASSISTANCE_SONIFICATION vol=1.0
    framesWritten=9600   ← app already finished the WAV`,
  },
  "flinger/stream-error": {
    service: "flinger",
    note: NOTE,
    text: `Thread MIXER bus0_media_out 48000 Hz ch=8
  software standby=no
  StreamDescriptor.state=ERROR
  observable.frames=UNKNOWN  xrunFrames=0
  Track session=77 uid=10080 ACTIVE usage=MEDIA
    framesWritten increasing
    underrun climbing`,
  },
  "flinger/bt-a2dp": {
    service: "flinger",
    note: NOTE,
    text: `Thread MIXER device=AUDIO_DEVICE_OUT_BLUETOOTH_A2DP
  software standby=no  frames++
  StreamDescriptor.state=ACTIVE
Thread MIXER SPEAKER  software standby=yes  (cabin idle)`,
  },
  "flinger/xrun": {
    service: "flinger",
    note: NOTE,
    text: `Thread MIXER 48000 Hz period ~10 ms
  StreamDescriptor.state=ACTIVE
  xrunFrames climbing every burst
  Track ACTIVE underrun climbing
  framesWritten still increasing (late, not stopped)`,
  },
  "flinger/vendor-green": {
    service: "flinger",
    note: NOTE,
    text: `Thread MIXER bus0_media_out
  software standby=no
  StreamDescriptor.state=ACTIVE
  observable.frames moving  xrunFrames=0
  Track ACTIVE usage=MEDIA vol=1.0
  ← AOSP looks healthy. Cabin may still be silent.`,
  },
  "flinger/paused-focus": {
    service: "flinger",
    note: NOTE,
    text: `Thread MIXER SPEAKER standby=no
  Track session=77 uid=10080 PAUSED usage=MEDIA
  StreamDescriptor.state=IDLE
  frames frozen`,
  },
  "policy/healthy-aaos": {
    service: "policy",
    note: NOTE,
    text: `Device ports:
  BUS address=bus0_media_out     48000 PCM_16_BIT OUT_STEREO
  BUS address=bus1_navigation_out 48000 PCM_16_BIT OUT_STEREO
Dynamic mix: USAGE_MEDIA,USAGE_GAME,USAGE_UNKNOWN → bus0_media_out
Dynamic mix: USAGE_ASSISTANCE_NAVIGATION_GUIDANCE → bus1_navigation_out
Patch: mix:media_bus0 → device:bus0_media_out`,
  },
  "policy/wrong-usage": {
    service: "policy",
    note: NOTE,
    text: `Dynamic mix: USAGE_MEDIA → bus0_media_out
Dynamic mix: USAGE_ASSISTANCE_NAVIGATION_GUIDANCE → bus1_navigation_out
Patch live: mix:media_bus0 → bus0_media_out
(no patch on bus1_navigation_out)
← session 129 is MEDIA, so it matched the media mix.`,
  },
  "policy/shared-bus": {
    service: "policy",
    note: NOTE,
    text: `Device port BUS address=bus0_media_out
Dynamic mix: USAGE_MEDIA AND USAGE_ASSISTANCE_NAVIGATION_GUIDANCE
  → same bus0_media_out
Patch: one mixport → bus0_media_out
← two contexts, one PCM at the DSP. Hardware duck is impossible.`,
  },
  "policy/stale-a2dp": {
    service: "policy",
    note: NOTE,
    text: `Devices:
  AUDIO_DEVICE_OUT_BLUETOOTH_A2DP  AVAILABLE
  AUDIO_DEVICE_OUT_SPEAKER         AVAILABLE
Live patch: mixport → A2DP
← AVAILABLE is not “headset is alive.” Flinger thread is the live evidence.`,
  },
  "policy/profile-8ch": {
    service: "policy",
    note: NOTE,
    text: `Port bus0_media_out profiles=48000 PCM_16_BIT OUT_7POINT1
← Policy advertised 8ch. HAL/vendor may still EINVAL on open/burst.
IModule.getAudioPorts() is the topology APM believed.`,
  },
  "car/healthy": {
    service: "car",
    note: NOTE,
    text: `Zone 0 primary occupantZoneId=0 user=10
  VolumeGroup media        address=bus0_media_out     contexts: MUSIC
  VolumeGroup navigation   address=bus1_navigation_out contexts: NAVIGATION
  Focus holders:
    uid=10080 usage=AUDIO_USAGE_MEDIA gain=GAIN zone=0`,
  },
  "car/wrong-usage": {
    service: "car",
    note: NOTE,
    text: `MUSIC      → bus0_media_out     group=media
NAVIGATION → bus1_navigation_out group=navigation
Focus:
  uid=10080 usage=MEDIA gain=GAIN
  uid=10095 usage=MEDIA gain=GAIN    # nav APK, usage=MEDIA
← CarAudioContext.MUSIC matched. Nav knob is the other group.`,
  },
  "car/shared-bus": {
    service: "car",
    note: NOTE,
    text: `volumeGroups:
  group cabin
    device address=bus0_media_out
      context MUSIC
      context NAVIGATION
Focus: MEDIA GAIN + NAVIGATION GAIN_TRANSIENT_MAY_DUCK GRANTED
← concurrent focus granted; both still one mixport.`,
  },
  "audio/focus-loss": {
    service: "audio",
    note: NOTE,
    text: `MediaFocusControl (phone) / CarAudioFocus (AAOS)
  holder uid=10080 MEDIA GAIN
  uid=10095 NAVIGATION  GAIN_TRANSIENT_MAY_DUCK
Focus is not getOutputForAttr. An app can ignore LOSS;
AAOS 15+ may still fade/mute the loser.`,
  },
  "hal/error": {
    service: "hal",
    note: NOTE,
    text: `IModule.openOutputStream OK  address=bus0_media_out ch=8 rate=48000
Command.start STATUS_OK
Command.burst STATUS_OK (first)
<vendor> pal/graph or pcm_write: EINVAL / AFE start failed
Command.burst → StreamDescriptor.state=ERROR
← ERROR: only legal next step is IStreamCommon.close.`,
  },
  "hal/standby-late": {
    service: "hal",
    note: NOTE,
    text: `T+0.000  Track::start
T+0.010  StreamDescriptor.state=STANDBY
T+0.040  WAV ended (200 ms)
T+0.180  Command.start / first burst → ACTIVE
← HAL STANDBY is not Flinger PlaybackThread standby, but Flinger uses Command.standby to get here.`,
  },
  "alsa/running-zeros": {
    service: "alsa",
    note: NOTE,
    text: `state: RUNNING
hw_ptr moving
XRUN count not climbing
← digital path alive. Zeros in the ring are silence, not an XRUN.
Policy does not pcm_open.`,
  },
  "alsa/xrun": {
    service: "alsa",
    note: NOTE,
    text: `state: XRUN    ← not RUNNING
pcm_write: EPIPE
← prepare → PREPARED, then start. Frozen hw_ptr with RUNNING is clocks/DAI/DMA, not Policy.`,
  },
  "alsa/not-started": {
    service: "alsa",
    note: NOTE,
    text: `state: PREPARED
hw_ptr frozen
← trigger START never happened, or start_threshold not reached.`,
  },
  "hal/active": {
    service: "hal",
    note: NOTE,
    text: `StreamDescriptor.state=ACTIVE
Command.burst STATUS_OK
observable.frames increasing
xrunFrames not climbing
← I/O contract is alive. Analog can still be muted.`,
  },
  "flinger/overlap-aa-radio": {
    service: "flinger",
    note: NOTE,
    text: `ONE MixerThread  address=BUS00_MEDIA  State=ACTIVE
  Track uid=AA     MEDIA  ACTIVE vol=1.0  frames still moving
  Track uid=Radio  MEDIA  ACTIVE vol=1.0  transfer started
← two writers, one mixport, both at digital full scale.
Overlap window ~300 ms if AA has not abandonAudioFocus yet.`,
  },
  "policy/overlap-same-bus": {
    service: "policy",
    note: NOTE,
    text: `Dynamic mix: USAGE_MEDIA → BUS00_MEDIA
AA and Radio both USAGE_MEDIA → same mixport → same BUS
Patch: one mix → BUS00_MEDIA
← muting that BUS in the HAL would mute radio too.`,
  },
  "audio/overlap-fade-blocked": {
    service: "audio",
    note: NOTE,
    text: `Radio requestAudioFocus(GAIN)  // winner
AA still holder, has not abandonAudioFocus()
AA flags: AUDIOFOCUS_FLAG_PAUSES_ON_DUCKABLE_LOSS
FadeOutManager.canCauseFadeOut(requester, loser):
  loser has PAUSES_ON_DUCKABLE_LOSS → return false
  log: "not fading out: loser has PAUSES_ON_DUCKABLE_LOSS"
← fade XML is installed; this LOSS does not fade AA.
AA promised to pause; it drained the client/mixer buffer instead.`,
  },
  "perfetto/deadline": {
    service: "perfetto",
    note: NOTE,
    text: `PlaybackThread / AudioMixer / FastMixer slices
  several > period_ms (e.g. 10 ms deep-buffer period, 14 ms slice)
← time bug. dumpsys still shows ACTIVE.
If audio atrace tags are disabled on the build, empty trace ≠ healthy.`,
  },
  "perfetto/overlap": {
    service: "perfetto",
    note: NOTE,
    text: `Two client write paths overlapping on the same PlaybackThread
Radio start vs AA last bursts in the same ~300 ms window
← confirms Flinger still mixing both. Not a DSP “stuck unmute.”`,
  },
  "qxdm/afe-busy": {
    service: "qxdm",
    note: NOTE,
    text: `QCAT (Qualcomm-like, not AOSP):
  PAL/AGM session up for media use-case
  AFE port started, no graph-build error
← DSP is playing whatever Flinger already mixed.
If two tracks mixed at 1.0, QXDM will show a busy AFE, not a duck.
Do not invent PAL module IDs. Read the strings your BSP prints.`,
  },
  "qxdm/clip": {
    service: "qxdm",
    note: NOTE,
    text: `QCAT: AFE/PP clip or AGC hitting ceiling
Flinger: two ACTIVE tracks vol=1.0 on one MIXER thread
← digital clip at mix or DSP. Split buses or fade the loser.
QXDM alone cannot tell you the two tracks were USAGE_MEDIA on one bus.`,
  },
  "flinger/clip-mix": {
    service: "flinger",
    note: NOTE,
    text: `Thread MIXER 48000 Hz State=ACTIVE xrunFrames=0
  Track A MEDIA ACTIVE vol=1.000
  Track B MEDIA ACTIVE vol=1.000
← software mix of two full-scale streams. Harsh/clip, not XRUN.
Tee sink WAV (if enabled) will show the clip in digital.`,
  },
  "alsa/tdm-shift": {
    service: "alsa",
    note: NOTE,
    text: `PCM RUNNING  8ch  S16  48 kHz  hw_ptr moving  XRUN=0
Cabin: FL/FR swapped or voice in a woofer slot
← FSYNC/slot map, not Policy. car XML does not program TDM slots.`,
  },
  "alsa/healthy": {
    service: "alsa",
    note: NOTE,
    text: `state: RUNNING
hw_ptr moving
XRUN count=0
← FE PCM alive. Analog unmute is still a different proof.`,
  },
  "audio/healthy": {
    service: "audio",
    note: NOTE,
    text: `MediaFocusControl / CarAudioFocus
  holder uid=10080 AUDIO_USAGE_MEDIA gain=GAIN zone=0
← one holder. Focus is not the route. getOutputForAttr already ran at createTrack.`,
  },
  "flinger/shared-bus": {
    service: "flinger",
    note: NOTE,
    text: `ONE MixerThread  bus0_media_out  standby=no  State=ACTIVE
  Track session=77  uid=10080 MEDIA       ACTIVE vol=1.000
  Track session=129 uid=10095 NAVIGATION  ACTIVE vol=1.000
  observable.frames moving
  xrunFrames=0
IModule reports a single opened output stream on bus0_media_out
← DSP sees one PCM. Hardware duck is impossible on this graph.`,
  },
  "flinger/carmedia-idle": {
    service: "flinger",
    note: NOTE,
    text: `Thread MIXER bus0_media_out  software standby=yes  State=STANDBY
  (no new MEDIA track after the source switch)
← mix looks idle. StreamDescriptor is not ERROR. This is not case 06 overlap.`,
  },
  "car/carmedia-uninit": {
    service: "car",
    note: NOTE,
    text: `CarMediaService
  user=10
  SharedPreferences: not initialized
  log: SharedPreferences are not initialized!
  mPendingInit=false
  onUserVisible: not observed this trial
  startMediaConnectorServiceLocked:
    Cannot start MediaConnection service. User 10 has not been initialized
  last source component: (null — mSharedPrefs == null)
← 3/10 race: switch before VISIBLE/unlock armed pending init.`,
  },
  "audio/carmedia-focus-ok": {
    service: "audio",
    note: NOTE,
    text: `requestAudioFocus / abandonAudioFocus: OK
CarAudioFocus: grants look healthy
← red herring. Focus success does not prove CarMedia started MediaConnection.`,
  },
  "audio/assistant-loss": {
    service: "audio",
    note: NOTE,
    text: `CALL_RING request GRANTED
  AOSP FocusInteraction: VOICE_COMMAND holder + CALL_RING = INTERACTION_EXCLUSIVE
Assistant uid received LOSS
Assistant AudioPlaybackConfiguration still ACTIVE — client still writing
USAGE_ASSISTANT  (not USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
FadeOutManager: auto-fade is MEDIA/GAME; SPEECH / assistant is unfadeable
← last-known-good is the focus decision. Failure is above HAL.`,
  },
  "flinger/assistant-still": {
    service: "flinger",
    note: NOTE,
    text: `Thread MIXER  cabin speaker  State=ACTIVE
  Track uid=Assistant USAGE_ASSISTANT ACTIVE vol=1.0 frames moving
  Track uid=AA USAGE_NOTIFICATION_RINGTONE  (not mixed / not heard)
← mute the assistant player after LOSS. Do not mute BUS00_MEDIA.`,
  },
  "policy/assistant-ring": {
    service: "policy",
    note: NOTE,
    text: `Live patch: assistant / VOICE_COMMAND mix still open
CALL_RING expected on speaker after exclusive LOSS
← routing XML did not pick the wrong bus. Exclusive LOSS already happened.`,
  },
  "qxdm/graph-down": {
    service: "qxdm",
    note: NOTE,
    text: `QCAT (Qualcomm-like, not AOSP):
  PAL/AGM graph not built or AFE port not started
  Flinger dumpsys still ACTIVE
← AOSP stops at the HAL. Do not invent PAL module IDs or ACDB names.`,
  },
};

export function dumpServiceOf(id) {
  return String(id || "").split("/")[0] || "";
}

export function getDump(id) {
  return DUMPS[id] || null;
}
