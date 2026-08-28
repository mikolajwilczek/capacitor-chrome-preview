import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { createPreviewDevices } from '../src/devices.js';
import {
  applyEmulationOverrides,
  assertDebugPortAvailable,
  createChromeLaunchArgs,
  createPreviewProfileDir,
  createPreviewLoadingUrl,
  createRuntimeSource,
  injectRuntime,
  isPreviewLoadingTarget,
  navigateToAppRoot,
  parseDebugPort,
  PreviewSession,
  removePreviewProfileDir,
  resetEmulation,
  trySetPreviewContentsSize,
  validatePreviewProfileDir,
  validatePreviewUrl,
  verifyViewport,
  withTimeout,
  type CdpClient,
  type CdpTarget,
} from '../src/preview-core.js';

type RecordedCall = {
  method: string;
  params?: unknown;
};

type MockClient = {
  client: CdpClient;
  calls: RecordedCall[];
  setLayoutViewport: (width: number, height: number) => void;
  setRuntimeException: (description: string | undefined) => void;
  setDeviceMetricsFailureWidth: (width: number | undefined) => void;
  disconnect: () => void;
};

const [iphone15, iphone13, galaxyA54] = createPreviewDevices('black');
const target = { id: 'target-1', type: 'page', url: 'data:text/html,test' } as CdpTarget;

function createMockClient(options: {
  failSafeArea?: boolean;
  commitNavigation?: boolean;
  navigationError?: string;
  navigationDownload?: boolean;
} = {}): MockClient {
  const calls: RecordedCall[] = [];
  let scriptCounter = 0;
  let clientWidth = iphone15.width;
  let clientHeight = iphone15.height;
  let runtimeException: string | undefined;
  let deviceMetricsFailureWidth: number | undefined;
  let frameNavigatedHandler: ((params: { frame: { id: string; parentId?: string } }) => void) | undefined;
  let disconnectHandler: (() => void) | undefined;

  const record = (method: string, params?: unknown): void => {
    calls.push({ method, params });
  };

  const client = {
    Page: {
      enable: async () => record('Page.enable'),
      frameNavigated: (handler: (params: { frame: { id: string; parentId?: string } }) => void) => {
        record('Page.frameNavigated.listen');
        frameNavigatedHandler = handler;

        return () => {
          record('Page.frameNavigated.removeListener');
          frameNavigatedHandler = undefined;
        };
      },
      navigate: async (params: unknown) => {
        record('Page.navigate', params);
        if (options.commitNavigation !== false) {
          queueMicrotask(() => frameNavigatedHandler?.({ frame: { id: 'app-frame' } }));
        }
        return {
          frameId: 'app-frame',
          loaderId: 'app-loader',
          errorText: options.navigationError,
          isDownload: options.navigationDownload,
        };
      },
      resetNavigationHistory: async () => record('Page.resetNavigationHistory'),
      addScriptToEvaluateOnNewDocument: async (params: unknown) => {
        record('Page.addScriptToEvaluateOnNewDocument', params);
        scriptCounter += 1;
        return { identifier: `script-${scriptCounter}` };
      },
      removeScriptToEvaluateOnNewDocument: async (params: unknown) => {
        record('Page.removeScriptToEvaluateOnNewDocument', params);
      },
      getLayoutMetrics: async () => {
        record('Page.getLayoutMetrics');
        return {
          cssLayoutViewport: {
            clientWidth,
            clientHeight,
          },
        };
      },
    },
    Runtime: {
      enable: async () => record('Runtime.enable'),
      evaluate: async (params: unknown) => {
        record('Runtime.evaluate', params);
        if (runtimeException) {
          return {
            exceptionDetails: {
              text: 'Uncaught',
              exception: { description: runtimeException },
            },
          };
        }
        return {};
      },
    },
    Browser: {
      getWindowForTarget: async (params: unknown) => {
        record('Browser.getWindowForTarget', params);
        return { windowId: 42 };
      },
      setContentsSize: async (params: unknown) => {
        record('Browser.setContentsSize', params);
      },
      close: async () => record('Browser.close'),
    },
    Emulation: {
      setDeviceMetricsOverride: async (params: { width: number; height: number }) => {
        record('Emulation.setDeviceMetricsOverride', params);
        if (params.width === deviceMetricsFailureWidth) {
          throw new Error(`metrics rejected for width ${params.width}`);
        }
        clientWidth = params.width;
        clientHeight = params.height;
      },
      setTouchEmulationEnabled: async (params: unknown) => record('Emulation.setTouchEmulationEnabled', params),
      setEmitTouchEventsForMouse: async (params: unknown) => record('Emulation.setEmitTouchEventsForMouse', params),
      setSafeAreaInsetsOverride: async (params: unknown) => {
        record('Emulation.setSafeAreaInsetsOverride', params);
        if (options.failSafeArea) {
          throw new Error('safe area unsupported');
        }
      },
      clearDeviceMetricsOverride: async () => record('Emulation.clearDeviceMetricsOverride'),
    },
    close: async () => record('client.close'),
    on: (event: string, handler: () => void) => {
      record(`client.on.${event}`);
      if (event === 'disconnect') disconnectHandler = handler;
    },
  } as unknown as CdpClient;

  return {
    client,
    calls,
    setLayoutViewport(width: number, height: number) {
      clientWidth = width;
      clientHeight = height;
    },
    setRuntimeException(description: string | undefined) {
      runtimeException = description;
    },
    setDeviceMetricsFailureWidth(width: number | undefined) {
      deviceMetricsFailureWidth = width;
    },
    disconnect() {
      disconnectHandler?.();
    },
  };
}

