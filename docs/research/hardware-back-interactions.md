# Hardware Back Interaction Research

Research date: 2026-08-10

## Question

How should the Chrome preview simulate Android Back for:

1. Gesture navigation: an inward swipe from the left or right screen edge.
2. Three-button navigation: clicking the visible Back button.

For three-button navigation, the controls should also have simple click feedback and their input events must not reach the previewed app underneath.

## Verdict

Use the injected runtime for input recognition and route both inputs through one `requestBack(source)` action.

- Gesture mode should add narrow left and right edge sensors and recognize an inward horizontal pointer gesture.
- Three-button mode should turn the existing decorative controls into real overlay buttons.
- The Back action should first run registered Ionic `ionBackButton` handlers, then perform safe web-history traversal only when no Ionic handler registers.
- At the app-history root, keep the preview open and show brief feedback instead of navigating to the CLI loading page or pretending to exit an Android Activity.
- Treat direct Capacitor `App.addListener('backButton')` delivery as a separate compatibility spike. The official web implementation does not implement native back dispatch.

Do not synthesize `KEYCODE_BACK`, `Escape`, `Alt+Left`, or a CDP scroll gesture. Current Android back handling lives above the WebView in Android back callbacks, while CDP input methods only dispatch input to the page.

Implementation status, 2026-08-10: both Android inputs are implemented with Ionic `ionBackButton` priority delivery, safe Navigation API Back fallback, and a CDP-enforced app-history root. Three-button mode includes semantic controls and Home/Recents feedback. Gesture mode includes left/right sensors, progress feedback, direction/threshold rejection, multi-pointer cancellation, event isolation, and reset/device-switch coverage. Direct Capacitor listener delivery remains future work.

## Native Behavior To Approximate

Android gesture navigation invokes Back with an inward swipe from either side edge. Android exposes left and right system-gesture insets because those regions take priority over app gestures. Their exact widths vary; the preview should model the width as prototype profile data rather than claim one universal Android value.

Current Capacitor Android behavior is:

- With no `backButton` listener, go back in the WebView when `WebView.canGoBack()` is true.
- With a `backButton` listener, deliver `{ canGoBack }` and suppress that default WebView traversal.
- Also fire the document-level `backbutton` event on the listener path.

The public Capacitor docs make the same interception rule explicit. They also say an app listener may call `window.history.back()` itself.

Chrome cannot reproduce Android Activity, task, launcher, or predictive-back transitions. It can still exercise the most useful browser-side result: whether the app's web navigation returns to the expected UI.

## Recommended Runtime Design

### One Back Action

Both input sources should call one function:

```ts
type BackSource = 'edge-gesture' | 'navigation-button';

function requestBack(source: BackSource): void {
  // 1. Determine whether safe app history exists.
  // 2. Emit a cancelable preview-owned event for optional adapters.
  // 3. Run Ionic's registered Back handlers by priority.
  // 4. Traverse one entry only when no handler registered.
  // 5. Otherwise show "app history root" feedback.
}
```

Emit a project-owned event before the default traversal:

```ts
const event = new CustomEvent('capacitor-chrome-preview:back', {
  cancelable: true,
  detail: { source, canGoBack },
});

window.dispatchEvent(event);
```

This gives future framework adapters a stable interception point. The implemented Ionic adapter dispatches the public `ionBackButton` event with a compatible `detail.register(priority, handler)` queue. It executes the highest priority first, uses the latest registration to break ties, and calls lower priorities only when a handler invokes `processNextHandler`. If any Ionic handler registers, browser-history fallback is suppressed. Ionic assigns overlays priority `100`, so a dismissible `ion-modal` closes without also navigating the route.

Do not automatically emit a legacy `document.backbutton` event and then also call history: legacy handlers are not required to call `preventDefault()`, so doing both can navigate twice.

### Safe History Boundary

The preview currently launches a `data:` loading page and then navigates to the app. A raw `history.back()` at the app root can therefore expose the loading page.

Use the Navigation API safeguard for current stable Chrome:

