# SDVCCS-90202 — CarPlay Audio Setup-Time KPI: Root Cause, Fix Evaluation, and Solution Design

> Status of ticket at last update (14/Aug/26): **unresolved**. FAST→DIRECT PoC introduced a mono-downlink regression (Cerence/ECNR crash).
> All claims below were verified directly against the checked-out source tree (see citations), not only against the JIRA narrative.

**Source roots**
- System partition: `/home/rntbci/MyStable-26.2-FVM/FVM_SYSTEM/`
- Vendor / other partitions: `/home/rntbci/MyStable-26.2-FVM/FVM_VENDOR/`
- Qualcomm AR audio HAL: `/home/rntbci/MyStable-26.2-FVM/FVM_VENDOR/vendor/qcom/opensource/audio-hal-ar/primary-hal/`
- CarPlay/SPCX receiver (LGE proprietary, source-available): `FVM_SYSTEM/vendor/alliance/services/SPCX/carplay-receiver-lib/src/R17A/`

---

## 1. Problem statement

Apple CarPlay certification requires audio **SETUP → SETUP RESPONSE under 100 ms** (>200 ms ⇒ Apple Engineering Rejection / CER blocker). "Setup" = the AAudio `openStream()` + `requestStart()` for the stream(s) behind that CarPlay audio type.

| Stream type | Nature | Measured setup | KPI |
|---|---|---|---|
| Media, Alternative, Main-Buffered | playback-only | ~25–65 ms | ✅ PASS |
| Telephony, Legacy Siri, AuxOut (E-Siri) | **duplex (record + playback) + ECNR** | 150–800 ms | ❌ FAIL |

The differentiator is **not** "voice audio". It is that the failing types open an **`AAudioRecorder` and `AAudioPlayer` simultaneously** and run **ECNR** (Cerence echo-cancel / noise-reduction). Playback-only types pass comfortably.

---

## 2. Root cause — where the time actually goes

This is not a single bug; it is an **accumulation of synchronous, blocking costs on the duplex path**. It is pure AOSP + platform-config behaviour, not a CarPlay-plugin defect.

### 2.1 Open phase (~78 ms floor) — front-loadable

- **`AudioRecord::createRecord_l()` ≈ 62 ms** — synchronous binder RPC to AudioFlinger to build the `RecordThread`/`RecordTrack`.
  `frameworks/av/media/libaudioclient/AudioRecord.cpp:901`.
  This is the **single biggest open cost, and it is on the input path.**
  - It also carries a retry that **sleeps 200–490 ms on `FAILED_TRANSACTION`** (`AudioRecord.cpp:927`) → explains the 500–800 ms outliers.
- **`AudioTrack::createTrack_l()` ≈ 16 ms** — binder RPC on the output path (`AudioTrack.cpp:1938`).

Both of these happen inside `AAudioStreamBuilder_openStream()`:
- Recorder: `.../plug-ins/audio/AAudioRecorder.cpp:258`
- Player: `.../plug-ins/audio/AAudioPlayer.cpp:247`

### 2.2 Start phase (~100–150 ms) — two forced HAL round-trips

Both are confirmed in source **and** in QC's own log (which shows two `setAudioPortConfig` calls at start):

1. **Output volume-sync** — `startOutput → startSource → checkAndSetVolume(..., outputDesc->useHwGain() /*force*/)`
   `frameworks/av/services/audiopolicy/managerdefault/AudioPolicyManager.cpp:2675-2679`; `useHwGain()` at `:8664`.
   Forced because the **device port** (Phone Bus / `BUS03_PHONE`) has `<gain useForVolume="true">`.
   **Verified in the DEPLOYED config**: `FVM_VENDOR/out/target/product/cdc_r_ivi/vendor/etc/audio_ar/audio_module_config_primary.xml` (~line 159–200, still true after the DIRECT migration). It pushes HW gain to the HAL via `setAudioPortConfig` **on every start**.
2. **Input routing patch** — `RecordThread::start() → AudioSystem::startInput() → AudioPolicyManager::startInput() → setInputDevice(force) → installPatch() → createAudioPatch()` → HAL `setAudioPortConfig`, **~77–109 ms** by QC's own measurement.

