import type {
  AndroidBackSource,
  IonicBackHandler,
  IonicBackHandlerRegistration,
  PreviewRuntimeBackNavigation,
  PreviewRuntimeBackNavigationOptions,
} from '../types.js';

export function createPreviewRuntimeBackNavigation(
  options: PreviewRuntimeBackNavigationOptions,
): PreviewRuntimeBackNavigation {
  const { rootId } = options;
  let feedbackTimer: number | undefined;
  let ionicBackBusy = false;

  function showFeedback(message: string): void {
    const feedback = document.querySelector(`#${rootId} .ccp-android-nav-feedback`);

    if (!(feedback instanceof window.HTMLElement)) return;

    if (feedbackTimer !== undefined) {
      window.clearTimeout(feedbackTimer);
    }

    feedback.textContent = message;
    feedback.classList.add('ccp-visible');
    feedbackTimer = window.setTimeout(() => {
      feedback.classList.remove('ccp-visible');
      feedbackTimer = undefined;
    }, 1600);
  }

  function dispatchIonicBackButton(): boolean {
    if (ionicBackBusy) return true;

    let registrationId = 0;
    let handlers: IonicBackHandlerRegistration[] = [];
    const ionicBackEvent = new window.CustomEvent('ionBackButton', {
      bubbles: false,
      detail: {
        register(priority: number, handler: IonicBackHandler) {
          if (typeof priority === 'number' && typeof handler === 'function') {
            handlers.push({ priority, handler, id: registrationId++ });
          }
        },
      },
    });

    document.dispatchEvent(ionicBackEvent);

    if (handlers.length === 0) return false;

    const processNextHandler = (): void => {
      if (handlers.length === 0) return;

      let selectedHandler = handlers[0];

      handlers.forEach((handler) => {
        if (handler.priority >= selectedHandler.priority) {
          selectedHandler = handler;
        }
      });

      handlers = handlers.filter((handler) => handler.id !== selectedHandler.id);
      ionicBackBusy = true;

      try {
        const result = selectedHandler.handler(processNextHandler);

        if (result != null) {
          void Promise.resolve(result)
            .catch(() => showFeedback('Ionic Back handler failed'))
            .finally(() => {
              ionicBackBusy = false;
            });
        } else {
          ionicBackBusy = false;
        }
      } catch {
        ionicBackBusy = false;
        showFeedback('Ionic Back handler failed');
      }
    };

    processNextHandler();
    return true;
  }

  function requestBack(source: AndroidBackSource): void {
    const navigationApi = 'navigation' in window ? window.navigation : undefined;
    const canGoBack = Boolean(navigationApi?.canGoBack);
    const backEvent = new window.CustomEvent('capacitor-chrome-preview:back', {
      cancelable: true,
      detail: {
        source,
        canGoBack,
      },
    });

    if (!window.dispatchEvent(backEvent)) {
      showFeedback('Back handled by the app');
      return;
    }

    if (dispatchIonicBackButton()) {
      return;
    }

    if (!canGoBack || !navigationApi) {
      showFeedback('No previous app page');
      return;
    }

    const navigationResult = navigationApi.back();

    void navigationResult?.finished?.catch(() => {
      showFeedback('Back navigation failed');
    });
  }

  return {
    requestBack,
    showFeedback,
    reset() {
      ionicBackBusy = false;

      if (feedbackTimer !== undefined) {
        window.clearTimeout(feedbackTimer);
        feedbackTimer = undefined;
      }
    },
  };
}