function called(calls: readonly RecordedCall[], method: string): RecordedCall[] {
  return calls.filter((call) => call.method === method);
}

test('Chrome launch arguments use app mode for stable viewport sizing', () => {
  const loadingUrl = createPreviewLoadingUrl('test-launch');
  const args = createChromeLaunchArgs(iphone15, 9400, '/tmp/cap-preview-profile', loadingUrl);

  assert.ok(args.includes('--remote-debugging-port=9400'));
  assert.ok(args.includes('--remote-debugging-address=127.0.0.1'));
  assert.ok(args.includes('--user-data-dir=/tmp/cap-preview-profile'));
  assert.ok(args.includes('--auto-open-devtools-for-tabs'));
  assert.ok(args.includes(`--window-size=${iphone15.width},${iphone15.height}`));
  assert.ok(args.includes(`--app=${loadingUrl}`));
  assert.equal(args.some((arg) => arg.startsWith('--new-window')), false);
});

test('profile cleanup accepts only an exact UUID child of the preview profile root', () => {
  const profileDir = path.join(
    process.cwd(),
    '.tmp',
    'chrome-preview-profile',
    '123e4567-e89b-42d3-a456-426614174000',
  );

  assert.equal(validatePreviewProfileDir(profileDir), profileDir);
  assert.throws(
    () => validatePreviewProfileDir(path.dirname(profileDir)),
    /Refusing to remove unchecked preview profile path/,
  );
  assert.throws(
    () => validatePreviewProfileDir(path.join(profileDir, 'nested')),
    /Refusing to remove unchecked preview profile path/,
  );
  assert.throws(
    () => validatePreviewProfileDir('/tmp/123e4567-e89b-42d3-a456-426614174000'),
    /Refusing to remove unchecked preview profile path/,
  );
});

test('profile cleanup removes only the validated one-run directory', async () => {
  const profileDir = createPreviewProfileDir(randomUUID());
  await mkdir(profileDir, { recursive: true });
  await writeFile(path.join(profileDir, 'marker'), 'preview');

  await removePreviewProfileDir(profileDir);
  await assert.rejects(() => access(profileDir), /ENOENT/);
});

test('debug port configuration accepts only valid TCP ports', () => {
  assert.equal(parseDebugPort(undefined), 9229);
  assert.equal(parseDebugPort('9400'), 9400);
  assert.throws(() => parseDebugPort('0'), /integer from 1 to 65535/);
  assert.throws(() => parseDebugPort('65536'), /integer from 1 to 65535/);
  assert.throws(() => parseDebugPort('not-a-port'), /integer from 1 to 65535/);
});

test('preview URLs allow web and local files but reject unsafe or ambiguous inputs', () => {
  assert.equal(validatePreviewUrl('http://localhost:3000'), 'http://localhost:3000/');
  assert.equal(validatePreviewUrl('file:///tmp/demo.html'), 'file:///tmp/demo.html');
  assert.throws(() => validatePreviewUrl('localhost:3000'), /Unsupported preview URL scheme/);
  assert.throws(() => validatePreviewUrl('ftp://example.test/app'), /Unsupported preview URL scheme/);
  assert.throws(
    () => validatePreviewUrl('https://user:secret@example.test/app'),
    /must not contain embedded credentials/,
  );
});

