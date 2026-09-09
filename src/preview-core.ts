import CDP from 'chrome-remote-interface';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, mkdir, realpath, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createPreviewDevices, DEFAULT_DEVICE_ID, findPreviewDevice } from './devices.js';
import {
  createInstallPreviewRuntimeSource,
  resetPreviewRuntime,
} from './injected-runtime.js';
import { runPreviewUi, type PreviewUiStatus } from './preview-ui.js';
import type { PreviewDevice, SafeAreaInsets, StatusBarProfile } from './types.js';

export type CdpClient = Awaited<ReturnType<typeof CDP>>;
export type CdpTarget = Awaited<ReturnType<typeof CDP.List>>[number];

type ExperimentalSafeAreaEmulationApi = CdpClient['Emulation'] & {
  setSafeAreaInsetsOverride(params: { insets: Partial<SafeAreaInsets> }): Promise<void>;
};

type ExperimentalBrowserSizingApi = CdpClient['Browser'] & {
  setContentsSize(params: { windowId: number; width: number; height: number }): Promise<void>;
};

type RefreshPreviewOptions = {
  tolerateRuntimeFailure?: boolean;
};

type CapabilityResult = {
  ok: boolean;
  message: string;
};

type EmulationResult = {
  safeArea: CapabilityResult;
  mouseTouch: CapabilityResult;
};

type DebugPortReservation = (debugPort: number) => Promise<void>;

export type PreviewOptions = {
  url: string;
  deviceId: string;
  persistSession: boolean;
};

export type ParsedPreviewCommand =
  | { kind: 'run'; options: PreviewOptions }
  | { kind: 'help'; usage: string };

export const DEFAULT_URL = new URL('../docs/manual-safe-area-test.html', import.meta.url).href;
export const DEFAULT_DEBUG_PORT = 9229;
export const PREVIEW_LOADING_TITLE = 'Capacitor Chrome Preview';
export const CDP_OPERATION_TIMEOUT_MS = 5_000;
export const NAVIGATION_TIMEOUT_MS = 10_000;
const devices = createPreviewDevices(getStatusBarForeground());

export async function main(): Promise<void> {
  const command = parsePreviewOptions(process.argv.slice(2), devices);

  if (command.kind === 'help') {
    console.log(command.usage);
    return;
  }

  const { options } = command;
  const initialDevice = getPreviewDeviceOrThrow(options.deviceId);
  const port = parseDebugPort(process.env.CAP_CHROME_PREVIEW_PORT);
  const launchId = randomUUID();
  const loadingUrl = createPreviewLoadingUrl(launchId);
  const profileDir = options.persistSession
    ? createPersistentPreviewProfileDir()
    : createPreviewProfileDir(launchId);

  await assertDebugPortAvailable(port);
  await mkdir(profileDir, { recursive: true });

  const chromePath = findChromePath();
  let chrome: ChildProcess;

  try {
    chrome = await launchPreviewAppWindow(chromePath, initialDevice, port, profileDir, loadingUrl);
  } catch (error) {
    if (!options.persistSession) {
      await tryRemovePreviewProfileDir(profileDir);
    }
    throw error;
  }

  const removeOwnedChromeSignalHandlers = installOwnedChromeSignalHandlers(chrome);
  let session: PreviewSession | undefined;
  let cleanupPromise: Promise<void> | undefined;

  const cleanup = (): Promise<void> => {
    cleanupPromise ??= cleanupPreviewRun(
      chrome,
      profileDir,
      options.persistSession,
      session,
      removeOwnedChromeSignalHandlers,
    );
    return cleanupPromise;
  };

  try {
    await waitForDebugPort(port, chrome);
    const target = await waitForPreviewAppTarget(port, loadingUrl, chrome);
    const client = await withTimeout(
      CDP({ target, port }),
      CDP_OPERATION_TIMEOUT_MS,
      'connecting to the owned Chrome target',
    );
    session = new PreviewSession(client, target, initialDevice);
    const activeSession = session;

    await activeSession.configure();
    await navigateToAppRoot(client, options.url);
    const initialStatus = await activeSession.restoreActiveDevice({ tolerateRuntimeFailure: true });

    if (canRenderInteractiveUi()) {
      const previewUi = runPreviewUi({
        url: options.url,
        port,
        profileDir,
        persistentProfile: options.persistSession,
        devices,
        initialActiveDeviceId: initialDevice.id,
        initialStatus,
        sessionEnded: activeSession.waitForTermination(),
        onSelectDevice: async (deviceId) => activeSession.switchToDevice(getPreviewDeviceOrThrow(deviceId)),
        onRestore: async () => activeSession.restoreActiveDevice(),
        onReturnToOriginalUrl: async () => activeSession.navigateTo(options.url),
        onRequestExit: cleanup,
      });
      await previewUi;
      return;
    }

    const exitRequested = waitForExit(activeSession);
    logStartup(options.url, initialDevice, initialStatus, port, profileDir, options.persistSession);
    await exitRequested;
  } finally {
    await cleanup();
  }
}

