/** AAOS / AOSP audio config files. Markdown (07/12/13/14) stays the essay. */

export const XML_FAMILIES = [
  { id: "aaos", name: "AAOS map", process: "car_service" },
  { id: "policy", name: "Policy topology", process: "audioserver / vendor HAL" },
  { id: "engine", name: "CAP engine (optional)", process: "audioserver" },
  { id: "flags", name: "Feature flags", process: "car_service / system_server" },
  { id: "vendor", name: "Vendor HAL graphs", process: "vendor", vendor: true },
  { id: "history", name: "Replaced — do not use", process: "—" },
];

/** Running-machine join: XML is parsed at boot / zone-config switch, not on every play(). */
export const BUS_STEPS = [
  {
    id: "xml",
    title: "Boot: parse the map",
    who: "CarAudioService in car_service",
    line: "Read vendor/etc/car_audio_configuration.xml (then system/etc). Version 4. Validate every address against Policy ports.",
  },
  {
    id: "mix",
    title: "Boot: install mixes",
    who: "CarAudioService → AudioService.registerAudioPolicy",
    line: "Each context → device address becomes an AudioPolicyMix (usage match + user-id affinity). XML is now a running mix graph. It is not re-read on play().",
  },
  {
    id: "play",
    title: "play(): App → Flinger",
    who: "App process. Not a Policy Binder from the app.",
    line: "IAudioFlinger.createTrack. Usage is a badge on the track. Focus is a different Binder (AudioService).",
  },
  {
    id: "attr",
    title: "getOutputForAttr",
    who: "AudioFlinger asks AudioPolicy (peers in audioserver)",
    line: "If audioUseDynamicRouting: mix match (usage + user) → AUDIO_DEVICE_OUT_BUS + address. Else phone strategy → device type.",
  },
  {
    id: "thread",
    title: "PlaybackThread for that BUS",
    who: "AudioFlinger",
    line: "One address → one MixerThread → one IModule stream. Two contexts on one address → one PCM at the DSP. Hardware duck is impossible there.",
  },
  {
    id: "hal",
    title: "HAL stream for that address",
    who: "AIDL IModule (vendor)",
    line: "Opened once via IModule.openOutputStream when Policy opens the bus output at boot; standby/start after that. Profiles must match what the port advertised. car XML does not program TDM slots, mixer_paths, or PAL graphs.",
  },
];

