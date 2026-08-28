import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('manual safe-area page exercises direct env values and fallback variables', async () => {
  const html = await readFile(path.join(process.cwd(), 'docs', 'manual-safe-area-test.html'), 'utf8');

  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /env\(safe-area-inset-top,\s*0px\)/);
  assert.match(html, /env\(safe-area-inset-bottom,\s*0px\)/);
  for (const edge of ['top', 'right', 'bottom', 'left']) {
    assert.match(
      html,
      new RegExp(`padding-${edge}:\\s*calc\\(16px \\+ var\\(--safe-area-inset-${edge}, env\\(safe-area-inset-${edge}, 0px\\)\\)\\)`),
    );
  }
  assert.match(html, /Direct env top/);
  assert.match(html, /Fallback variable bottom/);
});
