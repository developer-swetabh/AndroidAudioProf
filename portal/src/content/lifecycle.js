/** Lifecycle studio copy. Essays stay in Modules 03/06/07/08/12–14. */

export const LIFE_SCENES = [
  {
    id: "create",
    name: "createTrack vs play()",
    blurb: "Construction already routes. play() starts the thread.",
    product: "Phone · AOSP",
    myth: "The app does not Binder to Policy for createTrack. PCM never visits Policy or AudioService.",
  },
  {
    id: "period",
    name: "The period loop",
    blurb: "prepareTracks → mix → Command.burst → sleep. Direct/Offload skip mix, not Flinger.",
    product: "audioserver",
    myth: "FastMixer is a helper on MixerThread, not a third HAL output. Direct/Offload skip AudioMixer.",
  },
  {
    id: "bus",
    name: "Two-bus vs shared",
    blurb: "Two MixerThreads can HW-duck. One bus cannot.",
    product: "AAOS",
    myth: "CarAudioService registered the mixes at boot. It is not on the sample path.",
  },
  {
    id: "standby",
    name: "Two STANDBYs",
    blurb: "Flinger software standby is not StreamDescriptor STANDBY.",
    product: "audioserver · vendor",
    myth: "STANDBY is not system suspend. A Track can look ACTIVE while the HAL stream is already torn down.",
  },
  {
    id: "policy",
    name: "Policy room",
    blurb: "Policy returns a ticket at createTrack. The period loop does not re-ask speaker-or-bus.",
    product: "audioserver",
    myth: "AVAILABLE is a port. A live route is a patch. App still Binders to Flinger, not Policy.",
  },
];

export const CREATE_STEPS = [
  {
    id: "new",
    short: "new",
    title: "Builder, no PCM yet",
    who: "app / AudioTrack",
    where: "AudioTrack.Builder",
    line: "You have a musician with a usage badge. Nothing is mixed. Policy has not been asked. native_setup has not run.",
    dump: "No Flinger track yet. play() has not run.",
    live: { control: [], data: [] },
    hot: ["app"],
  },
  {
    id: "createTrack",
    short: "createTrack",
    title: "App Binders to Flinger",
    who: "app → audioserver",
    where: "JNI native_setup → IAudioFlinger.createTrack",
    line: "This Binder is createTrack. It is not IAudioPolicyService. Shared memory is about to exist.",
    dump: "dumpsys media.audio_flinger → a Track line with your uid/session (may still be idle).",
    live: { control: [], data: ["app-flinger"] },
    hot: ["app", "flinger"],
  },
  {
    id: "getOutput",
    short: "getOutputForAttr",
    title: "Flinger asks Policy (peer)",
    who: "audioserver · peers",
    where: "AudioSystem.getOutputForAttr",
    line: "Policy returns an io handle (device/address + thread). PCM does not ride this query. App did not Binder to Policy.",
    dump: "dumpsys media.audio_policy → mix/patch for that usage. Join the address to Flinger.",
    live: { control: ["peer"], data: ["app-flinger"] },
    hot: ["app", "policy", "flinger"],
  },
  {
    id: "track",
    short: "Track",
    title: "Track exists; thread may sleep",
    who: "audioserver / PlaybackThread",
    where: "Track idle on MixerThread",
    line: "You have a seat on a platform. The train may still be in software standby. No packets yet.",
    dump: "Track present, frames frozen. software standby=yes is normal before play().",
    live: { control: ["peer"], data: ["app-flinger"] },
    hot: ["app", "flinger", "policy"],
  },
  {
    id: "focus",
    short: "focus",
    title: "Focus is a different Binder",
    who: "system_server",
    where: "IAudioService / MediaFocusControl",
    line: "requestAudioFocus does not call getOutputForAttr. A rude app can still write. On AAOS, CarAudioFocus is still not PCM.",
    dump: "dumpsys audio → holder uid/usage. Join to the Flinger Track — they are different machines.",
    live: { control: ["app-svc"], data: ["app-flinger"] },
    hot: ["app", "svc", "flinger"],
  },
  {
    id: "play",
    short: "play()",
    title: "start — leave STANDBY if needed",
    who: "app → IAudioTrack",
    where: "Track::start → Command.start/burst if the stream is in STANDBY",
    line: "play() is not routing, and it does not open the HAL stream (that happened when Policy opened the output). If the thread was STANDBY, the next write sends Command.start + burst on the open stream; the vendor HAL may re-open its PCM/graph. First chime can die here.",
    dump: "software standby leaving; StreamDescriptor STANDBY→IDLE. See chime dumps if the WAV is short.",
    live: { control: [], data: ["app-flinger", "flinger-hal"] },
    hot: ["app", "flinger", "hal"],
  },
  {
    id: "pcm",
    short: "PCM",
    title: "Now the period can burst",
    who: "audioserver → vendor",
    where: "Command.burst on audio.fmq",
    line: "App write → mix → burst. Not HIDL write(). Policy is not in this call. Dump twice: t1−t0 is motion.",
    dump: "MixerThread ACTIVE, StreamDescriptor.state=ACTIVE, observable.frames moving, xrunFrames=0.",
    live: { control: [], data: ["app-flinger", "flinger-hal"] },
    hot: ["app", "flinger", "hal"],
  },
];

