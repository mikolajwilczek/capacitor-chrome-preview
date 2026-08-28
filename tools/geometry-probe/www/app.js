const output = document.getElementById('output');
const status = document.getElementById('status');
const timestamp = document.getElementById('timestamp');
const deviceLabel = document.getElementById('device-label');
const navigationMode = document.getElementById('navigation-mode');
const safeAreaProbe = document.getElementById('safe-area-probe');
const viewportSummary = document.getElementById('viewport-summary');
const safeAreaSummary = document.getElementById('safe-area-summary');
const nativeSummary = document.getElementById('native-summary');

let latestMeasurement;
let refreshTimer;

function number(value) {
  return Number.isFinite(value) ? value : null;
}

function rectangle(rect) {
  if (!rect) return null;

  return {
    x: number(rect.x),
    y: number(rect.y),
    width: number(rect.width),
    height: number(rect.height),
    top: number(rect.top),
    right: number(rect.right),
    bottom: number(rect.bottom),
    left: number(rect.left),
  };
}

function cssPixels(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readSafeArea() {
  const style = getComputedStyle(safeAreaProbe);

  return {
    top: cssPixels(style.paddingTop),
    right: cssPixels(style.paddingRight),
    bottom: cssPixels(style.paddingBottom),
    left: cssPixels(style.paddingLeft),
  };
}

function readInjectedVariables() {
  const style = getComputedStyle(document.documentElement);
  const result = {};

  for (const edge of ['top', 'right', 'bottom', 'left']) {
    const name = `--safe-area-inset-${edge}`;
    const raw = style.getPropertyValue(name).trim();
    result[edge] = raw ? { raw, cssPixels: cssPixels(raw) } : null;
  }

  return result;
}

function readWebGeometry() {
  const visualViewport = window.visualViewport;
  const orientation = screen.orientation;

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    devicePixelRatio: number(window.devicePixelRatio),
    window: {
      innerWidth: number(window.innerWidth),
      innerHeight: number(window.innerHeight),
      outerWidth: number(window.outerWidth),
      outerHeight: number(window.outerHeight),
      scrollX: number(window.scrollX),
      scrollY: number(window.scrollY),
    },
    documentElement: {
      clientWidth: number(document.documentElement.clientWidth),
      clientHeight: number(document.documentElement.clientHeight),
      scrollWidth: number(document.documentElement.scrollWidth),
      scrollHeight: number(document.documentElement.scrollHeight),
    },
    screen: {
      width: number(screen.width),
      height: number(screen.height),
      availWidth: number(screen.availWidth),
      availHeight: number(screen.availHeight),
      colorDepth: number(screen.colorDepth),
      pixelDepth: number(screen.pixelDepth),
      orientation: orientation ? {
        type: orientation.type,
        angle: number(orientation.angle),
      } : null,
    },
    visualViewport: visualViewport ? {
      width: number(visualViewport.width),
      height: number(visualViewport.height),
      offsetLeft: number(visualViewport.offsetLeft),
      offsetTop: number(visualViewport.offsetTop),
      pageLeft: number(visualViewport.pageLeft),
      pageTop: number(visualViewport.pageTop),
      scale: number(visualViewport.scale),
    } : null,
    cssSafeAreaPx: readSafeArea(),
    injectedSafeAreaVariables: readInjectedVariables(),
  };
}

async function readNativeGeometry() {
  const capacitor = window.Capacitor;
  const plugin = capacitor?.Plugins?.GeometryProbe;

  if (!plugin?.measure) {
    return {
      available: false,
      platform: capacitor?.getPlatform?.() ?? 'web',
      reason: 'GeometryProbe native plugin is unavailable.',
    };
  }

  try {
    return {
      available: true,
      ...await plugin.measure(),
    };
  } catch (error) {
    return {
      available: false,
      platform: capacitor?.getPlatform?.() ?? 'unknown',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function configuration() {
  return {
    deviceLabel: deviceLabel.value.trim() || null,
    navigationMode: navigationMode.value,
    notes: null,
  };
}

function saveConfiguration() {
  localStorage.setItem('geometry-probe-configuration', JSON.stringify(configuration()));
}

function restoreConfiguration() {
  try {
    const saved = JSON.parse(localStorage.getItem('geometry-probe-configuration') || '{}');
    deviceLabel.value = saved.deviceLabel || '';
    navigationMode.value = saved.navigationMode || 'not-applicable';
  } catch {
    localStorage.removeItem('geometry-probe-configuration');
  }
}

function formatSafeArea(insets) {
  if (!insets) return 'Unavailable';
  return `${insets.top ?? '?'} / ${insets.right ?? '?'} / ${insets.bottom ?? '?'} / ${insets.left ?? '?'}`;
}

function render(measurement) {
  latestMeasurement = measurement;
  output.textContent = JSON.stringify(measurement, null, 2);
  timestamp.textContent = measurement.capturedAt;
  viewportSummary.textContent = `${measurement.web.window.innerWidth} × ${measurement.web.window.innerHeight} @ ${measurement.web.devicePixelRatio}x`;
  safeAreaSummary.textContent = formatSafeArea(measurement.web.cssSafeAreaPx);
  nativeSummary.textContent = measurement.native.available
    ? `${measurement.native.platform} available`
    : measurement.native.reason;
}

async function measure(message = 'Measurement refreshed.') {
  status.textContent = 'Measuring…';
  saveConfiguration();

  const web = readWebGeometry();
  const native = await readNativeGeometry();
  const measurement = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    configuration: configuration(),
    web,
    native,
  };

  render(measurement);
  status.textContent = message;
}

function scheduleMeasure() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => void measure('Geometry changed; measurement refreshed.'), 180);
}