export const XML_FILES = [
  {
    id: "car-audio-configuration",
    file: "car_audio_configuration.xml",
    family: "aaos",
    product: "aaos",
    version: "4 (this course). v2/v3 still boot until you use new tags. v2 root tag may be audioZoneConfiguration in a file still named car_audio_configuration.xml.",
    path: "vendor/etc/ first, then system/etc/",
    example: "device/generic/car/emulator/audio/car_audio_configuration.xml",
    process: "car_service",
    parser: "CarAudioService (CarAudioZonesHelper* / CarAudioContext — names vary by branch)",
    uses: [
      "Zones (audioZoneId) and occupantZoneId (one-to-one)",
      "Volume groups: devices that share one knob / one gain curve",
      "Context → device address (the AAOS routing map)",
      "zoneConfigs (v3+): non-primary zones may switch (headrest vs headphones)",
      "applyFadeConfigs / fadeConfig names (v4) → car_audio_fade_configuration.xml",
      "Optional: oemContexts (v3+), mirroringDevices, activationVolumeConfigs (15, gated by audioUseMinMaxActivationVolume)",
      "Parsed at boot and on zone-config switch — not on every play()",
    ],
    not: [
      "Does not mix PCM. CarAudioService is not on the sample path.",
      "Does not program TDM slots, FSYNC, or DAPM. Wrong speaker with matching Flinger address → leave this file.",
      "Does not pick usage. The app’s AudioAttributes.usage is the badge.",
      "Does not grant focus. CarAudioFocus is a different machine.",
      "Does not fade. v4 only *names* fade configs. Durations live in the fade XML + flag.",
    ],
    join: "address string = IModule.getAudioPorts() device port = dumpsys media.audio_policy = Flinger BUS. A typo is a silent bus. dumpsys is what booted — not the overlay in your tree.",
    dump: "adb shell dumpsys car_service --services CarAudioService",
    dumpAlso: "adb shell dumpsys media.audio_policy   # dynamic mixes + BUS ports",
    flags: ["audioUseDynamicRouting=true (else this file is mostly unused)"],
    modules: ["12", "13", "14", "07"],
    labs: [
      { href: "#/architecture/navduck", label: "Architecture · two-bus" },
      { href: "#/workbench/rca/03", label: "RCA · shared bus" },
      { href: "#/workbench/dump/car/shared-bus", label: "Dump lab · shared bus" },
    ],
    excerpt: `<carAudioConfiguration version="4">
  <zones>
    <zone name="primary zone" isPrimary="true" occupantZoneId="0">
      <zoneConfigs>
        <zoneConfig name="primary zone config 0" isDefault="true">
          <volumeGroups>
            <group>
              <device address="bus0_media_out">
                <context context="music"/>
                <context context="announcement"/>
              </device>
            </group>
            <group>
              <device address="bus1_navigation_out">
                <context context="navigation"/>
              </device>
            </group>
            <group>
              <device address="bus7_system_sound_out">
                <context context="system_sound"/>
                <context context="emergency"/>
                <context context="safety"/>
                <context context="vehicle_status"/>
              </device>
            </group>
          </volumeGroups>
          <applyFadeConfigs>
            <fadeConfig name="relaxed fading" isDefault="true"/>
          </applyFadeConfigs>
        </zoneConfig>
      </zoneConfigs>
    </zone>
  </zones>
</carAudioConfiguration>
← teaching shape (Module 13 / AOSP emulator). Primary zone: one zoneConfig on 14/15.`,
  },
  {
    id: "car-audio-fade",
    file: "car_audio_fade_configuration.xml",
    family: "aaos",
    product: "aaos",
    version: "1 (Android 15). Names must match applyFadeConfigs in car XML v4.",
    path: "vendor/etc/ (with the car audio config)",
    example: "device/generic/car/emulator/audio/car_audio_fade_configuration.xml",
    process: "car_service",
    parser: "CarAudioService → FadeManagerConfiguration when dispatching focus loss",
    uses: [
      "Named fade configs: defaultFadeOutDurationInMillis / defaultFadeInDurationInMillis",
      "Which loser/winner usages get which config (transient fadeConfig vs isDefault)",
      "System-enforced VolumeShaper on the *losing player* — bus stays up",
    ],
    not: [
      "Not a bus mute. HAL Command.standby / DSP mute of BUS00_MEDIA kills the winner too.",
      "Not hardware duck. That needs two HAL streams.",
      "XML installed ≠ fade ran. AOSP FadeOutManager.canCauseFadeOut returns false if the loser has PAUSES_ON_DUCKABLE_LOSS.",
      "Auto-fade is MEDIA/GAME in AOSP; SPEECH / assistant is often unfadeable (workbook 08).",
      "Off until audioUseFadeManagerConfiguration is true (default false).",
    ],
    join: "fadeConfig name in car XML v4 applyFadeConfigs = config name here. Then dumpsys audio / canCauseFadeOut log.",
    dump: "adb shell dumpsys audio",
    dumpAlso: "logcat: FadeOutManager / canCauseFadeOut",
    flags: ["audioUseFadeManagerConfiguration=true"],
    modules: ["14", "05", "21"],
    labs: [
      { href: "#/debug/overlap", label: "Debug · overlap" },
      { href: "#/workbench/rca/06", label: "RCA · AA→radio" },
    ],
    excerpt: `<carAudioFadeConfiguration version="1">
  <configs>
    <config name="relaxed fading"
            defaultFadeOutDurationInMillis="800"
            defaultFadeInDurationInMillis="500">
    </config>
  </configs>
</carAudioFadeConfiguration>
← teaching reconstruction (AOSP emulator ideas). Durations are OEM; 50 ms vs 300 ms drain is workbook 06, not a schema promise.`,
  },
  {
    id: "audio-policy-configuration",
    file: "audio_policy_configuration.xml",
    family: "policy",
    product: "both",
    version: "HIDL: APM input (XSD). AIDL 15: not APM’s primary contract.",
    path: "vendor/etc/ (often with includes for BT/USB/r_submix)",
    example: "device/generic/car/emulator/audio/audio_policy_configuration.xml",
    process: "vendor HAL converter (AIDL) · historically AudioPolicyManager (HIDL)",
    parser: "Android 15: IModule.getAudioPorts / IConfig, queried by AudioFlinger libaudiohal and handed to APM. Default AIDL HAL may convert this XML internally.",
    uses: [
      "Device ports: type + address (bus0_media_out must exist as a port)",
      "Mix ports and attached profiles: format / rate / channel admission",
      "Includes: bluetooth / USB / r_submix / A2DP policy snippets (product-dependent names)",
      "AAOS official rule: every address in car XML must be defined here (or advertised as a HAL port)",
    ],
    not: [
      "The Android 15 sentence is not “APM parses this XML.” APM gets IModule/IConfig data via AudioFlinger/libaudiohal. Ask dumpsys media.audio_policy what actually booted.",
      "Does not map CarAudioContext. That is car_audio_configuration.xml + dynamic mixes.",
      "Does not program TDM slots or mixer_paths kcontrols.",
      "AVAILABLE on a port is not a live Flinger thread.",
    ],
    join: "Port address ↔ car XML device address ↔ Flinger BUS. Profile lie → Policy opens 8ch, HAL ERROR (workbook 05).",
    dump: "adb shell dumpsys media.audio_policy",
    dumpAlso: "IModule.getAudioPorts() is the topology APM believed",
    flags: ["HIDL vs AIDL classification first (Module 23)"],
    modules: ["07", "08", "13", "26"],
    labs: [
      { href: "#/learn/08", label: "Module 08 · AIDL ports" },
      { href: "#/workbench/dump/policy/healthy-media", label: "Dump lab · Policy healthy" },
      { href: "#/workbench/rca/05", label: "RCA · profile lie" },
    ],
    excerpt: `<!-- illustrative shape; schema depends on HAL generation -->
<module name="primary" ...>
  <devicePorts>
    <devicePort tagName="bus0_media_out" type="AUDIO_DEVICE_OUT_BUS" address="bus0_media_out">
      <profile format="AUDIO_FORMAT_PCM_16_BIT"
               samplingRates="48000"
               channelMasks="AUDIO_CHANNEL_OUT_STEREO"/>
    </devicePort>
  </devicePorts>
</module>
← teaching reconstruction (Module 07). On AIDL, prove the port in dumpsys, not only in this file.`,
  },
  {
    id: "policy-volumes",
    file: "audio_policy_volumes.xml + default_volume_tables.xml",
    family: "policy",
    product: "both",
    version: "Phone-like stream-type curves. AAOS usually does not use these as the cabin knob.",
    path: "vendor/etc/ or framework defaults",
    example: "frameworks/av/services/audiopolicy/config/",
    process: "audioserver (AudioPolicy) unless CAP volume / fixed volume",
    parser: "AudioPolicyManager volume tables",
    uses: [
      "Stream-type volume curves when software volume is in play",
      "Phone products and AAOS fallback if dynamic routing is off",
    ],
    not: [
      "Not the AAOS cabin knob. Volume groups live in car_audio_configuration.xml.",
      "If config_useFixedVolume=true, Flinger stays at 1.0; CarAudioService turns the group index into millibels and calls setAudioPortGain → IModule.setAudioPortConfig. Editing these tables will not move the amp.",
      "CAP volume: group name in car XML must match the engine; useFixedVolume must be false.",
    ],
    join: "Group index (CarAudioService dump) vs Flinger track vol vs HAL port gain (mB).",
    dump: "adb shell dumpsys media.audio_policy | grep -i volume",
    dumpAlso: "adb shell dumpsys car_service --services CarAudioService",
    flags: ["config_useFixedVolume (frameworks/base, not the car XML)"],
    modules: ["13", "07", "12"],
    labs: [{ href: "#/learn/13", label: "Module 13 · volume groups" }],
    excerpt: `useFixedVolume=true  →  Flinger PCM at 1.0, HAL owns gain
useFixedVolume=false →  software attenuation possible (fewer bits at the amp)
CAP audioUseCoreVolume=true → engine volume names, not these stream tables
← not a file dump; this is the decision that makes these XMLs relevant or dead.`,
  },
  {
    id: "cap-engine",
    file: "audio_policy_engine_configuration.xml (+ criteria, product_strategies, engine volumes)",
    family: "engine",
    product: "both",
    version: "Configurable Audio Policy engine. Optional. On 15, CAP data is commonly still XML. Full CAP-over-AIDL is 16+.",
    path: "vendor/etc/ (engineconfigurable)",
    example: "frameworks/av/services/audiopolicy/engineconfigurable/",
    process: "audioserver",
    parser: "engineconfigurable (not enginedefault)",
    uses: [
      "Product strategies (usage groups) when audioUseCoreRouting=true",
      "Volume groups when audioUseCoreVolume=true — names must match car XML group name=",
      "OEM-defined car contexts (v3+) must match strategy names if both are used",
    ],
    not: [
      "Do not invent Android 15 CAP AIDL calls. REFERENCE_PLATFORM: full CAP-over-AIDL is 16+.",
      "Off unless audioUseCoreVolume / audioUseCoreRouting. Many AAOS products still use dynamic mixes + default APM.",
      "Not mixer_paths. Not TDM.",
    ],
    join: "Strategy/volume name ↔ oemContext name ↔ car XML group name.",
    dump: "adb shell dumpsys media.audio_policy",
    dumpAlso: "Classify CAP flags before you read enginedefault",
    flags: ["audioUseCoreRouting", "audioUseCoreVolume"],
    modules: ["07", "12", "23"],
    labs: [{ href: "#/learn/12", label: "Module 12 · CAP note" }],
    excerpt: `audioUseCoreRouting=true  →  engine strategies, not only CarAudio Mix
audioUseCoreVolume=true   →  engine volume groups; car XML group name= must match
useFixedVolume must be false when using CAP volume
← teaching. Product file names vary; do not invent strategy IDs.`,
  },
  {
    id: "car-flags",
    file: "CarService config.xml (RRO) + frameworks/base config.xml",
    family: "flags",
    product: "aaos",
    version: "Since Android 13: RRO on com.android.car.updatable. Before 13: PRODUCT_PACKAGE_OVERLAYS.",
    path: "packages/services/Car/service/res/values/config.xml (overlaid). Cuttlefish: device/google/cuttlefish/shared/auto/rro_overlay/CarServiceOverlay/",
    example: "device/google/cuttlefish/shared/auto/rro_overlay/CarServiceOverlay/res/values/config.xml",
    process: "car_service (most bools) · system_server (config_useFixedVolume, volume keys)",
    parser: "Resources / RRO. Not the car audio XML parser.",
    uses: [
      "audioUseDynamicRouting — master switch for AAOS mixes (must be true on this course)",
      "audioUseFadeManagerConfiguration — parse fade XML (default false)",
      "audioUseCoreRouting / audioUseCoreVolume — CAP",
      "audioUseCarVolumeGroupMuting, audioUseHalDuckingSignals (IAudioControl#onDevicesToDuckChange)",
      "audioUseMinMaxActivationVolume — v4 activationVolumeConfigs",
      "config_oemCarService — OEM plugin (preinstalled, not a third-party APK)",
      "frameworks/base: config_useFixedVolume, config_handleVolumeKeysInWindowManager",
    ],
    not: [
      "These bools are not a bus map. Turning fade on without v4 applyFadeConfigs + fade XML does nothing useful.",
      "audioUseHalDuckingSignals is not software duck and not fade XML.",
      "config_useFixedVolume lives in frameworks/base, not the car XML.",
    ],
    join: "dumpsys car_service / CarAudioManager.isAudioFeatureEnabled. Overlay you edited ≠ overlay that booted.",
    dump: "adb shell dumpsys car_service --services CarAudioService",
    dumpAlso: "Check the RRO that actually won, not the file in your tree",
    flags: ["Classify flags on every bug (REFERENCE_PLATFORM one-liner)"],
    modules: ["12", "14", "23"],
    labs: [{ href: "#/learn/23", label: "Module 23 · classify" }],
    excerpt: `<resources>
  <bool name="audioUseDynamicRouting">true</bool>
  <bool name="audioUseFadeManagerConfiguration">false</bool>
  <!-- default off. Workbook 06 needs the flag *and* fade XML *and* canCauseFadeOut. -->
</resources>
← CarService overlay shape. Also set config_useFixedVolume in frameworks/base for cabin HAL gain.`,
  },
  {
    id: "audio-effects",
    file: "audio_effects.xml (HIDL-era) / Effects AIDL IFactory",
    family: "policy",
    product: "both",
    version: "Android 15 effects HAL is AIDL IFactory. XML may still wrap a vendor factory.",
    path: "vendor/etc/audio_effects.xml (if present)",
    example: "frameworks/av/media/libeffects/data/audio_effects.xml",
    process: "effects HAL service (vendor.audio-effect-hal-aidl), driven by AudioFlinger EffectChain",
    parser: "AIDL IFactory (AOSP default factory parses audio_effects_config.xml). HIDL-era audio_effects.xml is history; libeffectproxy is the HW/SW offload proxy.",
    uses: ["Effect libraries, pre/post processing attached to sessions or devices"],
    not: [
      "Do not start an Android 15 routing debug here unless the vendor’s IFactory still wraps XML.",
      "Effects are not CarAudioContext and not bus address.",
    ],
    join: "Effect session vs Flinger EffectChain. Wrong bus is not an EQ bug.",
    dump: "adb shell dumpsys media.audio_flinger  # effect chains",
    dumpAlso: "lshal | grep audio.effect",
    flags: ["AIDL vs HIDL classification"],
    modules: ["08", "06"],
    labs: [{ href: "#/learn/08", label: "Module 08" }],
    excerpt: `Android 15: IFactory / IEffect.command(START/STOP/RESET)
HIDL audio_effects.xml is history unless the vendor still wraps it.
← no invented effect UUIDs.`,
  },
  {
    id: "mixer-paths",
    file: "mixer_paths.xml",
    family: "vendor",
    product: "both",
    version: "Qualcomm-like vendor. Not a generic AOSP contract. May be absent on PAL/ACDB products.",
    path: "vendor/etc/ (board-specific)",
    example: "Ask your BSP. Do not copy a Pixel/phone file onto a car.",
    process: "vendor HAL (TinyALSA kcontrols) — never AudioPolicy, never CarAudioService",
    parser: "Vendor HAL / tinyalsa mixer. Policy does not parse this file.",
    uses: [
      "Sequences of mixer controls (DAPM-style) for a named use case",
      "Analog route / codec widgets after the PCM is already RUNNING",
    ],
    not: [
      "NOT audio_policy_configuration.xml. NOT car_audio_configuration.xml.",
      "Does not choose the Flinger BUS. If the address is already wrong, this file cannot save you.",
      "Does not program TDM slot maps by car context. Slot ≠ channel.",
      "Do not invent path names, PAL module IDs, or ACDB keys.",
    ],
    join: "PCM RUNNING + analog mute → vendor graph. AOSP dumpsys will look healthy (workbook vendor-mute).",
    dump: "vendor log / tinymix — ask the BSP",
    dumpAlso: "QXDM/QCAT last, and only on Qualcomm-like (Dump lab · vendor mute)",
    flags: ["Vendor DSP=? on the classification line"],
    modules: ["11", "16", "10"],
    labs: [
      { href: "#/workbench/dump/qxdm/vendor-mute", label: "Dump lab · vendor mute" },
      { href: "#/learn/16", label: "Module 16" },
    ],
    qcom: true,
    excerpt: `<!-- vendor, Qualcomm-like, not AOSP. Path names are BSP-specific — do not copy this. -->
Policy does not parse mixer_paths.xml.
car_audio_configuration.xml programs neither kcontrols nor TDM slots.
PCM RUNNING + analog mute → this family of files (or PAL/ACDB), not Policy.`,
  },
  {
    id: "audio-platform-info",
    file: "audio_platform_info.xml (and friends)",
    family: "vendor",
    product: "both",
    version: "Qualcomm-like. Not AOSP. May not exist.",
    path: "vendor/etc/ — ask the BSP",
    example: "Do not copy a phone file onto a car.",
    process: "vendor HAL",
    parser: "Vendor. Not CarAudioService. Not AudioPolicyManager.",
    uses: ["Board tables the vendor HAL uses after AOSP has chosen a stream (PCM ids, backends)."],
    not: [
      "Not a bus map. Not car XML. Not Policy ports.",
      "Do not invent PCM device numbers, ACDB keys, or PAL module IDs. If the file is absent, you are on a different vendor stack (Module 16).",
    ],
    join: "Only after Flinger address + StreamDescriptor look right. QXDM last.",
    dump: "ls vendor/etc/ | grep -i platform  # then ask BSP what the strings mean",
    dumpAlso: "Dump lab · vendor mute",
    flags: ["Vendor DSP=?"],
    modules: ["16", "08"],
    labs: [{ href: "#/learn/16", label: "Module 16" }],
    qcom: true,
    excerpt: `Qualcomm-like only. This course will not print proprietary tables.
If AOSP already shows two MEDIA tracks on one BUS, this file will not explain overlap.`,
  },
  {
    id: "car-volumes-groups-history",
    file: "car_volumes_groups.xml + IAudioControl.getBusForContext",
    family: "history",
    product: "aaos",
    version: "Replaced in Android 10 by car_audio_configuration.xml.",
    path: "Do not ship on this course’s reference platform.",
    example: "—",
    process: "—",
    parser: "Removed from the 15/AIDL default. Translate with Module 23 if you inherit it.",
    uses: ["History only: old volume groups / HAL getBusForContext"],
    not: [
      "Do not debug a 15 product as if getBusForContext still picks the bus.",
      "AudioControl HAL still exists for gain/focus callbacks — that is not this XML.",
    ],
    join: "If you see this filename on a 15 tree, classify as deviation.",
    dump: "ls vendor/etc/car_audio_configuration.xml",
    dumpAlso: "Module 23",
    flags: [],
    modules: ["12", "23"],
    labs: [{ href: "#/learn/23", label: "Module 23" }],
    excerpt: `Android 10: car_audio_configuration.xml replaces
  car_volumes_groups.xml
  IAudioControl.getBusForContext
This course does not treat those as live APIs.`,
  },
];

export function getXmlFile(id) {
  return XML_FILES.find((f) => f.id === id) || XML_FILES[0];
}

export function xmlFilesIn(familyId) {
  if (!familyId || familyId === "all") return XML_FILES;
  return XML_FILES.filter((f) => f.family === familyId);
}
