# Chrome App Window Sizing Research

Research date: 2026-06-26
Implementation verification date: 2026-06-27
Source links rechecked: 2026-06-27

Question: can the preview launcher make spawned Chrome use the iPhone 15 Pro CSS viewport size directly, without opening DevTools Device Mode responsive view, while keeping DevTools open?

## Verdict

Yes, but use an app-mode Chrome window instead of a normal browser tab.

App-window sizing and CDP device emulation solve separate problems:

- Native Chrome window sizing controls the visible app frame.
- CDP device emulation controls mobile browser semantics such as DPR, touch, viewport meta behavior, screen dimensions, and safe-area values.

The preview therefore launches a small app window and then applies CDP device
metrics and safe-area emulation.

Validated flow:

1. Launch Chrome with a dedicated profile, remote debugging, `--auto-open-devtools-for-tabs`, `--window-size=393,852`, and `--app=<loading-url>`.
2. Attach to the app page target through CDP.
3. Call `Browser.getWindowForTarget`.
4. Call experimental `Browser.setContentsSize` with the device CSS viewport size.
5. Apply the existing `Emulation.setDeviceMetricsOverride`, touch emulation, and safe-area override.
6. Navigate the app window to the requested dev-server URL.
7. Verify with `Page.getLayoutMetrics`.

DevTools can stay open in its own window without using Device Mode's responsive
view.

## Prototype Result

This path is now implemented in `src/preview.ts`.

The prototype launch now:

- Spawns Chrome with `--app=<data loading page>` instead of `--new-window about:blank`.
- Passes `--window-size=393,852` for the initial app window.
- Keeps `--auto-open-devtools-for-tabs`.
- Attaches through CDP before navigating to the requested URL.
- Calls `Browser.getWindowForTarget` and experimental `Browser.setContentsSize`.
- Applies the existing `Emulation.setDeviceMetricsOverride`, touch emulation, safe-area override, and injected overlay runtime.
- Verifies the result with `Page.getLayoutMetrics`.

Local verification on 2026-06-27:

```text
npm run typecheck
Verified viewport: 393x852
```

The built CLI was run against a small `data:` page on temporary debug port `9450`. It reported `Verified viewport: 393x852`, then the spawned test Chrome was closed and the temporary/default debug ports were confirmed clear.

## Why Normal Tabs Are Not Enough

Plain `--window-size=393,852` does not guarantee a `393x852` page viewport in a normal Chrome tab.

Local probe on macOS with Google Chrome `149.0.7827.197`:

| Mode | Requested | Browser bounds | Page viewport |
| --- | --- | --- | --- |
| Normal tab, DevTools docked | `--window-size=393,852` | `500x852` | `150x765` |
| Normal tab, no DevTools | `--window-size=393,852` | `500x852` | `500x765` |
| Normal tab, `Browser.setContentsSize(393,852)` | `393x852` contents | `500x939` | `500x852` |
| App window, DevTools open | `--app=...`, `--window-size=393,852` | `393x852` | `393x820` |
| App window, DevTools open, then `Browser.setContentsSize(393,852)` | `393x852` contents | `393x884` | `393x852` |
| App window plus existing device metrics override | `393x852`, DPR `3`, mobile `true` | `393x884` | `393x852`, DPR `3`, coarse pointer |

Normal Chrome windows hit a platform/browser minimum width on this machine. Docked DevTools consumes more page width, making the result unusable for an iPhone-width preview. App windows remove the tab strip/address bar constraints and allow the page contents to reach `393px` width.

## Implementation Notes

Use a small `data:` loading page for `--app`, not `about:blank`. In local testing, `--app=about:blank` became a Chrome new-tab page target, which is not a good controlled starting point.

Suggested launch shape:

```text
--remote-debugging-port=<port>
--user-data-dir=<profileDir>
--no-first-run
--no-default-browser-check
--disable-extensions
--auto-open-devtools-for-tabs
--window-size=393,852
--window-position=<x>,<y>
--app=data:text/html,<title>Capacitor Chrome Preview</title><meta name="viewport" content="width=device-width,initial-scale=1">
```

Suggested CDP flow:

```ts
const { windowId } = await client.Browser.getWindowForTarget({ targetId: target.id });

await client.Browser.setContentsSize({
  windowId,
  width: device.width,
  height: device.height,
});

await client.Emulation.setDeviceMetricsOverride({
  width: device.width,
  height: device.height,
  deviceScaleFactor: device.deviceScaleFactor,
  mobile: true,
  screenWidth: device.width,
  screenHeight: device.height,
  positionX: 0,
  positionY: 0,
});
```

Touch input simulation needs two CDP calls in app mode. `Emulation.setTouchEmulationEnabled` makes Chrome expose touch-capable mobile page state, while `Emulation.setEmitTouchEventsForMouse` converts desktop mouse input into touch events. Reset needs to clear both so the dedicated profile does not keep stale input behavior.

Keep `Page.getLayoutMetrics` as the verification hook. The iPhone 15 Pro check
passes when `cssLayoutViewport.clientWidth === 393` and
`cssLayoutViewport.clientHeight === 852`.

## Tradeoffs

- App mode removes the browser address bar and normal tab UI. That is acceptable for a preview harness and closer to a native app container, but it is less like ordinary browsing.
- `Browser.setContentsSize` is experimental in CDP. Keep a fallback to the current `Emulation.setDeviceMetricsOverride`-only path.
- `--auto-open-devtools-for-tabs` is documented by Chrome, but Chrome's docs warn that the flag applies to the first Chrome instance. The dedicated preview profile should still be verified across macOS, Windows, and Linux.
- The preview should continue applying `Emulation.setDeviceMetricsOverride`. Physical window sizing gives the visible app frame, while the CDP metrics override preserves mobile viewport-meta behavior, DPR, touch/coarse pointer behavior, and screen dimensions.
- Do not depend on DevTools docking preferences. A docked DevTools pane can still destroy the usable page width in normal-tab mode.
- `Browser.setContentsSize` uses DIP dimensions. The verification source of truth for the product should be the page's reported CSS viewport from `Page.getLayoutMetrics`, not the outer window bounds.

## Sources

- Chrome DevTools Protocol `Browser.getWindowForTarget` and experimental `Browser.setContentsSize`: <https://chromedevtools.github.io/devtools-protocol/tot/Browser/>
- Chrome DevTools Protocol `Page.getLayoutMetrics`: <https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-getLayoutMetrics>
- Chrome DevTools Protocol `Emulation.setDeviceMetricsOverride`: <https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setDeviceMetricsOverride>
- Chrome DevTools docs for `--auto-open-devtools-for-tabs`: <https://developer.chrome.com/docs/devtools/open#auto-open>
- Chromium source for `--app` and `--auto-open-devtools-for-tabs`: <https://chromium.googlesource.com/chromium/src/+/HEAD/chrome/common/chrome_switches.cc>
- Chromium source for `--window-size`: <https://chromium.googlesource.com/chromium/src/+/HEAD/chrome/common/chrome_switches.cc>