> **Key structural fact:** `useForVolume` is a **device-port** property, not a mixport property. The same device port is the sink regardless of the mixport FAST/DIRECT flag — this is why changing the mixport flag **cannot** remove the volume-sync cost.

### 2.3 The "Gustave" hook (basis of the attempted fix) is output-only

`frameworks/av/media/libaaudio/src/legacy/AudioStreamTrack.cpp:157-163`: for non-MEDIA `VX_OEM`-tagged streams it forces `AUDIO_FLAG_HW_AV_SYNC` and strips `AUDIO_FLAG_LOW_LATENCY` + `AUDIO_OUTPUT_FLAG_FAST`, causing APM to infer **DIRECT** output.
**`AudioStreamRecord.cpp` has NO equivalent hook** — verified. The mechanism is architecturally incapable of touching the input path, which is where the dominant cost lives.

### 2.4 Plus: Cerence/ECNR cold model load

First-use SCD/DNN topology load (e.g. `SSE_CP_FT_USB_DL`, `DNN_DNS_HFSQ_24KHZ.scd`) inside `audio_extn_ecnrInitialize()` adds a one-time cost on the first duplex open (`hal/core/extensions/hal_ecnr.cpp:763-877`).

---

## 3. Evaluation of the proposed fix (FAST → DIRECT migration)

Attached PoC = `issue/38.patch` (frameworks/av `AudioStreamTrack.cpp` WA) + `issue/0001-PoC-migrate-CP-from-fast-to-direct-output 1.patch` (AHAL XML config + `AudioUsecase.cpp`). The migration **is deployed** in the built tree (`audio_module_config_primary.xml`: `low_latency_out_phone = flags="DIRECT HW_AV_SYNC"`, `voip_playback = flags="DIRECT VOIP_RX"`).

**Verdict: partial and NOT valid as-is.**

| Concern | Finding |
|---|---|
| Input path (dominant ~62 ms) | **Untouched.** No record-side hook exists (§2.3). |
| Output volume-sync (~forced `setAudioPortConfig`) | **Unaffected.** Driven by `useForVolume` on the **device** port, independent of the mixport flag (§2.2). |
| **Regression introduced** | Under FAST, AudioFlinger's mixer **silently upmixed** CarPlay's **mono** client stream to stereo before the HAL. Under DIRECT there is **no resample/rechannel** — the exact mono format reaches the HAL. `StreamOutPrimaryOEM.cpp:241,426` derive **both** ECNR `in_ch` and `out_ch` directly from the client channel count, so mono → ECNR configured mono → Cerence topology (compiled for stereo) **crashes** → AHAL crash → audioserver crash. |
| Profile fragility | DIRECT requires the client sample-rate/channel-mask to **exactly** match a declared mixport profile or `openStream` fails (explains the logged 44.1 kHz / 48 kHz open failures during the PoC). |

**Conclusion:** the DIRECT migration optimizes at most a fraction of the *output* open cost while (a) leaving the two largest contributors (input open + both start-phase HAL round-trips) in place and (b) actively introducing a crash regression. It should not ship in its current form.

---

## 4. Solution options

Ranked by leverage:

- **Option A — Pre-warm / pool the duplex CarPlay streams** *(primary recommendation — detailed in §5)*. Front-loads the ~78 ms open phase (incl. the 62 ms record) off the SETUP critical path. Sidesteps the DIRECT/mono regression entirely (keeps FAST). No `useForVolume` change needed.
- **Option B — If DIRECT is kept, fix the regression at the AHAL** by upmixing mono→stereo before ECNR *(patch drafted in §6, but NOT to be pursued unless recommended)*.
- **Option C — Attack the forced volume-sync directly** (make `checkAndSetVolume` async/cached on start, or question whether `useForVolume="true"` is truly required on CarPlay buses). Removes a start-phase HAL round-trip. Complements A.
- **Option D — Preload/warm Cerence SCD/DNN models at boot** so the first duplex open pays no cold-load cost.
- **Option E — Certification fallback** (CER documentation) if the KPI still cannot be met.

---

## 5. Option A — Pre-warm design (PRIMARY)

### 5.1 Core idea

