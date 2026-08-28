import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createPreviewDevices } from '../src/devices.js';
import {
  createInstallPreviewRuntimeSource,
  installPreviewRuntime,
  resetPreviewRuntime,
} from '../src/injected-runtime.js';

const [iphone15, iphone13, galaxyA54, galaxyA543Button] = createPreviewDevices('black');

type GlobalSnapshot = {
  window: typeof globalThis.window;
  document: typeof globalThis.document;
  MutationObserver: typeof globalThis.MutationObserver;
  HTMLDivElement: typeof globalThis.HTMLDivElement;
  HTMLStyleElement: typeof globalThis.HTMLStyleElement;
};

const snapshot: GlobalSnapshot = {
  window: globalThis.window,
  document: globalThis.document,
  MutationObserver: globalThis.MutationObserver,
  HTMLDivElement: globalThis.HTMLDivElement,
  HTMLStyleElement: globalThis.HTMLStyleElement,
};

function installDom(markup = '<!doctype html><html><head></head><body></body></html>'): JSDOM {
  const dom = new JSDOM(markup, {
    pretendToBeVisual: true,
    url: 'https://example.test/',
  });

  globalThis.window = dom.window as unknown as typeof globalThis.window;
  globalThis.document = dom.window.document;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.HTMLDivElement = dom.window.HTMLDivElement;
  globalThis.HTMLStyleElement = dom.window.HTMLStyleElement;

  return dom;
}

function installNavigationApi(dom: JSDOM, canGoBack: boolean, onBack: () => void): void {
  Object.defineProperty(dom.window, 'navigation', {
    configurable: true,
    value: {
      canGoBack,
      back() {
        onBack();
        return {
          committed: Promise.resolve(),
          finished: Promise.resolve(),
        };
      },
    },
  });
}

function createPointerEvent(
  dom: JSDOM,
  type: string,
  pointerId = 1,
  options: {
    clientX?: number;
    clientY?: number;
    isPrimary?: boolean;
  } = {},
): PointerEvent {
  const event = new dom.window.MouseEvent(type, {
    bubbles: true,
    button: 0,
    cancelable: true,
    clientX: options.clientX,
    clientY: options.clientY,
  });

  Object.defineProperties(event, {
    isPrimary: { value: options.isPrimary ?? true },
    pointerId: { value: pointerId },
  });

  return event as unknown as PointerEvent;
}

function dispatchEdgeSwipe(
  dom: JSDOM,
  sensor: Element,
  options: {
    pointerId: number;
    startX: number;
    startY?: number;
    endX: number;
    endY?: number;
    endType?: 'pointerup' | 'pointercancel';
  },
): void {
  const startY = options.startY ?? 320;
  const endY = options.endY ?? startY;

  sensor.dispatchEvent(createPointerEvent(dom, 'pointerdown', options.pointerId, {
    clientX: options.startX,
    clientY: startY,
  }));
  sensor.dispatchEvent(createPointerEvent(dom, 'pointermove', options.pointerId, {
    clientX: options.endX,
    clientY: endY,
  }));
  sensor.dispatchEvent(createPointerEvent(dom, options.endType ?? 'pointerup', options.pointerId, {
    clientX: options.endX,
    clientY: endY,
  }));
}

afterEach(() => {
  resetPreviewRuntime();
  globalThis.window = snapshot.window;
  globalThis.document = snapshot.document;
  globalThis.MutationObserver = snapshot.MutationObserver;
  globalThis.HTMLDivElement = snapshot.HTMLDivElement;
  globalThis.HTMLStyleElement = snapshot.HTMLStyleElement;
});

