import * as crypto from "crypto";
import type { Bar } from "../types.js";

export interface SmartApiSession {
  jwtToken: string;
  refreshToken: string;
  feedToken: string;
  loggedInAt: number;
}

// ─── Interfaces for Order Management ──────────────────────────────────────────

export interface PlaceOrderRequest {
  variety: "NORMAL" | "STOPLOSS" | "AMO" | "ROBO";
  tradingsymbol: string;
  symboltoken: string;
  transactiontype: "BUY" | "SELL";
  exchange: "NSE" | "BSE" | "NFO" | "BFO" | "MCX" | "CDS";
  ordertype: "LIMIT" | "MARKET" | "STOPLOSS_LIMIT" | "STOPLOSS_MARKET";
  producttype: "DELIVERY" | "CARRYFORWARD" | "MARGIN" | "INTRADAY" | "BO";
  duration: "DAY" | "IOC";
  price: number;
  quantity: number;
  triggerprice?: number;
  squareoff?: number; // BO/ROBO target price offset
  stoploss?: number; // BO/ROBO stop loss price offset
  trailingstoploss?: number; // BO/ROBO trailing jump price
}

export interface ModifyOrderRequest extends Partial<PlaceOrderRequest> {
  orderid: string;
  variety: "NORMAL" | "STOPLOSS" | "AMO" | "ROBO";
}

export interface CancelOrderRequest {
  orderid: string;
  variety: "NORMAL" | "STOPLOSS" | "AMO" | "ROBO";
}

export interface LtpRequest {
  exchange: string;
  tradingsymbol: string;
  symboltoken: string;
}

export interface MarketDataRequest {
  mode: "LTP" | "OHLC" | "FULL";
  exchangeTokens: Record<string, string[]>; // e.g. {"NSE": ["3045", "99926000"]}
}

export interface GainerLoserRequest {
  datatype:
    "PercOILosers" | "PercOIGainers" | "PercPriceGainers" | "PercPriceLosers";
  expirytype: "NEAR" | "NEXT" | "FAR";
}

// ─── Interfaces for GTT Rules ────────────────────────────────────────────────

export interface CreateGttRuleRequest {
  tradingsymbol: string;
  symboltoken: string;
  exchange: string;
  transactiontype: "BUY" | "SELL";
  producttype: "DELIVERY" | "CARRYFORWARD" | "MARGIN" | "INTRADAY";
  price: number;
  qty: number;
  triggerprice: number;
  timeperiod: number; // Validity in days (GTT rule lifetime)
}

export interface ModifyGttRuleRequest extends Partial<CreateGttRuleRequest> {
  id: number; // GTT Rule ID to modify
}

// ─── Interfaces for Positions ────────────────────────────────────────────────

export interface ConvertPositionRequest {
  exchange: string;
  tradingsymbol: string;
  symboltoken: string;
  producttype: string;
  newproducttype: string;
  transactiontype: "BUY" | "SELL";
  quantity: number;
  type: "DAY" | "NET";
}

const SMARTAPI_BASE = "https://apiconnect.angelone.in";
const CACHE_TTL_MS = 20 * 60 * 60 * 1000; // 20 hours for JWT token

let _cachedSession: SmartApiSession | null = null;

export function readCreds() {
  // ANGEL_API_KEY is mandatory — SmartAPI rejects every authenticated
  // request without it.
  const apiKey = process.env.ANGEL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ANGEL_API_KEY is not set in .env — SmartAPI requests cannot be authenticated.",
    );
  }
  return {
    apiKey,
    clientCode: process.env.ANGEL_CLIENT_CODE?.trim() ?? "",
    password: process.env.ANGEL_PASSWORD?.trim() ?? "",
    totpSecret: process.env.ANGEL_TOTP_SECRET?.trim() ?? "",
    staticJwt: process.env.ANGEL_JWT_TOKEN?.trim() ?? "",
    localIP: "192.168.1.100",
    publicIP: "106.193.147.98",
    macAddress: "18:c0:4d:2b:80:75",
  };
}

