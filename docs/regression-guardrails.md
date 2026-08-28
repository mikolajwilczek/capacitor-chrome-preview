# Regression Guardrails

These are the behaviors future changes should preserve.

## Primary Workflow

- The first useful path is a TypeScript Node CLI that launches Chrome through CDP.
- The target audience is Capacitor and other WebView-based hybrid app teams.
- The default path should not require app-side setup before the user sees an overlay.
- Current support is macOS plus Google Chrome; other platforms and Chromium browsers are planned.

## Chrome And Viewport

- Use Chrome app mode for the preview window. Normal tabs/windows and docked DevTools can change the content viewport.
- Reapply `Browser.setContentsSize`, `Emulation.setDeviceMetricsOverride`, touch emulation, mouse-to-touch emulation, safe-area override, and runtime injection on startup, restore, and device switch.
- Keep `r` as the recovery path when a user resizes or otherwise tampers with the preview Chrome window.

## Chrome Session Ownership

- Validate the configured debug port, bind CDP explicitly to `127.0.0.1`, and refuse an occupied port before launching Chrome.
- Give each run a unique profile directory and an unguessable launch-marker URL. Attach only to the page whose URL exactly matches that marker.
- Abort if the spawned Chrome process exits before the debug endpoint and marked target are both found.
- Never fall back to a pre-existing or lookalike target, enumerate targets for cleanup, close unrelated targets, or call CDP `Browser.close`.
- Reset only the attached target and close its CDP client. Terminate Chrome only through the process group created by this run.
- Remove only the validated UUID profile for this run, and only after Chrome
  confirms exit. Retain it with a warning if Chrome may still be using it.
- Keep the owned-Chrome signal handler installed for the whole run. External
  SIGINT, SIGTERM, and SIGHUP must synchronously signal the owned process group
  even when asynchronous reset cannot finish before the CLI exits.

## Safe Areas

- Prefer CDP `Emulation.setSafeAreaInsetsOverride` so app CSS using `env(safe-area-inset-*)` can react.
- Keep injected `--safe-area-inset-*` variables as fallback/debug support, not the only strategy.
- Make visual overlays obvious enough to inspect top/bottom unsafe regions.
- Be direct in docs that Chrome emulation is not pixel-perfect native simulation.

## Android Navigation Controls

- Three-button Back must stay within safe app history and must not expose the CLI loading page.
- Reset the preview target's navigation history only after the initial app top frame commits, preserving SPA history created afterward.
- Three-button Back must run Ionic `ionBackButton` handlers by priority before browser-history fallback; an overlay dismissal must not also navigate.
- Home and Recents remain preview-only feedback; do not claim to simulate Android tasks or launcher behavior.
- Navigation-control pointer, click, and activation-key events must not fall through to app content.
- Gesture Back must accept inward swipes from either edge while rejecting short, outward, vertical, canceled, and multi-pointer gestures.
- Gesture sensors must consume their pointer sequences and be removed when switching away from Android gesture mode.
- Reset and device switching must remove navigation handlers, transient feedback, and active pointer state.

## Lifecycle And Reporting

- Bound startup, navigation, CDP operations, and shutdown so a closed or stalled
  target cannot hang the CLI indefinitely.
- Inspect `Runtime.evaluate.exceptionDetails`; transport success alone does not
  prove runtime installation.
- Report viewport, window sizing, safe-area CDP support, mouse-to-touch support,
  and runtime installation as separate capabilities.
- Register runtime bootstrap code for future documents, but return immediately
  in subframes.
- Commit a new active device only after required reconfiguration succeeds; roll
  back the previous bootstrap and emulation after failure.

## Reset And Privacy

- Reset must remove injected DOM/style, restore previous inline safe-area variables, clear CDP device metrics, clear safe-area override, disable touch emulation, and disable mouse-to-touch conversion.
- Do not normalize broad all-sites extension access.
- Do not track private company code, internal URLs, private screenshots, secrets, or local app paths.

## Required Checks

Run these before changing preview behavior:

```sh
npm run typecheck
npm run build
npm test
```

Use `docs/manual-safe-area-test.html` for manual verification when changing runtime rendering, safe-area behavior, or device profiles.
