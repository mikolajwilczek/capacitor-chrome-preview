import type { PreviewRuntimeStyleOptions } from '../types.js';

export function createSharedRuntimeStyleText(options: PreviewRuntimeStyleOptions): string {
  const { rootId, state } = options;
  const hardwareOverlay = state.hardwareOverlay;
  let hardwareOverlayWidth = 0;
  let hardwareOverlayHeight = 0;
  let hardwareOverlayShape = '';

  if (hardwareOverlay.type === 'dynamic-island') {
    hardwareOverlayWidth = hardwareOverlay.width;
    hardwareOverlayHeight = hardwareOverlay.height;
    hardwareOverlayShape = `
      border-radius: 999px;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 8px 20px rgba(0, 0, 0, 0.3);
    `;
  } else if (hardwareOverlay.type === 'notch') {
    hardwareOverlayWidth = hardwareOverlay.width;
    hardwareOverlayHeight = hardwareOverlay.height;
    hardwareOverlayShape = `
      border-radius: 0 0 ${hardwareOverlay.borderRadius}px ${hardwareOverlay.borderRadius}px;
      box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08), 0 8px 20px rgba(0, 0, 0, 0.22);
    `;
  } else {
    hardwareOverlayWidth = hardwareOverlay.diameter;
    hardwareOverlayHeight = hardwareOverlay.diameter;
    hardwareOverlayShape = `
      border-radius: 999px;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.16), 0 0 0 2px rgba(0, 0, 0, 0.08);
    `;
  }

  const css = String.raw;

  return css`
    #${rootId} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    #${rootId} .ccp-safe-area-top,
    #${rootId} .ccp-safe-area-bottom,
    #${rootId} .ccp-safe-area-left,
    #${rootId} .ccp-safe-area-right {
      position: fixed;
      z-index: 20;
      background: rgba(255, 47, 103, 0.14);
      box-shadow: inset 0 0 0 1px rgba(255, 47, 103, 0.42);
      display: ${state.debug.safeAreaGuides ? "block" : "none"};
    }

    #${rootId} .ccp-safe-area-top {
      top: 0;
      left: 0;
      right: 0;
      height: ${state.safeArea.top}px;
      box-shadow: inset 0 -1px 0 rgba(255, 47, 103, 0.68);
      display: ${state.debug.safeAreaGuides ? "block" : "none"};
    }

    #${rootId} .ccp-safe-area-bottom {
      bottom: 0;
      left: 0;
      right: 0;
      height: ${state.safeArea.bottom}px;
      display: ${state.debug.safeAreaGuides ? "block" : "none"};
    }

    #${rootId} .ccp-safe-area-left {
      top: 0;
      bottom: 0;
      left: 0;
      width: ${state.safeArea.left}px;
      display: ${state.debug.safeAreaGuides ? "block" : "none"};
    }

    #${rootId} .ccp-safe-area-right {
      top: 0;
      right: 0;
      bottom: 0;
      width: ${state.safeArea.right}px;
      display: ${state.debug.safeAreaGuides ? "block" : "none"};
    }

    #${rootId} .ccp-hardware-overlay {
      position: fixed;
      z-index: 30;
      top: ${hardwareOverlay.top}px;
      left: 50%;
      width: ${hardwareOverlayWidth}px;
      height: ${hardwareOverlayHeight}px;
      transform: translateX(-50%);
      background: #050505;
      ${hardwareOverlayShape}
    }

`;
}
