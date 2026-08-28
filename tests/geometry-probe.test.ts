import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const probeRoot = path.join(process.cwd(), 'tools', 'geometry-probe');

async function probeFile(...parts: string[]): Promise<string> {
  return readFile(path.join(probeRoot, ...parts), 'utf8');
}

test('geometry probe is isolated from the publishable CLI', async () => {
  const packageJson = JSON.parse(await probeFile('package.json')) as {
    private?: boolean;
    dependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };

  assert.equal(packageJson.private, true);
  assert.equal(packageJson.dependencies?.['@capacitor/core'], '8.5.0');
  assert.equal(packageJson.dependencies?.['@capacitor/filesystem'], '^8.1.3');
  assert.equal(packageJson.dependencies?.['@capacitor/share'], '^8.0.1');
  assert.match(packageJson.scripts?.['build:ios'] ?? '', /-project ios\/App\/App\.xcodeproj/);
  assert.match(packageJson.scripts?.['build:android'] ?? '', /gradlew assembleDebug/);
});

test('geometry probe compares CSS safe areas with native geometry', async () => {
  const [html, css, app] = await Promise.all([
    probeFile('www', 'index.html'),
    probeFile('www', 'styles.css'),
    probeFile('www', 'app.js'),
  ]);

  assert.match(html, /viewport-fit=cover/);
  for (const edge of ['top', 'right', 'bottom', 'left']) {
    assert.match(css, new RegExp(`env\\(safe-area-inset-${edge}, 0px\\)`));
    assert.match(app, new RegExp(`--safe-area-inset-\\$\\{edge\\}`));
  }
  assert.match(app, /Plugins\?\.GeometryProbe/);
  assert.match(app, /schemaVersion:\s*1/);
  assert.match(app, /visualViewport/);
  assert.match(app, /navigator\.clipboard/);
});

test('geometry probe saves JSON through native storage flows', async () => {
  const [html, css, app] = await Promise.all([
    probeFile('www', 'index.html'),
    probeFile('www', 'styles.css'),
    probeFile('www', 'app.js'),
  ]);

  assert.match(html, /Save JSON/);
  assert.match(html, /Device model/);
  assert.match(html, /closes the keyboard, waits one second/i);
  assert.doesNotMatch(html, /id="notes"/);
  assert.match(css, /input,\s*\nselect\s*\{[^}]*font-size:\s*16px/s);
  assert.match(app, /Plugins\?\.Filesystem/);
  assert.match(app, /Plugins\?\.Share/);
  assert.match(app, /platform === 'android' && geometryProbe\?\.saveJson/);
  assert.match(app, /system\?\.version \|\| system\?\.release \|\| 'unknown-os'/);
  assert.match(app, /Saved to \$\{result\.location\}/);
  assert.match(app, /directory:\s*'CACHE'/);
  assert.match(app, /files:\s*\[writtenFile\.uri\]/);
  assert.match(app, /Save to Files, then Downloads/);
  assert.match(app, /browserDownload\(text, filename\)/);
  assert.match(app, /Enter the device model first/);
  assert.match(app, /setTimeout\(resolve, 1000\)/);
  assert.match(app, /Math\.abs\(viewport\.scale - 1\) > 0\.01/);
  assert.match(app, /The page is zoomed/);
  assert.match(app, /windowInsets\?\.imeVisible/);
});

test('iOS bridge measures screen, WebView, status bar, and safe areas without identifiers', async () => {
  const swift = await probeFile('ios', 'App', 'App', 'GeometryProbePlugin.swift');

  assert.match(swift, /screen\.nativeBounds/);
  assert.match(swift, /window\.safeAreaInsets/);
  assert.match(swift, /webView\.safeAreaInsets/);
  assert.match(swift, /statusBarManager\.statusBarFrame/);
  assert.doesNotMatch(swift, /identifierForVendor|advertisingIdentifier/);
});

test('Android bridge measures all relevant insets and cutout bounds without identifiers', async () => {
  const java = await probeFile(
    'android',
    'app',
    'src',
    'main',
    'java',
    'dev',
    'mikolajwilczek',
    'capacitorchromepreview',
    'geometryprobe',
    'GeometryProbePlugin.java',
  );

  for (const type of [
    'statusBars',
    'navigationBars',
    'systemBars',
    'displayCutout',
    'systemGestures',
    'mandatorySystemGestures',
    'tappableElement',
    'ime',
  ]) {
    assert.match(java, new RegExp(`WindowInsetsCompat\\.Type\\.${type}`));
  }
  assert.match(java, /cutout\.getBoundingRects\(\)/);
  assert.match(java, /getCurrentWindowMetrics\(\)/);
  assert.match(java, /MediaStore\.Downloads\.getContentUri/);
  assert.match(java, /MediaStore\.Downloads\.RELATIVE_PATH/);
  assert.match(java, /Environment\.DIRECTORY_DOWNLOADS \+ "\/Geometry Probe"/);
  assert.match(java, /getExternalFilesDir\(Environment\.DIRECTORY_DOWNLOADS\)/);
  assert.doesNotMatch(java, /WRITE_EXTERNAL_STORAGE/);
  assert.doesNotMatch(java, /ANDROID_ID|Build\.SERIAL|getSerial\(|AdvertisingId/);
});
