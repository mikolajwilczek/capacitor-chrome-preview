# Device Geometry Measurements

Store reviewed JSON exports from
[`tools/geometry-probe`](../../../tools/geometry-probe/) here. Portrait geometry
is accepted for every current device profile.

## Captured evidence

| Device | OS | Captures | Status |
| --- | --- | --- | --- |
| iPhone 13 | iOS 26.6 | Portrait, landscape left | Portrait accepted; landscape left is supporting evidence |
| iPhone 15 Pro | iOS 26.6 | Portrait, landscape right | Portrait accepted; landscape right is supporting evidence |
| Samsung Galaxy A54 | Android 16 | Gesture and three-button; portrait and landscape | Both portrait profiles accepted; landscapes are supporting evidence |

The exports agree between browser CSS and native geometry after accounting for
Capacitor's integer Android fallback variables. Portrait exports cover every
configuration used by the current preview profiles.

## File naming

Use:

```text
<device>-<os>-<navigation>-<orientation>-<yyyy-mm-dd>-<hh-mm-ss>.json
```

Examples:

```text
iphone-15-pro-ios-26-na-portrait-2026-08-24-14-23-54.json
galaxy-a54-android-16-gesture-landscape-left-2026-08-24-14-23-54.json
```

## Acceptance check

Before committing an export:

- Confirm the device model and Android navigation mode.
- Check that the native bridge is available and the captured viewport matches
  the intended profile configuration.
- Check web CSS values against the native window/WebView insets.
- Inspect the JSON for private information or unique identifiers.
- Record why any chosen preview value differs from the measured value in
  [`device-profiles.md`](../device-profiles.md).

One portrait export is sufficient for a current portrait-only profile when the
values agree. The app refreshes after dismissing the keyboard; text size and
display-zoom confirmations are not separate acceptance gates. Repeat a capture
only when values disagree or a platform change may have affected geometry.

Simulator/emulator captures may be useful supporting evidence, but the profile
must say so explicitly. Physical-device evidence is preferred for the devices
available to the maintainer.
