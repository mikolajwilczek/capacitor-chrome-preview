import type {
  AndroidNavigationAction,
  EdgeBackSide,
  PreviewRuntimeUi,
  PreviewRuntimeUiOptions,
} from './types.js';

export function createPreviewRuntimeUi(options: PreviewRuntimeUiOptions): PreviewRuntimeUi {
  const {
    androidSystemBars,
    edgeBackAttribute,
    hardwareOverlayClass,
    isIosDevice,
    navigationActionAttribute,
    rootId,
    state,
    styleId,
    styleText,
  } = options;

  function createDiv(className: string): HTMLDivElement {
    const element = document.createElement('div');
    element.className = className;
    return element;
  }

  function createNavigationButton(
    action: AndroidNavigationAction,
    label: string,
    iconClassName: string,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = `ccp-android-nav-button ccp-android-nav-${action}`;
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.setAttribute(navigationActionAttribute, action);
    button.appendChild(createDiv(iconClassName));
    return button;
  }

  function createStatusBar(): HTMLDivElement {
    const statusBar = createDiv('ccp-status-bar-art');
    const time = createDiv('ccp-ios-status-time');
    const indicators = createDiv('ccp-ios-status-indicators');
    const cellular = createDiv('ccp-ios-cellular');

    time.textContent = '12:34';
    statusBar.setAttribute('aria-hidden', 'true');

    for (let index = 0; index < 4; index += 1) {
      cellular.appendChild(createDiv('ccp-ios-cellular-bar'));
    }

    indicators.append(
      cellular,
      createDiv('ccp-ios-wifi'),
      createDiv('ccp-ios-battery'),
    );
    statusBar.append(time, indicators);

    return statusBar;
  }

  function createAndroidNavigationBar(): HTMLDivElement {
    const navigationBar = createDiv(
      androidSystemBars.navigationMode === 'three-button'
        ? 'ccp-android-navigation-bar ccp-android-navigation-three-button'
        : 'ccp-android-navigation-bar ccp-android-navigation-gesture',
    );

    if (androidSystemBars.navigationMode === 'three-button') {
      navigationBar.setAttribute('role', 'group');
      navigationBar.setAttribute('aria-label', 'Android system navigation');
      navigationBar.append(
        createNavigationButton('back', 'Back', 'ccp-android-back-icon'),
        createNavigationButton('home', 'Home', 'ccp-android-home-icon'),
        createNavigationButton('recents', 'Recent apps', 'ccp-android-recents-icon'),
      );

      return navigationBar;
    }

    navigationBar.appendChild(createDiv('ccp-android-gesture-handle'));

    return navigationBar;
  }

  function createEdgeBackSensor(side: EdgeBackSide): HTMLDivElement {
    const sensor = createDiv(`ccp-android-edge-back-sensor ccp-android-edge-back-${side}`);
    sensor.setAttribute(edgeBackAttribute, side);
    sensor.setAttribute('aria-hidden', 'true');
    sensor.appendChild(createDiv('ccp-android-edge-back-indicator'));
    return sensor;
  }

  function createRootChildren(): Node[] {
    const sharedChildren: Node[] = [
      createDiv('ccp-safe-area-top'),
      createDiv('ccp-safe-area-bottom'),
      createDiv('ccp-safe-area-left'),
      createDiv('ccp-safe-area-right'),
    ];

    if (!isIosDevice) {
      const androidChildren: Node[] = [
        ...sharedChildren,
        createDiv('ccp-android-status-bar'),
        createDiv(hardwareOverlayClass),
        createAndroidNavigationBar(),
      ];

      const feedback = createDiv('ccp-android-nav-feedback');

      if (androidSystemBars.navigationMode === 'three-button') {
        feedback.setAttribute('role', 'status');
        feedback.setAttribute('aria-live', 'polite');
      } else {
        androidChildren.push(
          createEdgeBackSensor('left'),
          createEdgeBackSensor('right'),
        );
      }

      androidChildren.push(feedback);

      return androidChildren;
    }

    return [
      ...sharedChildren,
      createStatusBar(),
      createDiv(hardwareOverlayClass),
      createDiv('ccp-home-indicator'),
    ];
  }

  function isRootHealthy(root: HTMLElement): boolean {
    const hasBaseNodes = Boolean(
      root.querySelector('.ccp-safe-area-top')
      && root.querySelector('.ccp-safe-area-bottom')
      && root.querySelector('.ccp-safe-area-left')
      && root.querySelector('.ccp-safe-area-right')
      && root.querySelector('.ccp-hardware-overlay')
    );

    if (!hasBaseNodes) return false;

    if (!isIosDevice) {
      const hasAndroidBaseNodes = Boolean(
        root.querySelector('.ccp-android-status-bar')
        && root.querySelector('.ccp-android-navigation-bar')
        && root.querySelector('.ccp-android-nav-feedback')
      );

      if (!hasAndroidBaseNodes) return false;

      if (androidSystemBars.navigationMode === 'three-button') {
        return Boolean(
          root.querySelector('.ccp-android-navigation-three-button')
          && root.querySelector('.ccp-android-nav-back')
          && root.querySelector('.ccp-android-nav-home')
          && root.querySelector('.ccp-android-nav-recents')
          && root.querySelector('.ccp-android-back-icon')
          && root.querySelector('.ccp-android-home-icon')
          && root.querySelector('.ccp-android-recents-icon')
          && root.querySelector('.ccp-android-nav-feedback')
        );
      }

      return Boolean(
        root.querySelector('.ccp-android-gesture-handle')
        && root.querySelector(`[${edgeBackAttribute}="left"] .ccp-android-edge-back-indicator`)
        && root.querySelector(`[${edgeBackAttribute}="right"] .ccp-android-edge-back-indicator`)
      );
    }

    return Boolean(
      root.querySelector('.ccp-status-bar-art')
      && root.querySelector('.ccp-home-indicator')
    );
  }

  function ensureStyle(host: HTMLElement): void {
    let style = document.getElementById(styleId);

    if (!(style instanceof HTMLStyleElement)) {
      style = document.createElement('style');
      style.id = styleId;
      host.appendChild(style);
    }

    if (style.textContent !== styleText) {
      style.textContent = styleText;
    }
  }

  function ensureRoot(host: HTMLElement): void {
    let root = document.getElementById(rootId);

    if (!(root instanceof HTMLDivElement)) {
      root = document.createElement('div');
      root.id = rootId;
    }

    if (!isIosDevice && androidSystemBars.navigationMode === 'three-button') {
      root.removeAttribute('aria-hidden');
    } else {
      root.setAttribute('aria-hidden', 'true');
    }

    root.dataset.capacitorPreviewPlatform = state.platform;

    if (state.systemBars) {
      root.dataset.capacitorInsetsMode = androidSystemBars.insetsMode;
      root.dataset.capacitorSafeAreaSource = androidSystemBars.webViewSafeAreaSource || '';
    } else {
      delete root.dataset.capacitorInsetsMode;
      delete root.dataset.capacitorSafeAreaSource;
    }

    if (root.parentElement !== host) {
      host.appendChild(root);
    }

    if (!isRootHealthy(root)) {
      root.replaceChildren(...createRootChildren());
    }
  }

  return {
    ensure(host) {
      ensureStyle(host);
      ensureRoot(host);
    },
    isHealthy() {
      const root = document.getElementById(rootId);
      const style = document.getElementById(styleId);

      return root instanceof HTMLDivElement
        && style instanceof HTMLStyleElement
        && isRootHealthy(root);
    },
    remove() {
      document.getElementById(rootId)?.remove();
      document.getElementById(styleId)?.remove();
    },
  };
}