The SETUP critical path today is: native SDK delivers `Initialize → Set* → Prepare → Start` back-to-back, and **all** of the open cost is paid synchronously inside `Prepare`. Pre-warm moves the open cost **earlier**, to a moment that is *not* on the KPI clock: **CarPlay session establishment**, which happens well before the first Telephony/Siri SETUP request.

We speculatively **pre-open** (open, but do NOT start) a duplex ECNR stream using the well-known, fixed Telephony/E-Siri config as soon as the session is up. When the real SETUP arrives, `prepare()` **adopts** the already-open native streams instead of opening fresh ones.

### 5.2 Lifecycle (verified)

- Session up: `CarPlayReceiverSessionCallbacks.onSessionStarted(sessionRef)` (`java/main/.../CarPlayReceiverSessionCallbacks.java:190`); `getSessionRef()` becomes non-zero (`:103`). **← pre-warm trigger point.**
- Per audio type SETUP: native calls, on `AudioUtils` (`java/aivi2/audio/aaudio/.../audio/AudioUtils.java`):
  `onAudioStreamInitialize` (`:155`) → `onAudioStreamSetAudioType/SetFormat/SetInput/SetStreamType/SetDirection` → `onAudioStreamPrepare` (`:469`, submits `audioStream.prepare()`) → `onAudioStreamStart` (`:511`, submits `audioStream.start()`).
- `AudioStream.prepare()` (`.../audio/AudioStream.java:647`): for input, `createRecorder()` then `recorder.prepare()`; for output, `requestPlaybackFocus()` then `createPlayer()` then `player.prepare()`; both run via `CompletableFuture.supplyAsync` in parallel (this async-parallel split is **already present** — good, it means half the plumbing exists).
- `AAudioRecorder.prepare()` (`:47`) / `AAudioPlayer.prepare()` (`:46`) build the AAudio stream and call `openStream()`. `start()` calls `AAudioStream_requestStart()`. `stop()` calls `requestStop()` + `close()` and **nulls `mStream`** (so today every SETUP opens a brand-new stream).

### 5.3 What is safe to pre-open (and what is not)

| Resource | Pre-open at session start? | Reasoning |
|---|---|---|
| **AAudioRecorder native stream** (the 62 ms cost) | ✅ Yes | `AAudioRecorder.prepare()` does **not** request Android audio focus; opening an input stream has no focus side effect. This front-loads the single biggest cost with zero routing/focus impact. |
| **AAudioPlayer native stream** (16 ms) | ✅ Yes (open only) | `AAudioStreamBuilder_openStream()` does **not** acquire `AudioManager` focus — focus is requested separately in `AudioStream.prepare()` (`requestPlaybackFocus()` at `:692`), which we keep on the SETUP path. Opening an output stream without starting it does not route audio. |
| **`requestStart()` (pre-START)** | ❌ No | Starting routes to the Phone Bus and triggers the forced volume-sync `setAudioPortConfig`, stealing focus/audio from FM/Media while idle. Not acceptable. The start-phase HAL cost is therefore **out of scope for A** and is addressed by Option C. |
| **Android audio focus** | ❌ No | Keep focus acquisition on the SETUP path to avoid ducking other sources during idle CarPlay. |

**Boundary (be explicit):** Option A eliminates the **~78 ms open phase** from the KPI clock (the largest single removable chunk, including the 62 ms record and cold ECNR model load if the pre-warmed stream also warms Cerence). It does **not** by itself remove the two start-phase `setAudioPortConfig` round-trips — combine with Option C for those.

### 5.4 Design: a warm-stream pool

Add a `WarmAudioStreamPool` owned by `AudioUtils`. On `onSessionStarted`, it asynchronously pre-opens one duplex ECNR bundle (recorder + player) configured for the fixed Telephony/Legacy-Siri profile (16 kHz, mono, `VOICE_COMMUNICATION` preset — the exact config `AAudioRecorder.prepare()` already uses for Telephony at `:115-123`). It holds them in "opened, not started" state.

On `AudioStream.prepare()`, before creating fresh objects, ask the pool for a warm recorder/player **matching the negotiated config**. If matched, adopt them (skip `openStream`); if not (config mismatch, pool empty, or already consumed), fall back to today's create-and-open path. On `onAudioStreamStart` for the first Telephony stream, the pool schedules a replacement pre-open for the next session-level SETUP (e.g., Siri after a call).

