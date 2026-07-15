"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = require("./middleware/auth");
function createApp(eventBridge) {
    const app = (0, express_1.default)();
    const webUrl = process.env.whisper_WEB_URL || 'http://localhost:3000';
    console.log(`🔧 Backend CORS configured for: ${webUrl}`);
    app.use((0, cors_1.default)({
        origin: webUrl,
        credentials: true,
    }));
    app.use(express_1.default.json());
    app.get('/', (_req, res) => {
        res.json({ message: 'whisper API is running' });
    });
    app.use((req, _res, next) => {
        req.bridge = eventBridge;
        next();
    });
    app.use('/api', auth_1.identifyUser);
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/user', require('./routes/user'));
    app.use('/api/conversations', require('./routes/conversations'));
    app.use('/api/presets', require('./routes/presets'));
    app.get('/api/sync/status', (_req, res) => {
        res.json({
            status: 'online',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
        });
    });
    app.post('/api/desktop/set-user', (req, res) => {
        res.json({
            success: true,
            message: 'Direct IPC communication is now used. This endpoint is deprecated.',
            user: req.body,
            deprecated: true,
        });
    });
    app.get('/api/desktop/status', (_req, res) => {
        res.json({
            connected: true,
            current_user: null,
            communication_method: 'IPC',
            file_based_deprecated: true,
        });
    });
    return app;
}
module.exports = createApp;
//# sourceMappingURL=index.js.map