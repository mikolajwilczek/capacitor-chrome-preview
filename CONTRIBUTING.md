# Contributing

Capacitor Chrome Preview is early-stage developer tooling for Capacitor and other WebView-based hybrid apps. Contributions should preserve quick setup and reliable reset while describing browser-emulation limits accurately.

## Public Repo Rules

- Do not add private company code, screenshots, URLs, secrets, or app-specific assumptions.
- Keep examples generic unless the referenced project is public and intentionally used as an example.
- Do not add broad browser permissions or all-sites extension access without documenting the tradeoff.
- For changing external facts, comparisons, or tool claims, refresh sources and include a research date.

## Before Opening A PR

Run:

```sh
npm run check
```

`npm run check` runs typecheck, build, and tests. GitHub Actions runs the same
command with Node.js 24 on pushes to `main`/`master` and on pull requests. CI
uses Linux because these checks are platform-agnostic and do not launch Chrome.

Dependency installation configures the tracked pre-commit hook for this
repository. The hook runs `npm run check` before each commit. An existing
`core.hooksPath` with a different value is left unchanged.

For preview behavior changes, run the manual safe-area page:

```sh
npm run preview
```

Check that `q` resets the preview and closes the dedicated Chrome window.

## Device Profiles

Keep device profiles as plain data and document the source of each value.

When adding or changing a profile:

- Include viewport width, viewport height, DPR, safe-area insets, and hardware overlay data.
- State whether values are measured, sourced, or approximate.
- Update `docs/research/device-profiles.md`.
- Add or update tests for profile lookup and copied profile data.

## Native Capability Patches

Future native-capability patches must expose what they simulate and allow project-specific additions.

Requirements:

- Observe `window.Capacitor` only in the preview runtime.
- Patch a narrow plugin surface.
- Make the patch resettable.
- Keep project-specific patches outside the core unless they are generally useful.
- Document what is simulated and what is not.

Examples of future patches: keyboard inset events, app lifecycle events, network state, status bar style, deep-link dispatch, and selected plugin mocks.

## Documentation

Document limitations directly. Do not claim pixel-perfect native simulation, full Capacitor runtime coverage, or real-device equivalence.

Use these docs as source of truth:

- `README.md` for current public usage.
- `ROADMAP.md` for planned work.
- `docs/regression-guardrails.md` for behavior future changes must preserve.
- `docs/research/` for dated research and external comparisons.
