"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ipcBridge_1 = require("../ipcBridge");
const router = express_1.default.Router();
router.get('/', async (req, res) => {
    try {
        const presets = await (0, ipcBridge_1.ipcRequest)(req, 'get-presets');
        res.json(presets);
    }
    catch (error) {
        console.error('Failed to get presets via IPC:', error);
        res.status(500).json({ error: 'Failed to retrieve presets' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        await (0, ipcBridge_1.ipcRequest)(req, 'update-preset', { id: req.params.id, data: req.body });
        res.json({ message: 'Preset updated successfully' });
    }
    catch (error) {
        console.error('Failed to update preset via IPC:', error);
        res.status(500).json({ error: 'Failed to update preset' });
    }
});
module.exports = router;
//# sourceMappingURL=presets.js.map