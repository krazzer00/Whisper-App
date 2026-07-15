"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ipcBridge_1 = require("../ipcBridge");
const router = express_1.default.Router();
router.get('/status', async (req, res) => {
    try {
        const user = await (0, ipcBridge_1.ipcRequest)(req, 'get-user-profile');
        if (!user) {
            return res.status(500).json({ error: 'Default user not initialized' });
        }
        res.json({
            authenticated: true,
            user: {
                id: user.uid,
                name: user.display_name,
            },
        });
    }
    catch (error) {
        console.error('Failed to get auth status via IPC:', error);
        res.status(500).json({ error: 'Failed to retrieve auth status' });
    }
});
module.exports = router;
//# sourceMappingURL=auth.js.map