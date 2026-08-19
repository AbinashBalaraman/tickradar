import * as fs from "fs";
import * as path from "path";

export interface SmartApiSymbol {
  token: string;
  symbol: string;
  name: string;
  expiry?: string;
  strike?: string;
  lotsize?: string;
  instrumenttype?: string;
  exch_seg: string;
  tick_size?: string;
}

// Store scrip master in a project-local cache dir
const CACHE_DIR = path.join(process.cwd(), ".cache");
const SCRIP_MASTER_PATH = path.join(CACHE_DIR, "scrip_master.json");
const SCRIP_MASTER_URL =
  "https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json";

let _cachedMap: Map<string, SmartApiSymbol> | null = null;
let _cachedTime = 0;
const MAP_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours cache in memory

/**
 * Downloads the Scrip Master JSON file if it is missing or older than 24 hours.
 */
export async function downloadScripMaster(force = false): Promise<string> {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  const fileExists = fs.existsSync(SCRIP_MASTER_PATH);
  if (!force && fileExists) {
    const stats = fs.statSync(SCRIP_MASTER_PATH);
    const ageMs = Date.now() - stats.mtimeMs;
    if (ageMs < 24 * 60 * 60 * 1000) {
      console.log("✓ SmartAPI Scrip Master is fresh locally.");
      return SCRIP_MASTER_PATH;
    }
  }

  console.log(
    `📡 Downloading SmartAPI Scrip Master from ${SCRIP_MASTER_URL}...`,
  );
  const res = await fetch(SCRIP_MASTER_URL, {
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    throw new Error(`Failed to download Scrip Master: HTTP ${res.status}`);
  }
  const text = await res.text();
  fs.writeFileSync(SCRIP_MASTER_PATH, text, "utf-8");
  console.log(
    `✓ SmartAPI Scrip Master downloaded and saved to ${SCRIP_MASTER_PATH}`,
  );
  return SCRIP_MASTER_PATH;
}

/**
 * Loads the scrip master file and builds a lookup map in memory.
 * Key format: "EXCHANGE:TICKER" (e.g. "NSE:SBIN-EQ" or "NSE:NIFTY 50")
 */
export async function loadSmartApiSymbols(
  force = false,
): Promise<Map<string, SmartApiSymbol>> {
  if (!force && _cachedMap && Date.now() - _cachedTime < MAP_TTL_MS) {
    return _cachedMap;
  }

  const filePath = await downloadScripMaster(force);
  console.log("⌛ Parsing SmartAPI Scrip Master JSON...");
  const start = Date.now();
  const raw = fs.readFileSync(filePath, "utf-8");
  const arr: SmartApiSymbol[] = JSON.parse(raw);

  const map = new Map<string, SmartApiSymbol>();
  for (const s of arr) {
    if (!s.symbol || !s.exch_seg || !s.token) continue;
    // Map both standard formats: "NSE:SBIN-EQ"
    const key = `${s.exch_seg.toUpperCase()}:${s.symbol.toUpperCase()}`;
    map.set(key, s);
  }

  console.log(
    `✓ SmartAPI Scrip Master parsed in ${Date.now() - start}ms. Indexed ${map.size} symbols.`,
  );
  _cachedMap = map;
  _cachedTime = Date.now();
  return map;
}

/**
 * Resolves a standard ticker (e.g. "SBIN" on exchange "NSE") to its numeric token.
 */
export async function resolveTickerToToken(
  ticker: string,
  exchange = "NSE",
): Promise<string | null> {
  const t = ticker.trim().toUpperCase();
  const ex = exchange.trim().toUpperCase();

  // 1. Hardcoded standard index cases
  if (t === "^NSEI" || t === "NSEI" || t === "NIFTY" || t === "NIFTY50") {
    return "99926000"; // Nifty 50
  }
  if (t === "^NSEBANK" || t === "NSEBANK" || t === "BANKNIFTY") {
    return "99926009"; // Nifty Bank
  }

  const map = await loadSmartApiSymbols();

  // 2. Try matching direct ticker + "-EQ" for equities
  const keyEq = `${ex}:${t}-EQ`;
  const matchEq = map.get(keyEq);
  if (matchEq) return matchEq.token;

  // 3. Try matching raw ticker
  const keyRaw = `${ex}:${t}`;
  const matchRaw = map.get(keyRaw);
  if (matchRaw) return matchRaw.token;

  // 4. Case insensitive wildcard search (slow fallback)
  for (const [key, value] of map.entries()) {
    if (key.startsWith(`${ex}:`) && value.symbol.includes(t)) {
      return value.token;
    }
  }

  return null;
}
