# Roadmap

## Current Focus

The safe-area preview works locally on macOS with Google Chrome. Stage 2 now
focuses on CLI reliability and release hardening. The Geometry Probe provides
the measurement groundwork for Stage 5. Optional server integrations and native
capability patches have not started.

## Stage 0: Public-Ready Prototype

Status: in progress.

Completed:

- Company-agnostic source and examples.
- Documented safe-area preview workflow.
- Regression tests for CLI arguments, CDP calls, runtime reset, and device reconfiguration.
- Matching validation through GitHub Actions and the tracked pre-commit hook.
- MIT license.

Remaining:

- Complete the final source-publication review.
- Freeze and publish the reviewed candidate.
- Keep npm publication deferred until Stage 2 package requirements are complete.

## Stage 1: Safe-Area Preview

Status: complete as a prototype.

Delivered:

- Node CLI that launches an isolated Chrome profile.
- App-mode Chrome window with explicit content sizing.
- Interactive device selection and command-line `--device` support.
- iPhone Dynamic Island and notch profiles.
- Android gesture and 3-button system-bar profiles.
- CDP safe-area override with fallback-variable injection.
- Visible status bar, hardware, safe-area, home, and navigation overlays.
- Interactive Android Back behavior with Ionic handler delivery and safe app-history fallback.
- Reset of injected runtime state, touch emulation, device metrics, and safe-area overrides.
- Bundled manual safe-area test page as the default launch URL.
- No app-side dependency for the first visible result.

Profile viewport and safe-area geometry is measured. The operating-system
overlay drawings remain approximate.

## Stage 2: CLI Harness

Status: in progress.

Delivered:

- One-command local launch through `npm run preview`.
- Optional URL and `--device` arguments.
- Interactive device switching, restore, return-to-launch-URL, and reset controls.
- Loopback-only CDP, occupied-port refusal, per-run launch markers, and isolated profiles.
- Clear errors for invalid arguments, devices, ports, and failed navigation responses.
- Bounded CDP startup, navigation, runtime, emulation, and cleanup operations.
- Separate capability reporting for viewport, app-window sizing, safe area,
  mouse-to-touch input, and runtime injection.
- Runtime exception reporting and top-frame-only bootstrap execution.
- Transactional device switching with rollback after required-step failures.
- Automatic cleanup of the validated per-run profile after Chrome exits.
- Node.js 24 verification with a clean dependency audit.

Current release verification:

- Exercise target closure, Chrome closure, redirects, iframe behavior, and
  cleanup in stable Chrome.
- Complete privacy/history scans and independent review.
- Confirm GitHub-facing identity, metadata, and repository settings.

Remaining product work:

- Publish the `npx capacitor-chrome-preview` command.
- Add project configuration for defaults and fallback variables.
- Support platforms beyond macOS after the Chrome path is stable.

Possible project config:

```json
{
  "url": "http://localhost:4200",
  "defaultDevice": "iphone-15-pro",
  "safeAreaFallbackVariables": {
    "top": "--app-safe-area-top",
    "bottom": "--app-safe-area-bottom",
    "left": "--app-safe-area-left",
    "right": "--app-safe-area-right"
  }
}
```

## Stage 2.5: Optional Dev-Server Integrations

Status: not started.

Possible integrations:

- Vite integration.
- esbuild or framework dev-server hooks.
- Development-only HTML bootstrap injection.
- Local control channel for CLI or extension UI.
- Generated fallback CSS-variable configuration.

Dev-server integrations cannot become a prerequisite for the core preview.

## Stage 3: Native Capability Patches

Status: not started.

Expected direction:

- Observe `window.Capacitor` and patch known plugin surfaces only in development.
- Make patches extensible so projects can add their own behavior.
- Keep every patch explicit, resettable, and documented.
- Start with low-risk capabilities such as lifecycle events, network state,
  keyboard insets, status-bar style, and deep-link events.
- Do not present the preview as a full native runtime.

## Stage 4: Release and Evaluation Assets

Status: partially complete.

Available:

- Technical approach and architecture documentation.
- Dated platform and existing-solution research.
- Pre-release changelog.
- Repository-local safe-area demo page.

Remaining:

- Add public screenshots or a short demo video.
- Prepare release notes for the first usable version.
- Decide whether the repository-local demo also needs a hosted version.

## Stage 5: Device Profile Quality

Status: in progress. Both probe hosts compile, and portrait geometry is accepted
for every current profile.

Completed groundwork:

- Documentation of profile values, sources, and approximation status.
- Isolated iOS and Android Geometry Probe.
- Successful native builds for both probe hosts.
- Documented measurement export and acceptance process.
- Accepted iPhone 13 portrait geometry, with landscape-left supporting evidence.
- Accepted iPhone 15 Pro portrait geometry, with landscape-right supporting
  evidence.
- Accepted Galaxy A54 gesture and three-button portrait geometry, with both
  landscape captures retained as supporting evidence.
- Reconciled the Galaxy A54 viewport, DPR, safe areas, system bars, and
  hole-punch placement with physical-device measurements.

Remaining:

- Add visual regression tests for overlay geometry.
- Version device-profile data separately from the CLI implementation.