test('an occupied debug port is refused before Chrome launch', async () => {
  const occupiedPort = async (): Promise<void> => {
    const error = new Error('address already in use') as NodeJS.ErrnoException;
    error.code = 'EADDRINUSE';
    throw error;
  };

  await assert.rejects(
    () => assertDebugPortAvailable(9400, occupiedPort),
    /already in use.*cannot prove ownership/,
  );
});

test('target ownership requires this run exact launch marker URL', () => {
  const loadingUrl = createPreviewLoadingUrl('owned-launch');
  const ownedTarget = {
    id: 'owned',
    type: 'page',
    title: 'Capacitor Chrome Preview',
    url: loadingUrl,
  } as CdpTarget;
  const lookalikeTarget = {
    id: 'lookalike',
    type: 'page',
    title: 'Capacitor Chrome Preview',
    url: createPreviewLoadingUrl('different-launch'),
  } as CdpTarget;

  assert.equal(isPreviewLoadingTarget(ownedTarget, loadingUrl), true);
  assert.equal(isPreviewLoadingTarget(lookalikeTarget, loadingUrl), false);
  assert.equal(isPreviewLoadingTarget({ ...ownedTarget, type: 'other' }, loadingUrl), false);
});

test('emulation applies device metrics, touch input, mouse-to-touch, and safe-area values', async () => {
  const { client, calls } = createMockClient();

  await applyEmulationOverrides(client, iphone15);

  assert.deepEqual(called(calls, 'Emulation.setDeviceMetricsOverride')[0]?.params, {
    width: iphone15.width,
    height: iphone15.height,
    deviceScaleFactor: iphone15.deviceScaleFactor,
    mobile: true,
    screenWidth: iphone15.width,
    screenHeight: iphone15.height,
    positionX: 0,
    positionY: 0,
  });
  assert.deepEqual(called(calls, 'Emulation.setTouchEmulationEnabled')[0]?.params, {
    enabled: true,
    maxTouchPoints: 5,
  });
  assert.deepEqual(called(calls, 'Emulation.setEmitTouchEventsForMouse')[0]?.params, {
    enabled: true,
    configuration: 'mobile',
  });
  assert.deepEqual(called(calls, 'Emulation.setSafeAreaInsetsOverride')[0]?.params, {
    insets: iphone15.safeArea,
  });
});

test('safe-area override failure is tolerated after metrics and touch mode are applied', async () => {
  const { client, calls } = createMockClient({ failSafeArea: true });
  const result = await applyEmulationOverrides(client, iphone15);

  assert.equal(called(calls, 'Emulation.setDeviceMetricsOverride').length, 1);
  assert.equal(called(calls, 'Emulation.setTouchEmulationEnabled').length, 1);
  assert.equal(called(calls, 'Emulation.setEmitTouchEventsForMouse').length, 1);
  assert.equal(result.safeArea.ok, false);
  assert.match(result.safeArea.message, /CDP safe area unavailable.*runtime fallback remains/);
});

test('preview content sizing uses Browser.setContentsSize for the active target', async () => {
  const { client, calls } = createMockClient();

  await trySetPreviewContentsSize(client, target, iphone13);

  assert.deepEqual(called(calls, 'Browser.getWindowForTarget')[0]?.params, { targetId: target.id });
  assert.deepEqual(called(calls, 'Browser.setContentsSize')[0]?.params, {
    windowId: 42,
    width: iphone13.width,
    height: iphone13.height,
  });
});

test('initial app navigation removes the preview loading page from history after commit', async () => {
  const { client, calls } = createMockClient();

  await navigateToAppRoot(client, 'https://app.example.test/');

  assert.deepEqual(called(calls, 'Page.navigate')[0]?.params, {
    url: 'https://app.example.test/',
  });
  assert.equal(called(calls, 'Page.resetNavigationHistory').length, 1);
  assert.equal(called(calls, 'Page.frameNavigated.removeListener').length, 1);
  assert.ok(
    calls.findIndex((call) => call.method === 'Page.resetNavigationHistory')
      > calls.findIndex((call) => call.method === 'Page.navigate'),
  );
});