test('installs iOS overlay nodes and safe-area variables', () => {
  installDom();

  installPreviewRuntime(iphone15);

  const root = document.getElementById('capacitor-chrome-preview-root');
  const style = document.getElementById('capacitor-chrome-preview-style');

  assert.ok(root instanceof HTMLDivElement);
  assert.ok(style instanceof HTMLStyleElement);
  assert.equal(root.dataset.capacitorPreviewPlatform, 'ios');
  const statusBar = root.querySelector('.ccp-status-bar-art');

  assert.ok(statusBar instanceof HTMLDivElement);
  assert.equal(statusBar.querySelector('svg'), null);
  assert.equal(statusBar.querySelector('.ccp-ios-status-time')?.textContent, '12:34');
  assert.equal(statusBar.querySelectorAll('.ccp-ios-cellular-bar').length, 4);
  assert.ok(statusBar.querySelector('.ccp-ios-wifi'));
  assert.ok(statusBar.querySelector('.ccp-ios-battery'));
  assert.ok(root.querySelector('.ccp-hardware-dynamic-island'));
  assert.ok(root.querySelector('.ccp-home-indicator'));
  assert.equal(document.documentElement.style.getPropertyValue('--safe-area-inset-top'), '59px');
  assert.equal(document.documentElement.style.getPropertyValue('--safe-area-inset-bottom'), '34px');
  assert.equal(window.__CAPACITOR_CHROME_PREVIEW__?.state.id, iphone15.id);
});

test('serialized runtime source installs without module-scope dependencies', () => {
  installDom();

  const source = createInstallPreviewRuntimeSource(galaxyA543Button);
  const runSerializedRuntime = new Function(source);
  runSerializedRuntime();

  const root = document.getElementById('capacitor-chrome-preview-root');
  const backButton = root?.querySelector('.ccp-android-nav-back');

  assert.ok(root instanceof HTMLDivElement);
  assert.ok(backButton);
  assert.equal(window.__CAPACITOR_CHROME_PREVIEW__?.state.id, galaxyA543Button.id);
  assert.match(
    document.getElementById('capacitor-chrome-preview-style')?.textContent || '',
    /\.ccp-android-navigation-three-button/,
  );
});

test('installs Android gesture Back sensors and progress indicators', () => {
  installDom();

  installPreviewRuntime(galaxyA54);

  const root = document.getElementById('capacitor-chrome-preview-root');
  assert.ok(root instanceof HTMLDivElement);
  assert.ok(root.querySelector('.ccp-android-navigation-gesture'));
  assert.ok(root.querySelector('[data-ccp-edge-back="left"] .ccp-android-edge-back-indicator'));
  assert.ok(root.querySelector('[data-ccp-edge-back="right"] .ccp-android-edge-back-indicator'));
  assert.ok(root.querySelector('.ccp-android-nav-feedback'));
});

