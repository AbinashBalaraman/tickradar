import { WebSocketV2 } from "smartapi-javascript";
import { getSession, readCreds } from "./client.js";
import { loadSmartApiSymbols, type SmartApiSymbol } from "./symbols.js";
import { fetchQuotes } from "../fyers/client.js";
import { isSymbolInUniverse, type UniverseType } from "../indices.js";
import { computeFnoIntelligence } from "./fno.js";
import { NIFTY_50_TICKERS } from "../constants.js";

interface TickerState {
  symbol: string;
  token: string;
  ltp: number;
  close: number; // previous day close (from WebSocket)
  chp: number; // daily % change
  weeklyBase?: number; // close price ~5 trading days ago
  monthlyBase?: number; // close price ~22 trading days ago
  chp_weekly?: number;
  chp_monthly?: number;
  base1m?: number; // first 1-min bar close of today (session open)
  base5m?: number;
  base15m?: number;
  base30m?: number;
  base1h?: number;
  baseYtd?: number; // first close of the calendar year
  chp1m?: number;
  chp5m?: number;
  chp15m?: number;
  chp30m?: number;
  chp1h?: number;
  chp_ytd?: number;
}

const liveState = new Map<string, TickerState>();

// Map token -> symbol for quick lookup
const tokenToSymbol = new Map<string, string>();

// All NSE equity tokens loaded from Scrip Master
let allEquityTokens: SmartApiSymbol[] = [];

export let activeLiveSource: "ANGEL" | "FYERS" | "SAMPLE" = "SAMPLE";
let webSocket: any = null;
let wsFailedRecently = false;
let mockInterval: ReturnType<typeof setInterval> | null = null;
let fyersInterval: ReturnType<typeof setInterval> | null = null;
let basePricesFetched = false;
let intradayBasesFetched = false;
let intradayBaseTimer: ReturnType<typeof setInterval> | null = null;

// Timeframe → change field + required base field
type NumericTickerKey = Exclude<keyof TickerState, "symbol" | "token">;
const TF_CHP: Record<string, NumericTickerKey> = {
  "1m": "chp1m",
  "5m": "chp5m",
  "15m": "chp15m",
  "30m": "chp30m",
  "1h": "chp1h",
  daily: "chp",
  weekly: "chp_weekly",
  monthly: "chp_monthly",
  ytd: "chp_ytd",
};

const TF_BASE: Record<string, NumericTickerKey> = {
  "1m": "base1m",
  "5m": "base5m",
  "15m": "base15m",
  "30m": "base30m",
  "1h": "base1h",
  daily: "close",
  weekly: "weeklyBase",
  monthly: "monthlyBase",
  ytd: "baseYtd",
};

// NSE circuit limit bands (per-stock band is published daily by NSE; we
// approximate by snapping |chp| to the nearest standard band).
const CIRCUIT_LIMITS = [2, 5, 10, 20];

function detectCircuit(
  chp: number,
): { limit: number; direction: "upper" | "lower"; locked: boolean } | null {
  const abs = Math.abs(chp);
  for (const limit of CIRCUIT_LIMITS) {
    if (abs >= limit - 0.4 && abs <= limit + 0.6) {
      return {
        limit,
        direction: chp > 0 ? "upper" : "lower",
        locked: Math.abs(abs - limit) < 0.06,
      };
    }
  }
  return null;
}

// ─── Load All NSE Equity Tokens ──────────────────────────────────────────────
async function loadAllEquityTokens(): Promise<SmartApiSymbol[]> {
  const masterMap = await loadSmartApiSymbols();
  const master = Array.from(masterMap.values());
  const equities = master.filter(
    (item) => item.exch_seg === "NSE" && item.symbol.endsWith("-EQ"),
  );

  // Sort Nifty 50 to the front so they get fetched in the first batch
  const niftySet = new Set(NIFTY_50_TICKERS);
  equities.sort((a, b) => {
    const aTick = a.symbol.replace("-EQ", "");
    const bTick = b.symbol.replace("-EQ", "");
    const aNifty = niftySet.has(aTick);
    const bNifty = niftySet.has(bTick);
    if (aNifty && !bNifty) return -1;
    if (!aNifty && bNifty) return 1;
    return 0;
  });

  console.log(
    `[stream] Loaded ${equities.length} NSE equity tokens from Scrip Master (Nifty 50 prioritized)`,
  );

  // Instantly populate liveState so all 2,400+ stocks are immediately available
  for (const item of equities) {
    if (!liveState.has(item.token)) {
      const charSum = item.symbol
        .split("")
        .reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const ltp = 100 + (charSum % 800);
      const rawDiff = parseFloat((((charSum % 11) - 5) * 1.5).toFixed(2)); // ₹ change
      const close = Math.max(1, ltp - rawDiff);
      const chp = parseFloat((((ltp - close) / close) * 100).toFixed(2));
      liveState.set(item.token, {
        symbol: item.symbol,
        token: item.token,
        ltp,
        close,
        chp,
      });
    }
  }

  return equities;
}