async function cleanupPreviewRun(
  chrome: ChildProcess,
  profileDir: string,
  persistSession: boolean,
  session: PreviewSession | undefined,
  removeOwnedChromeSignalHandlers: () => void,
): Promise<void> {
  try {
    if (session) {
      try {
        await session.close();
      } catch (error) {
        console.warn(`Preview session cleanup failed: ${getErrorMessage(error)}`);
      }
    }

    const chromeStopped = await terminateSpawnedChrome(chrome);

    if (persistSession) {
      return;
    }

    if (chromeStopped) {
      await tryRemovePreviewProfileDir(profileDir);
    } else {
      console.warn(`Preview profile retained because Chrome may still be using it: ${profileDir}`);
    }
  } finally {
    removeOwnedChromeSignalHandlers();
  }
}

export class PreviewSession {
  private activeDevice: PreviewDevice;
  private newDocumentScriptIdentifier: string | undefined;
  private operationQueue: Promise<void> = Promise.resolve();
  private isClosed = false;
  private closePromise: Promise<void> | undefined;
  private resolveTermination!: () => void;
  private readonly termination = new Promise<void>((resolve) => {
    this.resolveTermination = resolve;
  });
  private readonly handleDisconnect = (): void => {
    this.resolveTermination();
  };

  constructor(
    private readonly client: CdpClient,
    private readonly target: CdpTarget,
    initialDevice: PreviewDevice,
  ) {
    this.activeDevice = initialDevice;
    this.client.on('disconnect', this.handleDisconnect);
  }

  waitForTermination(): Promise<void> {
    return this.termination;
  }

  async configure(): Promise<PreviewUiStatus> {
    const { Page, Runtime } = this.client;

    await withTimeout(
      Promise.all([
        Page.enable(),
        Runtime.enable(),
      ]),
      CDP_OPERATION_TIMEOUT_MS,
      'enabling CDP Page and Runtime domains',
    );

    return this.configureDevice(this.activeDevice, { tolerateRuntimeFailure: true });
  }

  async switchToDevice(device: PreviewDevice): Promise<PreviewUiStatus> {
    return this.enqueueOperation(async () => {
      const previousDevice = this.activeDevice;

      try {
        const status = await this.configureDevice(device);
        this.activeDevice = device;
        return status;
      } catch (error) {
        try {
          await this.configureDevice(previousDevice, { tolerateRuntimeFailure: true });
        } catch (rollbackError) {
          throw new Error(
            `Device switch failed: ${getErrorMessage(error)} Rollback also failed: ${getErrorMessage(rollbackError)}`,
            { cause: error },
          );
        }

        throw error;
      }
    });
  }

  async restoreActiveDevice(options: RefreshPreviewOptions = {}): Promise<PreviewUiStatus> {
    return this.enqueueOperation(() => this.configureDevice(this.activeDevice, options));
  }

  async navigateTo(url: string): Promise<PreviewUiStatus> {
    return this.enqueueOperation(async () => {
      await navigateToAppRoot(this.client, url);
      return this.configureDevice(this.activeDevice);
    });
  }

  async close(): Promise<void> {
    this.closePromise ??= this.performClose();
    return this.closePromise;
  }

