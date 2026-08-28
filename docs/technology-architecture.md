# Technology Architecture

## Decision

Use runtime attachment as the primary architecture. The controller connects to
an existing dev app and applies the preview without an app dependency.

Keep build-tool integration optional. A Vite or esbuild plugin is useful when
runtime attachment cannot inject early enough or the app needs explicit
fallback CSS tokens.

## Architecture Layers

### Layer 1: Controller

The controller owns the session:

- Find or launch Chrome.
- Open the dev-server URL.
- Select the active tab/target.
- Apply device profile data.
- Enable/disable preview.
- Reset all injected state.

Preferred implementation:

- TypeScript Node CLI.
- Launch a dedicated Chrome profile for predictable permissions and cleanup.
- Use Chrome DevTools Protocol directly.

Candidate libraries:

- `chrome-launcher` or a small custom Chrome launcher for process/profile handling.
- `chrome-remote-interface` for CDP calls.
- `devtools-protocol` types for typed CDP payloads.

Avoid making Playwright the product runtime dependency unless it proves simpler without hiding Chrome-specific behavior. Playwright is excellent for tests, but the product should control the user's installed Chrome.

### Layer 2: Browser Emulation

The browser emulation layer uses CDP where possible:

- `Emulation.setDeviceMetricsOverride` for viewport, scale, mobile mode, and orientation.
- `Emulation.setSafeAreaInsetsOverride` for `env(safe-area-inset-*)` and `env(safe-area-max-inset-*)`.

When the CDP override works, app code that uses standards-based safe-area CSS
reacts without app-specific configuration.

This layer should run before navigation when the controller owns the launch. If attaching to an already open app, apply it immediately and test whether a reload is required for reliable style recalculation.

### Layer 3: Injected Preview Runtime

The injected runtime is a small script/CSS bundle inserted into the page. It should be framework-agnostic and idempotent.

Responsibilities:

- Draw unsafe-area overlays.
- Draw hardware overlays such as Dynamic Island, notch, and home indicator.
- Expose current preview state for debugging.
- Reapply overlays after SPA navigation.
- Optionally dispatch a preview event when the simulated insets change.
- Remove everything cleanly on reset.

Injection mechanisms:

- For CLI-controlled Chrome: use CDP, preferably `Page.addScriptToEvaluateOnNewDocument` before navigation plus `Runtime.evaluate` for already loaded pages.
- For extension mode: use Manifest V3 `chrome.scripting.executeScript` and `chrome.scripting.insertCSS`.

The runtime should not modify application code or depend on app framework internals.

TypeScript boundary:

- Keep device/profile state in shared TypeScript types.
- Keep the injected browser runtime as real TypeScript functions, not hand-written JavaScript strings.
- Serialize compiled runtime factories only at the final CDP boundary, where `Page.addScriptToEvaluateOnNewDocument` and `Runtime.evaluate` require source text.
- Keep each serialized factory standalone. `Function.prototype.toString()` carries only that factory body, so the source composer passes the shared/iOS/Android style factories and input/Back/button/edge navigation factories as explicit dependencies alongside UI and lifecycle.

### Layer 4: Fallback Token Injection

Fallback token injection exists for apps or browser versions where CDP safe-area override is unavailable or unreliable.

It injects configured CSS variables, for example:

```css
:root {
  --app-safe-area-top: 59px;
  --app-safe-area-right: 0px;
  --app-safe-area-bottom: 34px;
  --app-safe-area-left: 0px;
}
```

This path requires the app and preview to agree on variable names, so it remains
a fallback when CDP cannot provide the safe-area values.

### Layer 5: Optional Dev-Server Integration

The dev-server integration is an opt-in package for teams that need deterministic early injection.

Candidate package names:

- `@capacitor-chrome-preview/vite`
- `@capacitor-chrome-preview/esbuild`
- `@capacitor-chrome-preview/dev-server`

Responsibilities:

- Inject the preview bootstrap into HTML during local development only.
- Expose a local control endpoint or WebSocket for the CLI/extension.
- Provide app-safe fallback variables before the app CSS loads.
- Emit warnings when app CSS uses unsupported patterns.

First use must remain possible without this package. Teams can opt in when they
need injection before application CSS loads.

## When To Inject

### Injection Decision Matrix

| Situation | Injection method | Timing | Why |
| --- | --- | --- | --- |
| CLI launches Chrome and opens the app | CDP emulation plus `Page.addScriptToEvaluateOnNewDocument` | Before first navigation | Applies values before app CSS and avoids app coupling. |
| CLI/extension attaches to an already open tab | CDP emulation plus `Runtime.evaluate`/`chrome.scripting` | Immediately, then reload if needed | Works with the current tab but may need a reload for style recalculation. |
| CDP safe-area override works but overlays are missing after SPA navigation | Runtime reinjection or route observer | After history/navigation changes | Keeps visual preview stable without app changes. |
| CDP safe-area override fails or is unavailable | CSS fallback token injection | Before app CSS if possible, otherwise immediate plus reload | Works for apps that agree on variables, but requires guided setup. |
| Team wants reliable fallback before first render | Vite/dev-server plugin | During dev HTML transform | Plugin can place bootstrap/style before app scripts and styles. |
| Team uses esbuild directly | esbuild plugin or wrapper dev server | During dev HTML/entry generation | Useful only if the app actually has an esbuild-controlled dev entry point. |

