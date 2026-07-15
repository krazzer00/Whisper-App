const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

test('settings renders independent microphone and system audio controls', () => {
    const source = fs.readFileSync(path.join(root, 'src/ui/settings/SettingsView.js'), 'utf8');
    for (const text of ['Audio devices', 'Microphone', 'System audio', 'Refresh devices', 'Emergency — Windows default']) {
        assert.match(source, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.match(source, /microphoneDeviceId/);
    assert.match(source, /systemAudioDeviceId/);
    assert.match(source, /audioRms/);
});

test('listen view renders actionable degraded audio state', () => {
    const source = fs.readFileSync(path.join(root, 'src/ui/listen/ListenView.js'), 'utf8');
    assert.match(source, /audio-health/);
    assert.match(source, /Retry audio/);
    assert.match(source, /Choose another device/);
    assert.match(source, /degraded/);
});