1. In the runtime, prefer `window.navigation.canGoBack` plus `window.navigation.back()`. The Navigation API accounts for History API entries used by SPAs and does not report a cross-origin previous entry as available.
2. The controller now calls CDP `Page.resetNavigationHistory()` after the initial app top frame commits, making the app the session root and removing the internal loading page from Back and Forward history.

If the Navigation API is unavailable, request the back action through a CDP runtime binding and let the controller inspect `Page.getNavigationHistory()` before using `Page.navigateToHistoryEntry()`. Avoid `history.length > 1`; it does not identify whether the previous entry belongs to the app.

This controller fallback can be deferred while the tool supports current stable Chrome.

## Gesture Navigation

Add invisible fixed sensors on the left and right edges only for an Android gesture profile:

```text
left edge  -> drag right -> Back
right edge -> drag left  -> Back
```

Suggested prototype geometry and recognition rules:

- Edge width: `24` CSS pixels, stored in the device profile and marked approximate.
- Commit distance: at least `48` CSS pixels inward.
- Direction lock: horizontal distance must exceed vertical distance by about `1.25x`.
- One active primary pointer and one Back action at most per gesture.
- Use `setPointerCapture(pointerId)` so the sensor keeps the gesture after the pointer leaves its narrow hit area.
- Use `touch-action: none` on the sensors to prevent Chrome from treating the drag as page panning.
- Show a small arrow/progress affordance; remove it on commit, cancellation, or reset.

Implementation status: the Galaxy A54 gesture profile stores `24px`, `48px`, and `1.25` for these parameters. Sensors exclude the modeled status and bottom navigation bars. Back commits on pointer release, then enters the same Ionic/history pipeline as the three-button control.

A short tap, outward drag, mostly vertical drag, second pointer, or `pointercancel` must not invoke Back.

An invisible sensor reserves its edge strip and is slightly more aggressive than Android, where simple taps in system-gesture insets can still reach the app. Preserve that limitation in the prototype rather than forwarding synthetic clicks to arbitrary page elements. A later experiment can replace sensors with capture-phase gesture observation if it can reliably cancel the app's partially received pointer stream.

Do not use `Input.synthesizeScrollGesture`: CDP describes it as issuing touch events for scrolling. It does not ask Android or Chrome to perform system Back.

## Three-Button Navigation

Replace the three decorative `div` controls with `button type="button"` elements carrying explicit preview actions:

- Back: call `requestBack('navigation-button')`.
- Home: show brief `Home is not simulated in Chrome` feedback and keep the preview open.
- Recents: show brief `Recents is not simulated in Chrome` feedback and keep the preview open.

Add simple pressed/ripple feedback to all three controls. Home and Recents should not manipulate the page; they belong to Android system/task UI, which Chrome cannot reproduce faithfully.

The current overlay root is `aria-hidden`. Put interactive controls in a separate, labeled overlay layer that is not hidden from assistive technology, while keeping decorative system-bar art hidden.

### Preventing Event Fallthrough

The overlay root currently uses `pointer-events: none`. Keep that for noninteractive art, but set `pointer-events: auto` and `touch-action: manipulation` on navigation buttons.

Hit testing then targets the overlay button instead of app content underneath. For strict isolation from app-level global listeners, install early capture-phase handlers on `window` for the relevant navigation-control events. When the target is a preview control:

```ts
event.preventDefault();
event.stopImmediatePropagation();
```

Handle the action in that same early capture listener because stopping at `window` prevents the event from continuing to the button. For pointer input, invoke on `pointerup` and suppress the following compatibility `click`; use `click` only for keyboard/programmatic activation so one action cannot fire twice. Consume `keydown`/`keyup` for focused controls as well. Suppress compatibility mouse/touch events if manual Chrome verification shows they are still emitted by the current mouse-to-touch emulation.

Register these listeners through `Page.addScriptToEvaluateOnNewDocument`, before app scripts can register their own global handlers. Removing the overlay alone is insufficient: reset and device switching must also remove every capture listener, pointer capture, active gesture, and feedback timer.

## Ionic `ionBackButton` Compatibility

Ionic's public hardware-back contract is suitable for browser-side simulation. Overlay components register a priority-`100` handler when an `ionBackButton` event is dispatched. Reproducing the documented priority queue lets the preview close modals, alerts, popovers, and other dismissible overlays without pretending to send an Android key event.