export const PERIOD_STEPS = [
  {
    id: "wake",
    short: "wake",
    title: "Period tick",
    who: "audioserver / MixerThread",
    where: "PlaybackThread::threadLoop",
    line: "The clock of this output woke. Policy is not re-routing. Time scale is period_ms, not Binder events.",
    dump: "Thread MIXER 48000 Hz period ~10–20 ms class. FastMixer is a helper on this thread, not a second speaker.",
  },
  {
    id: "prepare",
    short: "prepareTracks",
    title: "Who is on this train?",
    who: "audioserver / Track",
    where: "prepareTracks_l · obtainBuffer",
    line: "ACTIVE tracks with enough frames board. A late app is zeros for that track, not a blocked HAL. That is underrun, not Policy.",
    dump: "Track ACTIVE vs PAUSED. framesWritten vs mix period. Track underrun ≠ StreamDescriptor.xrunFrames yet.",
  },
  {
    id: "mix",
    short: "mix",
    title: "AudioMixer is a plus sign",
    who: "audioserver / AudioMixer",
    where: "AudioMixer::process",
    line: "After this box there is one PCM. The DSP cannot un-mix it. Direct/Offload skip this step — they do not skip Flinger.",
    dump: "Thread type MIXER. Two tracks at vol=1.0 here ⇒ software mix, not hardware duck.",
  },
  {
    id: "burst",
    short: "burst",
    title: "Write audio.fmq, then Command.burst",
    who: "audioserver → vendor HAL",
    where: "StreamDescriptor.Command.burst",
    line: "HAL must empty the FMQ. Not IStreamOut.write() on this course. Policy does not burst.",
    dump: "StreamDescriptor.state=ACTIVE, observable.frames moving, Command.burst STATUS_OK.",
  },
  {
    id: "sleep",
    short: "sleep",
    title: "Finish before period_ms",
    who: "audioserver / PlaybackThread",
    where: "threadLoop sleep / standby",
    line: "Work > period_ms ⇒ the next wake is late (glitch). Idle too long → Command.standby. That is not HAL StreamDescriptor STANDBY until Flinger says so.",
    dump: "Perfetto mixer slice vs period_ms. software standby=yes after idle. Dump twice.",
  },
];

export const BUS_LIFE_STEPS = [
  {
    id: "two",
    short: "two-bus",
    title: "Two MixerThreads",
    who: "audioserver · two outputs",
    where: "getOutputForAttr × two mixes",
    line: "USAGE_MEDIA → bus0. USAGE_ASSISTANCE_NAVIGATION_GUIDANCE → bus1. Two StreamDescriptors, two FE PCMs. DSP can hardware-duck.",
    dump: "dumpsys media.audio_policy → mix BUS00_MEDIA + mix BUS01_NAV (two outputs). Two MixerThreads.",
  },
  {
    id: "shared",
    short: "shared bus",
    title: "One PCM at the DSP",
    who: "audioserver · one output",
    where: "AudioMixer on one MixerThread",
    line: "Both contexts matched the same address. One IModule stream. Hardware duck is impossible — the DSP already saw a sum.",
    dump: "ONE MixerThread bus0_media_out. Track MEDIA vol=1.000 + Track NAVIGATION vol=1.000. DSP sees one PCM.",
  },
];