  private async performClose(): Promise<void> {
    this.isClosed = true;
    const cleanupFailures: string[] = [];

    try {
      await withTimeout(
        this.operationQueue,
        CDP_OPERATION_TIMEOUT_MS,
        'waiting for the active preview operation to finish',
      );
    } catch (error) {
      cleanupFailures.push(getErrorMessage(error));
    }

    try {
      await evaluateRuntimeSource(this.client, createRuntimeResetSource(), 'resetting the preview runtime');
    } catch (error) {
      cleanupFailures.push(getErrorMessage(error));
    }

    const cleanupResults = await Promise.allSettled([
      this.removeNewDocumentRuntime(),
      resetEmulation(this.client),
    ]);

    cleanupResults.forEach((result) => {
      if (result.status === 'rejected') {
        cleanupFailures.push(getErrorMessage(result.reason));
      }
    });

    try {
      await withTimeout(this.client.close(), CDP_OPERATION_TIMEOUT_MS, 'closing the CDP connection');
    } catch (error) {
      cleanupFailures.push(getErrorMessage(error));
    } finally {
      this.resolveTermination();
    }

    if (cleanupFailures.length > 0) {
      console.warn(`Preview cleanup was incomplete: ${cleanupFailures.join(' ')}`);
    }
  }

  private async configureDevice(
    device: PreviewDevice,
    options: RefreshPreviewOptions = {},
  ): Promise<PreviewUiStatus> {
    await this.updateNewDocumentRuntime(device);
    const windowSizing = await trySetPreviewContentsSize(this.client, this.target, device);
    const emulation = await applyEmulationOverrides(this.client, device);
    let runtime: CapabilityResult = { ok: true, message: 'runtime installed' };

    try {
      await injectRuntime(this.client, device);
    } catch (error) {
      if (!options.tolerateRuntimeFailure) {
        throw error;
      }

      runtime = { ok: false, message: `runtime failed: ${getErrorMessage(error)}` };
    }

    const viewport = await verifyViewport(this.client, device);
    return createCapabilityStatus(viewport, windowSizing, emulation, runtime);
  }

  private async updateNewDocumentRuntime(device: PreviewDevice): Promise<void> {
    const previousIdentifier = this.newDocumentScriptIdentifier;
    const { identifier } = await withTimeout(
      this.client.Page.addScriptToEvaluateOnNewDocument({
        source: createRuntimeSource(device),
      }),
      CDP_OPERATION_TIMEOUT_MS,
      'registering the preview bootstrap',
    );

    if (previousIdentifier) {
      try {
        await withTimeout(
          this.client.Page.removeScriptToEvaluateOnNewDocument({ identifier: previousIdentifier }),
          CDP_OPERATION_TIMEOUT_MS,
          'removing the previous preview bootstrap',
        );
      } catch (error) {
        try {
          await this.client.Page.removeScriptToEvaluateOnNewDocument({ identifier });
        } catch {
          // Preserve the original removal failure below.
        }

        throw new Error(`Previous preview bootstrap could not be removed: ${getErrorMessage(error)}`);
      }
    }

    this.newDocumentScriptIdentifier = identifier;
  }

  private async removeNewDocumentRuntime(): Promise<void> {
    if (!this.newDocumentScriptIdentifier) return;

    const identifier = this.newDocumentScriptIdentifier;
    this.newDocumentScriptIdentifier = undefined;
    await withTimeout(
      this.client.Page.removeScriptToEvaluateOnNewDocument({ identifier }),
      CDP_OPERATION_TIMEOUT_MS,
      'removing the preview bootstrap',
    );
  }

  private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const queuedOperation = this.operationQueue.then(async () => {
      if (this.isClosed) {
        throw new Error('Preview session is closed.');
      }

      return operation();
    });

    this.operationQueue = queuedOperation.then(
      () => undefined,
      () => undefined,
    );

    return queuedOperation;
  }
}

function findChromePath(): string {
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    path.join(homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
  ];

  const installedChrome = candidates.find((candidate) => existsSync(candidate));

  return installedChrome || 'google-chrome';
}

export function createChromeLaunchArgs(
  device: PreviewDevice,
  debugPort = DEFAULT_DEBUG_PORT,
  userDataDir = createPreviewProfileDir('manual'),
  loadingUrl = createPreviewLoadingUrl('manual'),
): string[] {
  return [
    `--remote-debugging-port=${debugPort}`,
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--auto-open-devtools-for-tabs',
    `--window-size=${device.width},${device.height}`,
    `--app=${loadingUrl}`,
  ];
}

async function launchPreviewAppWindow(
  chromePath: string,
  device: PreviewDevice,
  debugPort: number,
  userDataDir: string,
  loadingUrl: string,
): Promise<ChildProcess> {
  const chrome = spawn(chromePath, createChromeLaunchArgs(device, debugPort, userDataDir, loadingUrl), {
    detached: true,
    stdio: 'ignore',
  });

  await withTimeout(
    new Promise<void>((resolve, reject) => {
      chrome.once('error', reject);
      chrome.once('spawn', resolve);
    }),
    CDP_OPERATION_TIMEOUT_MS,
    'launching Google Chrome',
  );

  return chrome;
}

