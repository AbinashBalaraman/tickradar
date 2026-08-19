import { useEffect } from "react";
import {
  X,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Layers,
} from "lucide-react";
import { RowSparkline } from "./RowSparkline";

interface MultiChartStock {
  symbol: string;
  ltp: number;
  close: number;
  chp: number;
  changeValue?: number;
  sparkline?: number[];
}

interface MultiChartModalProps {
  stocks: MultiChartStock[];
  isOpen: boolean;
  onClose: () => void;
  onRemoveStock: (symbol: string) => void;
}

export function MultiChartModal({
  stocks,
  isOpen,
  onClose,
  onRemoveStock,
}: MultiChartModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || stocks.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="multi-chart-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl bg-bg-primary border border-border rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-bg-primary/95 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-indigo-500/15 text-indigo-500">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h2
                id="multi-chart-title"
                className="text-xl font-extrabold text-text-primary"
              >
                Multi-Stock Split Comparison Grid
              </h2>
              <p className="text-xs text-text-tertiary">
                Comparing {stocks.length} selected stocks side-by-side in
                real-time
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

        {/* 2x2 Grid Content */}
        <div className="p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
          {stocks.map((stock) => {
            const ticker = stock.symbol.replace("-EQ", "").trim();
            const isGain = stock.chp >= 0;
            return (
              <div
                key={stock.symbol}
                className="surface p-4 rounded-2xl border border-border space-y-3 flex flex-col justify-between"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-lg text-text-primary">
                        {ticker}
                      </h3>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-bg-tertiary border border-border text-text-tertiary">
                        NSE
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xl font-extrabold text-text-primary">
                        ₹
                        {stock.ltp.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <span
                        className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-lg ${
                          isGain
                            ? "bg-emerald-500/15 text-emerald-500"
                            : "bg-red-500/15 text-red-500"
                        }`}
                      >
                        {isGain ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5" />
                        )}
                        {isGain ? "+" : ""}
                        {stock.chp.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveStock(stock.symbol)}
                    className="p-1 rounded-lg text-text-tertiary hover:text-red-400 transition-colors"
                    title="Remove from comparison"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Inline Sparkline */}
                <div className="bg-bg-tertiary/40 rounded-xl p-3 flex items-center justify-between border border-border/50">
                  <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
                    Trend
                  </span>
                  <RowSparkline points={stock.sparkline} isGain={isGain} />
                </div>

                {/* Action Links */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-text-tertiary">
                    Prev Close: ₹{stock.close.toFixed(2)}
                  </span>
                  <a
                    href={`https://in.tradingview.com/chart/?symbol=NSE:${ticker}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <span>TradingView</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-bg-secondary flex justify-between items-center text-xs text-text-tertiary">
          <span>Press ESC or tap outside to close grid</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-bg-tertiary border border-border text-text-primary font-bold hover:bg-bg-elevated transition-colors cursor-pointer"
          >
            Close Grid
          </button>
        </div>
      </div>
    </div>
  );
}
