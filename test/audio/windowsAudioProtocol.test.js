const test = require('node:test');
const assert = require('node:assert/strict');

const { AudioFrameParser, HEADER_BYTES } = require('../../src/features/listen/audio/windowsAudioProtocol');

function makeFrame(pcm, { timestampUs = 42n, rms = 0.25 } = {}) {
    const header = Buffer.alloc(HEADER_BYTES);
    header.write('WAP1', 0, 'ascii');
    header.writeUInt32LE(pcm.length, 4);
    header.writeBigUInt64LE(timestampUs, 8);
    header.writeFloatLE(rms, 16);
    header.writeUInt32LE(16000, 20);
    header.writeUInt16LE(1, 24);
    header.writeUInt16LE(16, 26);
    return Buffer.concat([header, pcm]);
}

test('parser emits a frame split across pipe chunks', () => {
    const parser = new AudioFrameParser();
    const frame = makeFrame(Buffer.from([1, 2, 3, 4]));

    assert.deepEqual(parser.push(frame.subarray(0, 9)), []);
    const frames = parser.push(frame.subarray(9));

    assert.equal(frames.length, 1);
    assert.equal(frames[0].timestampUs, 42n);
    assert.equal(frames[0].rms, 0.25);
    assert.equal(frames[0].sampleRate, 16000);
    assert.deepEqual(frames[0].pcm, Buffer.from([1, 2, 3, 4]));
});

test('parser rejects invalid magic and oversized payloads', () => {
    const parser = new AudioFrameParser({ maxPayloadBytes: 16 });
    assert.throws(() => parser.push(Buffer.alloc(HEADER_BYTES)), /magic/i);

    const oversized = makeFrame(Buffer.alloc(32));
    assert.throws(() => new AudioFrameParser({ maxPayloadBytes: 16 }).push(oversized), /payload/i);
});
