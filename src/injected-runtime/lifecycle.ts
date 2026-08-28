import type {
  InlineVariableSnapshot,
  PreviewRuntimeLifecycle,
  PreviewRuntimeLifecycleOptions,
} from './types.js';

export function createPreviewRuntimeLifecycle(
  options: PreviewRuntimeLifecycleOptions,
): PreviewRuntimeLifecycle {
  const { androidSystemBars, isIosDevice, state, ui } = options;
  const shouldInjectSafeAreaVariables = isIosDevice
    || androidSystemBars.insetsMode === 'system-bars-css';
  const safeAreaVariables: Array<[name: string, value: number]> = shouldInjectSafeAreaVariables
    ? [
      ['--safe-area-inset-top', state.safeArea.top],
      ['--safe-area-inset-right', state.safeArea.right],
      ['--safe-area-inset-bottom', state.safeArea.bottom],
      ['--safe-area-inset-left', state.safeArea.left],
      ['--safe-area-max-inset-top', state.safeArea.topMax],
      ['--safe-area-max-inset-right', state.safeArea.rightMax],
      ['--safe-area-max-inset-bottom', state.safeArea.bottomMax],
      ['--safe-area-max-inset-left', state.safeArea.leftMax],
    ]
    : [];
  const previousInlineVariables = new Map<string, InlineVariableSnapshot>();
  let renderFrame = 0;
  let observer: MutationObserver | undefined;

  function applySafeAreaVariables(host: HTMLElement): void {
    safeAreaVariables.forEach(([name, value]) => {
      if (!previousInlineVariables.has(name)) {
        previousInlineVariables.set(name, {
          value: host.style.getPropertyValue(name),
          priority: host.style.getPropertyPriority(name),
        });
      }

      host.style.setProperty(name, `${value}px`);
    });
  }

  function restoreSafeAreaVariables(): void {
    const host = document.documentElement;

    if (!host) return;

    previousInlineVariables.forEach((previous, name) => {
      if (previous.value) {
        host.style.setProperty(name, previous.value, previous.priority);
      } else {
        host.style.removeProperty(name);
      }
    });

    previousInlineVariables.clear();
  }

  function render(): void {
    const host = document.documentElement;

    if (!host) {
      scheduleRender();
      return;
    }

    applySafeAreaVariables(host);
    ui.ensure(host);
    watchDom(host);
    state.renderCount = (state.renderCount || 0) + 1;
    state.lastRenderAt = Date.now();
  }

  function scheduleRender(): void {
    if (renderFrame) return;

    renderFrame = window.requestAnimationFrame(() => {
      renderFrame = 0;
      render();
    });
  }

  function watchDom(host: HTMLElement): void {
    if (observer) return;

    observer = new MutationObserver(() => {
      if (!ui.isHealthy()) {
        scheduleRender();
      }
    });

    observer.observe(host, {
      childList: true,
      subtree: true,
    });
  }

  const redrawEvents = [
    'resize',
    'orientationchange',
    'pageshow',
    'popstate',
    'hashchange',
    'visibilitychange',
  ];
  const redrawTimer = window.setTimeout(scheduleRender, 1000);

  redrawEvents.forEach((eventName) => window.addEventListener(eventName, scheduleRender, true));
  render();

  return {
    stop() {
      if (renderFrame) {
        window.cancelAnimationFrame(renderFrame);
        renderFrame = 0;
      }

      if (observer) {
        observer.disconnect();
        observer = undefined;
      }

      window.clearTimeout(redrawTimer);
      redrawEvents.forEach((eventName) => {
        window.removeEventListener(eventName, scheduleRender, true);
      });
    },
    cleanup() {
      ui.remove();
      restoreSafeAreaVariables();
    },
  };
}