This is framework-level emulation, not a native Android event. Apps using only Capacitor's `App.addListener('backButton')` still need the compatibility work below.

## Capacitor `App.addListener` Compatibility

The browser build of `@capacitor/app` extends `WebPlugin` but does not implement back dispatch. Therefore a DOM event or history traversal cannot, by itself, invoke an app callback registered with:

```ts
App.addListener('backButton', listener);
```

There is a technically promising but unsupported spike: when `window.Capacitor?.Plugins?.App` exists, feature-detect the web plugin proxy's inherited `hasListeners` and `notifyListeners` methods, then notify `backButton` with `{ canGoBack }`. Those methods are protected implementation details, not public `AppPlugin` API, so this must be tested against supported Capacitor versions and must fail safely to web-history behavior.

Do not make that internal hook the first implementation. A robust future adapter should be explicit, resettable, version-tested, and should never dispatch both the Capacitor callback and default history traversal when the callback is present.

Cordova/document `backbutton` compatibility should likewise be an explicit mode or adapter, not an automatic second event.

## Implementation Order

1. Add the shared preview-owned back event and safe history traversal.
2. Make the three-button overlay interactive and isolate its events.
3. Add left/right gesture sensors and progress feedback.
4. Add a manual test page with clickable controls behind the navigation bar and edges.
5. Add controller-managed history reset only if support expands beyond Chrome's Navigation API.
6. Spike Capacitor listener delivery separately with a real Capacitor browser bundle.

## Required Tests

- Back-button click requests exactly one back action.
- App `window`, `document`, and underlying-element pointer/click listeners do not receive navigation-button input.
- Home and Recents give feedback, do not navigate, and do not leak events.
- Left-edge inward and right-edge inward gestures each request one back action.
- Short, outward, vertical, canceled, and multi-pointer gestures do not request Back.
- Back at the app root does not reveal the CLI loading page or close Chrome.
- A same-origin `pushState` entry can be traversed and reports `canGoBack: true`.
- Reinstall, device switch, DOM repair, and reset do not duplicate listeners or actions.
- Switching to iOS or closing the session removes all Android interaction listeners and transient UI.

Run the existing preview behavior checks before and after implementation:

```sh
npm run typecheck
npm run build
npm test
```

Manual Chrome verification remains required because jsdom does not reproduce pointer capture, Chrome mouse-to-touch conversion, or navigation traversal fully.

## Sources

- Android Developers, "Android system bars": <https://developer.android.com/design/ui/mobile/guides/foundations/system-bars>
- Android Developers, "Ensure compatibility with gesture navigation": <https://developer.android.com/develop/ui/views/touch-and-input/gestures/gesturenav>
- Android Developers, "Display content edge-to-edge in views": <https://developer.android.com/develop/ui/views/layout/edge-to-edge>
- Android Developers, "Add support for the predictive back gesture": <https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture>
- Capacitor, "App Capacitor Plugin API": <https://capacitorjs.com/docs/apis/app>
- Capacitor source, `AppPlugin.java`: <https://github.com/ionic-team/capacitor-plugins/blob/main/app/android/src/main/java/com/capacitorjs/plugins/app/AppPlugin.java>
- Capacitor source, `AppWeb`: <https://github.com/ionic-team/capacitor-plugins/blob/main/app/src/web.ts>
- Capacitor source, plugin runtime registration: <https://github.com/ionic-team/capacitor/blob/main/core/src/runtime.ts>
- Chrome DevTools Protocol, Input domain: <https://chromedevtools.github.io/devtools-protocol/tot/Input/>
- Chrome DevTools Protocol, Page domain: <https://chromedevtools.github.io/devtools-protocol/tot/Page/>
- Chrome Developers, "Modern client-side routing: the Navigation API": <https://developer.chrome.com/docs/web-platform/navigation-api>
- WHATWG HTML, navigation and session history APIs: <https://html.spec.whatwg.org/multipage/nav-history-apis.html>
- W3C, Pointer Events: <https://www.w3.org/TR/pointerevents/>
- WHATWG DOM, event propagation control: <https://dom.spec.whatwg.org/#dom-event-stopimmediatepropagation>
