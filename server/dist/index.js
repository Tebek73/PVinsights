"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const schema_1 = require("./schema");
const simulate_1 = require("./simulate");
dotenv_1.default.config(); //incarca variabilele din .env in process.env
// Log unhandled promise rejections (e.g. missing await) so they appear in the terminal
process.on('unhandledRejection', (reason, promise) => {
    console.error('\n[unhandledRejection] Uncaught promise rejection:');
    console.error(reason);
    if (reason instanceof Error && reason.stack)
        console.error(reason.stack);
});
const app = (0, express_1.default)(); // creeaza aplicatia express
app.use((0, cors_1.default)()); // permite trafic cross-origin
app.use(express_1.default.json()); // parseaza corpul request-urilor ca JSON
// Request logging: log method + URL, then status code when response finishes
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} -> ${res.statusCode} (${ms}ms)`);
    });
    next();
});
app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});
const port = process.env.PORT || 3000;
app.post('/api/simulate', async (req, res) => {
    const parsed = schema_1.SimulateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
    }
    try {
        const result = await (0, simulate_1.runSimulation)(parsed.data);
        res.json(result);
    }
    catch (error) {
        console.error('\n[ERROR] /api/simulate failed:', error);
        if (error instanceof Error && error.stack)
            console.error(error.stack);
        const err = error;
        const data = err?.response?.data;
        const message = (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
            ? data.message
            : null) ??
            (typeof data === 'string' ? data : null) ??
            err?.message;
        const safeMessage = message && typeof message === 'string' && message.length < 500
            ? message
            : 'Internal server error. PVGIS may be overloaded or your inputs may be out of range. Try again in a moment.';
        res.status(502).json({ error: safeMessage });
    }
});
// Global error handler: catches any error passed to next(err) or thrown from async routes (Express 5)
app.use((err, _req, res, _next) => {
    console.error('\n[ERROR] Express error handler (uncaught route error):', err);
    if (err instanceof Error && err.stack)
        console.error(err.stack);
    res.status(500).json({ error: 'Internal server error. Check the server terminal for details.' });
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