test('installs Android system bar and three-button navigation overlays', () => {
  installDom();

  installPreviewRuntime(galaxyA543Button);

  const root = document.getElementById('capacitor-chrome-preview-root');
  const style = document.getElementById('capacitor-chrome-preview-style');
  assert.ok(root instanceof HTMLDivElement);
  assert.ok(style instanceof HTMLStyleElement);
  assert.equal(root.dataset.capacitorPreviewPlatform, 'android');
  assert.equal(root.dataset.capacitorInsetsMode, 'system-bars-css');
  assert.ok(root.querySelector('.ccp-android-status-bar'));
  assert.match(style.textContent, /\.ccp-android-status-bar \{[^}]*background: transparent;/);
  assert.ok(root.querySelector('.ccp-hardware-hole-punch'));
  assert.ok(root.querySelector('.ccp-android-navigation-three-button'));
  assert.match(
    style.textContent,
    /\.ccp-android-navigation-bar\.ccp-android-navigation-three-button \{[^}]*background: #fafafa;/,
  );
  assert.ok(root.querySelector('.ccp-android-nav-back'));
  assert.ok(root.querySelector('.ccp-android-nav-home'));
  assert.ok(root.querySelector('.ccp-android-nav-recents'));
  assert.match(
    style.textContent,
    /\.ccp-android-back-icon \{[^}]*width: 12px;[^}]*background: #000;[^}]*clip-path: polygon\(100% 0, 0 50%, 100% 100%\);/,
  );
  assert.match(style.textContent, /\.ccp-android-home-icon \{[^}]*border: 2px solid #000;/);
  assert.match(style.textContent, /\.ccp-android-recents-icon \{[^}]*border: 2px solid #000;/);
  assert.equal(root.hasAttribute('aria-hidden'), false);
  assert.equal(root.querySelector('.ccp-android-navigation-three-button')?.getAttribute('role'), 'group');
  assert.equal(root.querySelector('.ccp-android-nav-back')?.tagName, 'BUTTON');
  assert.equal(root.querySelector('.ccp-android-nav-back')?.getAttribute('aria-label'), 'Back');
  assert.equal(root.querySelector('.ccp-android-nav-home')?.getAttribute('aria-label'), 'Home');
  assert.equal(root.querySelector('.ccp-android-nav-recents')?.getAttribute('aria-label'), 'Recent apps');
  assert.ok(root.querySelector('.ccp-android-nav-feedback'));
  assert.equal(document.documentElement.style.getPropertyValue('--safe-area-inset-bottom'), '48px');
});

test('three-button Back traverses app history without leaking click events', () => {
  const dom = installDom();
  let backCalls = 0;
  let leakedClicks = 0;
  let backEventDetail: unknown;
  installNavigationApi(dom, true, () => backCalls += 1);

  installPreviewRuntime(galaxyA543Button);

  window.addEventListener('click', () => leakedClicks += 1, true);
  window.addEventListener('capacitor-chrome-preview:back', (event) => {
    backEventDetail = (event as CustomEvent).detail;
  });

  const backButton = document.querySelector('.ccp-android-nav-back');
  assert.ok(backButton);

  const clickWasNotCanceled = backButton.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));

  assert.equal(clickWasNotCanceled, false);
  assert.equal(leakedClicks, 0);
  assert.equal(backCalls, 1);
  assert.deepEqual(backEventDetail, {
    source: 'navigation-button',
    canGoBack: true,
  });
});

test('left and right inward edge swipes request Back without leaking pointer events', () => {
  const dom = installDom();
  let backCalls = 0;
  let leakedPointerEvents = 0;
  const sources: unknown[] = [];
  installNavigationApi(dom, true, () => backCalls += 1);

  installPreviewRuntime(galaxyA54);

  window.addEventListener('pointerdown', () => leakedPointerEvents += 1, true);
  window.addEventListener('pointermove', () => leakedPointerEvents += 1, true);
  window.addEventListener('pointerup', () => leakedPointerEvents += 1, true);
  window.addEventListener('capacitor-chrome-preview:back', (event) => {
    sources.push((event as CustomEvent).detail.source);
  });

  const leftSensor = document.querySelector('[data-ccp-edge-back="left"]');
  const rightSensor = document.querySelector('[data-ccp-edge-back="right"]');
  assert.ok(leftSensor);
  assert.ok(rightSensor);

  dispatchEdgeSwipe(dom, leftSensor, {
    pointerId: 1,
    startX: 0,
    endX: 60,
  });
  dispatchEdgeSwipe(dom, rightSensor, {
    pointerId: 2,
    startX: 359,
    endX: 299,
  });

  leftSensor.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));

  assert.equal(backCalls, 2);
  assert.deepEqual(sources, ['edge-gesture', 'edge-gesture']);
  assert.equal(leakedPointerEvents, 0);
});

test('edge Back indicator reflects drag progress and clears on cancellation', () => {
  const dom = installDom();
  installNavigationApi(dom, true, () => undefined);

  installPreviewRuntime(galaxyA54);

  const leftSensor = document.querySelector('[data-ccp-edge-back="left"]');
  const indicator = leftSensor?.querySelector<HTMLElement>('.ccp-android-edge-back-indicator');
  assert.ok(leftSensor);
  assert.ok(indicator);

  leftSensor.dispatchEvent(createPointerEvent(dom, 'pointerdown', 1, {
    clientX: 0,
    clientY: 300,
  }));
  leftSensor.dispatchEvent(createPointerEvent(dom, 'pointermove', 1, {
    clientX: 24,
    clientY: 300,
  }));

  assert.equal(indicator.classList.contains('ccp-visible'), true);
  assert.equal(indicator.style.getPropertyValue('--ccp-edge-opacity'), '0.675');
  assert.equal(indicator.style.getPropertyValue('--ccp-edge-scale'), '0.86');

  leftSensor.dispatchEvent(createPointerEvent(dom, 'pointercancel', 1, {
    clientX: 24,
    clientY: 300,
  }));

  assert.equal(indicator.classList.contains('ccp-visible'), false);
  assert.equal(indicator.style.getPropertyValue('--ccp-edge-opacity'), '');
  assert.equal(indicator.style.getPropertyValue('--ccp-edge-scale'), '');
});

