const test = require('node:test');
const assert = require('node:assert/strict');

const { WindowsAudioService } = require('../../src/features/listen/audio/windowsAudioService');

async function captureOneFrame(device) {
    const service = new WindowsAudioService({ healthTimeoutMs: 4000 });
    try {
        return await new Promise(async (resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`No PCM frame arrived from ${device.name}`)), 6000);
            try {
                await service.startCapture({
                    deviceId: device.id,
                    onAudio: payload => {
                        clearTimeout(timer);
                        resolve(payload);
                    },
                });
            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    } finally {
        await service.stopCapture();
    }
}

test('two independently selected WASAPI endpoints produce framed PCM heartbeat while silent', { skip: process.platform !== 'win32', timeout: 16000 }, async t => {
    const discovery = new WindowsAudioService({ healthTimeoutMs: 4000 });
    const devices = await discovery.listDevices();
    if (devices.length < 2) {
        t.skip('hardware integration requires at least two active render endpoints');
        return;
    }
    const defaultDevice = devices.find(device => device.isDefault) || devices[0];
    const secondDevice = devices.find(device => device.id !== defaultDevice.id);

    for (const device of [defaultDevice, secondDevice]) {
        const frame = await captureOneFrame(device);
        assert.equal(frame.sampleRate, 16000);
        assert.ok(Buffer.from(frame.pcmBase64, 'base64').length > 0);
    }
});