/**
 * Decodes a Base32 string into a Buffer.
 */
function base32Decode(base32: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = base32.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  const length = clean.length;
  const buffer = Buffer.alloc(Math.floor((length * 5) / 8));
  let bits = 0;
  let value = 0;
  let index = 0;

  for (let i = 0; i < length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) {
      throw new Error(`Invalid base32 character: ${clean[i]}`);
    }
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      buffer[index++] = (value >> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return buffer;
}

/**
 * Generates a 6-digit TOTP code based on a Base32 shared secret.
 */
export function generateTOTP(secret: string): string {
  if (!secret) return "";
  try {
    const key = base32Decode(secret);
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);

    const buffer = Buffer.alloc(8);
    buffer.writeUInt32BE(0, 0); // High 32 bits
    buffer.writeUInt32BE(counter, 4); // Low 32 bits

    const hmac = crypto.createHmac("sha1", key);
    hmac.update(buffer);
    const hash = hmac.digest();

    const offset = hash[hash.length - 1] & 0xf;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, "0");
  } catch (err) {
    console.error("Error generating TOTP:", err);
    return "";
  }
}

/**
 * Performs a login with password and TOTP code.
 */
export async function login(): Promise<SmartApiSession> {
  const {
    apiKey,
    clientCode,
    password,
    totpSecret,
    localIP,
    publicIP,
    macAddress,
  } = readCreds();

  if (!clientCode || !password) {
    throw new Error("ANGEL_CLIENT_CODE or ANGEL_PASSWORD not set in .env");
  }

  const totp = totpSecret ? generateTOTP(totpSecret) : "";
  if (!totp) {
    throw new Error(
      "ANGEL_TOTP_SECRET not set in .env (or failed to generate TOTP)",
    );
  }

  const payload = {
    clientcode: clientCode,
    password: password,
    totp: totp,
  };

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-PrivateKey": apiKey,
    "X-ClientLocalIP": localIP,
    "X-ClientPublicIP": publicIP,
    "X-MACaddress": macAddress,
  };

  const url = `${SMARTAPI_BASE}/rest/auth/angelbroking/user/v1/loginByPassword`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(
      `SmartAPI Login failed with HTTP ${res.status}: ${await res.text()}`,
    );
  }

  const json: any = await res.json();
  if (!json.status || !json.data) {
    throw new Error(
      `SmartAPI Login error: ${json.message || "unknown"} (code ${json.errorcode || "none"})`,
    );
  }

  const session: SmartApiSession = {
    jwtToken: json.data.jwtToken,
    refreshToken: json.data.refreshToken,
    feedToken: json.data.feedToken,
    loggedInAt: Date.now(),
  };

  _cachedSession = session;
  return session;
}

/**
 * Returns a valid access token (JWT), logging in if necessary.
 */
export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session ? session.jwtToken : null;
}

/**
 * Returns the full active session, logging in if necessary.
 */
export async function getSession(): Promise<SmartApiSession | null> {
  const { staticJwt, clientCode } = readCreds();

  if (staticJwt && !_cachedSession) {
    // If we only have static JWT, we can't reliably build a full session
    // but we assume getAccessToken is what's mainly used for static.
    // However, for WS we need feedToken. So staticJwt alone is insufficient for WS.
  }

  if (!clientCode) return null;

  if (_cachedSession && Date.now() - _cachedSession.loggedInAt < CACHE_TTL_MS) {
    return _cachedSession;
  }

  try {
    const session = await login();
    return session;
  } catch (e: any) {
    console.error("Error logging in to SmartAPI:", e.message);
    return null;
  }
}

/**
 * Low-level authenticated fetch helper for secure endpoints.
 */
