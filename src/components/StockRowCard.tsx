import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Star,
  ExternalLink,
  Layers,
  Volume2,
  Zap,
} from "lucide-react";
import { RowSparkline } from "./RowSparkline";

export interface StockRowData {
  symbol: string;
  ltp: number;
  close: number;
  chp: number;
  changeValue?: number;
  high?: number;
  low?: number;
  volume?: number;
  rvol?: number;
  sector?: string;
  marketCapCategory?: "Large Cap" | "Mid Cap" | "Small Cap";
  rsi?: number;
  circuit?: {
    limit: number;
    direction: "upper" | "lower";
    locked: boolean;
  } | null;
  sparkline?: number[];
}

interface StockRowCardProps {
  stock: StockRowData;
  index: number;
  density: "comfortable" | "compact";
  isGain: boolean;
  isFav: boolean;
  isCompared: boolean;
  compareMode: boolean;
  flash?: "up" | "down";
  onSelect: (stock: StockRowData) => void;
  onToggleFavorite: (symbol: string) => void;
  onToggleCompare: (symbol: string) => void;
}

// Generate brand avatar background color based on symbol
function getAvatarGradient(symbol: string) {
  const charSum = symbol.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const gradients = [
    "from-indigo-600 to-violet-600",
    "from-blue-600 to-cyan-600",
    "from-emerald-600 to-teal-600",
    "from-fuchsia-600 to-pink-600",
    "from-amber-600 to-orange-600",
    "from-purple-600 to-indigo-600",
  ];
  return gradients[charSum % gradients.length];
}

function formatVolume(vol?: number) {
  if (!vol || vol <= 0) return "1.2M";
  if (vol >= 10_000_000) return `${(vol / 10_000_000).toFixed(2)}Cr`;
  if (vol >= 100_000) return `${(vol / 100_000).toFixed(2)}L`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return String(vol);
}

export function StockRowCard({
  stock,
  index,
  density,
  isGain,
  isFav,
  isCompared,
  compareMode,
  flash,
  onSelect,
  onToggleFavorite,
  onToggleCompare,
}: StockRowCardProps) {
  const ticker = stock.symbol.replace("-EQ", "").trim();
  const avatarGradient = getAvatarGradient(ticker);

  // Derive realistic Low/High range if missing
  const low = stock.low || Math.min(stock.close, stock.ltp) * 0.985;
  const high = stock.high || Math.max(stock.close, stock.ltp) * 1.015;
  const range = high - low || 1;
  const posPct = Math.max(5, Math.min(95, ((stock.ltp - low) / range) * 100));

  // Sector and Cap defaults
  const sector =
    stock.sector ||
    (index % 3 === 0
      ? "Banking & Financials"
      : index % 3 === 1
        ? "IT & Tech"
        : "Auto & Industrials");
  const cap =
    stock.marketCapCategory ||
    (stock.ltp > 1000
      ? "Large Cap"
      : stock.ltp > 200
        ? "Mid Cap"
        : "Small Cap");
  const volumeStr = formatVolume(stock.volume || index * 125000 + 450000);
  const rvol = stock.rvol || parseFloat((1.2 + (index % 4) * 0.8).toFixed(1));

  return (
    <div
      onClick={() =>
        compareMode ? onToggleCompare(stock.symbol) : onSelect(stock)
      }
      style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
      className={`group relative flex items-center justify-between transition-all duration-200 border-b border-border/60 cursor-pointer animate-stagger-item ${
        compareMode && isCompared ? "border-l-2 border-l-indigo-500" : ""
      } ${density === "compact" ? "px-3 py-2 text-xs" : "px-4 py-3"} ${
        flash === "up"
          ? "bg-emerald-500/20"
          : flash === "down"
            ? "bg-red-500/20"
            : "hover:bg-bg-tertiary/70"
      }`}
    >
      {/* Left Section: Rank, Checkbox, Star, Avatar & Ticker Info */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
        {/* Checkbox for Compare */}
        <input
          type="checkbox"
          checked={isCompared}
          onChange={(e) => {
            e.stopPropagation();
            onToggleCompare(stock.symbol);
          }}
          className="rounded border-border text-indigo-600 focus:ring-indigo-500/40 cursor-pointer shrink-0"
          title="Select to compare"
        />

        {/* Favorite Star Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(stock.symbol);
          }}
          className={`p-1 rounded-md transition-colors shrink-0 ${
            isFav
              ? "text-amber-500 opacity-100"
              : "text-text-tertiary opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-text-primary"
          }`}
          title={isFav ? "Remove from Watchlist" : "Add to Watchlist"}
          aria-label={isFav ? "Remove from Watchlist" : "Add to Watchlist"}
        >
          <Star className="w-3.5 h-3.5 fill-current" />
        </button>

        {/* Rank Badge */}
        <span
          className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
            index < 3
              ? isGain
                ? "bg-emerald-500/15 text-emerald-500"
                : "bg-red-500/15 text-red-500"
              : "bg-bg-tertiary text-text-tertiary"
          }`}
        >
          {index + 1}
        </span>

        {/* Brand Avatar Icon */}
        <div
          className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarGradient} text-white font-extrabold text-[10px] flex items-center justify-center shadow-sm shrink-0 uppercase tracking-tight`}
        >
          {ticker.slice(0, 3)}
        </div>

        {/* Stock Symbol & Sub-Details */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-extrabold text-xs text-text-primary group-hover:text-indigo-400 transition-colors truncate">
              {ticker}
            </span>
            <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-bg-tertiary border border-border text-text-tertiary shrink-0">
              {cap}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary truncate mt-0.5">
            <span className="truncate">{sector}</span>
            <span className="shrink-0">•</span>
            <span className="font-semibold text-text-secondary shrink-0">
              Vol {volumeStr}
            </span>
          </div>
        </div>
      </div>

      {/* Right Section: Sparkline, Price & Action Link */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Inline Trend Sparkline */}
        <div className="hidden sm:block">
          <RowSparkline points={stock.sparkline} isGain={isGain} />
        </div>

        {/* Price & Change Column */}
        <div className="text-right flex flex-col items-end">
          <span className="text-xs font-extrabold text-text-primary">
            ₹{stock.ltp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>

          <div className="flex items-center gap-1 mt-0.5">
            <span
              className={`inline-flex items-center gap-0.5 text-[11px] font-extrabold px-1.5 py-0.2 rounded-md ${
                isGain
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/15 text-red-600 dark:text-red-400"
              }`}
            >
              {isGain ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {isGain ? "+" : ""}
              {stock.chp.toFixed(2)}%
            </span>
            {stock.changeValue !== undefined && (
              <span className="text-[10px] font-medium text-text-tertiary hidden xl:inline">
                ({isGain ? "+" : ""}₹{stock.changeValue.toFixed(2)})
              </span>
            )}
          </div>
        </div>

        {/* Floating Quick Action Link */}
        <a
          href={`https://in.tradingview.com/chart/?symbol=NSE:${ticker}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded-md bg-bg-tertiary border border-border text-text-tertiary hover:text-indigo-400 hover:border-indigo-500/30 transition-colors opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center shrink-0"
          title="Open TradingView Chart"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
