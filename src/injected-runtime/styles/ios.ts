import type { PreviewRuntimeStyleOptions } from '../types.js';

export function createIosRuntimeStyleText(options: PreviewRuntimeStyleOptions): string {
  const { rootId, state } = options;
  const css = String.raw;

  return css`    #${rootId} .ccp-status-bar-art {
      position: fixed;
      z-index: 10;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      height: 44px;
      box-sizing: border-box;
      padding: 0 27px 0 32px;
      color: ${state.statusBar.foreground === "white" ? "#fff" : "#000"};
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 14px;
      font-weight: 650;
      line-height: 1;
      letter-spacing: -0.2px;
    }

    #${rootId} .ccp-ios-status-indicators {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    #${rootId} .ccp-ios-cellular {
      height: 11px;
      display: flex;
      align-items: flex-end;
      gap: 2px;
    }

    #${rootId} .ccp-ios-cellular-bar {
      width: 3px;
      border-radius: 1px;
      background: currentColor;
    }

    #${rootId} .ccp-ios-cellular-bar:nth-child(1) {
      height: 4px;
    }
    #${rootId} .ccp-ios-cellular-bar:nth-child(2) {
      height: 6px;
    }
    #${rootId} .ccp-ios-cellular-bar:nth-child(3) {
      height: 8px;
    }
    #${rootId} .ccp-ios-cellular-bar:nth-child(4) {
      height: 11px;
    }

    #${rootId} .ccp-ios-wifi {
      width: 17px;
      height: 11px;
      background:
        radial-gradient(
          circle at 50% 100%,
          currentColor 0 1.5px,
          transparent 1.7px
        ),
        radial-gradient(
          circle at 50% 100%,
          transparent 0 4px,
          currentColor 4.2px 5.3px,
          transparent 5.5px
        ),
        radial-gradient(
          circle at 50% 100%,
          transparent 0 7.5px,
          currentColor 7.7px 8.8px,
          transparent 9px
        );
    }

    #${rootId} .ccp-ios-battery {
      position: relative;
      width: 22px;
      height: 10px;
      box-sizing: border-box;
      padding: 2px;
      border: 1.5px solid currentColor;
      border-radius: 3px;
      opacity: 0.82;
    }

    #${rootId} .ccp-ios-battery::before {
      content: "";
      display: block;
      width: 75%;
      height: 100%;
      border-radius: 1px;
      background: currentColor;
    }

    #${rootId} .ccp-ios-battery::after {
      content: "";
      position: absolute;
      top: 3px;
      right: -3px;
      width: 2px;
      height: 4px;
      border-radius: 0 1px 1px 0;
      background: currentColor;
    }

    #${rootId} .ccp-home-indicator {
      position: fixed;
      z-index: 30;
      left: 50%;
      bottom: 8px;
      width: 134px;
      height: 5px;
      transform: translateX(-50%);
      border-radius: 999px;
      background: rgba(8, 8, 8, 0.72);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
    }

`;
}
