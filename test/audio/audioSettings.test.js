const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeAudioSettings } = require('../../src/features/listen/audio/audioSettings');

test('audio settings default to explicit WASAPI selection with no substituted endpoint', () => {
    assert.deepEqual(normalizeAudioSettings({}), {
        microphoneDeviceId: 'default',
        systemAudioDeviceId: null,
        systemAudioMode: 'wasapi',
    });
});

test('audio settings preserve endpoint IDs and reject unknown modes', () => {
    assert.deepEqual(normalizeAudioSettings({
        microphoneDeviceId: 'mic-1',
        systemAudioDeviceId: '{output-1}',
        systemAudioMode: 'wasapi',
    }), {
        microphoneDeviceId: 'mic-1',
        systemAudioDeviceId: '{output-1}',
        systemAudioMode: 'wasapi',
    });
    assert.equal(normalizeAudioSettings({ systemAudioMode: 'silent-fallback' }).systemAudioMode, 'wasapi');
});
