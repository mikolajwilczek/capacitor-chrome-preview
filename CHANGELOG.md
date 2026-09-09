# Changelog

All notable changes to this project will be documented here.

## Unreleased

## 1.1.0 - 2026-09-09

### Added

- `--persist-session` for reusing a dedicated project-local Chrome profile so
  site logins and storage can survive preview restarts.

## 1.0.0 - 2026-08-28

### Added

- Node/CDP preview prototype for launching a dedicated Chrome app-mode window.
- Device profiles for iPhone 15 Pro, iPhone 13, Samsung Galaxy A54, and Samsung Galaxy A54 with 3-button navigation.
- CDP device metrics, touch emulation, mouse-to-touch emulation, and experimental safe-area override.
- Injected runtime for safe-area guides, status bar art, Dynamic Island/notch/hole-punch overlays, and bottom home/navigation indicators.
- Interactive Android three-button navigation with Ionic Back-handler delivery, safe app-history fallback, Home/Recents feedback, and isolated control input.
- Android gesture-navigation Back using isolated left/right edge swipes with progress feedback.
- App-root history reset so Back cannot reveal the internal "Opening preview..." bootstrap page.
- Interactive terminal UI for device switching, restoring the active device, returning to the launch URL, and resetting the preview.
- Manual safe-area test page at `docs/manual-safe-area-test.html`.
- Unit and DOM regression tests for CLI options, CDP behavior, app-mode launch arguments, device reconfiguration, touch input mode, and runtime reset.

### Changed

- Expanded public documentation to cover Capacitor and other WebView-based hybrid apps.
- Reconciled the Galaxy A54 profiles with physical Android 16 measurements for
  viewport, DPR, safe areas, system bars, and hole-punch placement.
- Runtime exceptions and individual emulation capabilities are now reported
  instead of treating viewport verification as complete success.
- Navigation and CDP operations are bounded, device switches roll back on
  required-step failure, and runtime bootstrap code exits in subframes.
- Per-run Chrome profiles are removed after Chrome confirms exit.
- External process signals stop the owned Chrome process group immediately;
  graceful terminal exits still complete reset and profile removal.
- CI covers Node.js 24 with full-commit action pinning.

### Known Limits

- Current implementation targets macOS with Google Chrome.
- CDP safe-area override is experimental and may vary by Chrome version.
- Operating-system overlay art remains approximate even where viewport and
  safe-area geometry is physically measured.
