import type {
  AndroidNavigationAction,
  PreviewRuntimeButtonNavigationOptions,
  PreviewRuntimeNavigationBehavior,
} from '../types.js';

export function createPreviewRuntimeButtonNavigation(
  options: PreviewRuntimeButtonNavigationOptions,
): PreviewRuntimeNavigationBehavior {
  const { backNavigation, navigationActionAttribute, rootId } = options;
  let activePointerId: number | undefined;
  let activePointerAction: AndroidNavigationAction | undefined;
  let activePointerButton: HTMLButtonElement | undefined;
  let activeKeyboardAction: AndroidNavigationAction | undefined;
  let lastPointerActivation: { action: AndroidNavigationAction; at: number } | undefined;

  function findNavigationButton(event: Event): HTMLButtonElement | undefined {
    const target = event.target;

    if (!(target instanceof window.Element)) return undefined;

    const button = target.closest(`[${navigationActionAttribute}]`);
    const root = document.getElementById(rootId);

    if (!button || button.tagName !== 'BUTTON' || !root?.contains(button)) {
      return undefined;
    }

    return button as HTMLButtonElement;
  }

  function getNavigationAction(button: HTMLButtonElement): AndroidNavigationAction | undefined {
    const action = button.getAttribute(navigationActionAttribute);

    if (action === 'back' || action === 'home' || action === 'recents') {
      return action;
    }

    return undefined;
  }

  function consumeNavigationEvent(event: Event): void {
    if (event.cancelable) {
      event.preventDefault();
    }

    event.stopImmediatePropagation();
  }

  function activateNavigationAction(action: AndroidNavigationAction): void {
    if (action === 'back') {
      backNavigation.requestBack('navigation-button');
      return;
    }

    backNavigation.showFeedback(
      action === 'home'
        ? 'Home is not simulated in Chrome'
        : 'Recent apps are not simulated in Chrome',
    );
  }

  function clearActivePointer(): void {
    if (activePointerButton && activePointerId !== undefined) {
      try {
        if (activePointerButton.hasPointerCapture?.(activePointerId)) {
          activePointerButton.releasePointerCapture(activePointerId);
        }
      } catch {
        // Pointer capture can already be released by the browser or DOM repair.
      }
    }

    activePointerButton?.classList.remove('ccp-active');
    activePointerId = undefined;
    activePointerAction = undefined;
    activePointerButton = undefined;
  }

  function handlePointerDown(event: PointerEvent): void {
    const button = findNavigationButton(event);
    const action = button ? getNavigationAction(button) : undefined;

    if (!button || !action) return;

    consumeNavigationEvent(event);

    if (event.button !== 0 || event.isPrimary === false) return;

    clearActivePointer();
    activePointerId = event.pointerId;
    activePointerAction = action;
    activePointerButton = button;
    button.classList.add('ccp-active');

    try {
      button.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic events and DOM test environments may not support capture.
    }
  }

  function handlePointerMove(event: PointerEvent): void {
    if (event.pointerId === activePointerId || findNavigationButton(event)) {
      consumeNavigationEvent(event);
    }
  }

  function handlePointerEnd(event: PointerEvent): void {
    const button = findNavigationButton(event);
    const isActivePointer = event.pointerId === activePointerId;

    if (!button && !isActivePointer) return;

    consumeNavigationEvent(event);

    if (!isActivePointer) return;

    const action = activePointerAction;
    clearActivePointer();

    if (event.type === 'pointerup' && action) {
      lastPointerActivation = { action, at: Date.now() };
      activateNavigationAction(action);
    }
  }

  function handleClick(event: MouseEvent): void {
    const button = findNavigationButton(event);
    const action = button ? getNavigationAction(button) : undefined;

    if (!action) return;

    consumeNavigationEvent(event);

    const pointerActivationWasRecent = lastPointerActivation?.action === action
      && Date.now() - lastPointerActivation.at < 750;

    lastPointerActivation = undefined;

    if (!pointerActivationWasRecent) {
      activateNavigationAction(action);
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    const button = findNavigationButton(event);
    const action = button ? getNavigationAction(button) : undefined;

    if (!button || !action || (event.key !== 'Enter' && event.key !== ' ')) return;

    consumeNavigationEvent(event);

    if (event.repeat) return;

    activeKeyboardAction = action;
    button.classList.add('ccp-active');
  }

  function handleKeyUp(event: KeyboardEvent): void {
    const button = findNavigationButton(event);
    const action = button ? getNavigationAction(button) : undefined;

    if (!button || !action || (event.key !== 'Enter' && event.key !== ' ')) return;

    consumeNavigationEvent(event);
    button.classList.remove('ccp-active');

    if (activeKeyboardAction === action) {
      activeKeyboardAction = undefined;
      activateNavigationAction(action);
    }
  }

  return {
    handlers: {
      pointerdown: handlePointerDown,
      pointermove: handlePointerMove,
      pointerup: handlePointerEnd,
      pointercancel: handlePointerEnd,
      click: handleClick,
      keydown: handleKeyDown,
      keyup: handleKeyUp,
    },
    reset() {
      clearActivePointer();
      activeKeyboardAction = undefined;
      lastPointerActivation = undefined;
    },
  };
}
