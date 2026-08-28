# Device Profile Research

Research dates: 2026-06-27, updated 2026-06-30, 2026-08-24, and 2026-08-27

## Current Profiles

| Device | Viewport points | DPR | Portrait safe area | Hardware overlay |
| --- | --- | --- | --- | --- |
| iPhone 15 Pro | `393 x 852` | `3x` | `top 59`, `bottom 34`, `left 0`, `right 0` | Dynamic Island prototype |
| iPhone 13 | `390 x 844` | `3x` | `top 47`, `bottom 34`, `left 0`, `right 0` | Notch prototype |
| Samsung Galaxy A54 | `384 x 832` | `2.8125x` | `top 33`, `bottom 14`, `left 0`, `right 0` | Measured hole-punch placement |
| Samsung Galaxy A54 (3-button nav) | `384 x 832` | `2.8125x` | `top 33`, `bottom 48`, `left 0`, `right 0` | Measured hole-punch placement plus 3-button nav |

## Notes

- The iPhone 13 viewport, native scale factor, and portrait safe-area values
  come from Use Your Loaf's screen-size table and are confirmed by a physical
  iPhone 13 capture from iOS 26.6.
- Apple's official iPhone 13 technical specifications list the native pixel resolution as `2532 x 1170`, which matches `390 x 844` points at `3x`.
- The iPhone 13 notch overlay is an approximate visual drawn inside the sourced `47px` top unsafe area. The viewport and safe-area values are the behavioral source of truth.
- The iPhone 15 Pro viewport, native scale factor, and portrait safe-area values
  are confirmed by a physical capture from iOS 26.6. The Dynamic Island drawing
  remains a visual approximation.
- Physical Galaxy A54 captures on Android 16 report a `1080 x 2340` display at
  density `2.8125`, producing a `384 x 832` portrait viewport.
- Capacitor injects integer fallback variables of `33px` top and `14px` bottom
  in gesture mode. Native insets are `33.78dp` and `14.93dp`, which browser CSS
  reports as `34px` and `15px`. The profile uses the injected values for app
  safe areas and the rounded values for its visual system bars.
- Three-button navigation keeps the `33px` injected top inset and uses a `48px`
  bottom inset. Its Back/Home/Recents controls retain the existing interaction
  behavior.
- The measured cutout is about `21px` square with an `8px` top offset. The
  preview renders it as a circle; operating-system icons remain illustrative.

## Capacitor Android Insets

Research date: 2026-06-30

Current Capacitor 8 registers `SystemBars` as a bundled core plugin on Android. Its safe-area path uses Android `WindowInsetsCompat` from `systemBars() | displayCutout()`, so status bars, navigation bars, gesture bars, and display cutouts all contribute to the effective safe area.

Capacitor's default Android `insetsHandling` mode is `css`. For WebView versions where native CSS `env(safe-area-inset-*)` values are unreliable, `SystemBars` injects fallback CSS variables named `--safe-area-inset-top`, `--safe-area-inset-right`, `--safe-area-inset-bottom`, and `--safe-area-inset-left`. The preview runtime mirrors those variable names so app CSS can use the Capacitor-style fallback pattern:

```css
padding-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
```

Gesture navigation versus 3-button navigation is an Android OS/user navigation-mode difference reflected through bottom system-bar insets. It is not a separate Capacitor app setting. Exact values vary by device, Android version, target SDK, WebView version, `viewport-fit=cover`, keyboard visibility, system-bar visibility, and navigation mode.

The prototype gesture profile also carries interaction values: a `24px` edge sensor, `48px` inward commit distance, and `1.25` horizontal-to-vertical direction ratio. These are explicit approximation parameters for the Chrome preview, not measured Galaxy A54 or universal Android values.

Manual verification page: [`docs/manual-safe-area-test.html`](../manual-safe-area-test.html).

## Physical-device validation

Research date: 2026-08-27

The repository now includes a standalone Capacitor measurement app at
[`tools/geometry-probe`](../../tools/geometry-probe/). It compares WebView CSS
geometry with native iOS safe-area/status-bar values and Android
`WindowInsetsCompat`/display-cutout values. The iOS and Android hosts compile.
The accepted iPhone 13, iPhone 15 Pro, and Galaxy A54 portrait captures provide
the viewport, DPR, and safe-area values used by the current profiles. Landscape
captures are retained as supporting evidence because the preview profiles are
portrait-only. The iPhone notch and Dynamic Island drawings remain visual
approximations even though their portrait viewports and safe areas are measured.

## Sources

- Use Your Loaf, "iPhone 13 Screen Sizes": <https://useyourloaf.com/blog/iphone-13-screen-sizes/>
- Apple Support, "iPhone 13 - Technical Specifications": <https://support.apple.com/en-us/111872>
- Samsung, "Galaxy A54 5G": <https://www.samsung.com/us/smartphones/galaxy-a54-5g/>
- Chrome Developers, "Prepare your web app for edge-to-edge": <https://developer.chrome.com/docs/css-ui/edge-to-edge>
- Capacitor, "System Bars": <https://capacitorjs.com/docs/apis/system-bars>
- Capacitor source, "SystemBars.java": <https://github.com/ionic-team/capacitor/blob/main/android/capacitor/src/main/java/com/getcapacitor/plugin/SystemBars.java>
- Capacitor source, "native-bridge.ts": <https://github.com/ionic-team/capacitor/blob/main/core/native-bridge.ts>
- Chrome DevTools Protocol, "Emulation.setSafeAreaInsetsOverride": <https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setSafeAreaInsetsOverride>
- Android Developers, "Edge-to-edge": <https://developer.android.com/develop/ui/views/layout/edge-to-edge>
- Android Developers, "WindowInsetsCompat": <https://developer.android.com/reference/androidx/core/view/WindowInsetsCompat>
- Android Developers, "Understand window insets in WebView": <https://developer.android.com/develop/ui/views/layout/webapps/understand-window-insets>
- Apple Developer Documentation, "safeAreaInsets": <https://developer.apple.com/documentation/uikit/uiview/safeareainsets>
- Apple Developer Documentation, "UIStatusBarManager": <https://developer.apple.com/documentation/uikit/uistatusbarmanager>
