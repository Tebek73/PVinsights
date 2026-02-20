import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { SimulateSchema } from './schema';
import { runSimulation } from './simulate';

dotenv.config(); //incarca variabilele din .env in process.env

// Log unhandled promise rejections (e.g. missing await) so they appear in the terminal
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n[unhandledRejection] Uncaught promise rejection:');
  console.error(reason);
  if (reason instanceof Error && reason.stack) console.error(reason.stack);
});

const app = express(); // creeaza aplicatia express
app.use(cors()); // permite trafic cross-origin
app.use(express.json()); // parseaza corpul request-urilor ca JSON

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
  const parsed = SimulateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.format() });
  }

  try {
    const result = await runSimulation(parsed.data);
    res.json(result);
  } catch (error: unknown) {
    console.error('\n[ERROR] /api/simulate failed:', error);
    if (error instanceof Error && error.stack) console.error(error.stack);
    const err = error as { response?: { data?: unknown }; message?: string };
    const data = err?.response?.data;
    const message =
      (data && typeof data === 'object' && 'message' in data && typeof (data as { message: unknown }).message === 'string'
        ? (data as { message: string }).message
        : null) ??
      (typeof data === 'string' ? data : null) ??
      err?.message;
    const safeMessage =
      message && typeof message === 'string' && message.length < 500
        ? message
        : 'Internal server error. PVGIS may be overloaded or your inputs may be out of range. Try again in a moment.';
    res.status(502).json({ error: safeMessage });
  }
});

// Global error handler: catches any error passed to next(err) or thrown from async routes (Express 5)
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('\n[ERROR] Express error handler (uncaught route error):', err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  res.status(500).json({ error: 'Internal server error. Check the server terminal for details.' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});