**Config-match guard is mandatory** — DIRECT's fragility taught us that a mismatched pre-opened stream is worse than none. If the phone negotiates an unexpected rate/channel, discard the warm stream and open fresh.

### 5.5 Patch (representative diff against real symbols)

> Grounded in the real files/symbols above. `WarmAudioStreamPool` is new; the `AudioStream` / `AudioUtils` / `AAudioRecorder` / `AAudioPlayer` hunks show the integration points.

**5.5.1 New file:** `java/aivi2/audio/aaudio/com/lge/projection/carplay/receiver/audio/WarmAudioStreamPool.java`

```java
package com.lge.projection.carplay.receiver.audio;

import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Pre-opens (but does not start) duplex ECNR AAudio streams for the well-known
 * Telephony / Legacy-Siri profile, so that AudioStream.prepare() can adopt an
 * already-open native stream instead of paying createRecord_l/createTrack_l on
 * the SETUP critical path.
 *
 * Only the OPEN phase is front-loaded. requestStart(), Android audio focus, and
 * device routing all remain on the SETUP path (see analysis §5.3).
 */
public final class WarmAudioStreamPool {
    private static final String TAG = CPRLog.getTag("Audio");

    /** A pre-opened, not-yet-started duplex bundle. */
    public static final class Warm {
        final AAudioRecorder recorder;   // opened, mStream valid
        final AAudioPlayer player;       // opened, mStream valid
        final int sampleRate;
        final int channels;
        Warm(AAudioRecorder r, AAudioPlayer p, int sr, int ch) {
            recorder = r; player = p; sampleRate = sr; channels = ch;
        }
    }

    private final ExecutorService mExec = Executors.newSingleThreadExecutor();
    private final ConcurrentLinkedDeque<Warm> mPool = new ConcurrentLinkedDeque<>();
    private final AAudioStreamFactory mFactory; // wraps createRecorder()/createPlayer()

    public WarmAudioStreamPool(AAudioStreamFactory factory) { mFactory = factory; }

    /** Called from AudioUtils.onSessionStarted(). Non-blocking. */
    public void prewarmTelephony() {
        mExec.submit(() -> {
            try {
                // Fixed Telephony/E-Siri ECNR profile (matches AAudioRecorder.prepare():115-123).
                final int sr = 16000, ch = 1;
                AAudioRecorder r = mFactory.newTelephonyRecorder(sr, ch);
                AAudioPlayer   p = mFactory.newTelephonyPlayer(sr, ch);
                if (r.prepare() == 0 && p.prepare() == 0) {   // openStream only, no requestStart
                    mPool.push(new Warm(r, p, sr, ch));
                    CPRLog.i(TAG, "Pre-warmed duplex ECNR stream ready (" + sr + "Hz/" + ch + "ch)");
                } else {
                    if (r != null) r.teardown();
                    if (p != null) p.teardown();
                }
            } catch (Throwable t) {
                CPRLog.w(TAG, "prewarmTelephony failed (non-fatal): " + t);
            }
        });
    }

    /** Adopt a warm bundle iff the negotiated config matches; else return null. */
    public Warm acquire(int sampleRate, int channels) {
        Warm w = mPool.poll();
        if (w == null) return null;
        if (w.sampleRate != sampleRate || w.channels != channels) {
            // Config mismatch: discard rather than risk a wrong-format stream (DIRECT lesson).
            w.recorder.teardown();
            w.player.teardown();
            return null;
        }
        return w;
    }

    /** Session finalize: drop any unused warm streams. */
    public void clear() {
        Warm w;
        while ((w = mPool.poll()) != null) { w.recorder.teardown(); w.player.teardown(); }
    }
}
```

**5.5.2** `AudioUtils.java` — trigger pre-warm on session start, clear on finalize.

```diff
@@ class AudioUtils
+    private final WarmAudioStreamPool mWarmPool =
+            new WarmAudioStreamPool(new AAudioStreamFactory(mContext, mAudioFocusManager));
+
+    /** Called when the CarPlay session is established (before per-type SETUP). */
+    void onSessionStarted() {
+        // Front-load the ~78 ms duplex open phase off the SETUP critical path.
+        mWarmPool.prewarmTelephony();
+    }
+
     void onAudioStreamInitialize(long streamRef) {
         AudioStream audioStream = new AudioStream(mContext, mAudioFocusManager);
+        audioStream.setWarmPool(mWarmPool);
         audioStream.setAudioStreamRef(streamRef);
         ...
     }
```

