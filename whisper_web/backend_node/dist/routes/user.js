"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ipcBridge_1 = require("../ipcBridge");
const router = express_1.default.Router();
router.put('/profile', async (req, res) => {
    try {
        await (0, ipcBridge_1.ipcRequest)(req, 'update-user-profile', req.body);
        res.json({ message: 'Profile updated successfully' });
    }
    catch (error) {
        console.error('Failed to update profile via IPC:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});
router.get('/profile', async (req, res) => {
    try {
        console.log('[API] /profile request - req.uid:', req.uid);
        console.log('[API] /profile request - Headers:', {
            'X-User-ID': req.get('X-User-ID'),
            'User-Agent': req.get('User-Agent'),
        });
        const user = await (0, ipcBridge_1.ipcRequest)(req, 'get-user-profile');
        console.log('[API] /profile IPC response:', user);
        if (!user) {
            console.log('[API] /profile - User not found in database');
            console.log('[API] /profile - This might mean:');
            console.log('[API] /profile - 1. AuthService is not authenticated');
            console.log('[API] /profile - 2. User does not exist in SQLite database');
            console.log('[API] /profile - 3. getCurrentUserId() returned wrong ID');
            return res.status(404).json({
                error: 'User not found',
                details: 'User profile not found in local database. Authentication may be required.',
            });
        }
        console.log('[API] /profile - Returning user data:', user);
        res.json(user);
    }
    catch (error) {
        console.error('Failed to get profile via IPC:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            error: 'Failed to get profile',
            details: errorMessage,
            ipcError: true,
        });
    }
});
router.post('/find-or-create', async (req, res) => {
    try {
        console.log('[API] find-or-create request received:', req.body);
        const body = req.body;
        if (!body || !body.uid) {
            return res.status(400).json({ error: 'User data with uid is required' });
        }
        const user = await (0, ipcBridge_1.ipcRequest)(req, 'find-or-create-user', req.body);
        console.log('[API] find-or-create response:', user);
        res.status(200).json(user);
    }
    catch (error) {
        console.error('Failed to find or create user via IPC:', error);
        console.error('Request body:', req.body);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            error: 'Failed to find or create user',
            details: errorMessage,
        });
    }
});
router.delete('/profile', async (req, res) => {
    try {
        await (0, ipcBridge_1.ipcRequest)(req, 'delete-account');
        res.status(200).json({ message: 'User account and all data deleted successfully.' });
    }
    catch (error) {
        console.error('Failed to delete user account via IPC:', error);
        res.status(500).json({ error: 'Failed to delete user account' });
    }
});
router.get('/batch', async (req, res) => {
    try {
        const query = req.query;
        const result = await (0, ipcBridge_1.ipcRequest)(req, 'get-batch-data', query.include);
        res.json(result);
    }
    catch (error) {
        console.error('Failed to get batch data via IPC:', error);
        res.status(500).json({ error: 'Failed to get batch data' });
    }
});
module.exports = router;
//# sourceMappingURL=user.js.map