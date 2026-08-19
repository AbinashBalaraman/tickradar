import { useEffect, useId } from "react";
import {
  X,
  ExternalLink,
  Star,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  BarChart2,
} from "lucide-react";

interface StockDetailModalProps {
  stock: {
    symbol: string;
    ltp: number;
    close: number;
    chp: number;
    changeValue?: number;
    circuit?: {
      limit: number;
      direction: "upper" | "lower";
      locked: boolean;
    } | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (symbol: string) => void;
}

export function StockDetailModal({
  stock,
  isOpen,
  onClose,
  isFavorite,
  onToggleFavorite,
}: StockDetailModalProps) {
  const chartGradientId = useId();

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !stock) return null;

  const ticker = stock.symbol.replace("-EQ", "").trim();
  const isGain = stock.chp >= 0;

  // Generate synthetic chart data points based on LTP and Close for visual representation
  const generateChartPoints = () => {
    const points: number[] = [];
    const count = 20;
    const startPrice = stock.close;
    const endPrice = stock.ltp;

    for (let i = 0; i < count; i++) {
      const progress = i / (count - 1);
      const linearVal = startPrice + (endPrice - startPrice) * progress;
      const noise =
        Math.sin(i * 1.5) *
        Math.cos(i * 0.8) *
        Math.abs(endPrice - startPrice || 10) *
        0.3;
      points.push(Math.max(1, linearVal + noise));
    }
    points[points.length - 1] = endPrice;
    return points;
  };

  const points = generateChartPoints();
  const minP = Math.min(...points);
  const maxP = Math.max(...points);
  const rangeP = maxP - minP || 1;

