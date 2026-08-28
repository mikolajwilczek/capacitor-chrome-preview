# Agent Instructions

## Project Context

This repository contains Capacitor Chrome Preview, an open-source project maintained by Mikołaj Wilczek.

The project targets Capacitor and other WebView-based hybrid app teams. Web developers often avoid native mobile setup, so mobile-specific layout issues reach mobile maintainers late. The initial scope covers safe areas, system bars, notches, and Dynamic Island preview in Chrome.

## Working Rules

- Keep the project company-agnostic by default.
- Do not add private company code, secrets, URLs, screenshots, local repo paths, or assumptions to this repository.
- Use small, documented prototypes until the safe-area approach is proven.
- Research changing external facts and tool comparisons. Include source links and the research date.
- Do not add a package scope, publisher identity, or public repository URL until the corresponding metadata is confirmed.

## Technical Direction

- Use TypeScript unless the repository establishes another stack.
- Start with a TypeScript Node CLI using Chrome DevTools Protocol.
- Consider Chrome Extension Manifest V3 after the CLI/CDP path is proven or when current-tab UI becomes necessary.
- Keep `Emulation.setSafeAreaInsetsOverride` experimental until it is verified in stable Chrome.
- Retain CSS-variable injection as a fallback alongside the CDP path.
- Add native iOS or Android code to the MVP only when profile verification requires it.
- Reuse Chrome DevTools Device Mode as a base layer.
- Limit browser access to localhost, the current tab, or dedicated profiles. Document the permission tradeoffs.
- Show a visible result before requiring app-specific setup. Guide any fallback integration explicitly.
- Use Vite, esbuild, or other dev-server integrations only for optional reliability improvements.
- Keep future native-capability patches explicit, resettable, and extensible by observing `window.Capacitor` only in preview/dev contexts.

## Documentation Standards

- Document product decisions in markdown under `docs/`.
- Keep README public-facing and concise.
- Put research notes under `docs/research/`.
- Describe tradeoffs and browser-emulation limits directly.
- Link public behavior expectations to `docs/regression-guardrails.md`.

## Definition Of Good Work

Changes should improve setup, clarity, or trust. Current priorities:

- Easy launch.
- App-mode Chrome viewport stability.
- Obvious visual overlay.
- Reliable reset.
- Clear fallback behavior.
- Minimal app-side setup.
- Tests for command arguments, CDP emulation/reset, device reconfiguration, touch input mode, and injected runtime reset.

Run these before changing preview behavior:

```sh
npm run typecheck
npm run build
npm test
```
