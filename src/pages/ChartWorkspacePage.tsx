import { useState } from "react";
import { LineChart, LayoutGrid, Layers, Search } from "lucide-react";
import { RowSparkline } from "../components/RowSparkline";

const DEFAULT_SYMBOLS = ["RELIANCE", "TCS", "INFY", "HDFCBANK"];

function generateSparkline(symbol: string): number[] {
  const seed = symbol.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const points: number[] = [];
  let val = 100 + (seed % 50);
  for (let i = 0; i < 8; i++) {
    const drift = ((seed * (i + 1)) % 7) - 3;
    val = Math.max(80, Math.min(160, val + drift));
    points.push(val);
  }
  return points;
}

export function ChartWorkspacePage() {
  const [gridMode, setGridMode] = useState<"1x1" | "2x1" | "2x2">("2x2");
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [newSymbol, setNewSymbol] = useState("");

  const addSymbol = () => {
    if (!newSymbol.trim()) return;
    const clean = newSymbol.trim().toUpperCase();
    if (!symbols.includes(clean)) {
      setSymbols([clean, ...symbols.slice(0, 3)]);
    }
    setNewSymbol("");
  };

  const visibleSymbols =
    gridMode === "1x1"
      ? symbols.slice(0, 1)
      : gridMode === "2x1"
        ? symbols.slice(0, 2)
        : symbols.slice(0, 4);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-md shadow-indigo-500/20">
              <LineChart className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
              Multi-Chart Split Workspace
            </h1>
          </div>
          <p className="text-text-secondary mt-1.5 text-sm">
            View side-by-side split chart layouts (1x1, 2x1, 2x2) with price
            previews and sparklines.
          </p>
        </div>
      </div>

      {/* Grid Layout Controls */}
      <div className="surface p-4 rounded-2xl border border-border flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSymbol()}
            placeholder="Add symbol (e.g. SBIN)..."
            className="bg-bg-tertiary border border-border rounded-xl px-3 py-1.5 text-xs font-semibold text-text-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={addSymbol}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm cursor-pointer"
          >
            Add Chart
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
            Grid Layout
          </span>
          <div className="flex bg-bg-tertiary p-1 rounded-xl border border-border">
            {(["1x1", "2x1", "2x2"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setGridMode(m)}
                className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                  gridMode === m
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Grid */}
      <div
        className={`grid gap-4 ${
          gridMode === "1x1"
            ? "grid-cols-1"
            : gridMode === "2x1"
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2"
        }`}
      >
        {visibleSymbols.map((sym, i) => (
          <div
            key={sym + i}
            className="surface p-5 rounded-2xl border border-border flex flex-col justify-between space-y-4 min-h-[220px]"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-extrabold text-text-primary">
                  {sym}
                </h3>
                <span className="text-xs text-text-tertiary">
                  NSE Equity • Live Feed
                </span>
              </div>
              <a
                href={`https://in.tradingview.com/chart/?symbol=NSE:${sym}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
              >
                Full TV Chart ↗
              </a>
            </div>

            <div className="bg-bg-tertiary/40 rounded-xl p-4 border border-border/50 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                Trend Preview
              </span>
              <RowSparkline
                points={generateSparkline(sym)}
                isGain={i % 2 === 0}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
