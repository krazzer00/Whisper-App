const HEADER_BYTES = 28;

class AudioFrameParser {
    constructor({ maxPayloadBytes = 1024 * 1024 } = {}) {
        this.maxPayloadBytes = maxPayloadBytes;
        this.buffer = Buffer.alloc(0);
    }

    push(chunk) {
        if (!Buffer.isBuffer(chunk)) chunk = Buffer.from(chunk);
        this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
        const frames = [];

        while (this.buffer.length >= HEADER_BYTES) {
            if (this.buffer.toString('ascii', 0, 4) !== 'WAP1') {
                this.buffer = Buffer.alloc(0);
                throw new Error('Invalid Windows audio frame magic');
            }
            const payloadBytes = this.buffer.readUInt32LE(4);
            if (payloadBytes > this.maxPayloadBytes) {
                this.buffer = Buffer.alloc(0);
                throw new Error(`Windows audio frame payload exceeds ${this.maxPayloadBytes} bytes`);
            }
            if (this.buffer.length < HEADER_BYTES + payloadBytes) break;

            frames.push({
                timestampUs: this.buffer.readBigUInt64LE(8),
                rms: this.buffer.readFloatLE(16),
                sampleRate: this.buffer.readUInt32LE(20),
                channels: this.buffer.readUInt16LE(24),
                bitsPerSample: this.buffer.readUInt16LE(26),
                pcm: Buffer.from(this.buffer.subarray(HEADER_BYTES, HEADER_BYTES + payloadBytes)),
            });
            this.buffer = this.buffer.subarray(HEADER_BYTES + payloadBytes);
        }
        return frames;
    }
}

module.exports = { AudioFrameParser, HEADER_BYTES };
