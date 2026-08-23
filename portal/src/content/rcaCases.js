/** Workbook 01–08 as labeled evidence cards. Dump text stays in debugDumps.js. */

export const RCA_SLOTS = [
  { id: "lkg", name: "Last-known-good", short: "LKG", hint: "Lowest layer with positive evidence" },
  { id: "immediate", name: "Immediate failure", short: "Fail", hint: "First dump line that is not the expected state" },
  { id: "root", name: "Root cause", short: "Root", hint: "The decision or stalled machine that produced that line" },
  { id: "contribute", name: "Contributing", short: "Why", hint: "Why the obvious lever will not fix it" },
  { id: "red", name: "Red herring", short: "Red", hint: "Looks spicy. Not this bug." },
];

export const SIX_Q = [
  { id: "who", label: "WHO", hint: "Owning component / process" },
  { id: "where", label: "WHERE", hint: "Layer on the pipeline — not an OSI number" },
  { id: "when", label: "WHEN", hint: "Timeline vs play() / focus / burst" },
  { id: "what", label: "WHAT", hint: "Dump line that is not the expected state" },
  { id: "why", label: "WHY", hint: "The decision that produced that line" },
  { id: "how", label: "HOW", hint: "Next dump or measurement that would prove a fix" },
];

export const RCA_CASES = [
  {
    id: "01",
    file: "01-healthy-media.md",
    title: "Healthy media (baseline)",
    product: "aaos",
    symptom: "Driver-zone media is playing. Cabin woofers have sound.",
    classify: "Android 15 · AIDL IModule/default · car XML v4 · dynamic routing · fade off",
    layer: "Baseline — no fix. Memorize this shape.",
    dumpScenario: "healthy-media",
    debug: null,
    note: "Baseline. Immediate-failure and root-cause trays should stay empty. Nav STANDBY is a red herring, not a bug.",
    prompts: [
      "Expected path?",
      "Last-known-good?",
      "Is the nav thread a problem?",
      "What does (t1−t0) frames tell you at 48 kHz?",
    ],
    cards: [
      { id: "car", dump: "car/healthy", slot: "lkg", why: "Zone, MUSIC→bus0, one MEDIA holder." },
      { id: "policy", dump: "policy/healthy-aaos", slot: "lkg", why: "Patch mix:media_bus0 → bus0_media_out." },
      { id: "flinger", dump: "flinger/healthy-media", slot: "lkg", why: "ACTIVE, frames moving, xrunFrames=0." },
      {
        id: "nav",
        service: "flinger",
        title: "Nav thread idle",
        text: `Thread MIXER bus1_navigation_out
  software standby=yes
  StreamDescriptor.state=STANDBY
  (no tracks)`,
        slot: "red",
        why: "Correct idle. No nav track. Not a bug.",
      },
    ],
    rca: {
      symptom: "Media playing; cabin has sound.",
      immediate: "None — last-known-good through StreamDescriptor.ACTIVE on bus0_media_out.",
      root: "n/a (baseline). Analog is not proven (no scope), but nothing in software contradicts cabin sound.",
      contribute: "Nav thread STANDBY is correct idle. Flinger software standby=no agrees with AIDL ACTIVE.",
      fix: "None. Learn this shape so cases 02–08 look wrong immediately.",
    },
    traps: ["Do not chase the STANDBY nav thread.", "One dump cannot prove motion — this case already has t0/t1."],
    learn: [
      { href: "#/learn/01", label: "Module 01 · layers" },
      { href: "#/learn/20", label: "Module 20 · dumps" },
      { href: "#/workbench/dump/flinger/healthy-media", label: "Dump lab · healthy" },
    ],
  },
  {
    id: "02",
    file: "02-wrong-usage.md",
    title: "Wrong usage (nav on media bus)",
    product: "aaos",
    symptom: "Nav volume knob does nothing; nav may be buried in media.",
    classify: "Android 15 · AIDL · car XML v4 · fade off",
    layer: "Application",
    dumpScenario: "wrong-usage",
    debug: "wrong-bus",
    prompts: [
      "Which bus is session 129 on, and why?",
      "Why does the nav knob do nothing?",
      "Is this a HAL / IModule bug?",
    ],
    cards: [
      {
        id: "app",
        service: "app",
        title: "App log",
        text: `AudioTrack created session=129
  usage=AUDIO_USAGE_MEDIA content=SPEECH
  playState=PLAYSTATE_PLAYING
  write() returns 960 repeatedly`,
        slot: "root",
        why: "content=SPEECH does not create NAVIGATION. Usage is the badge.",
      },
      { id: "flinger", dump: "flinger/wrong-usage", slot: "immediate", why: "session 129 is on the MUSIC bus. bus1 asleep." },
      { id: "car", dump: "car/wrong-usage", slot: "immediate", why: "Two MEDIA holders. Nav knob is the other group." },
      { id: "policy", dump: "policy/wrong-usage", slot: "contribute", why: "Policy matched the attributes it was given." },
      {
        id: "hal",
        service: "hal",
        title: "IModule blamed",
        text: `Hypothesis: IModule opened the wrong PCM / wrong bus.`,
        slot: "red",
        why: "bus1 is correctly asleep. Not an IModule bug.",
      },
    ],
    rca: {
      symptom: "Nav volume knob does nothing; nav may be buried in media.",
      immediate: "Nav PCM is on the MUSIC bus (session 129 usage=MEDIA).",
      root: "App set USAGE_MEDIA. content=SPEECH does not create NAVIGATION.",
      contribute: "No attribute check in the nav APK review. CarAudio is consistent with the attributes it was given.",
      fix: "USAGE_ASSISTANCE_NAVIGATION_GUIDANCE; confirm session on bus1.",
    },
    traps: ["Focus is not routing.", "bus1 STANDBY is consistent — do not “wake HAL” as the fix."],
    learn: [
      { href: "#/learn/05", label: "Module 05 · usage" },
      { href: "#/learn/13", label: "Module 13 · contexts" },
      { href: "#/debug/wrong-bus", label: "Debug · wrong bus" },
    ],
  },
  {
    id: "03",
    file: "03-shared-bus-no-duck.md",
    title: "Shared bus, no hardware duck",
    product: "aaos",
    symptom: "Nav and media both full-scale; clip. DSP team is blamed.",
    classify: "Android 15 AAOS · AIDL · car XML v4 · useFixedVolume=true · fade off",
    layer: "AAOS configuration + HAL gain (not the DSP “mixer” of one PCM)",
    dumpScenario: "shared-bus",
    debug: "shared-bus",
    prompts: [
      "How many HAL streams does the DSP see?",
      "Can hardware duck media independently?",
      "Smallest correct change set?",
    ],
    cards: [
      {
        id: "xml",
        service: "car",
        title: "car_audio_configuration.xml",
        text: `<device address="bus0_media_out">
  <context context="music"/>
  <context context="navigation"/>
</device>
useFixedVolume=true`,
        slot: "root",
        why: "v4 XML mapped MUSIC and NAVIGATION to the same address.",
      },
      { id: "flinger", dump: "flinger/shared-bus", slot: "immediate", why: "One mix, two tracks at vol=1.0, one IModule stream." },
      { id: "policy", dump: "policy/shared-bus", slot: "immediate", why: "Two contexts, one PCM at the DSP." },
      { id: "car", dump: "car/shared-bus", slot: "contribute", why: "CONCURRENT MAY_DUCK granted; still one mixport." },
      {
        id: "fixed",
        service: "flinger",
        title: "useFixedVolume",
        text: `useFixedVolume=true → Flinger will not duck PCM.
Hardware duck needs two HAL streams.`,
        slot: "contribute",
        why: "Flinger stays at 1.0. DSP still sees one stream.",
      },
      {
        id: "dsp",
        service: "qxdm",
        title: "DSP mixer duck",
        text: `Hypothesis: DSP “mixer” should duck media independently on this graph.`,
        slot: "red",
        why: "DSP already received one PCM. Hardware duck is impossible until there are two streams.",
      },
    ],
    rca: {
      symptom: "Both streams full-scale; clip.",
      immediate: "One Flinger mix, one IModule stream, two tracks at vol=1.0.",
      root: "v4 XML mapped MUSIC and NAVIGATION to the same address.",
      contribute: "useFixedVolume → Flinger will not duck PCM.",
      fix: "Split navigation to its own bus in car XML and IModule ports; implement HAL/DSP duck of media bus; keep CONCURRENT MAY_DUCK.",
    },
    traps: ["If this became a “DSP ducking bug,” reread Module 14.", "Focus GRANT is not two streams."],
    learn: [
      { href: "#/learn/14", label: "Module 14 · ducking" },
      { href: "#/architecture/navduck", label: "Architecture · two-bus" },
      { href: "#/debug/shared-bus", label: "Debug · shared bus" },
    ],
  },
  {
    id: "04",
    file: "04-standby-first-chime.md",
    title: "First chime / STANDBY",
    product: "aaos",
    symptom: "First seatbelt chime after idle missing; second (1 s later) heard.",
    classify: "Android 15 AAOS · AIDL · system sounds → bus7_system_sound_out",
    layer: "HAL bring-up / power policy for bus7",
    dumpScenario: "standby-chime",
    debug: "standby-chime",
    prompts: [
      "Is this an XRUN?",
      "Last-known-good for the first chime’s samples?",
      "Which AIDL command is late vs the one-shot?",
    ],
    cards: [
      { id: "flinger", dump: "flinger/standby-chime", slot: "immediate", why: "Descriptor STANDBY; app already finished the WAV." },
      { id: "hal", dump: "hal/standby-late", slot: "root", why: "Command.start / first burst after the 200 ms WAV ended." },
      {
        id: "tee",
        service: "flinger",
        title: "Tee sink (lab image)",
        text: `WAV contains the chime PCM (not zeros)`,
        slot: "lkg",
        why: "Flinger had samples. Last-known-good is digital mix.",
      },
      {
        id: "amp",
        service: "hw",
        title: "Scope",
        text: `amp EN for system slots rises at T+0.170`,
        slot: "contribute",
        why: "Analog unmute after the one-shot already finished.",
      },
      {
        id: "xrun",
        service: "alsa",
        title: "XRUN guess",
        text: `Hypothesis: first chime was an ALSA XRUN / underrun.`,
        slot: "red",
        why: "xrunFrames is not the story. Route was right; start was late.",
      },
    ],
    rca: {
      symptom: "First chime after idle missing.",
      immediate: "Analog unmute after the one-shot already finished.",
      root: "Stream stayed STANDBY / amp EN late vs 200 ms WAV (cold start after standby).",
      contribute: "System bus fully tears down; chime is shorter than bring-up.",
      fix: "Warm the chime path, shorten IModule start+unmute, or pre-roll silence. Do not disable all standby.",
    },
    traps: ["Missing Command.start/burst + analog EN is the late part — not Policy XML.", "Second chime is already ACTIVE."],
    learn: [
      { href: "#/learn/08", label: "Module 08 · AIDL" },
      { href: "#/learn/18", label: "Module 18 · power" },
      { href: "#/debug/standby-chime", label: "Debug · chime" },
    ],
  },
  {
    id: "05",
    file: "05-stream-error.md",
    title: "Stream ERROR (profile lie)",
    product: "aaos",
    symptom: "8ch media silent; 2ch still works. App does not crash.",
    classify: "Android 15 AAOS · AIDL IModule/default · MUSIC → bus0_media_out · profile 8ch advertised",
    layer: "Vendor HAL / DSP / ALSA — plus honest getAudioPorts()",
    dumpScenario: "stream-error",
    debug: "stream-error",
    qcom: true,
    prompts: [
      "Did Policy lie?",
      "Did Flinger fail to start the track?",
      "What does StreamDescriptor.ERROR allow next?",
      "AOSP hypothesis vs vendor hypothesis?",
    ],
    cards: [
      { id: "flinger", dump: "flinger/stream-error", slot: "immediate", why: "ERROR + UNKNOWN frames; client still writing." },
      { id: "hal", dump: "hal/error", slot: "immediate", why: "burst then vendor EINVAL → ERROR. close only." },
      { id: "policy", dump: "policy/profile-8ch", slot: "contribute", why: "IModule.getAudioPorts() claimed 8ch. Policy believed it." },
      {
        id: "vendor",
        service: "qxdm",
        title: "Vendor path",
        text: `<vendor> pal/graph or pcm_write: EINVAL / AFE start failed
← do not invent PAL module IDs. Read the strings your BSP prints.`,
        slot: "root",
        why: "Vendor path cannot run the 8ch use case it advertised.",
      },
      {
        id: "track",
        service: "flinger",
        title: "Track still ACTIVE",
        text: `Track session=77 ACTIVE usage=MEDIA
  framesWritten increasing
Hypothesis: Flinger failed to start the track.`,
        slot: "red",
        why: "Flinger started. The client is writing into a dead stream. Wrong bus is killed by address + 8ch thread.",
      },
    ],
    rca: {
      symptom: "8ch media silent; 2ch still works.",
      immediate: "StreamDescriptor.State=ERROR after first burst. observable.frames=UNKNOWN.",
      root: "Vendor path cannot run the 8ch use case it advertised (PCM/AFE/graph).",
      contribute: "IModule profile lie — Policy/Flinger legally opened 8ch.",
      fix: "Implement 8ch on that AFE/PCM or advertise only 2ch and let the framework upmix. Then close/reopen. ERROR is terminal.",
    },
    traps: [
      "Policy did not “fail.” It believed getAudioPorts().",
      "AOSP hypothesis (wrong bus) is killed by address + ACTIVE 8ch thread.",
    ],
    learn: [
      { href: "#/learn/08", label: "Module 08 · HAL" },
      { href: "#/learn/16", label: "Module 16 · DSP" },
      { href: "#/debug/stream-error", label: "Debug · ERROR" },
    ],
  },
  {
    id: "06",
    file: "06-aa-radio-same-bus-overlap.md",
    title: "AA → radio, same bus, ~300 ms overlap",
    product: "aaos",
    symptom: "AA and radio both audible ~300 ms after source = Radio.",
    classify: "Android 15 AAOS · AIDL · v4 · both USAGE_MEDIA → BUS00_MEDIA",
    layer: "Focus/fade (framework) + car fade XML — not Policy XML routing, not a codec path",
    dumpScenario: "overlap-aa-radio",
    debug: "overlap",
    prompts: [
      "Why is a HAL/DSP mute of BUS00_MEDIA the wrong lever?",
      "What does request-before-abandon actually prove?",
      "Why did applyFadeConfigs alone not change the cabin?",
    ],
    cards: [
      { id: "flinger", dump: "flinger/overlap-aa-radio", slot: "immediate", why: "Two MEDIA tracks mixed at vol=1.0 on one thread." },
      { id: "fade", dump: "audio/overlap-fade-blocked", slot: "root", why: "PAUSES_ON_DUCKABLE_LOSS → canCauseFadeOut false." },
      { id: "policy", dump: "policy/overlap-same-bus", slot: "contribute", why: "Shared bus. Muting that BUS would mute radio too." },
      { id: "perfetto", dump: "perfetto/overlap", slot: "lkg", why: "Confirms Flinger still mixing both. Not a DSP stuck unmute." },
      {
        id: "busmute",
        service: "hal",
        title: "HAL mute BUS00_MEDIA",
        text: `Hypothesis: Command.standby / DSP mute of BUS00_MEDIA until AA drains.`,
        slot: "red",
        why: "Radio uses that bus. Wrong lever.",
      },
      {
        id: "order",
        service: "audio",
        title: "Request before abandon",
        text: `Radio requestAudioFocus(GAIN) before AA abandonAudioFocus()
Hypothesis: that ordering is the root cause.`,
        slot: "red",
        why: "Request-before-abandon is normal. It does not explain the 300 ms drain.",
      },
    ],
    rca: {
      symptom: "AA and radio both audible ~300 ms after source = Radio.",
      immediate: "Two MEDIA tracks mixed on BUS00_MEDIA at vol=1.0 while AA still bursting.",
      root: "No per-track mute of the loser at LOSS. AA holds PAUSES_ON_DUCKABLE_LOSS, so FadeOutManager.canCauseFadeOut() returns false. AA's “pause” is a ~300 ms buffer drain.",
      contribute: "Shared bus (cannot HW-duck or bus-mute). Radio requestAudioFocus before AA abandon is normal.",
      fix: "v4 applyFadeConfigs + ~50 ms fadeOut so the losing player is VolumeShaped to 0 (bus stays up). Allow fade even when the loser set PAUSES_ON_DUCKABLE_LOSS if that player is still STARTED.",
    },
    traps: [
      "Do not Command.standby / DSP-mute BUS00_MEDIA.",
      "Fade XML is installed; this LOSS still does not fade AA.",
      "AOSP canCauseFadeOut literally skips fade when the loser has AUDIOFOCUS_FLAG_PAUSES_ON_DUCKABLE_LOSS.",
    ],
    learn: [
      { href: "#/learn/14", label: "Module 14 · concurrency" },
      { href: "#/learn/05", label: "Module 05 · focus" },
      { href: "#/debug/overlap", label: "Debug · overlap" },
    ],
  },
  {
    id: "07",
    file: "07-carmedia-prefs-init-race.md",
    title: "CarMedia prefs init race (3/10)",
    product: "aaos",
    symptom: "After AA↔Radio↔USB (any direction), no music. 3/10.",
    classify: "Android 15 AAOS · CarMediaService owns the active media source",
    layer: "CarMediaService (user lifecycle), not HAL, not fade",
    dumpScenario: "carmedia-race",
    debug: null,
    prompts: [
      "Why can focus be perfect and the cabin still be silent?",
      "Which dump proves CarMedia never started MediaConnection?",
      "What does 3/10 tell you that 10/10 would not?",
    ],
    cards: [
      { id: "car", dump: "car/carmedia-uninit", slot: "immediate", why: "Prefs null, pending false, MediaConnection never started." },
      {
        id: "pending",
        service: "car",
        title: "mPendingInit never armed",
        text: `onUserVisible() missing this trial
maybeInitUser() did not run
mPendingInit stayed false
unlock/visible cannot catch up`,
        slot: "root",
        why: "AOSP arms mPendingInit when the user is locked. The hole is a path that accepts a source change without maybeInitUser() / onUserVisible().",
      },
      { id: "flinger", dump: "flinger/carmedia-idle", slot: "lkg", why: "AOSP mix is idle, not ERROR. Not case 06 overlap." },
      { id: "focus", dump: "audio/carmedia-focus-ok", slot: "red", why: "Focus success hid the real owner (CarMedia)." },
      {
        id: "rate",
        service: "car",
        title: "3/10",
        text: `Symptom is 3/10, not 10/10.
When onUserVisible (or unlock+pending) happens first, switches work.`,
        slot: "contribute",
        why: "3/10 is a race (user-lifecycle vs source-switch), not a broken codec.",
      },
      {
        id: "hal",
        service: "hal",
        title: "Fade / HAL guess",
        text: `Hypothesis: fade XML or HAL stream died on the switch.`,
        slot: "red",
        why: "Kill fade/HAL when focus+AHAL look fine. Read CAR.MEDIA / CarMediaService dump.",
      },
    ],
    rca: {
      symptom: "After AA↔Radio↔USB (any direction), no music. 3/10.",
      immediate: "CarMedia did not restore/start the selected source (MediaConnection / last-source play never happened).",
      root: "SharedPreferences for save/restore were never initialized. onUserVisible() did not run on the failing trials, so initUser()/maybeInitSharedPrefs() never ran. mPendingInit was not set, so unlock did not catch up either.",
      contribute: "User CE storage is unavailable until unlock. Source switch can race user VISIBLE. Focus succeeding hid the real owner (CarMedia).",
      fix: "If the user play-context is not created / not initialized, set mPendingInit = true so the next unlock/visible path calls initUser() and arms prefs + MediaConnection.",
    },
    traps: [
      "“I cannot name the RC without HW logs” is the correct first sentence — the symptom matches a silent HAL stream.",
      "Do not blame HAL when focus was fine.",
    ],
    learn: [
      { href: "#/learn/12", label: "Module 12 · AAOS" },
      { href: "#/learn/21", label: "Module 21 · RCA" },
      { href: "#/workbench/dump/car/carmedia-race", label: "Dump lab · CarMedia" },
    ],
  },
  {
    id: "08",
    file: "08-assistant-ignores-focus-loss.md",
    title: "Assistant ignores exclusive LOSS",
    product: "aaos",
    symptom: "Assistant audible; AA BT ringtone not heard on speaker.",
    classify: "Android 15 AAOS + AA projected BT call · USAGE_ASSISTANT vs USAGE_NOTIFICATION_RINGTONE",
    layer: "AudioService / MediaFocusControl (enforcement), not Policy XML, not HAL, not CarMedia",
    dumpScenario: "assistant-loss",
    debug: null,
    prompts: [
      "Why is this not a routing XML bug?",
      "Why would applyFadeConfigs (case 06) likely fail here?",
      "What must happen when the call ends / assistant GAIN returns?",
    ],
    cards: [
      {
        id: "exclusive",
        service: "audio",
        title: "Exclusive LOSS delivered",
        text: `AOSP FocusInteraction: VOICE_COMMAND + CALL_RING = INTERACTION_EXCLUSIVE
CALL_RING GRANTED
Assistant received onAudioFocusChange(LOSS)`,
        slot: "lkg",
        why: "Last-known-good is CarAudioFocus / MediaFocusControl decision.",
      },
      { id: "audio", dump: "audio/assistant-loss", slot: "immediate", why: "LOSS delivered; assistant players still ACTIVE." },
      { id: "flinger", dump: "flinger/assistant-still", slot: "immediate", why: "Assistant PCM still mixed after exclusive LOSS." },
      {
        id: "app",
        service: "app",
        title: "Assistant ignores LOSS",
        text: `Closed-source player keeps writing after onAudioFocusChange(LOSS).
No GA source to fix.
AOSP auto-fade (12+) only auto-fades MEDIA/GAME.`,
        slot: "root",
        why: "Focus is cooperative for this usage. You cannot patch Google Assistant.",
      },
      {
        id: "fade",
        service: "audio",
        title: "applyFadeConfigs",
        text: `Hypothesis: v4 applyFadeConfigs (case 06) will fade assistant.`,
        slot: "contribute",
        why: "Assistant is often CONTENT_TYPE_SPEECH → FadeOutManager will not fade it.",
      },
      {
        id: "bus",
        service: "hal",
        title: "Mute BUS00_MEDIA",
        text: `Hypothesis: mute the shared media bus until assistant stops.`,
        slot: "red",
        why: "Ringtone on CALL_RING would die too. Mute the assistant player / uid.",
      },
      {
        id: "usage",
        service: "audio",
        title: "Match USAGE_ASSISTANCE_*",
        text: `Hypothesis: match every ASSISTANCE_* usage for the mute workaround.`,
        slot: "red",
        why: "There is no USAGE_ASSISTANCE. Do not mute NAVIGATION or SONIFICATION. Must unmute when that uid/usage regains focus.",
      },
    ],
    rca: {
      symptom: "Assistant audible; AA BT ringtone not heard on speaker.",
      immediate: "Assistant PCM still mixed after exclusive LOSS.",
      root: "Google Assistant continues playback after onAudioFocusChange(LOSS). No GA source to fix.",
      contribute: "AOSP auto-fade is MEDIA/GAME only; SPEECH/assistant is unfadeable. Focus is cooperative for this usage.",
      fix: "Workaround — use AOSP’s mute-on-focus-loss in MediaFocusControl.java and apply it to the assistant loser so the player is digitally muted. Ringtone (CALL_RING) stays audible. Unmute when that uid/usage regains focus.",
    },
    traps: [
      "Correct lever: per-player mute after LOSS.",
      "Wrong lever: mute the shared media bus; change CALL_RING vs VOICE_COMMAND (already exclusive in AOSP).",
      "Match USAGE_ASSISTANT. Do not mute USAGE_ASSISTANCE_NAVIGATION_GUIDANCE or USAGE_ASSISTANCE_SONIFICATION.",
    ],
    learn: [
      { href: "#/learn/05", label: "Module 05 · focus" },
      { href: "#/learn/12", label: "Module 12 · CarAudioFocus" },
      { href: "#/workbench/dump/audio/assistant-loss", label: "Dump lab · assistant" },
    ],
  },
];

export function getRcaCase(id) {
  return RCA_CASES.find((c) => c.id === id) || null;
}

export function rcaBlank() {
  return `Symptom:
Immediate failure:
Root cause:
Contributing factor:
Fix:`;
}

export function rcaFromAnswer(c) {
  const r = c.rca;
  return `Symptom:            ${r.symptom}
Immediate failure:  ${r.immediate}
Root cause:         ${r.root}
Contributing:       ${r.contribute}
Fix:                ${r.fix}
Layer:              ${c.layer}`;
}