export const STANDBY_STEPS = [
  {
    id: "sw",
    short: "Flinger SW",
    title: "PlaybackThread software standby",
    who: "audioserver / PlaybackThread",
    where: "threadLoop idle → Command.standby",
    line: "No ACTIVE tracks long enough: Flinger standbys the output (Command.standby; the stream stays open). Next play() pays standby exit — Command.start plus whatever the vendor HAL re-initialises. This is not system suspend.",
    dump: "software standby=yes. Dump twice — frozen frames with State=ACTIVE is a different bug.",
  },
  {
    id: "hal",
    short: "HAL STANDBY",
    title: "StreamDescriptor STANDBY",
    who: "vendor HAL",
    where: "StreamDescriptor.state=STANDBY",
    line: "HAL contract after open, and after Command.standby from IDLE. Producer and consumer inactive. The stream stays open in STANDBY; IStreamCommon.close only happens when Policy closes the output.",
    dump: "StreamDescriptor.state=STANDBY. Happy path: STANDBY --start→ IDLE --burst→ ACTIVE.",
  },
  {
    id: "chime",
    short: "chime miss",
    title: "Track ACTIVE, descriptor already STANDBY",
    who: "audioserver vs vendor",
    where: "one-shot WAV vs idle timeout",
    line: "Route can be right. The WAV finished before standby exit (Command.start, vendor PCM/graph restart, amp ramp) completed. First chime dies here — not a Policy miss.",
    dump: "Thread MIXER software standby=yes → leaving. StreamDescriptor.state=STANDBY. Track ACTIVE framesWritten=9600 (WAV done).",
  },
];

export const POLICY_STEPS = [
  {
    id: "ticket",
    short: "ticket",
    title: "io handle at createTrack",
    who: "audioserver · peers",
    where: "AudioSystem.getOutputForAttr",
    line: "Policy returns a ticket. Flinger seats you. The period loop never asks speaker-or-bus again (until a reroute event).",
    dump: "Join mix/patch address to the Flinger thread. getOutputForAttr is not a period.",
  },
  {
    id: "bootmix",
    short: "boot mixes",
    title: "Car XML installs mixes once",
    who: "car_service → AudioService",
    where: "registerAudioPolicy / AudioMix",
    line: "play() matches a mix that already exists. XML is not re-parsed on play(). CarAudioService is not on the PCM path.",
    dump: "dumpsys media.audio_policy → dynamic mixes. dumpsys car_service --services CarAudioService.",
  },
  {
    id: "avail",
    short: "AVAILABLE",
    title: "Port vs live patch",
    who: "audioserver / AudioPolicy",
    where: "IModule.getAudioPorts vs setAudioPatch",
    line: "AVAILABLE is a port. A live route is a patch: Policy → AudioPolicyClient → Flinger → IModule.setAudioPatch. Not I2S pins.",
    dump: "Policy AVAILABLE on a sink Flinger already left is a stale-device bug, not volume.",
  },
];

const STEPS = {
  create: CREATE_STEPS,
  period: PERIOD_STEPS,
  bus: BUS_LIFE_STEPS,
  standby: STANDBY_STEPS,
  policy: POLICY_STEPS,
};

export function getLifeScene(id) {
  return LIFE_SCENES.find((s) => s.id === id) || LIFE_SCENES[0];
}

export function stepsFor(sceneId) {
  return STEPS[sceneId] || CREATE_STEPS;
}

export function parseLifeArg(arg = "") {
  const parts = String(arg || "")
    .split("/")
    .filter(Boolean);
  let scene = "create";
  let stepId = "";
  if (parts[0] && STEPS[parts[0]]) {
    scene = parts[0];
    stepId = parts[1] || "";
  } else if (parts[0]) {
    const hit = LIFE_SCENES.find((s) => stepsFor(s.id).some((x) => x.id === parts[0]));
    if (hit) {
      scene = hit.id;
      stepId = parts[0];
    }
  }
  const sc = getLifeScene(scene);
  const steps = stepsFor(sc.id);
  if (stepId && !steps.some((s) => s.id === stepId)) stepId = "";
  return { scene: sc.id, stepId };
}