Wire `onSessionStarted()` from `CarPlayReceiverSessionCallbacks.onSessionStarted()` → session listener → `AudioUtils` (same path already used for `onAudioSessionFailed`).

**5.5.3** `AudioStream.java` — adopt a warm bundle in `prepare()` instead of opening fresh.

```diff
+    private WarmAudioStreamPool mWarmPool;
+    public void setWarmPool(WarmAudioStreamPool p) { mWarmPool = p; }
+
     public synchronized int prepare() {
         ...
         if (isInput()) {
-            mAAudioRecorder = createRecorder();
-            final AAudioRecorder recorder = mAAudioRecorder;
-            mPrepareFutures.add(CompletableFuture.supplyAsync(() -> {
-                int result = recorder.prepare();
+            WarmAudioStreamPool.Warm warm = (mWarmPool != null && isTelephonyLike())
+                    ? mWarmPool.acquire(mAudioFormat.mSampleRate, mAudioFormat.mChannelsPerFrame) : null;
+            mAAudioRecorder = (warm != null) ? warm.recorder : createRecorder();
+            final AAudioRecorder recorder = mAAudioRecorder;
+            final boolean recAlreadyOpen = (warm != null);
+            mPrepareFutures.add(CompletableFuture.supplyAsync(() -> {
+                int result = recAlreadyOpen ? 0 /* already opened at session start */
+                                            : recorder.prepare();
                 if (result == CarPlayTypes.StatusCode.NO_ERROR) {
                     mRecordNowAuthorized = true;
                 }
                 return result;
             }));
+            if (warm != null) { mAAudioPlayer = warm.player; }  // adopt player too (opened, not started)
         }

         if (isOutput()) {
             mAudioFocusManager.requestMixingAudioFocus(mStreamType, mAudioType);
             err = requestPlaybackFocus();          // focus stays on SETUP path (unchanged)
             ...
-            mAAudioPlayer = createPlayer();
+            if (mAAudioPlayer == null) { mAAudioPlayer = createPlayer(); }  // else adopted warm player
             final AAudioPlayer player = mAAudioPlayer;
-            mPrepareFutures.add(CompletableFuture.supplyAsync(player::prepare));
+            final boolean playAlreadyOpen = /* adopted */ ...;
+            mPrepareFutures.add(CompletableFuture.supplyAsync(
+                    () -> playAlreadyOpen ? 0 : player.prepare()));
         }
         ...
     }
+
+    private boolean isTelephonyLike() {
+        return Objects.equals(mAudioType, CarPlayTypes.AudioType.TELEPHONY)
+            || Objects.equals(mAudioType, CarPlayTypes.AudioType.SPEECH_RECOGNITION)
+            || (mStreamType == CarPlayTypes.StreamType.AUX_IN_AUDIO);
+    }
```

**5.5.4** `AAudioRecorder` / `AAudioPlayer` — no behavioural change required; only ensure `prepare()` is idempotent (a second call on an already-open stream is a no-op returning success) and that a pre-opened stream can be `start()`ed later unchanged. The existing `start()` (`AAudioRecorder.cpp:309`, `AAudioPlayer.cpp:295`) already just calls `requestStart(mStream)`, which works on a stream opened earlier.

### 5.6 Open questions to resolve before implementation

1. **Lead time:** confirm from a real trace that `onSessionStarted` precedes the first Telephony/Siri SETUP by ≳80 ms. (The pool absorbs the open cost only if the pre-open completes first; if not, `prepare()` cleanly falls back.)
2. **Idle-stream lifetime:** confirm an AAudio input/output stream can sit "opened, not started" indefinitely without the framework reclaiming it or logging errors. Add a watchdog that tears down + re-warms if the pool sits unused past a threshold.
3. **Config certainty:** confirm Telephony/E-Siri always negotiates 16 kHz/mono on this platform (per `AAudioRecorder.prepare():115-123`). If it can vary, pre-warm the most probable profile and rely on the mismatch-discard guard.
4. **ECNR warm-up:** decide whether pre-opening the duplex stream also triggers `audio_extn_ecnrInitialize()` (cold model load). If yes, A also absorbs §2.4; if the HAL defers ECNR init to first start, pair with Option D.

