import { createPreviewRuntimeLifecycle } from './injected-runtime/lifecycle.js';
import { createPreviewRuntimeBackNavigation } from './injected-runtime/navigation/back-navigation.js';
import { createPreviewRuntimeButtonNavigation } from './injected-runtime/navigation/button-navigation.js';
import { createPreviewRuntimeEdgeNavigation } from './injected-runtime/navigation/edge-navigation.js';
import { createNavigationInputController } from './injected-runtime/navigation/input-controller.js';
import { createAndroidRuntimeStyleText } from './injected-runtime/styles/android.js';
import { createIosRuntimeStyleText } from './injected-runtime/styles/ios.js';
import { createSharedRuntimeStyleText } from './injected-runtime/styles/shared.js';
import type { PreviewRuntimeFactories } from './injected-runtime/types.js';
import { createPreviewRuntimeUi } from './injected-runtime/ui.js';
import type { AndroidSystemBarsProfile, PreviewDevice, PreviewRuntimeState } from './types.js';

const runtimeFactories: PreviewRuntimeFactories = {
  styles: {
    createSharedStyleText: createSharedRuntimeStyleText,
    createIosStyleText: createIosRuntimeStyleText,
    createAndroidStyleText: createAndroidRuntimeStyleText,
  },
  createUi: createPreviewRuntimeUi,
  navigation: {
    createInputController: createNavigationInputController,
    createBackNavigation: createPreviewRuntimeBackNavigation,
    createButtonNavigation: createPreviewRuntimeButtonNavigation,
    createEdgeNavigation: createPreviewRuntimeEdgeNavigation,
  },
  createLifecycle: createPreviewRuntimeLifecycle,
};

export function resetPreviewRuntime(): void {
  window.__CAPACITOR_CHROME_PREVIEW__?.reset();
}

export function installPreviewRuntime(device: PreviewDevice): void {
  installPreviewRuntimeWithFactories(device, runtimeFactories);
}

export function createInstallPreviewRuntimeSource(device: PreviewDevice): string {
  const serializedDevice = JSON.stringify(device);

  if (typeof serializedDevice !== 'string') {
    throw new Error('Runtime device could not be serialized.');
  }

  const serializedFactories = `{
    styles: {
      createSharedStyleText: (${createSharedRuntimeStyleText.toString()}),
      createIosStyleText: (${createIosRuntimeStyleText.toString()}),
      createAndroidStyleText: (${createAndroidRuntimeStyleText.toString()})
    },
    createUi: (${createPreviewRuntimeUi.toString()}),
    navigation: {
      createInputController: (${createNavigationInputController.toString()}),
      createBackNavigation: (${createPreviewRuntimeBackNavigation.toString()}),
      createButtonNavigation: (${createPreviewRuntimeButtonNavigation.toString()}),
      createEdgeNavigation: (${createPreviewRuntimeEdgeNavigation.toString()})
    },
    createLifecycle: (${createPreviewRuntimeLifecycle.toString()})
  }`;

  return `(${installPreviewRuntimeWithFactories.toString()})(${serializedDevice}, ${serializedFactories});`;
}

function installPreviewRuntimeWithFactories(
  device: PreviewDevice,
  factories: PreviewRuntimeFactories,
): void {
  const state: PreviewRuntimeState = device;
  const rootId = 'capacitor-chrome-preview-root';
  const styleId = 'capacitor-chrome-preview-style';
  const navigationActionAttribute = 'data-ccp-navigation-action';
  const edgeBackAttribute = 'data-ccp-edge-back';
  const previousRuntime = window.__CAPACITOR_CHROME_PREVIEW__;
  const isIosDevice = state.platform === 'ios';
  const androidSystemBars: AndroidSystemBarsProfile = state.systemBars || {
    statusBarHeight: 0,
    navigationBarHeight: 0,
    navigationMode: 'gesture',
    insetsMode: 'system-bars-css',
    webViewSafeAreaSource: 'capacitor-css-fallback',
  };
  const gestureBack = androidSystemBars.gestureBack || {
    edgeWidth: 24,
    commitDistance: 48,
    directionRatio: 1.25,
  };
  const hardwareOverlayClass = `ccp-hardware-overlay ccp-hardware-${state.hardwareOverlay.type}`;

  if (previousRuntime?.reset) {
    previousRuntime.reset({ preserveNavigationInputController: true });
  }

  const styleOptions = {
    rootId,
    state,
    androidSystemBars,
    gestureBack,
  };
  const styleText = factories.styles.createSharedStyleText(styleOptions)
    + factories.styles.createIosStyleText(styleOptions)
    + factories.styles.createAndroidStyleText(styleOptions);
  const ui = factories.createUi({
    rootId,
    styleId,
    navigationActionAttribute,
    edgeBackAttribute,
    state,
    androidSystemBars,
    hardwareOverlayClass,
    isIosDevice,
    styleText,
  });
  const navigationInputController = previousRuntime?.navigationInputController
    || factories.navigation.createInputController();
  const backNavigation = isIosDevice
    ? undefined
    : factories.navigation.createBackNavigation({ rootId });
  const navigationBehavior = !backNavigation
    ? undefined
    : androidSystemBars.navigationMode === 'three-button'
    ? factories.navigation.createButtonNavigation({
      rootId,
      navigationActionAttribute,
      backNavigation,
    })
    : factories.navigation.createEdgeNavigation({
      rootId,
      edgeBackAttribute,
      state,
      gestureBack,
      backNavigation,
    });

  navigationInputController.setHandlers(navigationBehavior?.handlers);

  const lifecycle = factories.createLifecycle({
    state,
    isIosDevice,
    androidSystemBars,
    ui,
  });

  window.__CAPACITOR_CHROME_PREVIEW__ = {
    state,
    navigationInputController,
    reset(options = {}) {
      lifecycle.stop();
      navigationInputController.setHandlers(undefined);

      if (!options.preserveNavigationInputController) {
        navigationInputController.reset();
      }

      navigationBehavior?.reset();
      backNavigation?.reset();
      lifecycle.cleanup();
      delete window.__CAPACITOR_CHROME_PREVIEW__;
    },
  };
}
