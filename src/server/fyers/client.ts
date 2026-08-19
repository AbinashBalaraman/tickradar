/**
 * FYERS API integration.
 *
 * FYERS (https://fyers.in) is an Indian broker + market data API.
 * Covers NSE, BSE, NFO (F&O), MCX, CDS with real-time and
 * historical data for Indian markets.
 *
 * Auth flow (one-time, then reuse the access token):
 *   1. POST /v2/token with client_id + secret_key + redirect_uri
 *      + auth_code → { access_token, refresh_token }
 *   2. Use access_token as Authorization header on all /v2/data/ calls
 *
 * For our use, we keep a single in-memory access token (loaded from
 * FYERS_ACCESS_TOKEN env var) and refresh it lazily if we get a
 * 401. Credentials are in .env:
 *   FYERS_CLIENT_ID, FYERS_SECRET_KEY, FYERS_REDIRECT_URI, FYERS_ACCESS_TOKEN
 *
 * Endpoints we use:
 *   POST /v2/data/history   → historical OHLCV candles
 *   POST /v2/data/quotes    → live LTP/quote for one or more symbols
 *   GET  /v2/data/symbol-master → full symbol list (NSE/BSE)
 *   GET  /v2/data/market-depth  → 5-deep bid/ask
 *
 * Symbol format: FYERS uses "NSE:SBIN-EQ", "BSE:500112-EQ", "NSE:^NSEI" (index).
 * We translate our internal "SBIN" / "^NSEI" → "NSE:SBIN-EQ" / "NSE:^NSEI".
 */

import type { Bar } from "../types.js";

