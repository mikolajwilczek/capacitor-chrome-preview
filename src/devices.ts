import type { PreviewDevice, StatusBarProfile } from './types.js';

export const DEFAULT_DEVICE_ID = 'iphone-15-pro';

type PreviewDeviceBlueprint = Omit<PreviewDevice, 'statusBar'>;

const DEVICE_BLUEPRINTS = [
  {
    id: 'iphone-15-pro',
    name: 'iPhone 15 Pro',
    platform: 'ios',
    width: 393,
    height: 852,
    deviceScaleFactor: 3,
    safeArea: {
      top: 59,
      right: 0,
      bottom: 34,
      left: 0,
      topMax: 59,
      rightMax: 0,
      bottomMax: 34,
      leftMax: 0,
    },
    hardwareOverlay: {
      type: 'dynamic-island',
      top: 11,
      width: 126,
      height: 37,
    },
    debug: {
      safeAreaGuides: false,
    },
  },
  {
    id: 'iphone-13',
    name: 'iPhone 13',
    platform: 'ios',
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    safeArea: {
      top: 47,
      right: 0,
      bottom: 34,
      left: 0,
      topMax: 47,
      rightMax: 0,
      bottomMax: 34,
      leftMax: 0,
    },
    hardwareOverlay: {
      type: 'notch',
      top: 0,
      width: 154,
      height: 32,
      borderRadius: 18,
    },
    debug: {
      safeAreaGuides: false,
    },
  },
  {
    id: 'galaxy-a54',
    name: 'Samsung Galaxy A54',
    platform: 'android',
    width: 384,
    height: 832,
    deviceScaleFactor: 2.8125,
    safeArea: {
      top: 33,
      right: 0,
      bottom: 14,
      left: 0,
      topMax: 33,
      rightMax: 0,
      bottomMax: 14,
      leftMax: 0,
    },
    hardwareOverlay: {
      type: 'hole-punch',
      top: 8,
      diameter: 21,
    },
    systemBars: {
      statusBarHeight: 34,
      navigationBarHeight: 15,
      navigationMode: 'gesture',
      gestureBack: {
        edgeWidth: 24,
        commitDistance: 48,
        directionRatio: 1.25,
      },
      insetsMode: 'system-bars-css',
      webViewSafeAreaSource: 'capacitor-css-fallback',
    },
    debug: {
      safeAreaGuides: false,
    },
  },
  {
    id: 'galaxy-a54-3-button',
    name: 'Samsung Galaxy A54 (3-button nav)',
    platform: 'android',
    width: 384,
    height: 832,
    deviceScaleFactor: 2.8125,
    safeArea: {
      top: 33,
      right: 0,
      bottom: 48,
      left: 0,
      topMax: 33,
      rightMax: 0,
      bottomMax: 48,
      leftMax: 0,
    },
    hardwareOverlay: {
      type: 'hole-punch',
      top: 8,
      diameter: 21,
    },
    systemBars: {
      statusBarHeight: 34,
      navigationBarHeight: 48,
      navigationMode: 'three-button',
      insetsMode: 'system-bars-css',
      webViewSafeAreaSource: 'capacitor-css-fallback',
    },
    debug: {
      safeAreaGuides: false,
    },
  },
] satisfies readonly PreviewDeviceBlueprint[];

export function createPreviewDevices(statusBarForeground: StatusBarProfile['foreground']): PreviewDevice[] {
  return DEVICE_BLUEPRINTS.map((device) => ({
    ...device,
    safeArea: { ...device.safeArea },
    hardwareOverlay: { ...device.hardwareOverlay },
    systemBars: device.systemBars
      ? {
        ...device.systemBars,
        gestureBack: device.systemBars.gestureBack
          ? { ...device.systemBars.gestureBack }
          : undefined,
      }
      : undefined,
    statusBar: {
      foreground: statusBarForeground,
    },
    debug: { ...device.debug },
  }));
}

export function findPreviewDevice(devices: readonly PreviewDevice[], deviceId: string): PreviewDevice | undefined {
  return devices.find((device) => device.id === deviceId);
}
