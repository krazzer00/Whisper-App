const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

test('preload and main bridge expose narrow Windows audio channels', () => {
    const bridge = fs.readFileSync(path.join(root, 'src/bridge/featureBridge.js'), 'utf8');
    const preload = fs.readFileSync(path.join(root, 'src/preload.js'), 'utf8');
    for (const channel of [
        'audio:list-output-devices',
        'audio:start-windows-capture',
        'audio:stop-windows-capture',
        'audio:retry-windows-capture',
        'audio:renderer-capture-error',
        'audio-health',
    ]) {
        assert.match(`${bridge}\n${preload}`, new RegExp(channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
});