async function terminateSpawnedChrome(chrome: ChildProcess): Promise<boolean> {
  if (isChildExited(chrome)) {
    return true;
  }

  signalChromeProcessGroup(chrome, 'SIGTERM');

  if (await waitForChildExit(chrome, 2_000)) {
    return true;
  }

  signalChromeProcessGroup(chrome, 'SIGKILL');
  const didExit = await waitForChildExit(chrome, 500);
  if (!didExit) {
    console.warn('Spawned Chrome did not report exit after SIGKILL. Check the recorded process manually.');
  }

  return didExit;
}

function installOwnedChromeSignalHandlers(chrome: ChildProcess): () => void {
  const terminateOwnedChrome = (): void => {
    signalChromeProcessGroup(chrome, 'SIGTERM');
  };

  process.once('SIGINT', terminateOwnedChrome);
  process.once('SIGTERM', terminateOwnedChrome);
  process.once('SIGHUP', terminateOwnedChrome);

  return () => {
    process.off('SIGINT', terminateOwnedChrome);
    process.off('SIGTERM', terminateOwnedChrome);
    process.off('SIGHUP', terminateOwnedChrome);
  };
}

function signalChromeProcessGroup(chrome: ChildProcess, signal: NodeJS.Signals): void {
  if (!chrome.pid) return;

  try {
    process.kill(-chrome.pid, signal);
  } catch {
    try {
      chrome.kill(signal);
    } catch {
      // The spawned Chrome process may already have exited.
    }
  }
}

function waitForChildExit(chrome: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (isChildExited(chrome)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const finish = (didExit: boolean): void => {
      clearTimeout(timeout);
      chrome.off('exit', onExit);
      resolve(didExit || isChildExited(chrome));
    };
    const onExit = (): void => finish(true);
    const timeout = setTimeout(() => finish(false), timeoutMs);

    chrome.once('exit', onExit);
  });
}

function isChildExited(chrome: ChildProcess): boolean {
  return chrome.exitCode !== null || chrome.signalCode !== null;
}

function assertSpawnedChromeRunning(chrome: ChildProcess, action: string): void {
  if (!isChildExited(chrome)) return;

  const outcome = chrome.signalCode
    ? `signal ${chrome.signalCode}`
    : `exit code ${chrome.exitCode ?? 'unknown'}`;

  throw new Error(
    `Spawned Chrome stopped with ${outcome} before ${action}. Refusing to use another Chrome instance.`,
  );
}

