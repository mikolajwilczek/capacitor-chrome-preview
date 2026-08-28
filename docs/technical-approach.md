# Technical Approach

## Guiding Principle

Prefer the lowest-friction path that makes common mobile layout bugs visible in
Chrome while stating what the browser cannot reproduce.

## Core Concept

The harness connects three pieces:

1. A running web dev server, such as Vite, Webpack, Next.js, or a framework-specific server.
2. A Chrome tab showing the app at a mobile viewport.
3. A device profile that applies safe-area values and optional visual overlays.

For the first slice, the device profile only needs dimensions, orientation, safe-area insets, and a Dynamic Island/notch overlay.

For the concrete runtime architecture, see [Technology Architecture](technology-architecture.md).

## Architecture Options

### Option A: Content-script-only Chrome extension

Inject CSS variables and a visual overlay into the page.

Example injected variables:

```css
:root {
  --capacitor-preview-safe-area-top: 59px;
  --capacitor-preview-safe-area-right: 0px;
  --capacitor-preview-safe-area-bottom: 34px;
  --capacitor-preview-safe-area-left: 0px;
}
```

Pros:

- Simple to build.
- Easy to ship as a Chrome extension.
- Works without launching a special Chrome instance.

Cons:

- It cannot reliably override browser-native `env(safe-area-inset-*)` values.
- Apps must consume project-level CSS variables or framework-specific variables.
- This can drift away from real native behavior if each app integrates differently.

Use this as a fallback, not the preferred long-term core.

### Option B: Chrome extension using the Debugger API

Use `chrome.debugger` to send Chrome DevTools Protocol commands to the current tab. Chrome documents this API as a way for extensions to send CDP commands after declaring the `debugger` permission.

Relevant CDP primitive:

```text
Emulation.setSafeAreaInsetsOverride
```

The current CDP documentation describes it as experimental and says it overrides `env(safe-area-inset-*)` and `env(safe-area-max-inset-*)`.

Pros:

- Tests the same CSS API developers should use in real mobile webviews.
- Avoids requiring app-specific CSS variable integration for the standards-based path.
- Can still pair with a visible overlay.

Cons:

- Requires scary-looking extension permissions.
- Experimental CDP APIs can change.
- Needs careful detach/reset behavior so Chrome does not remain in a confusing debugged state.

Use this route when current-tab attachment is required and its permission and
reset behavior are acceptable.

### Option C: CLI-controlled Chrome

Ship a Node CLI that launches a dedicated Chrome profile with remote debugging enabled, opens the dev server URL, then applies CDP emulation from the CLI.

Current local-source command:

```sh
npm run preview -- --url http://localhost:4200 --device iphone-15-pro
```

Pros:

- One command can start the browser in a known state.
- No broad Chrome extension permission prompt is needed if CDP is controlled through the launched browser.
- Easier to integrate with project scripts.

Cons:

- Requires Chrome process management across macOS, Linux, and Windows.
- Harder to affect an already-open tab.
- The CLI still needs either an extension, a CDP overlay injection, or both for UI controls.

The current prototype uses this model to keep the browser state and CDP
connection under one controller.

### Option D: Capacitor/native companion

Build a Capacitor plugin or native companion later to export measured values from actual devices and compare them with the Chrome preview.

Pros:

- Improves accuracy.
- Helps build trustworthy device profiles.

Cons:

- Reintroduces native setup.
- Not needed for the first pain point.

Keep this out of the MVP.

## MVP Recommendation

Build the first technical spike around Option C with Option B as the later click-based UI path and Option A as fallback, while keeping permissions narrow:

1. Node CLI launches or connects to Chrome.
2. CLI applies device metrics and safe-area override through CDP.
3. CLI injects a small runtime for unsafe-area and Dynamic Island overlays.
4. CLI verifies/reset behavior.
5. Optional Chrome extension adds current-tab UI after the CDP path is proven.
6. Optional CSS-variable injection and dev-server plugins cover fallback cases.

The standards-based path should work on a demo that uses
`env(safe-area-inset-*)` directly. Framework variable mapping and app changes
belong to the fallback path.

A CLI-managed dedicated profile avoids broad extension access and limits CDP to
the preview browser instance.

Do not make a dev dependency, Vite plugin, or esbuild plugin mandatory for the first preview. Those integrations are secondary tools for deterministic early injection when runtime attachment is not enough.

## Permission And Trust Requirements

Avoid broad browser access by default.

Preferred permission posture:

- Localhost/dev-server URL first.
- Current tab only where possible.
- Dedicated Chrome profile for CLI-controlled CDP.
- Explicit opt-in for non-local URLs.
- Clear privacy documentation before Chrome Web Store release.

An extension that asks to read or change data on all sites is a poor fit for the target company rollout, even if the implementation is benign. If broad access becomes technically necessary for a prototype, document it as a temporary limitation and keep the public MVP focused on a narrower model.

## CDP Validation

Before building extension UI, verify the CDP behavior directly:

1. Create a demo page that uses `env(safe-area-inset-*)` directly.
2. Apply `Emulation.setSafeAreaInsetsOverride` through CDP.
3. Verify computed styles change without app-specific CSS variables.
4. Repeat through `chrome.debugger`.
5. Repeat through a CLI-launched Chrome with remote debugging.
6. Verify which implementation path can avoid broad all-sites extension access.

Direct `env()` overrides can be the primary path only when these checks pass.
Otherwise, runtime injection and configured fallback variables must carry the
preview behavior.

## App-Side CSS Strategy

The standards-based path uses safe-area environment values:

```css
.app-header {
  padding-top: max(16px, env(safe-area-inset-top, 0px));
}
```

If CDP override support is unavailable, the app may need a project token that can be overridden by the harness:

```css
:root {
  --app-safe-area-top: env(safe-area-inset-top, 0px);
  --app-safe-area-bottom: env(safe-area-inset-bottom, 0px);
}

.app-header {
  padding-top: max(16px, var(--app-safe-area-top));
}
```

The open-source docs should explain both paths. Projects can adopt the token path incrementally if it is needed for reliability.

## Device Profiles

A profile should be plain data, for example:

```json
{
  "id": "iphone-15-pro",
  "name": "iPhone 15 Pro",
  "platform": "ios",
  "viewport": { "width": 393, "height": 852, "deviceScaleFactor": 3 },
  "safeArea": { "top": 59, "right": 0, "bottom": 34, "left": 0 },
  "hardwareOverlay": { "type": "dynamic-island" }
}
```

The exact values should be treated as measured profile data, not guessed constants. Initial values can be approximate for a prototype, but stable releases should document how each profile was verified.

## Risks

- Chrome safe-area override support is experimental.
- A Chrome extension that asks for debugger access may reduce trust.
- Browser emulation will never cover all native WebView behavior.
- Optional delivery models add maintenance and permission surface.

## Open Questions

- Can `Emulation.setSafeAreaInsetsOverride` be sent reliably through `chrome.debugger` in stable Chrome?
- How much app CSS typically needs to change before the fallback variable path is useful?
