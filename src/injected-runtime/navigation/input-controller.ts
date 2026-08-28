import type {
  NavigationInputController,
  NavigationInputHandlers,
} from '../types.js';

export function createNavigationInputController(): NavigationInputController {
  let handlers: NavigationInputHandlers | undefined;
  const handlePointerDown = (event: PointerEvent) => handlers?.pointerdown?.(event);
  const handlePointerMove = (event: PointerEvent) => handlers?.pointermove?.(event);
  const handlePointerUp = (event: PointerEvent) => handlers?.pointerup?.(event);
  const handlePointerCancel = (event: PointerEvent) => handlers?.pointercancel?.(event);
  const handleClick = (event: MouseEvent) => handlers?.click?.(event);
  const handleKeyDown = (event: KeyboardEvent) => handlers?.keydown?.(event);
  const handleKeyUp = (event: KeyboardEvent) => handlers?.keyup?.(event);

  window.addEventListener('pointerdown', handlePointerDown, true);
  window.addEventListener('pointermove', handlePointerMove, true);
  window.addEventListener('pointerup', handlePointerUp, true);
  window.addEventListener('pointercancel', handlePointerCancel, true);
  window.addEventListener('click', handleClick, true);
  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('keyup', handleKeyUp, true);

  return {
    setHandlers(nextHandlers) {
      handlers = nextHandlers;
    },
    reset() {
      handlers = undefined;
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('pointerup', handlePointerUp, true);
      window.removeEventListener('pointercancel', handlePointerCancel, true);
      window.removeEventListener('click', handleClick, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    },
  };
}
