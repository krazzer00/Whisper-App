function buildMicrophoneConstraints(deviceId) {
    const audio = {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
    };
    if (deviceId && deviceId !== 'default') audio.deviceId = { exact: deviceId };
    return { audio, video: false };
}

function downmixChannels(channels) {
    if (!Array.isArray(channels) || channels.length === 0) return new Float32Array();
    const length = Math.min(...channels.map(channel => channel.length));
    const output = new Float32Array(length);
    for (let sample = 0; sample < length; ++sample) {
        let sum = 0;
        for (const channel of channels) sum += channel[sample];
        output[sample] = sum / channels.length;
    }
    return output;
}

class AecReferenceQueue {
    constructor({ maxAgeUs = 200000, maxFrames = 20 } = {}) {
        this.maxAgeUs = maxAgeUs;
        this.maxFrames = maxFrames;
        this.frames = [];
    }

    push(frame) {
        if (!frame || !Number.isFinite(Number(frame.timestampUs)) || !frame.data) return;
        this.frames.push({ ...frame, timestampUs: Number(frame.timestampUs) });
        if (this.frames.length > this.maxFrames) this.frames.splice(0, this.frames.length - this.maxFrames);
    }

    closest(timestampUs) {
        let closest = null;
        let closestDelta = Infinity;
        for (const frame of this.frames) {
            const delta = Math.abs(timestampUs - frame.timestampUs);
            if (delta < closestDelta) {
                closest = frame;
                closestDelta = delta;
            }
        }
        this.frames = this.frames.filter(frame => timestampUs - frame.timestampUs <= this.maxAgeUs);
        return closest && closestDelta <= this.maxAgeUs ? closest : null;
    }

    clear() {
        this.frames = [];
    }
}

module.exports = { buildMicrophoneConstraints, downmixChannels, AecReferenceQueue };
