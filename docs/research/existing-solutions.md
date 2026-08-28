# Mobile Preview Approach Comparison

Source review date: 2026-08-28.

This note compares technical approaches for checking safe areas and mobile
app-shell layout. Browser preview supports fast iteration; simulators and
physical devices cover native integration and final verification.

## Comparison

| Approach | Setup | Fidelity | Useful for | Limits |
| --- | --- | --- | --- | --- |
| [Chrome DevTools Device Mode](https://developer.chrome.com/docs/devtools/device-mode) | Low | Browser approximation | Viewport sizing, orientation, touch mode, throttling, and other responsive checks | Does not reproduce a native WebView container or every device behavior. Chrome documents Device Mode as an approximation. |
| [CDP safe-area override](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setSafeAreaInsetsOverride) | Medium | Browser-native CSS environment override | Testing layouts that consume `env(safe-area-inset-*)` without changing application CSS | The command is experimental, Chrome-specific, and requires reliable application and reset handling. |
| CSS-variable and DOM injection | Low to medium | Synthetic app-level behavior | Fallback variables, unsafe-area overlays, hardware cutout visuals, and apps that do not consume standard `env()` values | Depends on the application's CSS contract and does not reproduce native behavior by itself. Reinjection and cleanup must handle navigation. |
| [Capacitor Live Reload](https://capacitorjs.com/docs/guides/live-reload) | Medium to high | Real WebView on a simulator or device | Verifying native-container integration, system bars, plugins, and platform-specific behavior | Requires native tooling, network setup, and a slower development loop than browser preview. |
| App-side inset handling, such as [Capacitor System Bars](https://capacitorjs.com/docs/apis/system-bars) or a [safe-area helper](https://www.npmjs.com/package/%40capacitor-community/safe-area) | Medium | Real application runtime | Handling platform insets and WebView compatibility in the application | Changes the application and solves runtime behavior rather than providing an external preview harness. |
| Simulator or physical-device testing | High | Highest available | Acceptance checks, browser/WebView differences, keyboard behavior, rotation, and device-specific geometry | Slower to start and maintain, so it is not a replacement for a quick browser feedback loop. |

## Delivery Models

| Model | Strengths | Tradeoffs |
| --- | --- | --- |
| CLI-managed dedicated Chrome profile | Reproducible launch, bounded browser state, direct CDP access, and explicit reset | Starts a separate Chrome instance and must manage its lifecycle safely. |
| Current-tab browser extension | Convenient interaction with an already open page | The [`debugger` permission](https://developer.chrome.com/docs/extensions/reference/api/debugger) and CDP attachment must be explained; opening DevTools ends the extension's debugging session. |
| Application integration | Can expose app-specific variables and runtime behavior | Requires project changes and onboarding before the preview becomes useful. |
| Native live-reload loop | Exercises the actual app container | Has the highest setup cost and depends on native tooling and network configuration. |

## Project Layering

The preview uses Chrome DevTools Device Mode as its base layer, applies CDP
safe-area overrides when supported, injects application-specific fallback
tokens when needed, and draws DOM overlays for unsafe regions. Native WebView,
system-bar, keyboard, rotation, and geometry checks remain on simulators or
physical devices.

## Standards And Platform Context

The [CSS Environment Variables specification](https://www.w3.org/TR/css-env-1/) defines `safe-area-inset-*` and `safe-area-max-inset-*`. It requires zero safe-area insets for rectangular displays and defines the inset rectangle used to keep essential content visible on nonrectangular displays.

Apple's [WebKit guidance for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) explains how `viewport-fit=cover` and safe-area-aware padding work together. Chrome's [edge-to-edge migration guide](https://developer.chrome.com/docs/css-ui/edge-to-edge) documents evolving Android behavior around gesture navigation and dynamic insets.

## Selection Guide

- Use Device Mode for ordinary responsive checks.
- Add CDP overrides when standard `env()` behavior is the subject of the test.
- Use CSS-variable injection when the application has its own inset tokens or CDP is unavailable.
- Use Live Reload or native builds when the WebView container affects the result.
- Confirm release-critical geometry and interaction on the target devices.