---

## 6. Option B — mono→stereo upmix in the AHAL *(documented only; NOT to be pursued unless recommended)*

Relevant only **if** the DIRECT migration is kept. It fixes the §3 regression at the layer that has ownership of the ECNR configuration, with the smallest blast radius.

**Mechanism:** in `StreamOutPrimaryOEM::configure()` (Qualcomm AR AHAL), when the usecase is `Usecase::VOIP_PLAYBACK` with ECNR enabled and the negotiated client channel count is mono, force the ECNR/stream channel count to stereo and duplicate L→R before ECNR sees the buffer — reproducing what the FAST mixer used to do implicitly.

```diff
// hal/core/StreamOutPrimaryOEM.cpp  (near :241 / :426 where ECNR in_ch/out_ch are derived)
@@ StreamOutPrimaryOEM::configure()
     int ch = attr->out_media_config.ch_info.channels;
+    // WA: Cerence ECNR topology is compiled for stereo. Under DIRECT the mixer no
+    // longer upmixes CarPlay's mono downlink, so mono reaches ECNR and crashes
+    // audio_extn_ecnrInitialize(). Force stereo and duplicate L->R before ECNR.
+    bool ecnrMonoUpmix = mEcnrEnabled && (usecase == Usecase::VOIP_PLAYBACK) && (ch == 1);
+    if (ecnrMonoUpmix) {
+        ch = 2;                                  // present stereo to ECNR
+        mEcnrUpmixMonoToStereo = true;           // buffer path duplicates L->R
+    }
     audio_extn_setupIOBuffer(..., DIR_DL, ch, ch, ...);
```

Plus, in the DL write path, when `mEcnrUpmixMonoToStereo` is set, interleave each mono sample to L and R (mirroring the existing format-converter helpers such as `audio_extn_cvtformat16_lnterleave_to_deinterleave`) and double the DL buffer sizing. **Draft only** — do not integrate unless the team decides to keep DIRECT.

---

## 7. Recommendation

1. **Pursue Option A (pre-warm)** as the primary fix — it attacks the largest removable cost (the ~78 ms open phase incl. the 62 ms record), stays on FAST, and avoids the DIRECT/mono crash entirely.
2. **Add Option C** (async/cached volume-sync) to also remove the start-phase forced `setAudioPortConfig`, which A alone does not cover.
3. **Consider Option D** (boot-time Cerence warm-up) if ECNR cold-load remains on the first-open path.
4. **Do NOT ship the FAST→DIRECT migration** as-is; if it must be kept for other reasons, gate it behind **Option B** to remove the mono regression.
5. **Option E** (CER documentation) only as a last resort.

---

### Appendix — key verified citations

- `frameworks/av/media/libaudioclient/AudioRecord.cpp:901,927`
- `frameworks/av/media/libaudioclient/AudioTrack.cpp:1938`
- `frameworks/av/media/libaaudio/src/legacy/AudioStreamTrack.cpp:157-163` (Gustave hook, output-only)
- `frameworks/av/media/libaaudio/src/legacy/AudioStreamRecord.cpp` (no equivalent hook)
- `frameworks/av/services/audiopolicy/managerdefault/AudioPolicyManager.cpp:2675-2679, 8664, ~1838`
- `FVM_VENDOR/out/target/product/cdc_r_ivi/vendor/etc/audio_ar/audio_module_config_primary.xml:~159-200` (`useForVolume="true"`; DIRECT migration deployed)
- `hal/core/StreamOutPrimaryOEM.cpp:241,426`; `hal/core/extensions/hal_ecnr.cpp:763-877`
- CarPlay receiver: `AudioStream.java:647 (prepare), 773 (start), 879 (stop)`; `AudioUtils.java:155,469,511`; `CarPlayReceiverSessionCallbacks.java:103,190`; `AAudioRecorder.cpp:47,258,309,335`; `AAudioPlayer.cpp:46,247,295,320`