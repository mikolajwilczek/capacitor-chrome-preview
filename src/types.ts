export type SafeAreaInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  topMax: number;
  rightMax: number;
  bottomMax: number;
  leftMax: number;
};

export type DynamicIslandHardwareOverlay = {
  type: 'dynamic-island';
  top: number;
  width: number;
  height: number;
};

export type NotchHardwareOverlay = {
  type: 'notch';
  top: number;
  width: number;
  height: number;
  borderRadius: number;
};

export type HolePunchHardwareOverlay = {
  type: 'hole-punch';
  top: number;
  diameter: number;
};

export type HardwareOverlay = DynamicIslandHardwareOverlay | NotchHardwareOverlay | HolePunchHardwareOverlay;

export type StatusBarProfile = {
  foreground: 'black' | 'white';
};

export type AndroidSystemBarsProfile = {
  statusBarHeight: number;
  navigationBarHeight: number;
  navigationMode: 'gesture' | 'three-button';
  gestureBack?: {
    edgeWidth: number;
    commitDistance: number;
    directionRatio: number;
  };
  insetsMode: 'system-bars-css' | 'disabled';
  webViewSafeAreaSource?: 'native-env' | 'capacitor-css-fallback';
};

export type PreviewDebugOptions = {
  safeAreaGuides: boolean;
};

export type PreviewDevice = {
  id: string;
  name: string;
  platform: 'ios' | 'android';
  width: number;
  height: number;
  deviceScaleFactor: number;
  safeArea: SafeAreaInsets;
  hardwareOverlay: HardwareOverlay;
  statusBar: StatusBarProfile;
  systemBars?: AndroidSystemBarsProfile;
  debug: PreviewDebugOptions;
};

export type PreviewRuntimeState = PreviewDevice & {
  renderCount?: number;
  lastRenderAt?: number;
};
