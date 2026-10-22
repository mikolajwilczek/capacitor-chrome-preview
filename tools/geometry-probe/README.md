# Geometry Probe

This repo-only Capacitor app measures the geometry exposed to a real iOS or
Android WebView. Use its output as evidence before changing a preview device
profile. It is deliberately separate from the preview CLI and marked
`private: true` so it cannot be published to npm accidentally.

The probe records:

- Web viewport, screen, visual viewport, DPR, CSS safe-area values, and
  Capacitor fallback variables.
- iOS screen, window, root view, WebView, safe-area, and status-bar geometry.
- Android display, window, decor view, WebView, system-bar, display-cutout,
  gesture, tappable-element, and IME insets in pixels and density-independent
  pixels.

It does not collect serial numbers, advertising IDs, `ANDROID_ID`, or Apple's
`identifierForVendor`. The device model is entered manually.

## Setup

Requirements: Node.js 22+, Xcode for iOS, Android Studio, and mise. The local
mise configuration pins Temurin JDK 21.0.12.1 for Gradle 8.14.6.

Native version pins follow Capacitor 8.5.3, with the Gradle security patch
documented in the
[dependency review](../../docs/research/dependency-maintenance-2026-10-22.md).

```sh
cd tools/geometry-probe
mise trust
mise install
npm install
npm run sync
```

Native dependencies are isolated in this directory and are not dependencies of
the preview CLI.

## Run on iOS

```sh
npm run open:ios
```

In Xcode, select the physical iPhone, choose a personal signing team if needed,
and run `App`. The command-line simulator compile check is:

```sh
npm run build:ios
```

## Run on Android

```sh
mise exec -- npm run open:android
```

Android Studio can override the shell JDK. If it reports an incompatible Gradle
JVM, open **Settings → Build, Execution, Deployment → Build Tools → Gradle**,
set **Gradle JDK** to the directory printed by `mise where java`, then sync the
project again. Do not commit that machine-specific path.

Select the physical device and run `app`. Alternatively, build and install the
debug APK:

```sh
mise exec -- npm run build:android
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Capture procedure

Capture the portrait configuration that the preview currently uses:

1. Enter the device model. On Android, select the navigation mode represented by
   the profile.
2. Check that the native bridge says it is available.
3. Tap **Save JSON**. The app closes the keyboard, waits one second, and refreshes
   the measurement before exporting. It does not export a zoomed or
   keyboard-reduced viewport.
4. On Android, the file is written directly to `Downloads/Geometry Probe`. On
   iOS, choose **Save to Files**, then select **Downloads**. In a browser,
   **Save JSON** downloads the file directly. **Copy JSON** remains a fallback.
5. Store reviewed evidence under
   `docs/research/device-geometry-measurements/` using the documented naming
   convention.

Minimum matrix for the current profiles:

| Device | Configuration |
| --- | --- |
| iPhone 15 Pro | Portrait |
| iPhone 13 | Portrait |
| Galaxy A54 | Gesture navigation, portrait |
| Galaxy A54 | Three-button navigation, portrait |

One capture is enough when CSS and native values agree. Repeat only when values
conflict, the capture looks incomplete, or a later platform change may affect
geometry. Landscape captures are optional until the preview supports landscape.

## Build verification

```sh
npm run build:ios
npm run build:android
```

These compile the native bridges but do not substitute for measurements on the
physical devices.

As of 2026-10-22, the full `npm audit` reports no vulnerabilities. Keep the
scoped `xcode` → `uuid: 11.1.1` override: Capacitor CLI 8.5.3 still uses
`xcode` 3, which requests UUID 7 and would reintroduce
[GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
without the override. Recheck when Capacitor adopts a newer `xcode` major.
See the [dependency review](../../docs/research/dependency-maintenance-2026-10-22.md)
for version decisions and validation.