test('navigation times out and removes its listener when the top frame never commits', async () => {
  const { client, calls } = createMockClient({ commitNavigation: false });

  await assert.rejects(
    () => navigateToAppRoot(client, 'https://app.example.test/', 10),
    /waiting for navigation to commit.*timed out after 10ms/,
  );
  assert.equal(called(calls, 'Page.frameNavigated.removeListener').length, 1);
  assert.equal(called(calls, 'Page.resetNavigationHistory').length, 0);
});

test('navigation rejects CDP errors and downloads without waiting for commit', async () => {
  const failed = createMockClient({ navigationError: 'net::ERR_CERT_DATE_INVALID' });
  await assert.rejects(
    () => navigateToAppRoot(failed.client, 'https://expired.example.test/'),
    /Preview navigation failed: net::ERR_CERT_DATE_INVALID/,
  );

  const download = createMockClient({ navigationDownload: true });
  await assert.rejects(
    () => navigateToAppRoot(download.client, 'https://app.example.test/export'),
    /became a download instead of a page/,
  );
});

test('runtime injection is top-frame-only and surfaces JavaScript exceptions', async () => {
  const mock = createMockClient();
  const source = createRuntimeSource(iphone15);
  assert.match(source, /^if \(window\.top === window\)/);
  const subframeWindow = { top: {} };
  assert.doesNotThrow(() => runInNewContext(source, { window: subframeWindow }));

  mock.setRuntimeException('ReferenceError: previewInstall is not defined');
  await assert.rejects(
    () => injectRuntime(mock.client, iphone15),
    /installing the preview runtime failed: ReferenceError: previewInstall is not defined/,
  );
});

test('generic operation timeout rejects stalled work', async () => {
  await assert.rejects(
    () => withTimeout(new Promise<void>(() => undefined), 10, 'test operation'),
    /test operation timed out after 10ms/,
  );
});

test('reset clears safe-area, metrics, touch, and mouse-to-touch emulation', async () => {
  const { client, calls } = createMockClient();

  await resetEmulation(client);

  assert.deepEqual(called(calls, 'Emulation.setSafeAreaInsetsOverride')[0]?.params, { insets: {} });
  assert.equal(called(calls, 'Emulation.clearDeviceMetricsOverride').length, 1);
  assert.deepEqual(called(calls, 'Emulation.setTouchEmulationEnabled')[0]?.params, { enabled: false });
  assert.deepEqual(called(calls, 'Emulation.setEmitTouchEventsForMouse')[0]?.params, { enabled: false });
});

test('viewport verification reports ok, warning, and error states', async () => {
  const mock = createMockClient();

  assert.deepEqual(await verifyViewport(mock.client, iphone15), {
    kind: 'ok',
    message: 'viewport 393x852 verified',
  });

  mock.setLayoutViewport(390, 844);
  assert.deepEqual(await verifyViewport(mock.client, iphone15), {
    kind: 'warning',
    message: 'Expected viewport 393x852, but Chrome reported 390x844.',
  });

  const broken = {
    Page: {
      getLayoutMetrics: async () => {
        throw new Error('target closed');
      },
    },
  } as unknown as CdpClient;

  assert.deepEqual(await verifyViewport(broken, iphone15), {
    kind: 'error',
    message: 'Viewport verification failed: target closed',
  });
});

