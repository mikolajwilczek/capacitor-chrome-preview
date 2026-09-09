import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreviewDevices, DEFAULT_DEVICE_ID } from '../src/devices.js';
import { DEFAULT_URL, parsePreviewOptions, type ParsedPreviewCommand } from '../src/preview-core.js';

const devices = createPreviewDevices('black');

test('uses physical Galaxy A54 portrait geometry', () => {
  const gesture = devices.find((device) => device.id === 'galaxy-a54');
  const threeButton = devices.find((device) => device.id === 'galaxy-a54-3-button');

  assert.ok(gesture);
  assert.ok(threeButton);
  assert.deepEqual(
    {
      width: gesture.width,
      height: gesture.height,
      deviceScaleFactor: gesture.deviceScaleFactor,
      safeArea: gesture.safeArea,
      hardwareOverlay: gesture.hardwareOverlay,
      systemBars: gesture.systemBars,
    },
    {
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
      hardwareOverlay: { type: 'hole-punch', top: 8, diameter: 21 },
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
    },
  );
  assert.equal(threeButton.width, 384);
  assert.equal(threeButton.height, 832);
  assert.equal(threeButton.deviceScaleFactor, 2.8125);
  assert.equal(threeButton.safeArea.top, 33);
  assert.equal(threeButton.safeArea.bottom, 48);
  assert.equal(threeButton.systemBars?.statusBarHeight, 34);
  assert.equal(threeButton.systemBars?.navigationBarHeight, 48);
});

function expectRun(command: ParsedPreviewCommand): {
  url: string;
  deviceId: string;
  persistSession: boolean;
} {
  assert.equal(command.kind, 'run');
  return command.options;
}

test('uses the bundled safe-area test page and default device when no arguments are provided', () => {
  const options = expectRun(parsePreviewOptions([], devices));

  assert.deepEqual(options, {
    url: DEFAULT_URL,
    deviceId: DEFAULT_DEVICE_ID,
    persistSession: false,
  });
  assert.equal(new URL(options.url).protocol, 'file:');
  assert.match(options.url, /\/docs\/manual-safe-area-test\.html$/);
});

test('accepts a positional URL', () => {
  const options = expectRun(parsePreviewOptions(['http://localhost:3000/'], devices));

  assert.equal(options.url, 'http://localhost:3000/');
  assert.equal(options.deviceId, DEFAULT_DEVICE_ID);
});

test('accepts --url with a following value', () => {
  const options = expectRun(parsePreviewOptions(['--url', 'http://localhost:4173/'], devices));

  assert.equal(options.url, 'http://localhost:4173/');
});

test('accepts --url=value', () => {
  const options = expectRun(parsePreviewOptions(['--url=https://example.test/app'], devices));

  assert.equal(options.url, 'https://example.test/app');
});

test('accepts --device with a following value', () => {
  const options = expectRun(parsePreviewOptions(['--device', 'iphone-13'], devices));

  assert.equal(options.deviceId, 'iphone-13');
});

test('accepts --device=value', () => {
  const options = expectRun(parsePreviewOptions(['--device=galaxy-a54'], devices));

  assert.equal(options.deviceId, 'galaxy-a54');
});

test('accepts --persist-session', () => {
  const options = expectRun(parsePreviewOptions(['--persist-session'], devices));

  assert.equal(options.persistSession, true);
});

test('explicit --url takes precedence over a positional URL', () => {
  const options = expectRun(parsePreviewOptions([
    'http://localhost:3000/',
    '--url',
    'http://localhost:4200/',
  ], devices));

  assert.equal(options.url, 'http://localhost:4200/');
});

test('returns usage for --help without exiting the process', () => {
  const command = parsePreviewOptions(['--help'], devices);

  assert.equal(command.kind, 'help');
  assert.match(command.usage, /Usage: capacitor-chrome-preview/);
  assert.match(command.usage, /--persist-session/);
  assert.match(command.usage, /iphone-15-pro/);
});

test('returns usage for -h without exiting the process', () => {
  const command = parsePreviewOptions(['-h'], devices);

  assert.equal(command.kind, 'help');
  assert.match(command.usage, /Devices:/);
});

test('rejects missing --url values', () => {
  assert.throws(
    () => parsePreviewOptions(['--url'], devices),
    /Missing value for --url/,
  );
});

test('rejects missing --device values', () => {
  assert.throws(
    () => parsePreviewOptions(['--device'], devices),
    /Missing value for --device/,
  );
});

test('rejects unknown flags', () => {
  assert.throws(
    () => parsePreviewOptions(['--browser=chrome'], devices),
    /Unknown option: --browser=chrome/,
  );
});

test('rejects extra positional arguments', () => {
  assert.throws(
    () => parsePreviewOptions(['http://localhost:3000/', 'http://localhost:3001/'], devices),
    /Unexpected extra positional argument/,
  );
});

test('rejects unknown device IDs with available options', () => {
  assert.throws(
    () => parsePreviewOptions(['--device', 'pixel-fold'], devices),
    /Unknown device "pixel-fold".*iphone-15-pro.*galaxy-a54/s,
  );
});
