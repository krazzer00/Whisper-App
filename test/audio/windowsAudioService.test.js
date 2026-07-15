const test = require('node:test');
const assert = require('node:assert/strict');

const { RetryPolicy, buildCaptureArgs } = require('../../src/features/listen/audio/windowsAudioService');

test('capture arguments preserve the exact selected endpoint', () => {
    assert.deepEqual(buildCaptureArgs('{endpoint-id}', '\\\\.\\pipe\\whisper-test'), [
        'capture', '--device', '{endpoint-id}', '--pipe', '\\\\.\\pipe\\whisper-test',
    ]);
});

test('retry policy allows one retry for the same endpoint only', () => {
    const policy = new RetryPolicy(1);
    assert.equal(policy.claim('{endpoint-a}'), true);
    assert.equal(policy.claim('{endpoint-a}'), false);
    assert.equal(policy.claim('{endpoint-b}'), false);
});