test('session configure, restore, and device switching reapply preview values', async () => {
  const mock = createMockClient();
  const session = new PreviewSession(mock.client, target, iphone15);

  const initialStatus = await session.configure();
  assert.equal(initialStatus.kind, 'ok');
  assert.match(initialStatus.message, /viewport 393x852 verified/);
  assert.match(initialStatus.message, /window sizing applied/);
  assert.match(initialStatus.message, /safe area applied through CDP/);
  assert.match(initialStatus.message, /mouse-to-touch applied/);
  assert.match(initialStatus.message, /runtime installed/);
  assert.equal(called(mock.calls, 'Page.addScriptToEvaluateOnNewDocument').length, 1);
  assert.equal(called(mock.calls, 'Browser.setContentsSize').length, 1);
  assert.equal(called(mock.calls, 'Emulation.setDeviceMetricsOverride').length, 1);
  assert.equal(called(mock.calls, 'Runtime.evaluate').length, 1);

  mock.calls.length = 0;
  mock.setLayoutViewport(500, 500);
  const restoredStatus = await session.restoreActiveDevice();
  assert.equal(restoredStatus.kind, 'ok');
  assert.deepEqual(called(mock.calls, 'Browser.setContentsSize')[0]?.params, {
    windowId: 42,
    width: iphone15.width,
    height: iphone15.height,
  });
  assert.deepEqual(called(mock.calls, 'Emulation.setDeviceMetricsOverride')[0]?.params, {
    width: iphone15.width,
    height: iphone15.height,
    deviceScaleFactor: iphone15.deviceScaleFactor,
    mobile: true,
    screenWidth: iphone15.width,
    screenHeight: iphone15.height,
    positionX: 0,
    positionY: 0,
  });

  mock.calls.length = 0;
  const switchedStatus = await session.switchToDevice(galaxyA54);
  assert.equal(switchedStatus.kind, 'ok');
  assert.deepEqual(called(mock.calls, 'Browser.setContentsSize')[0]?.params, {
    windowId: 42,
    width: galaxyA54.width,
    height: galaxyA54.height,
  });
  assert.deepEqual(called(mock.calls, 'Emulation.setSafeAreaInsetsOverride')[0]?.params, {
    insets: galaxyA54.safeArea,
  });
  assert.deepEqual(called(mock.calls, 'Page.removeScriptToEvaluateOnNewDocument')[0]?.params, {
    identifier: 'script-2',
  });
});

test('failed device switching restores the previous device and bootstrap', async () => {
  const mock = createMockClient();
  const session = new PreviewSession(mock.client, target, iphone15);

  await session.configure();
  mock.calls.length = 0;
  mock.setDeviceMetricsFailureWidth(galaxyA54.width);

  await assert.rejects(
    () => session.switchToDevice(galaxyA54),
    /metrics rejected for width 384/,
  );

  mock.setDeviceMetricsFailureWidth(undefined);
  mock.calls.length = 0;
  await session.restoreActiveDevice();
  assert.deepEqual(called(mock.calls, 'Emulation.setDeviceMetricsOverride')[0]?.params, {
    width: iphone15.width,
    height: iphone15.height,
    deviceScaleFactor: iphone15.deviceScaleFactor,
    mobile: true,
    screenWidth: iphone15.width,
    screenHeight: iphone15.height,
    positionX: 0,
    positionY: 0,
  });
});

test('session navigation returns to a URL and reapplies the active device', async () => {
  const mock = createMockClient();
  const session = new PreviewSession(mock.client, target, iphone15);

  await session.configure();
  mock.calls.length = 0;

  const status = await session.navigateTo('https://app.example.test/original');

  assert.equal(status.kind, 'ok');
  assert.deepEqual(called(mock.calls, 'Page.navigate')[0]?.params, {
    url: 'https://app.example.test/original',
  });
  assert.equal(called(mock.calls, 'Page.resetNavigationHistory').length, 1);
  assert.equal(called(mock.calls, 'Emulation.setDeviceMetricsOverride').length, 1);
  assert.deepEqual(called(mock.calls, 'Emulation.setSafeAreaInsetsOverride')[0]?.params, {
    insets: iphone15.safeArea,
  });
});

test('session shutdown resets only its target and never closes the browser', async () => {
  const mock = createMockClient();
  const session = new PreviewSession(mock.client, target, iphone15);

  await session.configure();
  mock.calls.length = 0;
  await session.close();

  assert.equal(called(mock.calls, 'Browser.close').length, 0);
  assert.equal(called(mock.calls, 'client.close').length, 1);
  assert.equal(called(mock.calls, 'Emulation.clearDeviceMetricsOverride').length, 1);
  assert.equal(called(mock.calls, 'Page.removeScriptToEvaluateOnNewDocument').length, 1);
});

test('session close is idempotent and external disconnect is observable', async () => {
  const mock = createMockClient();
  const session = new PreviewSession(mock.client, target, iphone15);

  const terminated = session.waitForTermination();
  mock.disconnect();
  await terminated;

  await Promise.all([session.close(), session.close()]);
  assert.equal(called(mock.calls, 'client.close').length, 1);
});
