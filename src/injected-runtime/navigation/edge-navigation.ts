import type {
  ActiveEdgeBackGesture,
  EdgeBackSide,
  PreviewRuntimeEdgeNavigationOptions,
  PreviewRuntimeNavigationBehavior,
} from '../types.js';

export function createPreviewRuntimeEdgeNavigation(
  options: PreviewRuntimeEdgeNavigationOptions,
): PreviewRuntimeNavigationBehavior {
  const { backNavigation, edgeBackAttribute, gestureBack, rootId, state } = options;
  let activeEdgeBackGesture: ActiveEdgeBackGesture | undefined;
  const blockedEdgePointerIds = new Set<number>();

  function consumeNavigationEvent(event: Event): void {
    if (event.cancelable) {
      event.preventDefault();
    }

    event.stopImmediatePropagation();
  }

  function findEdgeBackSensor(event: Event): HTMLDivElement | undefined {
    const target = event.target;

    if (!(target instanceof window.Element)) return undefined;

    const sensor = target.closest(`[${edgeBackAttribute}]`);
    const root = document.getElementById(rootId);

    if (!(sensor instanceof window.HTMLDivElement) || !root?.contains(sensor)) {
      return undefined;
    }

    return sensor;
  }

  function getEdgeBackSide(sensor: HTMLDivElement): EdgeBackSide | undefined {
    const side = sensor.getAttribute(edgeBackAttribute);
    return side === 'left' || side === 'right' ? side : undefined;
  }

  function getEdgeBackDistances(event: PointerEvent, gesture: ActiveEdgeBackGesture): {
    inward: number;
    vertical: number;
  } {
    return {
      inward: gesture.side === 'left'
        ? event.clientX - gesture.startX
        : gesture.startX - event.clientX,
      vertical: Math.abs(event.clientY - gesture.startY),
    };
  }

  function updateEdgeBackIndicator(event: PointerEvent, gesture: ActiveEdgeBackGesture): void {
    const indicator = gesture.sensor.querySelector('.ccp-android-edge-back-indicator');

    if (!(indicator instanceof window.HTMLElement)) return;

    const { inward } = getEdgeBackDistances(event, gesture);
    const progress = Math.max(0, Math.min(1, inward / gestureBack.commitDistance));
    const indicatorTop = Math.max(16, Math.min(state.height - 16, event.clientY));

    indicator.style.top = `${indicatorTop}px`;
    indicator.style.setProperty('--ccp-edge-opacity', `${0.35 + progress * 0.65}`);
    indicator.style.setProperty('--ccp-edge-scale', `${0.72 + progress * 0.28}`);
    indicator.classList.add('ccp-visible');
  }

  function clearActiveEdgeBackGesture(): void {
    const gesture = activeEdgeBackGesture;

    if (!gesture) return;

    try {
      if (gesture.sensor.hasPointerCapture?.(gesture.pointerId)) {
        gesture.sensor.releasePointerCapture(gesture.pointerId);
      }
    } catch {
      // Pointer capture can already be released by the browser or DOM repair.
    }

    const indicator = gesture.sensor.querySelector('.ccp-android-edge-back-indicator');

    if (indicator instanceof window.HTMLElement) {
      indicator.classList.remove('ccp-visible');
      indicator.style.removeProperty('--ccp-edge-opacity');
      indicator.style.removeProperty('--ccp-edge-scale');
    }

    activeEdgeBackGesture = undefined;
  }

  function handlePointerDown(event: PointerEvent): void {
    if (activeEdgeBackGesture && event.pointerId !== activeEdgeBackGesture.pointerId) {
      blockedEdgePointerIds.add(event.pointerId);
      consumeNavigationEvent(event);
      clearActiveEdgeBackGesture();
      return;
    }

    const sensor = findEdgeBackSensor(event);
    const side = sensor ? getEdgeBackSide(sensor) : undefined;

    if (!sensor || !side) return;

    blockedEdgePointerIds.add(event.pointerId);
    consumeNavigationEvent(event);

    if (event.button !== 0 || event.isPrimary === false) return;

    activeEdgeBackGesture = {
      pointerId: event.pointerId,
      side,
      startX: event.clientX,
      startY: event.clientY,
      sensor,
    };
    updateEdgeBackIndicator(event, activeEdgeBackGesture);

    try {
      sensor.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic events and DOM test environments may not support capture.
    }
  }

  function handlePointerMove(event: PointerEvent): void {
    const gesture = activeEdgeBackGesture;
    const isBlocked = blockedEdgePointerIds.has(event.pointerId);

    if (!isBlocked && !findEdgeBackSensor(event)) return;

    consumeNavigationEvent(event);

    if (gesture?.pointerId === event.pointerId) {
      updateEdgeBackIndicator(event, gesture);
    }
  }

  function handlePointerEnd(event: PointerEvent): void {
    const gesture = activeEdgeBackGesture;
    const isActivePointer = gesture?.pointerId === event.pointerId;
    const isBlocked = blockedEdgePointerIds.has(event.pointerId);

    if (!isBlocked && !isActivePointer && !findEdgeBackSensor(event)) return;

    consumeNavigationEvent(event);
    blockedEdgePointerIds.delete(event.pointerId);

    if (!gesture || !isActivePointer) return;

    const { inward, vertical } = getEdgeBackDistances(event, gesture);
    const shouldCommit = event.type === 'pointerup'
      && inward >= gestureBack.commitDistance
      && inward >= vertical * gestureBack.directionRatio;

    clearActiveEdgeBackGesture();

    if (shouldCommit) {
      backNavigation.requestBack('edge-gesture');
    }
  }

  function handleClick(event: MouseEvent): void {
    if (findEdgeBackSensor(event)) {
      consumeNavigationEvent(event);
    }
  }

  return {
    handlers: {
      pointerdown: handlePointerDown,
      pointermove: handlePointerMove,
      pointerup: handlePointerEnd,
      pointercancel: handlePointerEnd,
      click: handleClick,
    },
    reset() {
      clearActiveEdgeBackGesture();
      blockedEdgePointerIds.clear();
    },
  };
}