test('edge-swipe Back dismisses an Ionic-style modal without traversing history', () => {
  const dom = installDom();
  let backCalls = 0;
  let modalDismissals = 0;
  installNavigationApi(dom, true, () => backCalls += 1);

  installPreviewRuntime(galaxyA54);

  document.addEventListener('ionBackButton', (event) => {
    const detail = (event as CustomEvent<{
      register(priority: number, handler: () => void): void;
    }>).detail;
    detail.register(100, () => modalDismissals += 1);
  });

  const leftSensor = document.querySelector('[data-ccp-edge-back="left"]');
  assert.ok(leftSensor);
  dispatchEdgeSwipe(dom, leftSensor, {
    pointerId: 1,
    startX: 0,
    endX: 60,
  });

  assert.equal(modalDismissals, 1);
  assert.equal(backCalls, 0);
});

test('short, outward, vertical, and canceled edge gestures do not request Back', () => {
  const dom = installDom();
  let backCalls = 0;
  installNavigationApi(dom, true, () => backCalls += 1);

  installPreviewRuntime(galaxyA54);

  const leftSensor = document.querySelector('[data-ccp-edge-back="left"]');
  const rightSensor = document.querySelector('[data-ccp-edge-back="right"]');
  assert.ok(leftSensor);
  assert.ok(rightSensor);

  dispatchEdgeSwipe(dom, leftSensor, {
    pointerId: 1,
    startX: 0,
    endX: 30,
  });
  dispatchEdgeSwipe(dom, rightSensor, {
    pointerId: 2,
    startX: 359,
    endX: 400,
  });
  dispatchEdgeSwipe(dom, leftSensor, {
    pointerId: 3,
    startX: 0,
    startY: 300,
    endX: 60,
    endY: 370,
  });
  dispatchEdgeSwipe(dom, leftSensor, {
    pointerId: 4,
    startX: 0,
    endX: 60,
    endType: 'pointercancel',
  });

  assert.equal(backCalls, 0);
});

test('a second pointer cancels an active edge Back gesture', () => {
  const dom = installDom();
  let backCalls = 0;
  installNavigationApi(dom, true, () => backCalls += 1);

  installPreviewRuntime(galaxyA54);

  const leftSensor = document.querySelector('[data-ccp-edge-back="left"]');
  assert.ok(leftSensor);

  leftSensor.dispatchEvent(createPointerEvent(dom, 'pointerdown', 1, {
    clientX: 0,
    clientY: 300,
  }));
  document.body.dispatchEvent(createPointerEvent(dom, 'pointerdown', 2, {
    clientX: 100,
    clientY: 300,
    isPrimary: false,
  }));
  leftSensor.dispatchEvent(createPointerEvent(dom, 'pointerup', 1, {
    clientX: 60,
    clientY: 300,
  }));
  document.body.dispatchEvent(createPointerEvent(dom, 'pointerup', 2, {
    clientX: 100,
    clientY: 300,
    isPrimary: false,
  }));

  assert.equal(backCalls, 0);
});