async function isChromeDebugPortReady(debugPort: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`, {
      signal: AbortSignal.timeout(1_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForDebugPort(debugPort: number, chrome: ChildProcess): Promise<void> {
  const deadline = Date.now() + 10_000;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    assertSpawnedChromeRunning(chrome, 'exposing its debug port');

    if (await isChromeDebugPortReady(debugPort)) {
      assertSpawnedChromeRunning(chrome, 'claiming its debug port');
      return;
    }

    lastError = new Error('debug port not ready');
    await sleep(150);
  }

  throw new Error(`Chrome did not expose a debug port on ${debugPort}: ${lastError?.message || 'timeout'}`);
}

async function listTargets(debugPort: number): Promise<CdpTarget[]> {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`, {
    signal: AbortSignal.timeout(1_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to list Chrome targets: ${response.status} ${response.statusText}`);
  }

  return await response.json() as CdpTarget[];
}

async function waitForPreviewAppTarget(
  debugPort: number,
  loadingUrl: string,
  chrome: ChildProcess,
): Promise<CdpTarget> {
  const deadline = Date.now() + 10_000;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    assertSpawnedChromeRunning(chrome, 'opening its marked preview target');

    try {
      const loadingTarget = (await listTargets(debugPort))
        .find((target) => isPreviewLoadingTarget(target, loadingUrl));

      if (loadingTarget) {
        assertSpawnedChromeRunning(chrome, 'claiming its marked preview target');
        return loadingTarget;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    await sleep(150);
  }

  const reason = lastError ? ` Last target-listing error: ${lastError.message}` : '';
  throw new Error(
    `Spawned Chrome did not expose this run's marked preview target on debug port ${debugPort}.`
    + ' Refusing to attach because target ownership cannot be proven.'
    + reason,
  );
}

export function isPreviewLoadingTarget(target: CdpTarget, loadingUrl: string): boolean {
  return target.type === 'page' && target.url === loadingUrl;
}

export async function applyEmulationOverrides(
  client: CdpClient,
  device: PreviewDevice,
): Promise<EmulationResult> {
  await withTimeout(
    client.Emulation.setDeviceMetricsOverride({
      width: device.width,
      height: device.height,
      deviceScaleFactor: device.deviceScaleFactor,
      mobile: true,
      screenWidth: device.width,
      screenHeight: device.height,
      positionX: 0,
      positionY: 0,
    }),
    CDP_OPERATION_TIMEOUT_MS,
    'applying device metrics',
  );

  await withTimeout(
    client.Emulation.setTouchEmulationEnabled({
      enabled: true,
      maxTouchPoints: 5,
    }),
    CDP_OPERATION_TIMEOUT_MS,
    'enabling touch emulation',
  );

  const mouseTouch = await trySetEmitTouchEventsForMouse(client);
  const safeArea = await trySetSafeAreaInsets(client, device);

  return { safeArea, mouseTouch };
}

export async function trySetPreviewContentsSize(
  client: CdpClient,
  target: CdpTarget,
  device: PreviewDevice,
): Promise<CapabilityResult> {
  try {
    const { windowId } = await withTimeout(
      client.Browser.getWindowForTarget({ targetId: target.id }),
      CDP_OPERATION_TIMEOUT_MS,
      'finding the preview app window',
    );

    await withTimeout(
      getExperimentalBrowserSizing(client).setContentsSize({
        windowId,
        width: device.width,
        height: device.height,
      }),
      CDP_OPERATION_TIMEOUT_MS,
      'sizing the preview app window',
    );

    return { ok: true, message: 'window sizing applied' };
  } catch (error) {
    return { ok: false, message: `window sizing unavailable: ${getErrorMessage(error)}` };
  }
}

export async function trySetSafeAreaInsets(
  client: CdpClient,
  device: PreviewDevice,
): Promise<CapabilityResult> {
  try {
    await withTimeout(
      getExperimentalSafeAreaEmulation(client).setSafeAreaInsetsOverride({
        insets: device.safeArea,
      }),
      CDP_OPERATION_TIMEOUT_MS,
      'applying the CDP safe-area override',
    );

    return { ok: true, message: 'safe area applied through CDP' };
  } catch (error) {
    return {
      ok: false,
      message: `CDP safe area unavailable; runtime fallback remains: ${getErrorMessage(error)}`,
    };
  }
}

export async function trySetEmitTouchEventsForMouse(client: CdpClient): Promise<CapabilityResult> {
  try {
    await withTimeout(
      client.Emulation.setEmitTouchEventsForMouse({
        enabled: true,
        configuration: 'mobile',
      }),
      CDP_OPERATION_TIMEOUT_MS,
      'enabling mouse-to-touch emulation',
    );

    return { ok: true, message: 'mouse-to-touch applied' };
  } catch (error) {
    return { ok: false, message: `mouse-to-touch unavailable: ${getErrorMessage(error)}` };
  }
}

export async function resetEmulation(client: CdpClient): Promise<void> {
  const resets = await Promise.allSettled([
    withTimeout(
      getExperimentalSafeAreaEmulation(client).setSafeAreaInsetsOverride({ insets: {} }),
      CDP_OPERATION_TIMEOUT_MS,
      'clearing the safe-area override',
    ),
    withTimeout(
      client.Emulation.clearDeviceMetricsOverride(),
      CDP_OPERATION_TIMEOUT_MS,
      'clearing device metrics',
    ),
    withTimeout(
      client.Emulation.setTouchEmulationEnabled({ enabled: false }),
      CDP_OPERATION_TIMEOUT_MS,
      'disabling touch emulation',
    ),
    withTimeout(
      client.Emulation.setEmitTouchEventsForMouse({ enabled: false }),
      CDP_OPERATION_TIMEOUT_MS,
      'disabling mouse-to-touch emulation',
    ),
  ]);
  const failures = resets.flatMap((result) => (
    result.status === 'rejected' ? [getErrorMessage(result.reason)] : []
  ));

  if (failures.length > 0) {
    throw new Error(`Emulation reset was incomplete: ${failures.join(' ')}`);
  }
}

export async function injectRuntime(client: CdpClient, device: PreviewDevice): Promise<void> {
  await evaluateRuntimeSource(client, createRuntimeSource(device), 'installing the preview runtime');
}

export async function navigateToAppRoot(
  client: CdpClient,
  url: string,
  timeoutMs = NAVIGATION_TIMEOUT_MS,
): Promise<void> {
  let expectedFrameId: string | undefined;
  let resolveCommit: (() => void) | undefined;
  const committedTopFrames = new Set<string>();
  const committed = new Promise<void>((resolve) => {
    resolveCommit = resolve;
  });
  const removeFrameListener = client.Page.frameNavigated(({ frame }) => {
    if (frame.parentId) return;

    committedTopFrames.add(frame.id);

    if (frame.id === expectedFrameId) {
      resolveCommit?.();
    }
  });

  try {
    const navigation = await withTimeout(
      client.Page.navigate({ url }),
      timeoutMs,
      `requesting navigation to ${url}`,
    );

    if (navigation.errorText) {
      throw new Error(`Preview navigation failed: ${navigation.errorText}`);
    }

    if ((navigation as typeof navigation & { isDownload?: boolean }).isDownload) {
      throw new Error(`Preview navigation became a download instead of a page: ${url}`);
    }

    expectedFrameId = navigation.frameId;

    if (!navigation.loaderId || committedTopFrames.has(expectedFrameId)) {
      resolveCommit?.();
    }

    await withTimeout(committed, timeoutMs, `waiting for navigation to commit: ${url}`);
    await withTimeout(
      client.Page.resetNavigationHistory(),
      CDP_OPERATION_TIMEOUT_MS,
      'resetting preview navigation history',
    );
  } finally {
    removeFrameListener();
  }
}

export async function verifyViewport(client: CdpClient, device: PreviewDevice): Promise<PreviewUiStatus> {
  try {
    const metrics = await withTimeout(
      client.Page.getLayoutMetrics(),
      CDP_OPERATION_TIMEOUT_MS,
      'reading the layout viewport',
    );
    const { clientWidth, clientHeight } = metrics.cssLayoutViewport;
    const viewport = `${clientWidth}x${clientHeight}`;
    const expectedViewport = `${device.width}x${device.height}`;

    if (viewport === expectedViewport) {
      return { kind: 'ok', message: `viewport ${viewport} verified` };
    }

    return { kind: 'warning', message: `Expected viewport ${expectedViewport}, but Chrome reported ${viewport}.` };
  } catch (error) {
    return { kind: 'error', message: `Viewport verification failed: ${getErrorMessage(error)}` };
  }
}

function createCapabilityStatus(
  viewport: PreviewUiStatus,
  windowSizing: CapabilityResult,
  emulation: EmulationResult,
  runtime: CapabilityResult,
): PreviewUiStatus {
  const capabilityResults = [windowSizing, emulation.safeArea, emulation.mouseTouch, runtime];
  const hasCapabilityWarning = capabilityResults.some((result) => !result.ok);
  const kind = viewport.kind === 'error' || !runtime.ok
    ? 'error'
    : viewport.kind === 'warning' || hasCapabilityWarning
      ? 'warning'
      : 'ok';

  return {
    kind,
    message: [viewport.message, ...capabilityResults.map((result) => result.message)].join(' | '),
  };
}

async function evaluateRuntimeSource(
  client: CdpClient,
  expression: string,
  action: string,
): Promise<void> {
  const evaluation = await withTimeout(
    client.Runtime.evaluate({ expression, awaitPromise: false }),
    CDP_OPERATION_TIMEOUT_MS,
    action,
  );

  if (evaluation.exceptionDetails) {
    const description = evaluation.exceptionDetails.exception?.description
      || evaluation.exceptionDetails.text
      || 'unknown JavaScript exception';
    throw new Error(`${action} failed: ${description}`);
  }
}

function waitForExit(session: PreviewSession): Promise<void> {
  return new Promise((resolve) => {
    let hasFinished = false;
    const finish = (): void => {
      if (hasFinished) return;
      hasFinished = true;
      process.off('SIGINT', finish);
      process.off('SIGTERM', finish);
      process.off('SIGHUP', finish);
      resolve();
    };

    process.once('SIGINT', finish);
    process.once('SIGTERM', finish);
    process.once('SIGHUP', finish);
    void session.waitForTermination().then(finish);
  });
}

function getExperimentalSafeAreaEmulation(client: CdpClient): ExperimentalSafeAreaEmulationApi {
  return client.Emulation as ExperimentalSafeAreaEmulationApi;
}

function getExperimentalBrowserSizing(client: CdpClient): ExperimentalBrowserSizingApi {
  return client.Browser as ExperimentalBrowserSizingApi;
}

export function parsePreviewOptions(
  argv: string[],
  availableDevices: readonly PreviewDevice[],
): ParsedPreviewCommand {
  let url: string | undefined;
  let positionalUrl: string | undefined;
  let deviceId = DEFAULT_DEVICE_ID;
  let persistSession = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      return { kind: 'help', usage: createUsage(availableDevices) };
    }

    if (arg === '--url') {
      url = readFlagValue(argv, index, '--url');
      index += 1;
      continue;
    }

    if (arg.startsWith('--url=')) {
      url = arg.slice('--url='.length);
      continue;
    }

    if (arg === '--device') {
      deviceId = readFlagValue(argv, index, '--device');
      index += 1;
      continue;
    }

    if (arg.startsWith('--device=')) {
      deviceId = arg.slice('--device='.length);
      continue;
    }

    if (arg === '--persist-session') {
      persistSession = true;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (positionalUrl) {
      throw new Error(`Unexpected extra positional argument: ${arg}`);
    }

    positionalUrl = arg;
  }

  if (!findPreviewDevice(availableDevices, deviceId)) {
    const deviceIds = availableDevices.map((device) => device.id).join(', ');
    throw new Error(`Unknown device "${deviceId}". Available devices: ${deviceIds}`);
  }

  const selectedUrl = validatePreviewUrl(url || positionalUrl || DEFAULT_URL);

  return {
    kind: 'run',
    options: {
      url: selectedUrl,
      deviceId,
      persistSession,
    },
  };
}

