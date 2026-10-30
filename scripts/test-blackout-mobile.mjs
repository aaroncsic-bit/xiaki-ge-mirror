import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../blackout/js/mobile-preview.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../blackout/index.html', import.meta.url), 'utf8');
assert.ok(html.includes('<script src="js/mobile-preview.js?v=1"></script>'));
assert.ok(!html.includes('href="css/mobile-preview.css'), 'Desktop must not load the mobile stylesheet');
// Even a narrow desktop window or touch-enabled Windows laptop must remain untouched.
for (const navigator of [
    { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140', platform: 'Win32', maxTouchPoints: 0 },
    { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140', platform: 'Win32', maxTouchPoints: 10 },
    { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605', platform: 'MacIntel', maxTouchPoints: 0 },
    { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/140', platform: 'Linux x86_64', maxTouchPoints: 0 },
]) {
    const forbidden = new Proxy({}, { get() { assert.fail('Mobile code accessed the desktop DOM or window'); } });
    vm.runInNewContext(script, { navigator, document: forbidden, window: forbidden });
}
console.log('BLACKOUT mobile gate passed: Windows, touch Windows, macOS and Linux have no DOM/style/listener changes.');
