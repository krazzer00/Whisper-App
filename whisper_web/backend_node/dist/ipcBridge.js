"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipcRequest = ipcRequest;
const crypto_1 = __importDefault(require("crypto"));
const events_1 = require("events");
function ipcRequest(req, channel, payload) {
    return new Promise((resolve, reject) => {
        if (!req.bridge || !(req.bridge instanceof events_1.EventEmitter) || typeof req.bridge.emit !== 'function') {
            reject(new Error('IPC bridge is not available'));
            return;
        }
        const responseChannel = `${channel}-${crypto_1.default.randomUUID()}`;
        const onResponse = (response) => {
            if (!response) {
                reject(new Error(`No response received from ${channel}`));
                return;
            }
            if (response.success) {
                resolve(response.data);
            }
            else {
                reject(new Error(response.error || `IPC request to ${channel} failed`));
            }
        };
        req.bridge.once(responseChannel, onResponse);
        try {
            req.bridge.emit('web-data-request', channel, responseChannel, payload);
        }
        catch (error) {
            req.bridge.removeAllListeners(responseChannel);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            reject(new Error(`Failed to emit IPC request: ${errorMessage}`));
        }
    });
}
exports.default = { ipcRequest };
//# sourceMappingURL=ipcBridge.js.map