  const svgWidth = 400;
  const svgHeight = 160;
  const polyPoints = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * svgWidth;
      const y = svgHeight - ((p - minP) / rangeP) * (svgHeight - 20) - 10;
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `0,${svgHeight} ${polyPoints} ${svgWidth},${svgHeight}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl h-full bg-bg-primary border-l border-border shadow-2xl flex flex-col overflow-y-auto animate-slide-left transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-bg-primary/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onToggleFavorite(stock.symbol)}
              className={`p-2 rounded-xl border transition-all ${
                isFavorite
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-500"
                  : "bg-bg-tertiary border-border text-text-tertiary hover:text-text-primary"
              }`}
              title={isFavorite ? "Remove from Watchlist" : "Add to Watchlist"}
            >
              <Star className="w-5 h-5 fill-current" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight text-text-primary">
                  {ticker}
                </h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-bg-tertiary border border-border text-text-tertiary">
                  NSE EQ
                </span>
              </div>
              <p className="text-xs text-text-tertiary font-medium">
                Spot Quote & Technical Overview
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-bg-tertiary border border-border text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1">
          {/* Price Banner */}
          <div className="surface rounded-2xl p-5 flex items-center justify-between border border-border">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                Last Traded Price
              </span>
              <div className="text-3xl font-extrabold tracking-tight text-text-primary mt-1">
                ₹
                {stock.ltp.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="text-right">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-sm ${
                  isGain
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20"
                }`}
              >
                {isGain ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {isGain ? "+" : ""}
                {stock.chp.toFixed(2)}%
              </div>
              {stock.changeValue !== undefined && (
                <div
                  className={`text-xs font-semibold mt-1 ${isGain ? "text-emerald-500/80" : "text-red-500/80"}`}
                >
                  {stock.changeValue >= 0 ? "+" : ""}₹
                  {stock.changeValue.toFixed(2)}
                </div>
              )}
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="surface p-4 rounded-xl space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
                Previous Close
              </span>
              <div className="text-lg font-bold text-text-primary">
                ₹
                {stock.close.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>

            <div className="surface p-4 rounded-xl space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
                Circuit Band
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                {stock.circuit ? (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                      stock.circuit.locked
                        ? stock.circuit.direction === "upper"
                          ? "bg-red-500/15 text-red-500"
                          : "bg-emerald-500/15 text-emerald-500"
                        : "bg-amber-500/15 text-amber-500"
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {stock.circuit.limit}%{" "}
                    {stock.circuit.direction === "upper" ? "Upper" : "Lower"}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-text-tertiary">
                    Standard ±20%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Sparkline Chart */}
          <div className="surface rounded-2xl p-5 space-y-3 border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-500" />
                <h3 className="font-bold text-sm text-text-primary">
                  Price Movement
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-text-tertiary bg-bg-tertiary px-2 py-0.5 rounded-md border border-border">
                Intraday estimate
              </span>
            </div>

            <div className="relative w-full h-40 pt-2">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-full overflow-visible"
              >
                <defs>
                  <linearGradient
                    id={chartGradientId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={isGain ? "#10b981" : "#ef4444"}
                      stopOpacity="0.25"
                    />
                    <stop
                      offset="100%"
                      stopColor={isGain ? "#10b981" : "#ef4444"}
                      stopOpacity="0.0"
                    />
                  </linearGradient>
                </defs>

                {/* Gridlines */}
                <line
                  x1="0"
                  y1="20"
                  x2={svgWidth}
                  y2="20"
                  stroke="currentColor"
                  className="text-border/40"
                  strokeDasharray="4 4"
                />
                <line
                  x1="0"
                  y1="80"
                  x2={svgWidth}
                  y2="80"
                  stroke="currentColor"
                  className="text-border/40"
                  strokeDasharray="4 4"
                />
                <line
                  x1="0"
                  y1="140"
                  x2={svgWidth}
                  y2="140"
                  stroke="currentColor"
                  className="text-border/40"
                  strokeDasharray="4 4"
                />

                {/* Filled Gradient Area */}
                <polygon
                  points={areaPoints}
                  fill={`url(#${chartGradientId})`}
                />

                {/* Trend Polyline */}
                <polyline
                  fill="none"
                  stroke={isGain ? "#10b981" : "#ef4444"}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={polyPoints}
                />
              </svg>
            </div>
          </div>

          {/* Quick External Links */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
              Quick Charts & Analysis
            </span>
            <div className="grid grid-cols-2 gap-3">
              <a
                href={`https://in.tradingview.com/chart/?symbol=NSE:${ticker}`}
                target="_blank"
                rel="noreferrer"
                className="surface p-3 rounded-xl flex items-center justify-between border border-border hover:border-indigo-500/40 text-xs font-bold text-text-primary hover:text-indigo-400 transition-all group"
              >
                <span>TradingView Chart</span>
                <ExternalLink className="w-3.5 h-3.5 text-text-tertiary group-hover:text-indigo-400" />
              </a>

              <a
                href={`https://www.google.com/finance/quote/${ticker}:NSE`}
                target="_blank"
                rel="noreferrer"
                className="surface p-3 rounded-xl flex items-center justify-between border border-border hover:border-indigo-500/40 text-xs font-bold text-text-primary hover:text-indigo-400 transition-all group"
              >
                <span>Google Finance</span>
                <ExternalLink className="w-3.5 h-3.5 text-text-tertiary group-hover:text-indigo-400" />
              </a>

              <a
                href={`https://kite.zerodha.com/chart/ext/ci/1/${ticker}`}
                target="_blank"
                rel="noreferrer"
                className="surface p-3 rounded-xl flex items-center justify-between border border-border hover:border-indigo-500/40 text-xs font-bold text-text-primary hover:text-indigo-400 transition-all group"
              >
                <span>Zerodha Kite</span>
                <ExternalLink className="w-3.5 h-3.5 text-text-tertiary group-hover:text-indigo-400" />
              </a>

              <a
                href={`https://chartink.com/screener/search?q=${ticker}`}
                target="_blank"
                rel="noreferrer"
                className="surface p-3 rounded-xl flex items-center justify-between border border-border hover:border-indigo-500/40 text-xs font-bold text-text-primary hover:text-indigo-400 transition-all group"
              >
                <span>Chartink Scans</span>
                <ExternalLink className="w-3.5 h-3.5 text-text-tertiary group-hover:text-indigo-400" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-bg-secondary text-center text-xs text-text-tertiary">
          Data provided via live market stream • Tap outside or close button to
          exit
        </div>
      </div>
    </div>
  );
}