export interface FyersToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface FyersCandle {
  timestamp: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const FYERS_BASE = "https://api.fyers.in/v2";
const FYERS_DATA = `${FYERS_BASE}/data`;

function readCreds() {
  return {
    clientId: process.env.FYERS_CLIENT_ID ?? "",
    secretKey: process.env.FYERS_SECRET_KEY ?? "",
    redirectUri: process.env.FYERS_REDIRECT_URI ?? "http://127.0.0.1:5001",
    accessToken: process.env.FYERS_ACCESS_TOKEN ?? "",
  };
}

let _cachedToken: FyersToken | null = null;

/** Get a valid access token. Loads from env on first call, caches
 *  for the process lifetime. Returns null if no token is configured
 *  (so the caller can fall back to sample data). */
export function getAccessToken(): string | null {
  if (_cachedToken?.accessToken) return _cachedToken.accessToken;
  const c = readCreds();
  if (!c.accessToken) return null;
  _cachedToken = { accessToken: c.accessToken };
  return c.accessToken;
}

/** Build a FYERS-formatted symbol from our internal ticker.
 *  - "SBIN"           → "NSE:SBIN-EQ"
 *  - "^NSEI"          → "NSE:^NSEI"     (index)
 *  - "^NSEBANK"       → "NSE:^NSEBANK"
 *  - Already-formatted "NSE:..." passes through.
 *
 *  isIndex=true forces the NSE: prefix + no -EQ suffix.
 *  exchange='BSE' uses the BSE: prefix. */
export function toFyersSymbol(
  ticker: string,
  opts: { isIndex?: boolean; exchange?: string } = {},
): string {
  if (ticker.includes(":")) return ticker;
  const isIdx = opts.isIndex || ticker.startsWith("^");
  const exch = opts.exchange ?? (isIdx ? "NSE" : "NSE");
  if (isIdx) {
    // Indices: NSE:^NSEI, NSE:^NSEBANK
    const sym = ticker.startsWith("^") ? ticker : `^${ticker}`;
    return `${exch}:${sym}`;
  }
  return `${exch}:${ticker}-EQ`;
}

/** Convert our internal symbol to FYERS format using the
 *  symbol record from getSymbols(). */
export function toFyersSymbolFromRecord(sym: {
  ticker: string;
  isIndex?: boolean;
  exchange?: string;
  instrumentType?: string;
}): string {
  return toFyersSymbol(sym.ticker, {
    isIndex: sym.isIndex,
    exchange: sym.exchange,
  });
}

/** Low-level: fetch FYERS with auth. */
async function fyersFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("FYERS_ACCESS_TOKEN not configured in .env");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", token);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  // 8s timeout for individual calls — FYERS API occasionally hangs
  // for 30+ seconds when the token is bad.
  return fetch(`${FYERS_DATA}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(8000),
  });
}

export interface HistoryRequest {
  symbol: string; // FYERS format
  resolution: "1" | "5" | "15" | "30" | "60" | "1D" | "1W" | "1M";
  dateFormat: "0" | "1"; // 0=epoch, 1=yyyy-mm-dd
  rangeFrom: number; // epoch seconds
  rangeTo: number; // epoch seconds
  contFlag?: "1" | "0"; // 1 = continuous (include pre/post market)
}

export interface HistoryResponse {
  s: "ok" | "error";
  code: number;
  message: string;
  candles: number[][]; // [[ts, open, high, low, close, volume], ...]
  symbol?: string;
}

/** Fetch historical OHLCV candles from FYERS.
 *  Returns an array of Bar (our internal format) sorted ascending by date. */
export async function fetchHistory(
  fyersSymbol: string,
  startDate: string, // 'yyyy-mm-dd'
  endDate: string,
  resolution: "1" | "5" | "15" | "30" | "60" | "1D" | "1W" | "1M" = "1D",
): Promise<Bar[]> {
  const rangeFrom = Math.floor(
    new Date(startDate + "T00:00:00Z").getTime() / 1000,
  );
  const rangeTo = Math.floor(new Date(endDate + "T23:59:59Z").getTime() / 1000);
  const body: HistoryRequest = {
    symbol: fyersSymbol,
    resolution,
    dateFormat: "0",
    rangeFrom,
    rangeTo,
    contFlag: "1",
  };
  const res = await fyersFetch("/history", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`FYERS /history ${res.status}: ${await res.text()}`);
  }
  const json: HistoryResponse = await res.json();
  if (json.s !== "ok") {
    throw new Error(
      `FYERS /history error: ${json.message} (code ${json.code})`,
    );
  }
  if (!Array.isArray(json.candles) || json.candles.length === 0) return [];
  // FYERS returns [ts, open, high, low, close, volume]
  return json.candles
    .map(([ts, o, h, l, c, v]) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open: Number(o),
      high: Number(h),
      low: Number(l),
      close: Number(c),
      volume: Number(v) || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface QuoteRequest {
  symbols: string[]; // FYERS format
}

export interface QuoteResponse {
  s: "ok" | "error";
  code: number;
  message: string;
  d: Array<{
    n: string; // symbol name (FYERS format)
    s: number; // symbol id
    v: {
      lp: number; // last price
      o: number; // open
      h: number; // high
      l: number; // low
      pc: number; // previous close
      v: number; // volume
      ltq: number; // last trade qty
      tt: number; // tick time (HHMM)
    };
  }>;
}

/** Fetch live quotes (last price + OHLC + volume) for one or more symbols. */
export async function fetchQuotes(
  fyersSymbols: string[],
): Promise<QuoteResponse | null> {
  if (fyersSymbols.length === 0) return null;
  const res = await fyersFetch("/quotes", {
    method: "POST",
    body: JSON.stringify({ symbols: fyersSymbols }),
  });
  if (!res.ok) return null;
  const json: QuoteResponse = await res.json();
  if (json.s !== "ok") return null;
  return json;
}

export interface SymbolMasterRecord {
  fyToken: number; // FYERS internal numeric id
  symbol: string; // e.g. "NSE:SBIN-EQ"
  name: string;
  exchange: number; // 1=NSE, 2=NFO, 3=CDS, 5=MCX, 7=BSE
  segment: number; // 1=EQ, 2=FUT, 3=OPT, 11=CAS (currency)
  instrumentType: "EQ" | "FUT" | "OPT" | "INDEX";
  expiryDate?: string; // for F&O
  strikePrice?: number;
  optionType?: "CE" | "PE";
  lotSize: number;
  tickSize: number;
  isin?: string;
  exchangeName: string; // 'NSE', 'BSE', 'MCX', 'CDS'
  segmentName: string; // 'EQ', 'FUT', 'OPT', 'CAS'
  symbolDescription: string;
}

/** Fetch the full symbol master (large — 100k+ rows).
 *  Caller should cache the result.
 *  segmentFilter: 'EQ' (cash equities), 'FUT' (futures), 'OPT' (options), 'INDEX' (indices) */
export async function fetchSymbolMaster(
  segmentFilter: "EQ" | "FUT" | "OPT" | "INDEX" = "EQ",
): Promise<SymbolMasterRecord[]> {
  const url = `${FYERS_DATA}/symbol-master?segment=${segmentFilter}`;
  const res = await fyersFetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`FYERS /symbol-master ${res.status}: ${await res.text()}`);
  }
  const json: any = await res.json();
  if (json?.s !== "ok" || !Array.isArray(json?.symbols)) {
    throw new Error(
      `FYERS /symbol-master error: ${json?.message ?? "unknown"}`,
    );
  }
  return json.symbols as SymbolMasterRecord[];
}

/** Health check: is the access token valid? Returns true if FYERS
 *  accepts our token with a simple /quotes call. Hard-capped at
 *  6s — FYERS sometimes hangs longer. */
export async function ping(): Promise<boolean> {
  if (!getAccessToken()) return false;
  try {
    const pingPromise = fyersFetch("/quotes", {
      method: "POST",
      body: JSON.stringify({ symbols: ["NSE:SBIN-EQ"] }),
    });
    const timeout = new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("FYERS ping timeout")), 6000),
    );
    const r = await Promise.race([pingPromise, timeout]);
    return r.ok;
  } catch {
    return false;
  }
}

/** Translate a list of our internal symbols to FYERS format using a
 *  symbol record. Used by the scanner and backtest to bulk-fetch. */
export function batchToFyers(
  symbols: Array<{
    ticker: string;
    isIndex?: boolean;
    exchange?: string;
    instrumentType?: string;
  }>,
): string[] {
  return symbols.map(toFyersSymbolFromRecord);
}
