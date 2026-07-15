const DEFAULT_AUDIO_SETTINGS = Object.freeze({
    microphoneDeviceId: 'default',
    systemAudioDeviceId: null,
    systemAudioMode: 'wasapi',
});

function normalizeId(value, fallback) {
    return typeof value === 'string' && value.trim() ? value : fallback;
}

function normalizeAudioSettings(settings = {}) {
    const systemAudioMode = settings.systemAudioMode === 'chromium-default' ? 'chromium-default' : 'wasapi';
    return {
        microphoneDeviceId: normalizeId(settings.microphoneDeviceId, DEFAULT_AUDIO_SETTINGS.microphoneDeviceId),
        systemAudioDeviceId: normalizeId(settings.systemAudioDeviceId, DEFAULT_AUDIO_SETTINGS.systemAudioDeviceId),
        systemAudioMode,
    };
}

module.exports = { DEFAULT_AUDIO_SETTINGS, normalizeAudioSettings };