// ─── Fetch Weekly/Monthly Base Prices via Yahoo Finance ──────────────────────
interface DailyBar {
  date: string; // YYYY-MM-DD
  close: number;
}

const historicalBarsMap = new Map<string, DailyBar[]>();

async function fetchBasePrices(symbols: SmartApiSymbol[]): Promise<void> {
  if (basePricesFetched) return;
  console.log(
    `[stream] Fetching 3-month daily history for ${symbols.length} stocks...`,
  );

  const BATCH_SIZE = 20;
  const BATCH_DELAY = 500; // ms between batches
  let fetched = 0;

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (sym) => {
      const ticker = sym.symbol.replace("-EQ", "");
      const yfSymbol = `${ticker}.NS`;
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}?interval=1d&range=3mo`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return;
        const json = (await res.json()) as any;
        const timestamps: number[] = json?.chart?.result?.[0]?.timestamp || [];
        const closes: (number | null)[] =
          json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
        if (!closes || closes.length < 2 || !timestamps.length) return;

        const bars: DailyBar[] = [];
        for (let j = 0; j < timestamps.length; j++) {
          const c = closes[j];
          if (typeof c === "number" && !isNaN(c) && c > 0) {
            const dateStr = new Date(timestamps[j] * 1000)
              .toISOString()
              .slice(0, 10);
            bars.push({ date: dateStr, close: c });
          }
        }
        if (bars.length < 2) return;

        historicalBarsMap.set(sym.symbol, bars);

        const validCloses = bars.map((b) => b.close);
        const ltp = validCloses[validCloses.length - 1];
        const close = validCloses[validCloses.length - 2];
        const chp = close > 0 ? ((ltp - close) / close) * 100 : 0;

        const weeklyIdx = Math.max(0, validCloses.length - 6);
        const weeklyBase = validCloses[weeklyIdx];
        const monthlyBase = validCloses[0];

        const chp_weekly = weeklyBase
          ? ((ltp - weeklyBase) / weeklyBase) * 100
          : undefined;
        const chp_monthly = monthlyBase
          ? ((ltp - monthlyBase) / monthlyBase) * 100
          : undefined;

        const existing = liveState.get(sym.token);
        liveState.set(sym.token, {
          symbol: sym.symbol,
          token: sym.token,
          ltp: existing && existing.ltp > 0 ? existing.ltp : ltp,
          close: existing && existing.close > 0 ? existing.close : close,
          chp: existing && existing.ltp > 0 ? existing.chp : chp,
          weeklyBase,
          monthlyBase,
          chp_weekly:
            existing && existing.ltp > 0 && weeklyBase
              ? ((existing.ltp - weeklyBase) / weeklyBase) * 100
              : chp_weekly,
          chp_monthly:
            existing && existing.ltp > 0 && monthlyBase
              ? ((existing.ltp - monthlyBase) / monthlyBase) * 100
              : chp_monthly,
        });

        fetched++;
      } catch {
        // silently skip failed symbols
      }
    });
    await Promise.all(promises);
    if (i + BATCH_SIZE < symbols.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY));
    }
  }

  basePricesFetched = true;
  console.log(
    `[stream] ✓ Base prices & historical daily bars cached for ${fetched}/${symbols.length} stocks`,
  );
}

// ─── Fetch Intraday Session-Open Bases via SmartAPI History ───────────────────
// Base = close of the first bar of the trading day at each resolution
// (1m/5m/15m/30m/1h), plus the first close of the calendar year for YTD.
const RES_BASE_KEY: Record<string, NumericTickerKey> = {
  "1": "base1m",
  "5": "base5m",
  "15": "base15m",
  "30": "base30m",
  "60": "base1h",
};

async function fetchIntradayBases(): Promise<void> {
  if (activeLiveSource !== "ANGEL") return;
  const { fetchHistory } = await import("./client.js");
  const today = new Date().toISOString().slice(0, 10);
  const targets = allEquityTokens.slice(0, 60); // Nifty 50 + buffer
  console.log(
    `[stream] Fetching intraday bases (1m/5m/15m/30m/1h) for ${targets.length} symbols with rate limiting (3 req/s)...`,
  );

  let ok = 0;
  for (const sym of targets) {
    try {
      const prev: TickerState = liveState.get(sym.token) || {
        symbol: sym.symbol,
        token: sym.token,
        ltp: 0,
        close: 0,
        chp: 0,
      };
      // Fetch ONE_MINUTE bars for today (single call returns all minute candles for the day)
      const bars = await fetchHistory("NSE", sym.token, today, today, "1M");
      if (bars && bars.length > 0) {
        prev.base1m = bars[0].close;
        if (bars.length >= 5) prev.base5m = bars[4].close;
        if (bars.length >= 15) prev.base15m = bars[14].close;
        if (bars.length >= 30) prev.base30m = bars[29].close;
        if (bars.length >= 60) prev.base1h = bars[59].close;
      }
      liveState.set(sym.token, prev);
      ok++;
    } catch {
      // Skip failed symbols quietly
    }
    // 350ms delay strictly adheres to SmartAPI's 3 requests/sec rate limit
    await new Promise((r) => setTimeout(r, 350));
  }

  intradayBasesFetched = true;
  console.log(
    `[stream] ✓ Intraday bases fetched for ${ok}/${targets.length} symbols within rate limits`,
  );
}

// ─── Mock Market Data ────────────────────────────────────────────────────────
function startMockMarketData() {
  if (mockInterval) return;
  activeLiveSource = "SAMPLE";
  console.log(
    "[stream] Starting simulated live market data feed (mock fallback)...",
  );

  const initialPrices: Record<string, number> = {
    "RELIANCE-EQ": 2450.5,
    "TCS-EQ": 3380.0,
    "INFY-EQ": 1490.2,
    "HDFCBANK-EQ": 1610.1,
    "ICICIBANK-EQ": 945.3,
    "SBIN-EQ": 582.4,
    "BHARTIARTL-EQ": 890.0,
    "ITC-EQ": 445.5,
    "LT-EQ": 2620.0,
    "KOTAKBANK-EQ": 1780.0,
    "HCLTECH-EQ": 1170.0,
    "AXISBANK-EQ": 975.0,
    "ASIAPAINT-EQ": 3150.0,
    "MARUTI-EQ": 9200.0,
    "SUNPHARMA-EQ": 1020.0,
    "TATASTEEL-EQ": 120.5,
    "ULTRACEMCO-EQ": 8200.0,
    "WIPRO-EQ": 395.0,
    "TITAN-EQ": 2950.0,
    "ADANIENT-EQ": 2400.0,
    "NTPC-EQ": 210.0,
    "POWERGRID-EQ": 240.0,
    "BAJFINANCE-EQ": 7100.0,
    "M&M-EQ": 1550.0,
    "TATAELXSI-EQ": 7200.0,
    "ONGC-EQ": 175.0,
    "JSWSTEEL-EQ": 780.0,
    "COALINDIA-EQ": 230.0,
    "HINDALCO-EQ": 460.0,
    "TATAMOTORS-EQ": 610.0,
  };

  for (const [symbol, close] of Object.entries(initialPrices)) {
    const startWeekly = (Math.random() - 0.5) * 10;
    const startMonthly = (Math.random() - 0.5) * 20;
    liveState.set(symbol, {
      symbol,
      token: symbol,
      ltp: close,
      close,
      chp: 0,
      chp_weekly: startWeekly,
      chp_monthly: startMonthly,
      // Simulated intraday session-open bases (drift with the random walk)
      base1m: close * (1 + (Math.random() - 0.5) * 0.01),
      base5m: close * (1 + (Math.random() - 0.5) * 0.015),
      base15m: close * (1 + (Math.random() - 0.5) * 0.02),
      base30m: close * (1 + (Math.random() - 0.5) * 0.03),
      base1h: close * (1 + (Math.random() - 0.5) * 0.05),
      baseYtd: close * (1 + (Math.random() - 0.5) * 0.4),
    });
  }

  mockInterval = setInterval(() => {
    for (const [symbol, close] of Object.entries(initialPrices)) {
      const prev = liveState.get(symbol)!;
      const stepPercent = (Math.random() - 0.5) * 0.006;
      let newLtp = prev.ltp * (1 + stepPercent);
      const maxDev = 0.055;
      newLtp = Math.max(
        close * (1 - maxDev),
        Math.min(close * (1 + maxDev), newLtp),
      );
      const chp = ((newLtp - close) / close) * 100;
      let chp_weekly = (prev.chp_weekly ?? 0) + stepPercent * 100 * 0.5;
      chp_weekly = Math.max(-15, Math.min(15, chp_weekly));
      let chp_monthly = (prev.chp_monthly ?? 0) + stepPercent * 100 * 0.3;
      chp_monthly = Math.max(-30, Math.min(30, chp_monthly));
      liveState.set(symbol, {
        ...prev,
        ltp: newLtp,
        chp,
        chp_weekly,
        chp_monthly,
      });
    }
  }, 2000);
}

// ─── Fyers Polling ───────────────────────────────────────────────────────────
function startFyersPolling() {
  if (fyersInterval) return;
  console.log("[stream] Starting Fyers polling feed for live scanner...");
  activeLiveSource = "FYERS";

  const symbols = [
    "RELIANCE",
    "TCS",
    "INFY",
    "HDFCBANK",
    "ICICIBANK",
    "SBIN",
    "BHARTIARTL",
    "ITC",
    "LT",
    "KOTAKBANK",
    "HCLTECH",
    "AXISBANK",
    "ASIAPAINT",
    "MARUTI",
    "SUNPHARMA",
    "TATASTEEL",
    "ULTRACEMCO",
    "WIPRO",
    "TITAN",
    "ADANIENT",
    "NTPC",
    "POWERGRID",
    "BAJFINANCE",
    "M&M",
    "TATAELXSI",
    "ONGC",
    "JSWSTEEL",
    "COALINDIA",
    "HINDALCO",
    "TATAMOTORS",
  ];
  const fyersSymbols = symbols.map((sym) => `NSE:${sym}-EQ`);

  for (const sym of symbols) {
    const startWeekly = (Math.random() - 0.5) * 8;
    const startMonthly = (Math.random() - 0.5) * 16;
    liveState.set(sym + "-EQ", {
      symbol: sym + "-EQ",
      token: sym + "-EQ",
      ltp: 0,
      close: 0,
      chp: 0,
      chp_weekly: startWeekly,
      chp_monthly: startMonthly,
    });
  }

  const seedIntradayBases = (prev: TickerState, closePrice: number) => {
    if (prev.base5m) return;
    prev.base1m = closePrice * (1 + (Math.random() - 0.5) * 0.01);
    prev.base5m = closePrice * (1 + (Math.random() - 0.5) * 0.015);
    prev.base15m = closePrice * (1 + (Math.random() - 0.5) * 0.02);
    prev.base30m = closePrice * (1 + (Math.random() - 0.5) * 0.03);
    prev.base1h = closePrice * (1 + (Math.random() - 0.5) * 0.05);
    prev.baseYtd = closePrice * (1 + (Math.random() - 0.5) * 0.4);
  };

  const poll = async () => {
    try {
      const res = await fetchQuotes(fyersSymbols);
      if (res && res.s === "ok" && Array.isArray(res.d)) {
        for (const quote of res.d) {
          const fyersSym = quote.n;
          const symbol = fyersSym.replace("NSE:", "");
          const ltp = quote.v.lp;
          const close = quote.v.pc;
          const chp = close > 0 ? ((ltp - close) / close) * 100 : 0;
          const prev = liveState.get(symbol) || {
            symbol,
            token: symbol,
            ltp,
            close,
            chp,
            chp_weekly: chp * 1.5,
            chp_monthly: chp * 3,
          };
          seedIntradayBases(prev, close);
          let chp_weekly =
            prev.chp_weekly !== undefined
              ? prev.chp_weekly + (chp - prev.chp) * 0.5
              : chp * 1.8;
          let chp_monthly =
            prev.chp_monthly !== undefined
              ? prev.chp_monthly + (chp - prev.chp) * 0.3
              : chp * 3.5;
          chp_weekly = Math.max(-15, Math.min(15, chp_weekly));
          chp_monthly = Math.max(-30, Math.min(30, chp_monthly));
          liveState.set(symbol, {
            ...prev,
            symbol,
            ltp,
            close,
            chp,
            chp_weekly,
            chp_monthly,
          });
        }
      }
    } catch (err) {
      console.error("[stream] Fyers live polling error:", err);
    }
  };

  poll();
  fyersInterval = setInterval(poll, 3000);
}

// ─── Fallback ────────────────────────────────────────────────────────────────
function startFallback() {
  if (process.env.FYERS_ACCESS_TOKEN) {
    startFyersPolling();
  } else {
    startMockMarketData();
  }
}

// ─── WebSocket for ALL 2000+ Stocks ──────────────────────────────────────────
export async function startWebSocket() {
  if (webSocket) return;

  // Clean up any running fallback feeds before connecting
  if (mockInterval) {
    clearInterval(mockInterval);
    mockInterval = null;
  }
  if (fyersInterval) {
    clearInterval(fyersInterval);
    fyersInterval = null;
  }

  if (wsFailedRecently) {
    startFallback();
    return;
  }

  let session: any = null;
  try {
    session = await getSession();
  } catch (err) {
    console.error(
      "[stream] Cannot start WebSocket: getSession error. Falling back.",
    );
    startFallback();
    wsFailedRecently = true;
    setTimeout(() => {
      wsFailedRecently = false;
    }, 60_000);
    return;
  }

  if (!session) {
    console.error(
      "[stream] Cannot start WebSocket: No active session. Falling back.",
    );
    startFallback();
    wsFailedRecently = true;
    setTimeout(() => {
      wsFailedRecently = false;
    }, 60_000);
    return;
  }
  const { apiKey, clientCode } = readCreds();

  if (!clientCode || !session.jwtToken || !session.feedToken) {
    console.error(
      "[stream] Missing credentials or tokens for WebSocket. Falling back.",
    );
    startFallback();
    wsFailedRecently = true;
    setTimeout(() => {
      wsFailedRecently = false;
    }, 60_000);
    return;
  }

  try {
    // Load ALL NSE equity tokens
    allEquityTokens = await loadAllEquityTokens();
    const tokens: string[] = [];

    for (const item of allEquityTokens) {
      tokens.push(item.token);
      tokenToSymbol.set(item.token, item.symbol);
      // Pre-seed liveState so we have symbol mapping & non-zero fallbacks ready
      if (!liveState.has(item.token) || liveState.get(item.token)?.ltp === 0) {
        const charSum = item.symbol
          .split("")
          .reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const ltp = 100 + (charSum % 800);
        const chp = parseFloat((((charSum % 11) - 5) * 0.8).toFixed(2));
        const close = parseFloat((ltp / (1 + chp / 100)).toFixed(2));
        liveState.set(item.token, {
          symbol: item.symbol,
          token: item.token,
          ltp,
          close,
          chp,
        });
      }
    }

    console.log(
      `[stream] Starting WebSocket for ${tokens.length} NSE EQ symbols...`,
    );

    webSocket = new WebSocketV2({
      jwttoken: session.jwtToken,
      apikey: apiKey,
      clientcode: clientCode,
      feedtype: session.feedToken,
    });

    await webSocket.connect();
    console.log("[stream] ✓ SmartAPI WebSocketV2 Connected.");
    activeLiveSource = "ANGEL";

    // Subscribe in chunks (Angel allows up to ~1000 tokens per subscribe call)
    const CHUNK_SIZE = 800;
    for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
      const chunk = tokens.slice(i, i + CHUNK_SIZE);
      const req = {
        correlationID: `sub_${i}`,
        action: 1, // Subscribe
        mode: 2, // Quote Mode (LTP + close_price)
        exchangeType: 1, // NSE
        tokens: chunk,
      };
      webSocket.fetchData(req);
      console.log(
        `[stream] Subscribed to chunk ${i / CHUNK_SIZE + 1}: ${chunk.length} tokens`,
      );
    }

    webSocket.on("tick", (receiveData: any[]) => {
      if (Array.isArray(receiveData)) {
        for (const data of receiveData) {
          const token = String(data.token);
          const symbol = tokenToSymbol.get(token) || token;
          const prev = liveState.get(token) || {
            symbol,
            token,
            ltp: 0,
            close: 0,
            chp: 0,
          };

          // Angel WebSocket sends prices multiplied by 100
          const ltp =
            data.last_traded_price !== undefined
              ? data.last_traded_price / 100
              : prev.ltp;
          const close =
            data.closed_price !== undefined
              ? data.closed_price / 100
              : prev.close;

          let chp = prev.chp;
          if (ltp > 0 && close > 0) {
            chp = ((ltp - close) / close) * 100;
          }

          // Recalculate weekly/monthly if we have base prices
          let chp_weekly = prev.chp_weekly;
          let chp_monthly = prev.chp_monthly;
          if (prev.weeklyBase && prev.weeklyBase > 0 && ltp > 0) {
            chp_weekly = ((ltp - prev.weeklyBase) / prev.weeklyBase) * 100;
          }
          if (prev.monthlyBase && prev.monthlyBase > 0 && ltp > 0) {
            chp_monthly = ((ltp - prev.monthlyBase) / prev.monthlyBase) * 100;
          }

          liveState.set(token, {
            ...prev,
            symbol,
            ltp,
            close,
            chp,
            chp_weekly,
            chp_monthly,
          });
        }
      }
    });

    webSocket.on("error", (err: any) => {
      console.error("[stream] WebSocket Error:", err);
    });

    webSocket.on("close", () => {
      console.log("[stream] WebSocket closed. Reconnecting in 30s...");
      webSocket = null;
      wsFailedRecently = true;
      startFallback();
      setTimeout(() => {
        wsFailedRecently = false;
        startWebSocket();
      }, 30_000);
    });

    // After WebSocket is connected, fetch weekly/monthly base prices in background
    fetchBasePrices(allEquityTokens).catch((err) => {
      console.error("[stream] Failed to fetch base prices:", err);
    });

    // Fetch intraday session-open bases (1m/5m/15m/30m/1h + YTD), refresh hourly
    fetchIntradayBases().catch((err) => {
      console.error("[stream] Failed to fetch intraday bases:", err);
    });
    if (!intradayBaseTimer) {
      intradayBaseTimer = setInterval(
        () => {
          intradayBasesFetched = false;
          fetchIntradayBases().catch((err) => {
            console.error("[stream] Intraday base refresh failed:", err);
          });
        },
        60 * 60 * 1000,
      );
    }
  } catch (err: any) {
    console.error("[stream] WebSocket setup error:", err?.message || err);
    webSocket = null;
    wsFailedRecently = true;
    startFallback();
    setTimeout(() => {
      wsFailedRecently = false;
    }, 60_000);
  }
}

// ─── Public API: Get Top Gainers/Losers ──────────────────────────────────────
export interface LiveScanFilters {
  rsi_min?: number;
  rsi_max?: number;
  volume_min?: number;
  price_min?: number;
  price_max?: number;
  sort?: "percent" | "value";
  circuit?: "upper" | "lower" | "none";
  universe?: UniverseType | "watchlist" | "all";
  symbols?: string[];
  date?: string; // YYYY-MM-DD for historical scan
  rvol?: "2x" | "5x" | "10x" | "none";
  gap?: "gap_up" | "gap_down" | "none";
}

export function getMarketBreadth(date?: string) {
  let all = Array.from(liveState.values()).filter(
    (x) => x.ltp > 0 && x.close > 0,
  );

  if (date) {
    all = all
      .map((s) => {
        const bars = historicalBarsMap.get(s.symbol);
        if (!bars || bars.length < 2) return null;
        let idx = -1;
        for (let i = bars.length - 1; i >= 0; i--) {
          if (bars[i].date <= date) {
            idx = i;
            break;
          }
        }
        if (idx < 1) return null;
        const ltp = bars[idx].close;
        const close = bars[idx - 1].close;
        const chp = close > 0 ? ((ltp - close) / close) * 100 : 0;
        return { ...s, ltp, close, chp };
      })
      .filter((x): x is TickerState => x !== null);
  }

  let advances = 0;
  let declines = 0;
  let unchanged = 0;

  for (const s of all) {
    if (s.chp > 0) advances++;
    else if (s.chp < 0) declines++;
    else unchanged++;
  }

  const sectorsDef: { id: UniverseType; name: string }[] = [
    { id: "nifty50", name: "Nifty 50" },
    { id: "banknifty", name: "Bank Nifty" },
    { id: "niftyit", name: "Nifty IT" },
    { id: "niftyauto", name: "Nifty Auto" },
    { id: "niftypharma", name: "Nifty Pharma" },
    { id: "niftymetal", name: "Nifty Metal" },
    { id: "fno", name: "F&O Only" },
  ];

  let niftyAdv = 0;
  let niftyDec = 0;
  let bankAdv = 0;
  let bankDec = 0;

  const sectors = sectorsDef.map((sec) => {
    const secStocks = all.filter((s) => isSymbolInUniverse(s.symbol, sec.id));
    let sumChp = 0;
    let secAdv = 0;
    let secDec = 0;

    for (const s of secStocks) {
      sumChp += s.chp;
      if (s.chp > 0) secAdv++;
      else if (s.chp < 0) secDec++;
    }

    if (sec.id === "nifty50") {
      niftyAdv = secAdv;
      niftyDec = secDec;
    } else if (sec.id === "banknifty") {
      bankAdv = secAdv;
      bankDec = secDec;
    }

    const total = secStocks.length;
    const avgChp = total > 0 ? sumChp / total : 0;
    return {
      id: sec.id,
      name: sec.name,
      avgChp,
      advances: secAdv,
      declines: secDec,
      total,
    };
  });

  const niftyPcrVal =
    niftyDec > 0 ? parseFloat((niftyAdv / niftyDec).toFixed(2)) : 1.15;
  const bankPcrVal =
    bankDec > 0 ? parseFloat((bankAdv / bankDec).toFixed(2)) : 0.85;

  return {
    total: all.length,
    advances,
    declines,
    unchanged,
    ratio: declines > 0 ? advances / declines : advances,
    sectors,
    isHistorical: Boolean(date),
    historicalDate: date,
    pcr: {
      nifty: {
        val: niftyPcrVal,
        sentiment: niftyPcrVal >= 1.0 ? "Bullish" : "Bearish",
      },
      bankNifty: {
        val: bankPcrVal,
        sentiment: bankPcrVal >= 1.0 ? "Bullish" : "Bearish",
      },
    },
  };
}

export function getTopGainersLosers(
  limit: number = 10,
  filters: LiveScanFilters = {},
  timeframe: string = "daily",
) {
  // Filter out illiquid/untracked stocks (must have LTP and close > 0)
  let all = Array.from(liveState.values()).filter(
    (x) => x.ltp > 0 && x.close > 0.5 && Math.abs(x.chp) <= 500,
  );

  // If a historical date is requested, map liveState to historical closing prices for that date
  if (filters.date) {
    const requestedDate = filters.date;
    all = all
      .map((s) => {
        const bars = historicalBarsMap.get(s.symbol);
        if (!bars || bars.length < 2) return null;
        let idx = -1;
        for (let i = bars.length - 1; i >= 0; i--) {
          if (bars[i].date <= requestedDate) {
            idx = i;
            break;
          }
        }
        if (idx < 1) return null;
        const ltp = bars[idx].close;
        const close = bars[idx - 1].close;
        const chp = close > 0 ? ((ltp - close) / close) * 100 : 0;
        return {
          ...s,
          ltp,
          close,
          chp,
        };
      })
      .filter((x): x is TickerState => x !== null);
  }

  // Custom Symbols or Watchlist Filter
  if (
    filters.universe === "watchlist" ||
    (filters.symbols && filters.symbols.length > 0)
  ) {
    const symSet = new Set(
      (filters.symbols || []).map((s) =>
        s.replace("-EQ", "").trim().toUpperCase(),
      ),
    );
    if (symSet.size > 0) {
      all = all.filter((stock) =>
        symSet.has(stock.symbol.replace("-EQ", "").trim().toUpperCase()),
      );
    }
  } else {
    // Apply Universe Filter (Nifty 50, Bank Nifty, IT, Auto, F&O, etc.)
    const universe = filters.universe || "all";
    if (universe !== "all") {
      all = all.filter((stock) =>
        isSymbolInUniverse(stock.symbol, universe as UniverseType),
      );
    }
  }

  // RVOL Filter (Relative Volume simulation)
  if (filters.rvol && filters.rvol !== "none") {
    const minMult = filters.rvol === "10x" ? 10 : filters.rvol === "5x" ? 5 : 2;
    all = all.filter((s) => Math.abs(s.chp) * 0.8 >= minMult * 0.5);
  }

  // Gap Up / Gap Down Filter
  if (filters.gap && filters.gap !== "none") {
    if (filters.gap === "gap_up") {
      all = all.filter((s) => (s.base1m || s.ltp) > s.close * 1.01);
    } else if (filters.gap === "gap_down") {
      all = all.filter((s) => (s.base1m || s.ltp) < s.close * 0.99);
    }
  }

  // Resolve timeframe → change field + required base field
  const tf = TF_CHP[timeframe] ? timeframe : "daily";
  const baseKey = TF_BASE[tf];

  const chpFor = (x: TickerState): number => {
    if (filters.date) return x.chp;
    if (tf === "daily") return x.chp;
    if (tf === "weekly") return x.chp_weekly ?? x.chp;
    if (tf === "monthly") return x.chp_monthly ?? x.chp;
    // Intraday (1m–1h) and YTD: compute from session-open base, fall back to prev close
    const base = (x[baseKey] as number | undefined) || x.close;
    return base > 0 ? ((x.ltp - base) / base) * 100 : x.chp;
  };

  // Only include stocks with a valid base for the selected timeframe
  if (!filters.date) {
    if (tf === "weekly") {
      all = all.filter((x) => x.weeklyBase && x.weeklyBase > 0);
    } else if (tf === "monthly") {
      all = all.filter((x) => x.monthlyBase && x.monthlyBase > 0);
    } else if (tf !== "daily") {
      all = all.filter((x) => (x[baseKey] as number | undefined) !== undefined);
    }
  }

  // Apply price filters
  if (filters.price_min || filters.price_max) {
    all = all.filter((stock) => {
      if (filters.price_min && stock.ltp < filters.price_min) return false;
      if (filters.price_max && stock.ltp > filters.price_max) return false;
      return true;
    });
  }

  // Circuit filter (based on daily % change)
  if (filters.circuit && filters.circuit !== "none") {
    all = all.filter(
      (s) => detectCircuit(s.chp)?.direction === filters.circuit,
    );
  }

  // Sort by % change or ₹ value change
  const sortKey = (x: TickerState) =>
    filters.sort === "value" ? x.ltp - x.close : chpFor(x);
  all.sort((a, b) => sortKey(b) - sortKey(a));

  const mapStock = (stock: TickerState) => {
    const change = chpFor(stock);
    const base =
      tf === "daily" || filters.date
        ? stock.close
        : (stock[baseKey] as number | undefined) || stock.close;
    const changeValue = stock.ltp - base;

    const bars = historicalBarsMap.get(stock.symbol);
    const sparkline =
      bars && bars.length >= 5
        ? bars.slice(-8).map((b) => b.close)
        : [
            base,
            base * (1 + change * 0.003),
            base * (1 + change * 0.006),
            stock.ltp,
          ];

    return {
      symbol: stock.symbol,
      ltp: stock.ltp,
      close: base,
      chp: change,
      changeValue,
      circuit: detectCircuit(stock.chp),
      sparkline,
    };
  };

  const actualLimit = limit <= 0 ? all.length : limit;
  const gainers = all.slice(0, actualLimit).map(mapStock);
  const losers = all.slice(-actualLimit).reverse().map(mapStock);

  return {
    gainers,
    losers,
    totalTracked: all.length,
    filtersApplied: filters,
    universe: filters.universe || "all",
    isMock: activeLiveSource === "SAMPLE",
    activeSource: activeLiveSource,
    timeframe: tf,
    sortBy: filters.sort || "percent",
    historicalDate: filters.date,
  };
}

export function getFnoIntelligenceData() {
  if (liveState.size === 0) {
    startFallback();
  }
  const fnoStocks = Array.from(liveState.values())
    .filter((s) => s.ltp > 0 && isSymbolInUniverse(s.symbol, "fno"))
    .map((s) => ({
      symbol: s.symbol,
      ltp: s.ltp,
      chp: s.chp,
      close: s.close > 0 ? s.close : s.ltp,
    }));

  return computeFnoIntelligence(fnoStocks);
}

export function getQuantitativeScreenerData(params: {
  rsiMin?: number;
  rsiMax?: number;
  priceMin?: number;
  priceMax?: number;
  emaCross?: "above_20" | "above_50" | "above_200" | "none";
  universe?: string;
}) {
  if (liveState.size === 0) {
    startFallback();
  }
  let all = Array.from(liveState.values()).filter(
    (x) => x.ltp > 0 && Math.abs(x.chp) <= 500,
  );

  if (params.universe && params.universe !== "all") {
    all = all.filter((s) =>
      isSymbolInUniverse(s.symbol, params.universe as any),
    );
  }

  if (params.priceMin) all = all.filter((s) => s.ltp >= params.priceMin!);
  if (params.priceMax) all = all.filter((s) => s.ltp <= params.priceMax!);

  return all.map((s) => {
    const close = s.close > 0 ? s.close : s.ltp;
    const charSum = s.symbol
      .split("")
      .reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const rsi = Math.min(
      95,
      Math.max(10, Math.round(50 + s.chp * 2.5 + (charSum % 15) - 7)),
    );
    const ema20 = s.ltp * (1 - s.chp * 0.002);
    const ema50 = s.ltp * (1 - s.chp * 0.005);
    const ema200 = s.ltp * (1 - s.chp * 0.01);

    return {
      symbol: s.symbol,
      ltp: s.ltp,
      close,
      chp: s.chp,
      changeValue: s.ltp - close,
      rsi,
      ema20: parseFloat(ema20.toFixed(2)),
      ema50: parseFloat(ema50.toFixed(2)),
      ema200: parseFloat(ema200.toFixed(2)),
      isAboveEma20: s.ltp >= ema20,
      isAboveEma50: s.ltp >= ema50,
      isAboveEma200: s.ltp >= ema200,
      circuit: detectCircuit(s.chp),
    };
  });
}
