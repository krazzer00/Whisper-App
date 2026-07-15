const test = require('node:test');
const assert = require('node:assert/strict');

const { buildMicrophoneConstraints, downmixChannels, AecReferenceQueue } = require('../../src/ui/listen/audioCore/audioDeviceModel');

test('microphone constraints request the exact selected device', () => {
    assert.deepEqual(buildMicrophoneConstraints('mic-123'), {
        audio: {
            deviceId: { exact: 'mic-123' },
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        },
        video: false,
    });
    assert.equal(buildMicrophoneConstraints('default').audio.deviceId, undefined);
});

test('channel downmix averages every channel instead of truncating channel zero', () => {
    assert.deepEqual(Array.from(downmixChannels([
        Float32Array.from([1, 0.5]),
        Float32Array.from([-1, 0.5]),
    ])), [0, 0.5]);
});

test('AEC reference queue returns aligned data and rejects stale data', () => {
    const queue = new AecReferenceQueue({ maxAgeUs: 150000 });
    queue.push({ timestampUs: 1_000_000, data: 'old' });
    queue.push({ timestampUs: 1_100_000, data: 'aligned' });
    assert.equal(queue.closest(1_180_000).data, 'aligned');
    assert.equal(queue.closest(1_400_001), null);
});
