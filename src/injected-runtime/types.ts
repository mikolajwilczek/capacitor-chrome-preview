import type {
  AndroidSystemBarsProfile,
  PreviewRuntimeState,
} from '../types.js';

export type PreviewRuntime = {
  state: PreviewRuntimeState;
  navigationInputController: NavigationInputController;
  reset: (options?: PreviewRuntimeResetOptions) => void;
};

export type PreviewRuntimeResetOptions = {
  preserveNavigationInputController?: boolean;
};

export type NavigationInputHandlers = {
  pointerdown?: (event: PointerEvent) => void;
  pointermove?: (event: PointerEvent) => void;
  pointerup?: (event: PointerEvent) => void;
  pointercancel?: (event: PointerEvent) => void;
  click?: (event: MouseEvent) => void;
  keydown?: (event: KeyboardEvent) => void;
  keyup?: (event: KeyboardEvent) => void;
};

export type NavigationInputController = {
  setHandlers: (handlers: NavigationInputHandlers | undefined) => void;
  reset: () => void;
};

export type InlineVariableSnapshot = {
  value: string;
  priority: string;
};

export type AndroidNavigationAction = 'back' | 'home' | 'recents';
export type AndroidBackSource = 'edge-gesture' | 'navigation-button';
export type EdgeBackSide = 'left' | 'right';

export type ActiveEdgeBackGesture = {
  pointerId: number;
  side: EdgeBackSide;
  startX: number;
  startY: number;
  sensor: HTMLDivElement;
};

export type IonicBackHandler = (processNextHandler: () => void) => Promise<unknown> | void | null;

export type IonicBackHandlerRegistration = {
  priority: number;
  handler: IonicBackHandler;
  id: number;
};

export type GestureBackProfile = {
  edgeWidth: number;
  commitDistance: number;
  directionRatio: number;
};

export type PreviewRuntimeStyleOptions = {
  rootId: string;
  state: PreviewRuntimeState;
  androidSystemBars: AndroidSystemBarsProfile;
  gestureBack: GestureBackProfile;
};

export type PreviewRuntimeUiOptions = {
  rootId: string;
  styleId: string;
  navigationActionAttribute: string;
  edgeBackAttribute: string;
  state: PreviewRuntimeState;
  androidSystemBars: AndroidSystemBarsProfile;
  hardwareOverlayClass: string;
  isIosDevice: boolean;
  styleText: string;
};

export type PreviewRuntimeUi = {
  ensure: (host: HTMLElement) => void;
  isHealthy: () => boolean;
  remove: () => void;
};

export type PreviewRuntimeBackNavigationOptions = {
  rootId: string;
};

export type PreviewRuntimeBackNavigation = {
  requestBack: (source: AndroidBackSource) => void;
  showFeedback: (message: string) => void;
  reset: () => void;
};

export type PreviewRuntimeButtonNavigationOptions = {
  rootId: string;
  navigationActionAttribute: string;
  backNavigation: PreviewRuntimeBackNavigation;
};

export type PreviewRuntimeEdgeNavigationOptions = {
  rootId: string;
  edgeBackAttribute: string;
  state: PreviewRuntimeState;
  gestureBack: GestureBackProfile;
  backNavigation: PreviewRuntimeBackNavigation;
};

export type PreviewRuntimeNavigationBehavior = {
  handlers: NavigationInputHandlers;
  reset: () => void;
};

export type PreviewRuntimeLifecycleOptions = {
  state: PreviewRuntimeState;
  isIosDevice: boolean;
  androidSystemBars: AndroidSystemBarsProfile;
  ui: PreviewRuntimeUi;
};

export type PreviewRuntimeLifecycle = {
  stop: () => void;
  cleanup: () => void;
};

export type PreviewRuntimeStyleFactories = {
  createSharedStyleText: (options: PreviewRuntimeStyleOptions) => string;
  createIosStyleText: (options: PreviewRuntimeStyleOptions) => string;
  createAndroidStyleText: (options: PreviewRuntimeStyleOptions) => string;
};

export type PreviewRuntimeNavigationFactories = {
  createInputController: () => NavigationInputController;
  createBackNavigation: (
    options: PreviewRuntimeBackNavigationOptions,
  ) => PreviewRuntimeBackNavigation;
  createButtonNavigation: (
    options: PreviewRuntimeButtonNavigationOptions,
  ) => PreviewRuntimeNavigationBehavior;
  createEdgeNavigation: (
    options: PreviewRuntimeEdgeNavigationOptions,
  ) => PreviewRuntimeNavigationBehavior;
};

export type PreviewRuntimeFactories = {
  styles: PreviewRuntimeStyleFactories;
  createUi: (options: PreviewRuntimeUiOptions) => PreviewRuntimeUi;
  navigation: PreviewRuntimeNavigationFactories;
  createLifecycle: (options: PreviewRuntimeLifecycleOptions) => PreviewRuntimeLifecycle;
};

declare global {
  interface Window {
    __CAPACITOR_CHROME_PREVIEW__?: PreviewRuntime;
  }
}
