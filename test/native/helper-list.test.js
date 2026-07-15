const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const helper = path.resolve(__dirname, '..', '..', 'native', 'windows-audio-helper', 'bin', 'whisper-audio-helper.exe');

test('native helper lists render endpoints as JSON', { skip: process.platform !== 'win32' }, async () => {
    const { stdout } = await execFileAsync(helper, ['list'], { windowsHide: true });
    const payload = JSON.parse(stdout.trim());

    assert.equal(payload.type, 'devices');
    assert.ok(Array.isArray(payload.devices));
    for (const device of payload.devices) {
        assert.equal(typeof device.id, 'string');
        assert.equal(typeof device.name, 'string');
        assert.equal(typeof device.isDefault, 'boolean');
    }
});