export function validatePreviewUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid preview URL: ${value}`);
  }

  if (!['http:', 'https:', 'file:'].includes(url.protocol)) {
    throw new Error(`Unsupported preview URL scheme "${url.protocol}". Use http, https, or file.`);
  }

  if (url.username || url.password) {
    throw new Error('Preview URLs must not contain embedded credentials.');
  }

  return url.href;
}

export function readFlagValue(argv: string[], index: number, flagName: string): string {
  const value = argv[index + 1];

  if (!value || value.startsWith('-')) {
    throw new Error(`Missing value for ${flagName}.`);
  }

  return value;
}

export function createUsage(availableDevices: readonly PreviewDevice[]): string {
  const idColumnWidth = Math.max(...availableDevices.map((device) => device.id.length));
  const deviceList = availableDevices
    .map((device) => `  ${device.id.padEnd(idColumnWidth)} ${device.name} ${device.width}x${device.height}`)
    .join('\n');

  return [
    'Usage: capacitor-chrome-preview [url] [--url <url>] [--device <device-id>] [--persist-session]',
    '',
    'Options:',
    '  --persist-session  Reuse a dedicated profile to keep logins and site data.',
    '',
    'Devices:',
    deviceList,
  ].join('\n');
}

export function getPreviewDeviceOrThrow(deviceId: string): PreviewDevice {
  const device = findPreviewDevice(devices, deviceId);

  if (!device) {
    const deviceIds = devices.map((candidate) => candidate.id).join(', ');
    throw new Error(`Unknown device "${deviceId}". Available devices: ${deviceIds}`);
  }

  return device;
}

export function getStatusBarForeground(): StatusBarProfile['foreground'] {
  return process.env.CAP_CHROME_PREVIEW_STATUS_BAR_COLOR === 'white' ? 'white' : 'black';
}

export function canRenderInteractiveUi(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function logStartup(
  url: string,
  device: PreviewDevice,
  status: PreviewUiStatus,
  debugPort = DEFAULT_DEBUG_PORT,
  userDataDir = createPreviewProfileDir('manual'),
  persistentProfile = false,
): void {
  const statusLogger = status.kind === 'ok' ? console.log : console.warn;

  statusLogger(status.message);
  console.log(`Capacitor Chrome Preview is running for ${url}`);
  console.log(`Device: ${device.name}`);
  console.log(`Chrome remote debugging: http://127.0.0.1:${debugPort}`);
  console.log(`Profile: ${userDataDir} (${persistentProfile ? 'persistent' : 'temporary'})`);
  console.log('Press Ctrl+C to reset the preview and close the preview Chrome window.');
}