### Controller-Owned Navigation

Flow:

1. Developer starts app dev server.
2. Developer runs:

   ```sh
   npm run preview -- http://localhost:4200 --device iphone-15-pro
   ```

3. CLI launches a dedicated Chrome profile with remote debugging.
4. CLI attaches to the target before first navigation.
5. CLI applies device metrics and safe-area insets through CDP.
6. CLI registers the preview runtime with `Page.addScriptToEvaluateOnNewDocument`.
7. CLI opens the app URL.
8. Runtime draws overlays as soon as the document is ready.

App CSS sees the emulated conditions from the first navigation.

### Existing-Tab Attachment

Flow:

1. Developer opens the local app in Chrome.
2. Developer starts the preview session or clicks the extension.
3. Controller attaches to the current tab.
4. Controller applies CDP safe-area emulation.
5. Controller injects overlay runtime immediately.
6. If computed styles do not update reliably, controller prompts for or performs a reload.

This flow may require a reload because the controller did not own the first
navigation.

### Build-Tool Injection

Flow:

1. App installs an optional dev dependency.
2. App config adds a Vite/esbuild/dev-server plugin.
3. Plugin injects preview bootstrap into development HTML.
4. CLI or extension connects to the bootstrap through local messaging.
5. Bootstrap sets fallback tokens before app CSS finishes loading.

This handles apps where:

- CDP safe-area override is unavailable.
- A page must see fallback tokens before the first render.
- The app uses custom CSS variables instead of direct `env()` values.

## Extension Role

The extension should be optional at first.

Possible roles:

- Current-tab attach for users who prefer clicking instead of running a CLI.
- Device picker UI.
- Overlay toggles.
- Debug state panel.

Risks:

- `debugger` permission is sensitive.
- Broad host access is a trust problem.
- Chrome Web Store review adds release overhead.

Permission posture:

- Prefer `activeTab` and current-tab operations.
- Avoid `<all_urls>` as the default public MVP posture.
- If debugger access is required, explain it as "controls only the selected preview tab while the session is active."

## Package Structure

Likely monorepo packages:

```text
packages/
  core/        device profiles, session state, shared protocol
  cli/         Chrome launch, CDP controller, local config
  runtime/     injected overlay/runtime bundle
  extension/   optional Manifest V3 UI and current-tab attach
  vite/        optional dev-server HTML injection
  esbuild/     optional build/dev-server injection
```

Initial implementation can start with fewer packages:

```text
packages/
  core/
  cli/
  runtime/
```

Add extension and plugin packages only after the CDP spike proves the runtime path.

## Session Protocol

The preview state should be plain JSON:

```json
{
  "enabled": true,
  "deviceId": "iphone-15-pro",
  "viewport": { "width": 393, "height": 852, "deviceScaleFactor": 3 },
  "safeArea": { "top": 59, "right": 0, "bottom": 34, "left": 0 },
  "overlays": {
    "unsafeArea": true,
    "hardware": true
  },
  "fallbackVariables": {}
}
```

The same state should drive CLI, extension, injected runtime, and future plugins.

## Reset Requirements

Reset must restore the browser and page state changed by the preview.

It should:

- Clear CDP safe-area overrides.
- Clear device metric overrides when the session owns them.
- Remove injected overlay DOM.
- Remove injected style elements.
- Remove fallback CSS variables set by the tool.
- Detach from the tab or close the dedicated Chrome profile when appropriate.

A failed reset can leave stale DOM, CSS variables, emulation, or profile state.

## MVP Technology Stack

Recommended MVP stack:

- TypeScript.
- Node CLI.
- CDP through `chrome-remote-interface` or a thin typed CDP wrapper.
- Dedicated Chrome profile launched by the CLI.
- Injected runtime built as a small browser script.
- Static device profile JSON/TypeScript data.
- Playwright only for automated verification and screenshots.

Defer:

- Published Chrome extension.
- Vite/esbuild plugin packages.
- Native Capacitor plugin.
- Large device database.

## Dev-Server Plugin Order

Implement optional dev-server integration in this order:

1. Vite plugin first, because it has a clear `transformIndexHtml` hook and is common for modern frontend dev servers.
2. Generic HTML injection helper second, for custom dev servers.
3. esbuild plugin only if a target app actually uses esbuild in a way that controls the development HTML or entry bootstrap.

The plugin must be development-only. It should refuse or no-op in production builds unless explicitly forced.

## First Technical Spike

Build the smallest proof:

1. Static demo page using direct `env(safe-area-inset-*)`.
2. Node script launches Chrome with remote debugging.
3. Script sends `Emulation.setDeviceMetricsOverride`.
4. Script sends `Emulation.setSafeAreaInsetsOverride`.
5. Script injects a Dynamic Island overlay.
6. Script reads computed styles to prove `env()` changed.
7. Script resets and verifies styles/DOM return to normal.

A successful direct override supports the CLI architecture. If it fails,
evaluate extension attachment and dev-server injection before selecting the
fallback.