test('switching away from Android gesture mode cancels an active edge gesture', () => {
  const dom = installDom();
  let backCalls = 0;
  installNavigationApi(dom, true, () => backCalls += 1);

  installPreviewRuntime(galaxyA54);

  const leftSensor = document.querySelector('[data-ccp-edge-back="left"]');
  assert.ok(leftSensor);
  leftSensor.dispatchEvent(createPointerEvent(dom, 'pointerdown', 1, {
    clientX: 0,
    clientY: 300,
  }));

  installPreviewRuntime(iphone15);
  document.body.dispatchEvent(createPointerEvent(dom, 'pointerup', 1, {
    clientX: 60,
    clientY: 300,
  }));

  assert.equal(document.querySelector('[data-ccp-edge-back]'), null);
  assert.equal(backCalls, 0);
});

test('three-button Back dismisses an Ionic-style modal without traversing history', () => {
  const dom = installDom();
  let backCalls = 0;
  let modalDismissals = 0;
  let navigationHandlerCalls = 0;
  installNavigationApi(dom, true, () => backCalls += 1);

  installPreviewRuntime(galaxyA543Button);

  document.addEventListener('ionBackButton', (event) => {
    const detail = (event as CustomEvent<{
      register(priority: number, handler: (processNextHandler: () => void) => void): void;
    }>).detail;

    detail.register(0, () => navigationHandlerCalls += 1);
    detail.register(100, () => modalDismissals += 1);
  });

  const backButton = document.querySelector<HTMLElement>('.ccp-android-nav-back');
  assert.ok(backButton);
  backButton.click();

  assert.equal(modalDismissals, 1);
  assert.equal(navigationHandlerCalls, 0);
  assert.equal(backCalls, 0);
});

test('Ionic Back handlers can explicitly continue down the priority queue', () => {
  const dom = installDom();
  let backCalls = 0;
  const calls: string[] = [];
  installNavigationApi(dom, true, () => backCalls += 1);

  installPreviewRuntime(galaxyA543Button);

  document.addEventListener('ionBackButton', (event) => {
    const detail = (event as CustomEvent<{
      register(priority: number, handler: (processNextHandler: () => void) => void): void;
    }>).detail;

    detail.register(0, () => calls.push('navigation'));
    detail.register(100, (processNextHandler) => {
      calls.push('overlay');
      processNextHandler();
    });
  });

  const backButton = document.querySelector<HTMLElement>('.ccp-android-nav-back');
  assert.ok(backButton);
  backButton.click();

  assert.deepEqual(calls, ['overlay', 'navigation']);
  assert.equal(backCalls, 0);
});

test('pointer activation invokes a navigation button once and consumes the pointer sequence', () => {
  const dom = installDom();
  let backCalls = 0;
  let leakedPointerEvents = 0;
  installNavigationApi(dom, true, () => backCalls += 1);

  installPreviewRuntime(galaxyA543Button);

  window.addEventListener('pointerdown', () => leakedPointerEvents += 1, true);
  window.addEventListener('pointerup', () => leakedPointerEvents += 1, true);
  const backButton = document.querySelector('.ccp-android-nav-back');
  assert.ok(backButton);

  backButton.dispatchEvent(createPointerEvent(dom, 'pointerdown'));
  backButton.dispatchEvent(createPointerEvent(dom, 'pointerup'));
  backButton.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));

  assert.equal(leakedPointerEvents, 0);
  assert.equal(backCalls, 1);
});

test('keyboard activation invokes Back once without leaking activation keys', () => {
  const dom = installDom();
  let backCalls = 0;
  let leakedKeys = 0;
  installNavigationApi(dom, true, () => backCalls += 1);

  installPreviewRuntime(galaxyA543Button);

  window.addEventListener('keydown', () => leakedKeys += 1, true);
  window.addEventListener('keyup', () => leakedKeys += 1, true);
  const backButton = document.querySelector('.ccp-android-nav-back');
  assert.ok(backButton);

  backButton.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'Enter',
  }));
  backButton.dispatchEvent(new dom.window.KeyboardEvent('keyup', {
    bubbles: true,
    cancelable: true,
    key: 'Enter',
  }));

  assert.equal(leakedKeys, 0);
  assert.equal(backCalls, 1);
});