export function parseDebugPort(value: string | undefined): number {
  const debugPort = value === undefined ? DEFAULT_DEBUG_PORT : Number(value);

  if (!Number.isInteger(debugPort) || debugPort < 1 || debugPort > 65_535) {
    throw new Error('CAP_CHROME_PREVIEW_PORT must be an integer from 1 to 65535.');
  }

  return debugPort;
}

export async function assertDebugPortAvailable(
  debugPort: number,
  reservePort: DebugPortReservation = reserveLoopbackPort,
): Promise<void> {
  parseDebugPort(String(debugPort));

  try {
    await reservePort(debugPort);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === 'EADDRINUSE') {
      throw new Error(
        `Chrome debug port ${debugPort} is already in use. Refusing to attach because this run cannot prove ownership.`,
      );
    }

    throw new Error(`Chrome debug port ${debugPort} could not be reserved: ${getErrorMessage(error)}`);
  }
}

async function reserveLoopbackPort(debugPort: number): Promise<void> {
  const server = createServer();

  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => reject(error);

      server.once('error', onError);
      server.listen({ host: '127.0.0.1', port: debugPort, exclusive: true }, () => {
        server.off('error', onError);
        resolve();
      });
    });
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  }
}

export function createPreviewProfileDir(launchId: string): string {
  return path.join(process.cwd(), '.tmp', 'chrome-preview-profile', launchId);
}