async function secureFetch(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<any> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error(
      "SmartAPI access token not configured or could not be generated",
    );
  }

  const { apiKey, localIP, publicIP, macAddress } = readCreds();
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "X-PrivateKey": apiKey,
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": localIP,
    "X-ClientPublicIP": publicIP,
    "X-MACaddress": macAddress,
  };

  const url = `${SMARTAPI_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`SmartAPI ${path} HTTP ${res.status}: ${await res.text()}`);
  }

  const json: any = await res.json();
  if (!json.status) {
    throw new Error(
      `SmartAPI ${path} error: ${json.message || "unknown"} (code ${json.errorcode || "none"})`,
    );
  }
  return json.data ?? json;
}

// ─── 1. User & Portfolio APIs ──────────────────────────────────────────────────

export async function getProfile(): Promise<any> {
  return secureFetch("/rest/secure/angelbroking/user/v1/getProfile", "GET");
}

export async function getFundsAndMargin(): Promise<any> {
  return secureFetch("/rest/secure/angelbroking/user/v1/getRMS", "GET");
}

export async function logout(): Promise<any> {
  return secureFetch("/rest/secure/angelbroking/user/v1/logout", "POST");
}

// ─── 2. Order Management APIs ─────────────────────────────────────────────────

export async function placeOrder(params: PlaceOrderRequest): Promise<any> {
  return secureFetch(
    "/rest/secure/angelbroking/order/v1/placeOrder",
    "POST",
    params,
  );
}

export async function modifyOrder(params: ModifyOrderRequest): Promise<any> {
  return secureFetch(
    "/rest/secure/angelbroking/order/v1/modifyOrder",
    "POST",
    params,
  );
}

export async function cancelOrder(params: CancelOrderRequest): Promise<any> {
  return secureFetch(
    "/rest/secure/angelbroking/order/v1/cancelOrder",
    "POST",
    params,
  );
}

export async function getOrderBook(): Promise<any> {
  return secureFetch("/rest/secure/angelbroking/order/v1/getOrderBook", "GET");
}

export async function getTradeBook(): Promise<any> {
  return secureFetch("/rest/secure/angelbroking/order/v1/getTradeBook", "GET");
}

export async function getLtpData(params: LtpRequest): Promise<any> {
  return secureFetch(
    "/rest/secure/angelbroking/order/v1/getLtpData",
    "POST",
    params,
  );
}

// ─── 3. Market Data APIs ──────────────────────────────────────────────────────

export async function getMarketData(params: MarketDataRequest): Promise<any> {
  return secureFetch(
    "/rest/secure/angelbroking/market/v1/quote/",
    "POST",
    params,
  );
}

export async function getGainerLoser(params: GainerLoserRequest): Promise<any> {
  return secureFetch(
    "/rest/secure/angelbroking/marketData/v1/gainersLosers",
    "POST",
    params,
  );
}

// ─── 4. GTT (Good Till Triggered) Rule APIs ───────────────────────────────────

export async function createGttRule(
  params: CreateGttRuleRequest,
): Promise<any> {
  return secureFetch(
    "/rest/secure/angelbroking/gtt/v1/createRule",
    "POST",
    params,
  );
}

export async function modifyGttRule(
  params: ModifyGttRuleRequest,
): Promise<any> {
  return secureFetch(
    "/rest/secure/angelbroking/gtt/v1/modifyRule",
    "POST",
    params,
  );
}

export async function cancelGttRule(params: CancelOrderRequest): Promise<any> {
  return secureFetch(
    "/rest/secure/angelbroking/gtt/v1/cancelRule",
    "POST",
    params,
  );
}

export async function getGttRuleDetails(ruleId: number): Promise<any> {
  return secureFetch(
    `/rest/secure/angelbroking/gtt/v1/ruleDetails/${ruleId}`,
    "GET",
  );
}

export async function listGttRules(params: {
  status: string[];
  page: number;
  count: number;
}): Promise<any> {
  return secureFetch(
    "/rest/secure/angelbroking/gtt/v1/listRules",
    "POST",
    params,
  );
}

// ─── 5. Portfolio & Holdings APIs ─────────────────────────────────────────────

export async function getHoldings(): Promise<any> {
  return secureFetch(
    "/rest/secure/angelbroking/portfolio/v1/getHolding",
    "GET",
  );
}

export async function getPositions(): Promise<any> {
  return secureFetch(
    "/rest/secure/angelbroking/portfolio/v1/getPosition",
    "GET",
  );
}

export async function convertPosition(
  params: ConvertPositionRequest,
): Promise<any> {
  return secureFetch(
    "/rest/secure/angelbroking/portfolio/v1/convertPosition",
    "POST",
    params,
  );
}

// ─── 6. Historical Data API ───────────────────────────────────────────────────

export interface SmartApiCandleRequest {
  exchange: string;
  symboltoken: string;
  interval: string;
  fromdate: string; // YYYY-MM-DD HH:MM
  todate: string; // YYYY-MM-DD HH:MM
}

/**
 * Fetch historical candle data from SmartAPI.
 */
export async function fetchHistory(
  exchange: string,
  symbolToken: string,
  startDate: string, // YYYY-MM-DD
  endDate: string, // YYYY-MM-DD
  resolution: string = "1D",
): Promise<Bar[]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error(
      "SmartAPI access token not configured or could not be generated",
    );
  }

  const { apiKey, localIP, publicIP, macAddress } = readCreds();

  // Map resolution to SmartAPI interval
  let interval = "ONE_DAY";
  const r = resolution.toUpperCase();
  if (r === "1" || r === "1M" || r === "ONE_MINUTE") interval = "ONE_MINUTE";
  else if (r === "3" || r === "3M" || r === "THREE_MINUTE")
    interval = "THREE_MINUTE";
  else if (r === "5" || r === "5M" || r === "FIVE_MINUTE")
    interval = "FIVE_MINUTE";
  else if (r === "10" || r === "10M" || r === "TEN_MINUTE")
    interval = "TEN_MINUTE";
  else if (r === "15" || r === "15M" || r === "FIFTEEN_MINUTE")
    interval = "FIFTEEN_MINUTE";
  else if (r === "30" || r === "30M" || r === "THIRTY_MINUTE")
    interval = "THIRTY_MINUTE";
  else if (r === "60" || r === "60M" || r === "1H" || r === "ONE_HOUR")
    interval = "ONE_HOUR";
  else interval = "ONE_DAY";

  // Format dates: from YYYY-MM-DD to YYYY-MM-DD HH:MM
  const fromdate = `${startDate} 09:00`;
  const todate = `${endDate} 15:30`;

  const payload: SmartApiCandleRequest = {
    exchange,
    symboltoken: symbolToken,
    interval,
    fromdate,
    todate,
  };

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "X-PrivateKey": apiKey,
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": localIP,
    "X-ClientPublicIP": publicIP,
    "X-MACaddress": macAddress,
  };

  const url = `${SMARTAPI_BASE}/rest/secure/angelbroking/historical/v1/getCandleData`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(
      `SmartAPI /getCandleData HTTP ${res.status}: ${await res.text()}`,
    );
  }

  const json: any = await res.json();
  if (!json.status || !Array.isArray(json.data)) {
    throw new Error(
      `SmartAPI /getCandleData error: ${json.message || "unknown"} (code ${json.errorcode || "none"})`,
    );
  }

  // SmartAPI returns arrays of: [timestamp, open, high, low, close, volume]
  // timestamp format: "2023-09-06T11:15:00"
  return json.data
    .map((c: any[]) => ({
      date: String(c[0]).slice(0, 10),
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5]) || 0,
    }))
    .sort((a: any, b: any) => a.date.localeCompare(b.date));
}

/**
 * Health check: is the access token valid and working?
 */
export async function ping(): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;
  try {
    // Try to fetch a short daily candle for SBIN-EQ (token 3045)
    const testFetch = fetchHistory(
      "NSE",
      "3045",
      "2023-09-06",
      "2023-09-06",
      "1D",
    );
    const timeout = new Promise<any>((_, reject) =>
      setTimeout(() => reject(new Error("SmartAPI ping timeout")), 6000),
    );
    await Promise.race([testFetch, timeout]);
    return true;
  } catch {
    return false;
  }
}
