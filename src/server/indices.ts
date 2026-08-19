/**
 * Stock Indices & Universe Definitions for Granular Filtering
 */

export const NIFTY_50_TICKERS: ReadonlySet<string> = new Set([
  "RELIANCE",
  "TCS",
  "INFY",
  "HDFCBANK",
  "ICICIBANK",
  "HINDUNILVR",
  "ITC",
  "SBIN",
  "BHARTIARTL",
  "KOTAKBANK",
  "LT",
  "AXISBANK",
  "BAJFINANCE",
  "MARUTI",
  "TITAN",
  "SUNPHARMA",
  "ULTRACEMCO",
  "NESTLEIND",
  "HCLTECH",
  "WIPRO",
  "INDUSINDBK",
  "TATAMOTORS",
  "TATASTEEL",
  "NTPC",
  "POWERGRID",
  "ONGC",
  "JSWSTEEL",
  "TECHM",
  "BAJAJFINSV",
  "ADANIENT",
  "HDFCLIFE",
  "DIVISLAB",
  "DRREDDY",
  "CIPLA",
  "APOLLOHOSP",
  "EICHERMOT",
  "BRITANNIA",
  "COALINDIA",
  "SBILIFE",
  "HEROMOTOCO",
  "GRASIM",
  "TATACONSUM",
  "BAJAJ_AUTO",
  "ADANIPORTS",
  "BPCL",
  "M_M",
  "ASIANPAINT",
  "UPL",
  "SHRIRAMFIN",
  "HINDALCO",
]);

export const NIFTY_BANK_TICKERS: ReadonlySet<string> = new Set([
  "HDFCBANK",
  "ICICIBANK",
  "KOTAKBANK",
  "AXISBANK",
  "SBIN",
  "INDUSINDBK",
  "BANKBARODA",
  "PNB",
  "AUBANK",
  "FEDERALBNK",
  "IDFCFIRSTB",
  "BANDHANBNK",
]);

export const NIFTY_IT_TICKERS: ReadonlySet<string> = new Set([
  "TCS",
  "INFY",
  "HCLTECH",
  "WIPRO",
  "TECHM",
  "LTIM",
  "PERSISTENT",
  "COFORGE",
  "MPHASIS",
  "OFSS",
]);

export const NIFTY_AUTO_TICKERS: ReadonlySet<string> = new Set([
  "TATAMOTORS",
  "MARUTI",
  "M_M",
  "BAJAJ_AUTO",
  "EICHERMOT",
  "HEROMOTOCO",
  "TVSMOTOR",
  "BHARATFORG",
  "BOSHLTD",
  "BALKRISIND",
]);

export const NIFTY_PHARMA_TICKERS: ReadonlySet<string> = new Set([
  "SUNPHARMA",
  "DIVISLAB",
  "DRREDDY",
  "CIPLA",
  "APOLLOHOSP",
  "TORNTPHARM",
  "MANKIND",
  "LUPIN",
  "ZYDUSLIFE",
  "AUROPHARMA",
]);

export const NIFTY_METAL_TICKERS: ReadonlySet<string> = new Set([
  "TATASTEEL",
  "JSWSTEEL",
  "HINDALCO",
  "JINDALSTEL",
  "VEDL",
  "COALINDIA",
  "NMDC",
  "SAIL",
  "NATIONALUM",
  "APLAPOLLO",
]);

export const FNO_TICKERS: ReadonlySet<string> = new Set([
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
  "AXISBANK",
  "BAJFINANCE",
  "MARUTI",
  "TITAN",
  "SUNPHARMA",
  "ULTRACEMCO",
  "HCLTECH",
  "WIPRO",
  "INDUSINDBK",
  "TATAMOTORS",
  "TATASTEEL",
  "NTPC",
  "POWERGRID",
  "ONGC",
  "JSWSTEEL",
  "TECHM",
  "BAJAJFINSV",
  "ADANIENT",
  "HDFCLIFE",
  "DIVISLAB",
  "DRREDDY",
  "CIPLA",
  "APOLLOHOSP",
  "EICHERMOT",
  "BRITANNIA",
  "COALINDIA",
  "SBILIFE",
  "HEROMOTOCO",
  "GRASIM",
  "TATACONSUM",
  "BAJAJ_AUTO",
  "ADANIPORTS",
  "BPCL",
  "M_M",
  "ASIANPAINT",
  "UPL",
  "SHRIRAMFIN",
  "HINDALCO",
  "BANKBARODA",
  "PNB",
  "AUBANK",
  "FEDERALBNK",
  "IDFCFIRSTB",
  "BANDHANBNK",
  "LTIM",
  "PERSISTENT",
  "COFORGE",
  "MPHASIS",
  "OFSS",
  "TVSMOTOR",
  "BHARATFORG",
  "TORNTPHARM",
  "MANKIND",
  "LUPIN",
  "ZYDUSLIFE",
  "AUROPHARMA",
  "JINDALSTEL",
  "VEDL",
  "NMDC",
  "SAIL",
  "NATIONALUM",
  "DLF",
  "GODREJPROP",
  "OBERREALTY",
  "HAL",
  "BEL",
  "CONCOR",
  "PFC",
  "RECLTD",
  "IRCTC",
  "POLYCAB",
  "DIXON",
  "VOLTAS",
  "TRENT",
  "PIDILITIND",
  "CHOLAFIN",
]);

export type UniverseType =
  | "all"
  | "nifty50"
  | "banknifty"
  | "niftyit"
  | "niftyauto"
  | "niftypharma"
  | "niftymetal"
  | "fno";

export function isSymbolInUniverse(
  symbol: string,
  universe: UniverseType = "all",
): boolean {
  if (universe === "all") return true;
  const cleanSymbol = symbol.replace("-EQ", "").trim();

  switch (universe) {
    case "nifty50":
      return NIFTY_50_TICKERS.has(cleanSymbol);
    case "banknifty":
      return NIFTY_BANK_TICKERS.has(cleanSymbol);
    case "niftyit":
      return NIFTY_IT_TICKERS.has(cleanSymbol);
    case "niftyauto":
      return NIFTY_AUTO_TICKERS.has(cleanSymbol);
    case "niftypharma":
      return NIFTY_PHARMA_TICKERS.has(cleanSymbol);
    case "niftymetal":
      return NIFTY_METAL_TICKERS.has(cleanSymbol);
    case "fno":
      return FNO_TICKERS.has(cleanSymbol);
    default:
      return true;
  }
}
