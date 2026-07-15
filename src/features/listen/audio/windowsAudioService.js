const { EventEmitter } = require('node:events');
const { execFile, spawn } = require('node:child_process');
const crypto = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { promisify } = require('node:util');
const { AudioFrameParser } = require('./windowsAudioProtocol');

const execFileAsync = promisify(execFile);

function buildCaptureArgs(deviceId, pipeName) {
    if (!deviceId) throw new Error('A WASAPI endpoint ID is required');
    return ['capture', '--device', deviceId, '--pipe', pipeName];
}

class RetryPolicy {
    constructor(maxRetries = 1) {
        this.maxRetries = maxRetries;
        this.endpointId = null;
        this.claimed = 0;
    }

    claim(endpointId) {
        if (this.endpointId === null) this.endpointId = endpointId;
        if (this.endpointId !== endpointId || this.claimed >= this.maxRetries) return false;
        this.claimed += 1;
        return true;
    }
}

class WindowsAudioService extends EventEmitter {
    constructor({
        spawnProcess = spawn,
        execFileProcess = execFileAsync,
        createServer = net.createServer,
        now = () => Date.now(),
        healthTimeoutMs = 3000,
        helperPath = null,
        isPackaged = null,
    } = {}) {
        super();
        this.spawnProcess = spawnProcess;
        this.execFileProcess = execFileProcess;
        this.createServer = createServer;
        this.now = now;
        this.healthTimeoutMs = healthTimeoutMs;
        this.explicitHelperPath = helperPath;
        this.isPackaged = isPackaged;
        this.child = null;
        this.server = null;
        this.healthTimer = null;
        this.lastFrameAt = 0;
        this.current = null;
        this.retryPolicy = null;
        this.stopping = false;
    }

    resolveHelperPath() {
        if (this.explicitHelperPath) return this.explicitHelperPath;
        const packaged = this.isPackaged ?? (() => {
            try { return require('electron').app?.isPackaged === true; } catch { return false; }
        })();
        if (packaged) {
            return path.join(process.resourcesPath, 'native', 'windows-audio-helper', 'whisper-audio-helper.exe');
        }
        return path.resolve(__dirname, '..', '..', '..', '..', 'native', 'windows-audio-helper', 'bin', 'whisper-audio-helper.exe');
    }

    async listDevices() {
        if (process.platform !== 'win32') return [];
        const { stdout } = await this.execFileProcess(this.resolveHelperPath(), ['list'], { windowsHide: true });
        const line = String(stdout).trim().split(/\r?\n/).find(value => value.trim().startsWith('{'));
        if (!line) throw new Error('Windows audio helper returned no device response');
        const result = JSON.parse(line);
        if (result.type === 'error') throw Object.assign(new Error(result.message), { code: result.code });
        if (result.type !== 'devices' || !Array.isArray(result.devices)) throw new Error('Invalid device response from Windows audio helper');
        return result.devices;
    }

    async startCapture({ deviceId, onAudio = () => {}, onHealth = () => {} }) {
        await this.stopCapture();
        this.stopping = false;
        this.retryPolicy = new RetryPolicy(1);
        this.current = { deviceId, onAudio, onHealth };
        await this._startProcess();
    }

    async _startProcess() {
        const { deviceId, onAudio, onHealth } = this.current;
        const pipeName = `\\\\.\\pipe\\whisper-audio-${process.pid}-${crypto.randomUUID()}`;
        const parser = new AudioFrameParser();
        this.lastFrameAt = this.now();

        this.server = this.createServer(socket => {
            socket.on('data', chunk => {
                try {
                    for (const frame of parser.push(chunk)) {
                        this.lastFrameAt = this.now();
                        const payload = {
                            pcmBase64: frame.pcm.toString('base64'),
                            timestampUs: frame.timestampUs.toString(),
                            rms: frame.rms,
                            sampleRate: frame.sampleRate,
                        };
                        onAudio(payload);
                        this._publishHealth({ state: 'capturing', rms: frame.rms, deviceId }, onHealth);
                    }
                } catch (error) {
                    this._handleFailure({ code: 'INVALID_AUDIO_FRAME', message: error.message });
                }
            });
            socket.on('error', error => this._handleFailure({ code: 'AUDIO_PIPE_FAILED', message: error.message }));
        });

        await new Promise((resolve, reject) => {
            this.server.once('error', reject);
            this.server.listen(pipeName, resolve);
        });

        this.child = this.spawnProcess(this.resolveHelperPath(), buildCaptureArgs(deviceId, pipeName), {
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdoutBuffer = '';
        this.child.stdout.on('data', chunk => {
            stdoutBuffer += chunk.toString('utf8');
            const lines = stdoutBuffer.split(/\r?\n/);
            stdoutBuffer = lines.pop();
            for (const line of lines.filter(Boolean)) {
                try {
                    const event = JSON.parse(line);
                    if (event.type === 'error') this._handleFailure(event);
                    if (event.type === 'ready') this._publishHealth({ state: 'connected', rms: 0, deviceId }, onHealth);
                } catch (error) {
                    this._handleFailure({ code: 'INVALID_HELPER_RESPONSE', message: error.message });
                }
            }
        });
        this.child.stderr.on('data', chunk => this.emit('diagnostic', chunk.toString('utf8')));
        this.child.once('error', error => this._handleFailure({ code: 'HELPER_START_FAILED', message: error.message }));
        this.child.once('exit', code => {
            if (!this.stopping && code !== 0) this._handleFailure({ code: 'HELPER_EXITED', message: `Audio helper exited with code ${code}` });
        });

        this.healthTimer = setInterval(() => {
            if (!this.stopping && this.now() - this.lastFrameAt > this.healthTimeoutMs) {
                this._handleFailure({ code: 'SYSTEM_AUDIO_TIMEOUT', message: 'No system audio frames are arriving from the selected device.' });
            }
        }, Math.min(1000, this.healthTimeoutMs));
        this.healthTimer.unref?.();
        this._publishHealth({ state: 'connecting', rms: 0, deviceId }, onHealth);
    }

    _publishHealth(health, callback = this.current?.onHealth) {
        callback?.(health);
        this.emit('health', health);
    }

    async _handleFailure(error) {
        if (this.stopping || !this.current) return;
        const current = this.current;
        this._publishHealth({ state: 'degraded', deviceId: current.deviceId, rms: 0, error }, current.onHealth);
        const retry = this.retryPolicy.claim(current.deviceId);
        await this._stopProcess();
        if (retry && !this.stopping) {
            this.current = current;
            setTimeout(() => this._startProcess().catch(nextError => this._handleFailure({ code: 'HELPER_RETRY_FAILED', message: nextError.message })), 250);
        }
    }

    async _stopProcess() {
        clearInterval(this.healthTimer);
        this.healthTimer = null;
        if (this.child && !this.child.killed) this.child.kill();
        this.child = null;
        if (this.server) await new Promise(resolve => this.server.close(resolve));
        this.server = null;
    }

    async stopCapture() {
        this.stopping = true;
        await this._stopProcess();
        this.current = null;
    }

    async retryCapture() {
        if (!this.current) throw new Error('No Windows audio capture to retry');
        const current = this.current;
        await this.startCapture(current);
    }
}

const windowsAudioService = new WindowsAudioService();

module.exports = { WindowsAudioService, RetryPolicy, buildCaptureArgs, windowsAudioService };
