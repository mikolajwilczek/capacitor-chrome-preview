import { Box, render, Text, useApp, useInput } from 'ink';
import { useState, type ReactElement } from 'react';
import type { PreviewDevice } from './types.js';

export type PreviewUiStatus = {
  kind: 'pending' | 'ok' | 'warning' | 'error';
  message: string;
};

export type PreviewUiProps = {
  url: string;
  port: number;
  profileDir: string;
  persistentProfile: boolean;
  devices: readonly PreviewDevice[];
  initialActiveDeviceId: string;
  initialStatus: PreviewUiStatus;
  sessionEnded: Promise<void>;
  onSelectDevice: (deviceId: string) => Promise<PreviewUiStatus>;
  onRestore: () => Promise<PreviewUiStatus>;
  onReturnToOriginalUrl: () => Promise<PreviewUiStatus>;
  onRequestExit: () => Promise<void>;
};

type PreviewAppProps = PreviewUiProps & {
  requestExit: () => Promise<void>;
};

export async function runPreviewUi(props: PreviewUiProps): Promise<void> {
  let exitStarted = false;
  let app: ReturnType<typeof render> | undefined;

  const requestExit = async (): Promise<void> => {
    if (exitStarted) return;
    exitStarted = true;
    await props.onRequestExit();
  };

  const closeFromSignal = (): void => {
    const cleanupWatchdog = setTimeout(() => {
      console.warn('Preview cleanup did not finish within 30 seconds after the process signal.');
      app?.unmount();
    }, 30_000);

    void requestExit().finally(() => {
      clearTimeout(cleanupWatchdog);
      app?.unmount();
    });
  };

  process.once('SIGINT', closeFromSignal);
  process.once('SIGTERM', closeFromSignal);
  process.once('SIGHUP', closeFromSignal);

  app = render(
    <PreviewApp
      {...props}
      requestExit={requestExit}
    />,
    {
      exitOnCtrlC: false,
    },
  );

  void props.sessionEnded.then(() => {
    app?.unmount();
  });

  try {
    await app.waitUntilExit();
  } finally {
    process.off('SIGINT', closeFromSignal);
    process.off('SIGTERM', closeFromSignal);
    process.off('SIGHUP', closeFromSignal);
  }
}

function PreviewApp({
  url,
  port,
  profileDir,
  persistentProfile,
  devices,
  initialActiveDeviceId,
  initialStatus,
  onSelectDevice,
  onRestore,
  onReturnToOriginalUrl,
  requestExit,
}: PreviewAppProps): ReactElement {
  const { exit } = useApp();
  const initialIndex = Math.max(devices.findIndex((device) => device.id === initialActiveDeviceId), 0);
  const [activeDeviceId, setActiveDeviceId] = useState(initialActiveDeviceId);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [status, setStatus] = useState(initialStatus);
  const [isBusy, setIsBusy] = useState(false);

  const activeDevice = devices.find((device) => device.id === activeDeviceId) ?? devices[initialIndex];
  const selectedDevice = devices[selectedIndex] ?? activeDevice;

  async function applyDevice(device: PreviewDevice): Promise<void> {
    if (isBusy) return;

    setIsBusy(true);
    setStatus({ kind: 'pending', message: `Switching to ${device.name}...` });

    try {
      const nextStatus = await onSelectDevice(device.id);
      setActiveDeviceId(device.id);
      setSelectedIndex(devices.findIndex((candidate) => candidate.id === device.id));
      setStatus(nextStatus);
    } catch (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function restoreCurrentDevice(): Promise<void> {
    if (isBusy) return;

    setIsBusy(true);
    setStatus({ kind: 'pending', message: `Restoring ${activeDevice.name} size and emulation...` });

    try {
      const nextStatus = await onRestore();
      setStatus(nextStatus);
    } catch (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function returnToOriginalUrl(): Promise<void> {
    if (isBusy) return;

    setIsBusy(true);
    setStatus({ kind: 'pending', message: 'Returning to original URL...' });

    try {
      const nextStatus = await onReturnToOriginalUrl();
      setStatus(nextStatus);
    } catch (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function quit(): Promise<void> {
    setIsBusy(true);
    setStatus({ kind: 'pending', message: 'Resetting preview...' });

    try {
      await requestExit();
    } catch (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error) });
      setIsBusy(false);
      return;
    }

    exit();
  }

  useInput((input, key) => {
    if ((key.ctrl && input === 'c') || input === '\u0003' || input === 'q' || input === '\u0004') {
      void quit();
      return;
    }

    if (isBusy) return;

    if (input === 'r') {
      void restoreCurrentDevice();
      return;
    }

    if (input === 'o') {
      void returnToOriginalUrl();
      return;
    }

    if (key.upArrow || key.leftArrow) {
      setSelectedIndex((index) => (index - 1 + devices.length) % devices.length);
      return;
    }

    if (key.downArrow || key.rightArrow) {
      setSelectedIndex((index) => (index + 1) % devices.length);
      return;
    }

    if (key.return) {
      void applyDevice(selectedDevice);
      return;
    }

    const directDeviceIndex = Number(input) - 1;
    if (Number.isInteger(directDeviceIndex) && devices[directDeviceIndex]) {
      void applyDevice(devices[directDeviceIndex]);
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold>Capacitor Chrome Preview</Text>
        <Text>URL: <Text color="cyan">{url}</Text></Text>
        <Text>Chrome remote debugging: <Text color="cyan">http://127.0.0.1:{port}</Text></Text>
        <Text>
          Profile: <Text color="gray">{profileDir} ({persistentProfile ? 'persistent' : 'temporary'})</Text>
        </Text>
      </Box>

      <Box flexDirection="column">
        <Text>
          Active device:{' '}
          <Text color="green">{activeDevice.name}</Text>
          {' '}({activeDevice.width}x{activeDevice.height} @ {activeDevice.deviceScaleFactor}x)
        </Text>
        <Text>
          Status:{' '}
          <Text color={getStatusColor(status.kind)}>{status.message}</Text>
        </Text>
      </Box>

      <Box flexDirection="column">
        <Text bold>Devices</Text>
        {devices.map((device, index) => {
          const isSelected = index === selectedIndex;
          const isActive = device.id === activeDeviceId;
          const selector = isSelected ? '>' : ' ';
          const activeMarker = isActive ? '*' : ' ';

          return (
            <Text key={device.id} color={isSelected ? 'cyan' : undefined}>
              {selector} {index + 1}. [{activeMarker}] {device.name} {device.width}x{device.height}
            </Text>
          );
        })}
      </Box>

      <Text color="gray">
        Controls: arrows select, Enter applies, 1-9 switches, r restores size, o returns to original URL, q exits.
        {isBusy ? ' Working...' : ''}
      </Text>
    </Box>
  );
}

function getStatusColor(kind: PreviewUiStatus['kind']): 'blue' | 'green' | 'yellow' | 'red' {
  switch (kind) {
    case 'ok':
      return 'green';
    case 'warning':
      return 'yellow';
    case 'error':
      return 'red';
    case 'pending':
      return 'blue';
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