export function createPersistentPreviewProfileDir(): string {
  return path.join(process.cwd(), '.tmp', 'chrome-preview-profile', 'persistent');
}

export function validatePreviewProfileDir(profileDir: string): string {
  const expectedParent = path.resolve(process.cwd(), '.tmp', 'chrome-preview-profile');
  const resolvedProfileDir = path.resolve(profileDir);
  const profileName = path.basename(resolvedProfileDir);

  if (
    path.dirname(resolvedProfileDir) !== expectedParent
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileName)
  ) {
    throw new Error(`Refusing to remove unchecked preview profile path: ${profileDir}`);
  }

  return resolvedProfileDir;
}

export async function removePreviewProfileDir(profileDir: string): Promise<void> {
  const checkedProfileDir = validatePreviewProfileDir(profileDir);
  const expectedRealParent = path.join(
    await realpath(process.cwd()),
    '.tmp',
    'chrome-preview-profile',
  );
  const actualRealParent = await realpath(path.dirname(checkedProfileDir));

  if (actualRealParent !== expectedRealParent) {
    throw new Error(`Refusing to remove preview profile through a linked path: ${profileDir}`);
  }

  try {
    const profileStats = await lstat(checkedProfileDir);
    if (profileStats.isSymbolicLink()) {
      throw new Error(`Refusing to remove a linked preview profile: ${profileDir}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }

  await rm(checkedProfileDir, { recursive: true, force: true });
}

async function tryRemovePreviewProfileDir(profileDir: string): Promise<void> {
  try {
    await removePreviewProfileDir(profileDir);
  } catch (error) {
    console.warn(`Preview profile cleanup failed for ${profileDir}: ${getErrorMessage(error)}`);
  }
}

export function createPreviewLoadingUrl(launchId: string): string {
  const html = [
    '<!doctype html>',
    `<title>${PREVIEW_LOADING_TITLE}</title>`,
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<meta name="capacitor-chrome-preview-launch" content="${launchId}">`,
    '<style>body{margin:0;font:13px system-ui,sans-serif;background:#fff;color:#374151;display:grid;place-items:center;min-height:100vh}</style>',
    '<div>Opening preview...</div>',
  ].join('');

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

export function createRuntimeSource(device: PreviewDevice): string {
  return createTopFrameRuntimeSource(createInstallPreviewRuntimeSource(device));
}

export function createRuntimeResetSource(): string {
  return createTopFrameRuntimeSource(createRuntimeInvocationSource(resetPreviewRuntime));
}

function createTopFrameRuntimeSource(source: string): string {
  return `if (window.top === window) {\n${source}\n}`;
}

export function createRuntimeInvocationSource<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  ...args: TArgs
): string {
  const serializedArgs = args.map((arg) => {
    const serialized = JSON.stringify(arg);

    if (typeof serialized !== 'string') {
      throw new Error('Runtime argument could not be serialized.');
    }

    return serialized;
  });

  return `(${fn.toString()})(${serializedArgs.join(',')});`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, action: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    const timeout = setTimeout(() => {
      finish(() => reject(new Error(`${action} timed out after ${timeoutMs}ms.`)));
    }, timeoutMs);

    promise.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
