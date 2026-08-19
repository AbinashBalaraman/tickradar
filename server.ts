import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const PORT = parseInt(process.env.PORT || '3100', 10);

function handleError(res: express.Response, e: any) {
  console.error('[api]', e instanceof Error ? e.message : e);
  if (res.headersSent) return;
  if (e instanceof Error && /not found/i.test(e.message)) {
    return res.status(404).json({ error: 'Not found', details: e.message });
  }
  res.status(500).json({ error: 'Internal server error', hint: String(e?.message || e).slice(0, 200) });
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // ─── SmartAPI (Angel One) live feed ──────────────────────────────────────
  // GET /api/smartapi/live-gainers-losers
  //   query: ?limit=10&timeframe=daily&universe=all|nifty50|banknifty|fno...
  app.get('/api/smartapi/live-gainers-losers', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string || '10', 10);
      const rsi_min = parseFloat(req.query.rsi_min as string || '0');
      const rsi_max = parseFloat(req.query.rsi_max as string || '100');
      const volume_min = parseFloat(req.query.volume_min as string || '0');
      const price_min = parseFloat(req.query.price_min as string || '0');
      const price_max = parseFloat(req.query.price_max as string || '1000000');
      const timeframe = (req.query.timeframe as string || 'daily').toLowerCase();
      const universe = (req.query.universe as any || 'all').toLowerCase();
      const sort = (req.query.sort as string || 'percent').toLowerCase() as 'percent' | 'value';
      const circuit = (req.query.circuit as string || 'none').toLowerCase() as 'none' | 'upper' | 'lower';
      const symbolsRaw = req.query.symbols as string | undefined;
      const symbols = symbolsRaw ? symbolsRaw.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
      const date = req.query.date as string | undefined;
      const rvol = req.query.rvol as any;
      const gap = req.query.gap as any;

      const { startWebSocket, getTopGainersLosers } = await import('./src/server/smartapi/stream.js');

      // Ensure the feed is running before serving data
      await startWebSocket();

      const result = getTopGainersLosers(
        limit,
        {
          rsi_min: isNaN(rsi_min) ? 0 : rsi_min,
          rsi_max: isNaN(rsi_max) ? 100 : rsi_max,
          volume_min: isNaN(volume_min) ? 0 : volume_min,
          price_min: isNaN(price_min) ? 0 : price_min,
          price_max: isNaN(price_max) ? 1000000 : price_max,
          universe,
          sort,
          circuit,
          symbols,
          date,
          rvol,
          gap,
        },
        timeframe
      );
      res.json(result);
    } catch (e) {
      handleError(res, e);
    }
  });

  // GET /api/smartapi/market-breadth
  app.get('/api/smartapi/market-breadth', async (req, res) => {
    try {
      const date = req.query.date as string | undefined;
      const { startWebSocket, getMarketBreadth } = await import('./src/server/smartapi/stream.js');
      await startWebSocket();
      res.json(getMarketBreadth(date));
    } catch (e) {
      handleError(res, e);
    }
  });

  // GET /api/smartapi/fno-buildup
  app.get('/api/smartapi/fno-buildup', async (_req, res) => {
    try {
      const { startWebSocket, getFnoIntelligenceData } = await import('./src/server/smartapi/stream.js');
      await startWebSocket();
      res.json(getFnoIntelligenceData());
    } catch (e) {
      handleError(res, e);
    }
  });

  // GET /api/smartapi/screener
  app.get('/api/smartapi/screener', async (req, res) => {
    try {
      const { startWebSocket, getQuantitativeScreenerData } = await import('./src/server/smartapi/stream.js');
      await startWebSocket();
      const rsiMin = parseFloat(req.query.rsi_min as string || '0');
      const rsiMax = parseFloat(req.query.rsi_max as string || '100');
      const priceMin = parseFloat(req.query.price_min as string || '0');
      const priceMax = parseFloat(req.query.price_max as string || '1000000');
      const universe = (req.query.universe as string) || 'all';

      res.json(getQuantitativeScreenerData({ rsiMin, rsiMax, priceMin, priceMax, universe }));
    } catch (e) {
      handleError(res, e);
    }
  });

  // GET /api/smartapi/status → is Angel One configured + reachable?
  app.get('/api/smartapi/status', async (_req, res) => {
    try {
      const { getAccessToken, ping } = await import('./src/server/smartapi/client.js');
      let configured = false;
      try {
        configured = !!(await getAccessToken());
      } catch {
        configured = false;
      }
      if (!configured) {
        return res.json({
          configured: false,
          reachable: false,
          message: 'SmartAPI credentials (client code / password) not set in .env',
        });
      }
      const pingPromise = ping();
      const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 7000));
      const reachable = await Promise.race([pingPromise, timeout]);
      res.json({ configured, reachable, message: reachable ? 'SmartAPI API OK' : 'SmartAPI unreachable or auth failed' });
    } catch (e) {
      handleError(res, e);
    }
  });

  // POST /api/smartapi/sync-symbols → download + parse the Angel One Scrip Master
  app.post('/api/smartapi/sync-symbols', async (req, res) => {
    try {
      const { loadSmartApiSymbols } = await import('./src/server/smartapi/symbols.js');
      const force = Boolean(req.body?.force);
      const result = await loadSmartApiSymbols(force);
      res.json({ success: true, count: result.size, message: `Synced ${result.size} Angel One symbols.` });
    } catch (e) {
      handleError(res, e);
    }
  });

  // ─── Fyers status ────────────────────────────────────────────────────────
  app.get('/api/fyers/status', async (_req, res) => {
    try {
      const { getAccessToken, ping } = await import('./src/server/fyers/client.js');
      const configured = !!getAccessToken();
      if (!configured) {
        return res.json({ configured: false, reachable: false, message: 'FYERS_ACCESS_TOKEN not set in .env' });
      }
      const pingPromise = ping();
      const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 7000));
      const reachable = await Promise.race([pingPromise, timeout]);
      res.json({ configured, reachable, message: reachable ? 'FYERS API OK' : 'FYERS unreachable or auth failed' });
    } catch (e) {
      handleError(res, e);
    }
  });

  // GET /api/status/data-source → active feed source (ANGEL | FYERS | SAMPLE)
  app.get('/api/status/data-source', async (_req, res) => {
    const { activeLiveSource } = await import('./src/server/smartapi/stream.js');
    res.json({ source: activeLiveSource });
  });

  // ─── Final catch-all error handler ───────────────────────────────────────────
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[unhandled]', err instanceof Error ? `${err.message}\n${err.stack}` : err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'An unexpected internal server error occurred.' });
  });

  // Vite dev middleware or production static serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`▶ LiveScanner server listening on http://0.0.0.0:${PORT}`);
    try {
      const { startWebSocket } = await import('./src/server/smartapi/stream.js');
      await startWebSocket();
    } catch (err) {
      console.error('[boot] startWebSocket failed:', err);
    }
  });
}

startServer().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