test('Home and Recents clicks show feedback without navigation or event leakage', () => {
  const dom = installDom();
  let backCalls = 0;
  let leakedClicks = 0;
  installNavigationApi(dom, true, () => backCalls += 1);

  installPreviewRuntime(galaxyA543Button);

  window.addEventListener('click', () => leakedClicks += 1, true);
  const homeButton = document.querySelector<HTMLElement>('.ccp-android-nav-home');
  const recentsButton = document.querySelector<HTMLElement>('.ccp-android-nav-recents');
  const feedback = document.querySelector('.ccp-android-nav-feedback');
  assert.ok(homeButton);
  assert.ok(recentsButton);
  assert.ok(feedback);

  homeButton.click();
  assert.equal(feedback.textContent, 'Home is not simulated in Chrome');
  assert.equal(feedback.classList.contains('ccp-visible'), true);

  recentsButton.click();
  assert.equal(feedback.textContent, 'Recent apps are not simulated in Chrome');
  assert.equal(leakedClicks, 0);
  assert.equal(backCalls, 0);
});

test('Back stays at app history root and can be handled by a preview event listener', () => {
  const dom = installDom();
  let backCalls = 0;
  installNavigationApi(dom, false, () => backCalls += 1);

  installPreviewRuntime(galaxyA543Button);

  const backButton = document.querySelector<HTMLElement>('.ccp-android-nav-back');
  const feedback = document.querySelector('.ccp-android-nav-feedback');
  assert.ok(backButton);
  assert.ok(feedback);

  backButton.click();
  assert.equal(feedback.textContent, 'No previous app page');
  assert.equal(backCalls, 0);

  window.addEventListener('capacitor-chrome-preview:back', (event) => event.preventDefault(), { once: true });
  backButton.click();
  assert.equal(feedback.textContent, 'Back handled by the app');
  assert.equal(backCalls, 0);
});

test('runtime reinjection preserves early navigation event isolation', () => {
  const dom = installDom();
  let backCalls = 0;
  let leakedClicks = 0;
  installNavigationApi(dom, true, () => backCalls += 1);

  installPreviewRuntime(iphone15);
  window.addEventListener('click', () => leakedClicks += 1, true);
  installPreviewRuntime(galaxyA543Button);
  installPreviewRuntime(galaxyA543Button);

  const backButton = document.querySelector<HTMLElement>('.ccp-android-nav-back');
  assert.ok(backButton);
  backButton.click();

  assert.equal(leakedClicks, 0);
  assert.equal(backCalls, 1);
});

test('reinstall resets the prior runtime and keeps one active overlay', () => {
  installDom();

  installPreviewRuntime(iphone15);
  installPreviewRuntime(iphone13);

  assert.equal(document.querySelectorAll('#capacitor-chrome-preview-root').length, 1);
  assert.equal(document.querySelectorAll('#capacitor-chrome-preview-style').length, 1);
  assert.equal(window.__CAPACITOR_CHROME_PREVIEW__?.state.id, iphone13.id);
  assert.ok(document.querySelector('.ccp-hardware-notch'));
  assert.equal(document.documentElement.style.getPropertyValue('--safe-area-inset-top'), '47px');
});

test('reset removes overlay DOM and restores previous inline safe-area variables', () => {
  installDom('<!doctype html><html style="--safe-area-inset-top: 7px !important;"><head></head><body></body></html>');

  installPreviewRuntime(iphone15);
  assert.equal(document.documentElement.style.getPropertyValue('--safe-area-inset-top'), '59px');
  assert.equal(document.documentElement.style.getPropertyValue('--safe-area-inset-bottom'), '34px');

  resetPreviewRuntime();

  assert.equal(document.getElementById('capacitor-chrome-preview-root'), null);
  assert.equal(document.getElementById('capacitor-chrome-preview-style'), null);
  assert.equal(document.documentElement.style.getPropertyValue('--safe-area-inset-top'), '7px');
  assert.equal(document.documentElement.style.getPropertyPriority('--safe-area-inset-top'), 'important');
  assert.equal(document.documentElement.style.getPropertyValue('--safe-area-inset-bottom'), '');
  assert.equal(window.__CAPACITOR_CHROME_PREVIEW__, undefined);
});