function viewportIsZoomed() {
  const viewport = window.visualViewport;
  if (!viewport) return false;

  return Math.abs(viewport.scale - 1) > 0.01;
}

function keyboardAppearsVisible() {
  const viewport = window.visualViewport;
  const visualViewportIsReduced = viewport
    ? viewport.width < window.innerWidth - 1 || viewport.height < window.innerHeight - 1
    : false;

  return visualViewportIsReduced || latestMeasurement.native?.windowInsets?.imeVisible === true;
}

function dismissKeyboard() {
  document.activeElement?.blur?.();
  deviceLabel.blur();
  navigationMode.blur();
}

async function prepareExport() {
  if (!deviceLabel.value.trim()) {
    status.textContent = 'Enter the device model first, for example iPhone 13.';
    deviceLabel.focus();
    return false;
  }

  dismissKeyboard();
  status.textContent = 'Closing the keyboard and refreshing…';
  await new Promise((resolve) => setTimeout(resolve, 1000));

  clearTimeout(refreshTimer);
  await measure('Measurement ready.');

  if (viewportIsZoomed()) {
    status.textContent = 'The page is zoomed. Reopen the app, then tap Save JSON again.';
    return false;
  }

  if (keyboardAppearsVisible()) {
    status.textContent = 'The keyboard is still open. Close it and tap Save JSON again.';
    return false;
  }

  return true;
}

async function copyJson() {
  if (!await prepareExport()) return;

  const text = JSON.stringify(latestMeasurement, null, 2);

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  status.textContent = 'Measurement JSON copied.';
}

function slug(value, fallback) {
  const result = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return result || fallback;
}

function measurementFilename(measurement) {
  const system = measurement.native?.system;
  const date = new Date(measurement.capturedAt);
  const capturedAt = Number.isNaN(date.getTime())
    ? String(Date.now())
    : date.toISOString().slice(0, 19).replace('T', '-').replaceAll(':', '-');

  return [
    measurement.configuration.deviceLabel || system?.model || measurement.native?.platform,
    measurement.native?.platform || 'web',
    system?.version || system?.release || 'unknown-os',
    measurement.configuration.navigationMode === 'not-applicable'
      ? 'na'
      : measurement.configuration.navigationMode,
    system?.interfaceOrientation || system?.orientation || measurement.web.screen.orientation?.type,
    capturedAt,
  ].map((part) => slug(part, 'unknown')).join('-') + '.json';
}

function browserDownload(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function saveJson() {
  if (!await prepareExport()) return;

  const text = JSON.stringify(latestMeasurement, null, 2);
  const filename = measurementFilename(latestMeasurement);
  const capacitor = window.Capacitor;
  const geometryProbe = capacitor?.Plugins?.GeometryProbe;
  const filesystem = capacitor?.Plugins?.Filesystem;
  const share = capacitor?.Plugins?.Share;
  const platform = capacitor?.getPlatform?.() ?? 'web';

  if (platform === 'android' && geometryProbe?.saveJson) {
    status.textContent = 'Saving to Downloads…';

    try {
      const result = await geometryProbe.saveJson({ filename, data: text });
      status.textContent = `Saved to ${result.location}.`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status.textContent = `Could not save the JSON: ${message}`;
    }

    return;
  }

  if (capacitor?.isNativePlatform?.() && filesystem?.writeFile && share?.share) {
    status.textContent = 'Preparing the JSON file…';

    try {
      const writtenFile = await filesystem.writeFile({
        path: filename,
        data: text,
        directory: 'CACHE',
        encoding: 'utf8',
      });

      status.textContent = 'Choose Save to Files, then Downloads.';
      await share.share({
        title: 'Geometry Probe measurement',
        files: [writtenFile.uri],
        dialogTitle: 'Save measurement JSON',
      });
      status.textContent = 'Save sheet closed.';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status.textContent = `Could not open the save sheet: ${message}`;
    }

    return;
  }

  browserDownload(text, filename);
  status.textContent = `Downloaded ${filename}.`;
}

for (const input of [deviceLabel, navigationMode]) {
  input.addEventListener('change', () => void measure('Configuration updated.'));
}

document.getElementById('copy').addEventListener('click', () => void copyJson());
document.getElementById('download').addEventListener('click', () => void saveJson());
window.addEventListener('resize', scheduleMeasure);
window.addEventListener('orientationchange', scheduleMeasure);
window.visualViewport?.addEventListener('resize', scheduleMeasure);
window.visualViewport?.addEventListener('scroll', scheduleMeasure);

restoreConfiguration();
void measure('Initial measurement complete.');
