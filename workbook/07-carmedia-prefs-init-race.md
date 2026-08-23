# Case 07 — 3/10 no music after any source switch

Real hardware. **Not** case 06 (overlap / fade / same bus). Focus looked healthy. The cabin still had no music after AA↔Radio↔USB switches, **3 times in 10**.

This case exists so you do **not** invent a HAL or fade root cause from a 3/10 rate alone.

## Classification

```text
Android 15 AAOS
CarMediaService owns the active media *source* (one source in the car)
Focus (request/abandon) succeeded on failing trials
Symptom is “B never actually plays,” not “two sources overlap”
```

## What CarMediaService is for

```text
User taps Radio / USB / AA
        ↓
CarMediaService.setMediaSource / source change
        ↓
save last source + playback state  →  SharedPreferences
        ↓
restore / autostart via MediaConnection service
        (startMediaConnectorService on the *user* context)
        ↓
that source’s MediaSession / HAL path plays
```

This is **above** AudioFlinger. A clean focus log only proves the *apps that ran* cooperated. It does not prove CarMedia **restored and started** the new source.

Shared prefs name in AOSP: `com.android.car.media.car_media_service`.  
They hold last component (`media_source_component`) and playback state. They are **not** available from credential-encrypted storage until user 0 is unlocked. AOSP initializes them in `initUser()` → `maybeInitSharedPrefs()`.

## Lifecycle that is supposed to init

```text
CarMediaService.init()
    → maybeInitUser(currentUser)
         if user unlocked → initUser() → SharedPreferences
         else             → UserMediaPlayContext.mPendingInit = true

USER_VISIBLE  (U+)  → onUserVisible()  → maybeInitUser()
USER_UNLOCKED       → onUserUnlocked() → if mPendingInit: initUser(); clear flag
```

`startMediaConnectorServiceLocked()` **returns without starting play** if the per-user `mContext` is still null:

```text
Cannot start MediaConnection service. User %d has not been initialized
```

Reads of last source use:

```text
mSharedPrefs == null ? null : mSharedPrefs.getString(key, "")
```

and `sharedPrefsInitialized()` logs `SharedPreferences are not initialized!`.

## Failing trial (ideas — from the hardware RCA)

```text
requestAudioFocus / abandonAudioFocus  : OK  (red herring)
onUserVisible()                        : missing this trial
mSharedPrefs                           : null
save/restore last source               : fails
Pending init                           : false  (nobody armed the deferred init)
User context                           : not created / not initUser()'d
→ MediaConnection never starts the selected source
→ tester: “music is not getting played”
```

3/10 = **user-lifecycle vs source-switch ordering**. When `onUserVisible` (or unlock+pending) happens first, init runs and switches work. When a switch happens first and pending-init was never set, restore is a no-op.

## Your annotation (before the answer key)

```text
Why can focus be perfect and the cabin still be silent?
Which dump/log proves CarMedia never started MediaConnection?
What does 3/10 tell you that 10/10 would not?
Why is mPendingInit required if onUserVisible is missed?
Five-line RCA:
```
