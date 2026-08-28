import type { PreviewRuntimeStyleOptions } from '../types.js';

export function createAndroidRuntimeStyleText(options: PreviewRuntimeStyleOptions): string {
  const { androidSystemBars, gestureBack, rootId } = options;
  const css = String.raw;

  return css`    #${rootId} .ccp-android-status-bar {
      position: fixed;
      z-index: 10;
      top: 0;
      left: 0;
      right: 0;
      height: ${androidSystemBars.statusBarHeight}px;
      background: transparent;
    }

    #${rootId} .ccp-android-navigation-bar {
      position: fixed;
      z-index: 10;
      left: 0;
      right: 0;
      bottom: 0;
      height: ${androidSystemBars.navigationBarHeight}px;
    }

    #${rootId} .ccp-android-navigation-bar.ccp-android-navigation-three-button {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      align-items: center;
      background: #fafafa;
      box-shadow: 0 -1px 0 rgba(0, 0, 0, 0.08);
      pointer-events: none;
    }

    #${rootId} .ccp-android-nav-button {
      position: relative;
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      margin: 0;
      padding: 0;
      border: 0;
      appearance: none;
      color: inherit;
      background: transparent;
      cursor: pointer;
      pointer-events: auto;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }

    #${rootId} .ccp-android-nav-button::before {
      content: "";
      position: absolute;
      width: 42px;
      height: 32px;
      border-radius: 999px;
      background: rgba(22, 22, 22, 0.14);
      opacity: 0;
      transform: scale(0.72);
      transition:
        opacity 100ms ease,
        transform 100ms ease;
    }

    #${rootId} .ccp-android-nav-button:hover::before {
      opacity: 0.55;
    }

    #${rootId} .ccp-android-nav-button.ccp-active::before,
    #${rootId} .ccp-android-nav-button:active::before {
      opacity: 1;
      transform: scale(1);
    }

    #${rootId} .ccp-android-nav-button:focus-visible {
      outline: 2px solid #2563eb;
      outline-offset: -4px;
    }

    #${rootId} .ccp-android-nav-feedback {
      position: fixed;
      z-index: 40;
      left: 50%;
      bottom: ${androidSystemBars.navigationBarHeight + 10}px;
      max-width: calc(100% - 32px);
      padding: 7px 11px;
      border-radius: 999px;
      color: #fff;
      background: rgba(17, 24, 39, 0.9);
      box-shadow: 0 5px 16px rgba(0, 0, 0, 0.24);
      font-size: 12px;
      line-height: 16px;
      text-align: center;
      white-space: nowrap;
      opacity: 0;
      transform: translate(-50%, 6px);
      transition:
        opacity 120ms ease,
        transform 120ms ease;
      pointer-events: none;
    }

    #${rootId} .ccp-android-nav-feedback.ccp-visible {
      opacity: 1;
      transform: translate(-50%, 0);
    }

    #${rootId} .ccp-android-back-icon {
      width: 12px;
      height: 16px;
      background: #000;
      clip-path: polygon(100% 0, 0 50%, 100% 100%);
    }

    #${rootId} .ccp-android-home-icon {
      width: 16px;
      height: 16px;
      border-radius: 999px;
      border: 2px solid #000;
    }

    #${rootId} .ccp-android-recents-icon {
      width: 16px;
      height: 16px;
      border: 2px solid #000;
      border-radius: 3px;
    }

    #${rootId} .ccp-android-gesture-handle {
      position: absolute;
      left: 50%;
      bottom: 7px;
      width: 108px;
      height: 4px;
      transform: translateX(-50%);
      border-radius: 999px;
      background: rgba(12, 12, 12, 0.58);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
    }

    #${rootId} .ccp-android-edge-back-sensor {
      position: fixed;
      z-index: 35;
      top: ${androidSystemBars.statusBarHeight}px;
      bottom: ${androidSystemBars.navigationBarHeight}px;
      width: ${gestureBack.edgeWidth}px;
      pointer-events: auto;
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
    }

    #${rootId} .ccp-android-edge-back-left {
      left: 0;
    }

    #${rootId} .ccp-android-edge-back-right {
      right: 0;
    }

    #${rootId} .ccp-android-edge-back-indicator {
      --ccp-edge-opacity: 0.35;
      --ccp-edge-scale: 0.72;
      position: fixed;
      z-index: 36;
      top: 50%;
      width: 32px;
      height: 32px;
      border-radius: 999px;
      background: rgba(17, 24, 39, 0.88);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.24);
      opacity: 0;
      transform: translateY(-50%) scale(var(--ccp-edge-scale));
      transition: opacity 80ms ease;
      pointer-events: none;
    }

    #${rootId} .ccp-android-edge-back-indicator.ccp-visible {
      opacity: var(--ccp-edge-opacity);
    }

    #${rootId} .ccp-android-edge-back-left .ccp-android-edge-back-indicator {
      left: 4px;
    }

    #${rootId} .ccp-android-edge-back-right .ccp-android-edge-back-indicator {
      right: 4px;
    }

    #${rootId} .ccp-android-edge-back-indicator::after {
      content: "";
      position: absolute;
      top: 10px;
      width: 9px;
      height: 9px;
      border-top: 2px solid #fff;
      border-right: 2px solid #fff;
    }

    #${rootId}
      .ccp-android-edge-back-left
      .ccp-android-edge-back-indicator::after {
      left: 9px;
      transform: rotate(45deg);
    }

    #${rootId}
      .ccp-android-edge-back-right
      .ccp-android-edge-back-indicator::after {
      right: 9px;
      transform: rotate(-135deg);
    }
  `;
}
