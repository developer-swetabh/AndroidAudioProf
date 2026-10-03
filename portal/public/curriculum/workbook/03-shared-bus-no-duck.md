# Case 03 — Nav and media both full blast, clipped

> **Illustrative:** the dumps and logs in this case are teaching reconstructions, not captures from a real device. Field names follow Android 15 AIDL + AAOS; exact `dumpsys` text varies by build.

OEM requirement: nav on driver tweeters, media 12 dB down on woofers.

What shipped: both scream from every speaker; DSP team is blamed.

## Classification

Android 15 AAOS, AIDL Core HAL, car XML v4, `useFixedVolume=true`, fade flag false.

## car_audio_configuration.xml (what actually booted)

```xml
<carAudioConfiguration version="4">
  <zones>
    <zone name="primary zone" isPrimary="true" occupantZoneId="0">
      <zoneConfigs>
        <zoneConfig name="primary zone config 0" isDefault="true">
          <volumeGroups>
            <group name="cabin">
              <device address="bus0_media_out">
                <context context="music"/>
                <context context="navigation"/>
                <context context="announcement"/>
              </device>
            </group>
            <!-- other groups omitted -->
          </volumeGroups>
        </zoneConfig>
      </zoneConfigs>
    </zone>
  </zones>
</carAudioConfiguration>
```

## Focus

```text
uid=10080 MEDIA              GAIN
uid=10095 NAVIGATION         GAIN_TRANSIENT_MAY_DUCK   GRANTED
interaction: CONCURRENT
```

## AudioFlinger

```text
ONE MixerThread  bus0_media_out  standby=no  State=ACTIVE
  Track session=77  uid=10080 MEDIA       ACTIVE vol=1.000
  Track session=129 uid=10095 NAVIGATION  ACTIVE vol=1.000
  observable.frames moving
  xrunFrames=0
IModule reports a single opened output stream on bus0_media_out
```

## Your annotation

```text
How many HAL streams does the DSP see?
Can hardware duck media independently?
Where would attenuation have to happen today?
Smallest correct change set?
Layer of the fix (XML vs HAL vs app)?
```
