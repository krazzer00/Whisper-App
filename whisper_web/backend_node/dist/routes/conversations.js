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
        const sessions = await (0, ipcBridge_1.ipcRequest)(req, 'get-sessions');
        res.json(sessions);
    }
    catch (error) {
        console.error('Failed to get sessions via IPC:', error);
        res.status(500).json({ error: 'Failed to retrieve sessions' });
    }
});
router.get('/meetings', async (req, res) => {
    try {
        const sessions = await (0, ipcBridge_1.ipcRequest)(req, 'get-sessions');
        const meetings = (sessions || []).filter(s => s.session_type === 'listen');
        const limit = Math.max(1, Math.min(parseInt(req.query.limit || '10', 10), 50));
        const offset = Math.max(0, parseInt(req.query.offset || '0', 10));
        const page = meetings.slice(offset, offset + limit);
        res.json({
            items: page,
            nextOffset: offset + page.length < meetings.length ? offset + page.length : null,
            total: meetings.length,
        });
    }
    catch (error) {
        console.error('Failed to get meetings via IPC:', error);
        res.status(500).json({ error: 'Failed to retrieve meetings' });
    }
});
router.get('/questions', async (req, res) => {
    try {
        const sessions = await (0, ipcBridge_1.ipcRequest)(req, 'get-sessions');
        const questions = (sessions || []).filter(s => s.session_type === 'ask');
        const limit = Math.max(1, Math.min(parseInt(req.query.limit || '10', 10), 50));
        const offset = Math.max(0, parseInt(req.query.offset || '0', 10));
        const page = questions.slice(offset, offset + limit);
        res.json({
            items: page,
            nextOffset: offset + page.length < questions.length ? offset + page.length : null,
            total: questions.length,
        });
    }
    catch (error) {
        console.error('Failed to get questions via IPC:', error);
        res.status(500).json({ error: 'Failed to retrieve questions' });
    }
});
router.post('/', async (req, res) => {
    try {
        const result = await (0, ipcBridge_1.ipcRequest)(req, 'create-session', req.body);
        res.status(201).json({ ...result, message: 'Session created successfully' });
    }
    catch (error) {
        console.error('Failed to create session via IPC:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});
router.put('/:session_id', async (req, res) => {
    try {
        const { title } = (req.body || {});
        if (!title || typeof title !== 'string') {
            return res.status(400).json({ error: 'title is required' });
        }
        const result = await (0, ipcBridge_1.ipcRequest)(req, 'update-session-title', { id: req.params.session_id, title });
        res.json(result || { changes: 1 });
    }
    catch (error) {
        console.error(`Failed to update session title via IPC for ${req.params.session_id}:`, error);
        res.status(500).json({ error: 'Failed to update session title' });
    }
});
router.delete('/:session_id', async (req, res) => {
    try {
        await (0, ipcBridge_1.ipcRequest)(req, 'delete-session', req.params.session_id);
        res.status(200).json({ message: 'Session deleted successfully' });
    }
    catch (error) {
        console.error(`Failed to delete session via IPC for ${req.params.session_id}:`, error);
        res.status(500).json({ error: 'Failed to delete session' });
    }
});
router.get('/stats', async (req, res) => {
    try {
        const sessions = await (0, ipcBridge_1.ipcRequest)(req, 'get-sessions');
        const meetings = (sessions || []).filter(s => s.session_type === 'listen');
        const nowSec = Math.floor(Date.now() / 1000);
        const totalMeetingSeconds = meetings.reduce((sum, s) => {
            if (!s.started_at)
                return sum;
            const end = s.ended_at || nowSec;
            const dur = Math.max(0, end - s.started_at);
            return sum + dur;
        }, 0);
        const detailPromises = (sessions || []).map(s => (0, ipcBridge_1.ipcRequest)(req, 'get-session-details', s.id).catch(() => null));
        const details = await Promise.all(detailPromises);
        const totalQuestions = details.reduce((acc, d) => {
            if (!d || !Array.isArray(d.ai_messages))
                return acc;
            return acc + d.ai_messages.filter((m) => m.role === 'user').length;
        }, 0);
        res.json({ totalMeetingSeconds, totalQuestions });
    }
    catch (error) {
        console.error('Failed to get stats via IPC:', error);
        res.status(500).json({ error: 'Failed to retrieve stats' });
    }
});
router.get('/search', async (req, res) => {
    try {
        const q = (req.query.q || '').toString().trim();
        if (!q) {
            return res.json([]);
        }
        const sessions = await (0, ipcBridge_1.ipcRequest)(req, 'get-sessions');
        const needle = q.toLowerCase();
        const results = (sessions || []).filter(s => (s.title || '').toLowerCase().includes(needle));
        res.json(results);
    }
    catch (error) {
        console.error('Failed to search sessions via IPC:', error);
        res.status(500).json({ error: 'Failed to search conversations' });
    }
});
// Paginated, scoped search: supports searching by title (default) or summaries when scope=summary
router.get('/search/page', async (req, res) => {
    try {
        const scope = (req.query.scope || 'title').toString().trim().toLowerCase();
        const q = (req.query.q || '').toString().trim().toLowerCase();
        const limit = Math.max(1, Math.min(parseInt(req.query.limit || '10', 10), 50));
        const offset = Math.max(0, parseInt(req.query.offset || '0', 10));
        const sessions = await (0, ipcBridge_1.ipcRequest)(req, 'get-sessions');
        const ordered = sessions || []; // already ordered DESC by started_at from repository
        let filtered = [];
        if (scope === 'all') {
            if (!q) {
                const page = ordered.slice(offset, offset + limit);
                return res.json({
                    items: page,
                    nextOffset: offset + page.length < ordered.length ? offset + page.length : null,
                    total: ordered.length,
                });
            }
            // Filter by title for all sessions and by summary for meetings; keep original order
            const titleMatches = new Set(ordered.filter(s => (s.title || '').toLowerCase().includes(q)).map(s => s.id));
            const listenSessions = ordered.filter(s => s.session_type === 'listen');
            const detailPromises = listenSessions.map(s => (0, ipcBridge_1.ipcRequest)(req, 'get-session-details', s.id).catch(() => null));
            const details = await Promise.all(detailPromises);
            const summaryMatches = new Set();
            details.forEach((d, idx) => {
                if (!d || !d.summary)
                    return;
                const tldr = (d.summary.tldr || '').toLowerCase();
                const text = (d.summary.text || '').toLowerCase();
                if (tldr.includes(q) || text.includes(q)) {
                    summaryMatches.add(listenSessions[idx].id);
                }
            });
            filtered = ordered.filter(s => titleMatches.has(s.id) || summaryMatches.has(s.id));
            const page = filtered.slice(offset, offset + limit);
            return res.json({
                items: page,
                nextOffset: offset + page.length < filtered.length ? offset + page.length : null,
                total: filtered.length,
            });
        }
        if (scope === 'summary') {
            // If query empty, just list meetings (listen) paginated
            const listenSessions = ordered.filter(s => s.session_type === 'listen');
            if (!q) {
                const page = listenSessions.slice(offset, offset + limit);
                return res.json({
                    items: page,
                    nextOffset: offset + page.length < listenSessions.length ? offset + page.length : null,
                    total: listenSessions.length,
                });
            }
            // With query, fetch details to access summary and filter
            const detailPromises = listenSessions.map(s => (0, ipcBridge_1.ipcRequest)(req, 'get-session-details', s.id).catch(() => null));
            const details = await Promise.all(detailPromises);
            const needle = q;
            filtered = listenSessions.filter((s, idx) => {
                const d = details[idx];
                if (!d || !d.summary)
                    return false;
                const tldr = (d.summary.tldr || '').toLowerCase();
                const text = (d.summary.text || '').toLowerCase();
                return tldr.includes(needle) || text.includes(needle);
            });
        }
        else {
            // Default: title search
            if (!q) {
                return res.json({ items: [], nextOffset: null, total: 0 });
            }
            const needle = q;
            filtered = ordered.filter(s => (s.title || '').toLowerCase().includes(needle));
        }
        const page = filtered.slice(offset, offset + limit);
        res.json({
            items: page,
            nextOffset: offset + page.length < filtered.length ? offset + page.length : null,
            total: filtered.length,
        });
    }
    catch (error) {
        console.error('Failed to perform paginated search via IPC:', error);
        res.status(500).json({ error: 'Failed to search conversations (paged)' });
    }
});
router.get('/:session_id', async (req, res) => {
    try {
        const details = await (0, ipcBridge_1.ipcRequest)(req, 'get-session-details', req.params.session_id);
        if (!details) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json(details);
    }
    catch (error) {
        console.error(`Failed to get session details via IPC for ${req.params.session_id}:`, error);
        res.status(500).json({ error: 'Failed to retrieve session details' });
    }
});
module.exports = router;
//# sourceMappingURL=conversations.js.map