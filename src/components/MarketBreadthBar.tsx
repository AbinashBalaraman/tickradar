import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Layers, Activity } from "lucide-react";

interface SectorBreadth {
  id: string;
  name: string;
  avgChp: number;
  advances: number;
  declines: number;
  total: number;
}

interface MarketBreadthData {
  total: number;
  advances: number;
  declines: number;
  unchanged: number;
  ratio: number;
  sectors: SectorBreadth[];
  pcr?: {
    nifty: { val: number; sentiment: "Bullish" | "Bearish" };
    bankNifty: { val: number; sentiment: "Bullish" | "Bearish" };
  };
}

interface MarketBreadthBarProps {
  selectedDate?: string;
}

export function MarketBreadthBar({ selectedDate }: MarketBreadthBarProps) {
  const [data, setData] = useState<MarketBreadthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBreadth = async () => {
    try {
      const url = selectedDate
        ? `/api/smartapi/market-breadth?date=${encodeURIComponent(selectedDate)}`
        : "/api/smartapi/market-breadth";
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silently ignore temporary network glitches
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBreadth();
    const interval = setInterval(fetchBreadth, 10000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  if (loading && !data) {
    return (
      <div className="surface rounded-2xl p-4 flex items-center justify-center gap-2 text-xs text-text-tertiary">
        <Activity className="w-4 h-4 animate-spin text-indigo-500/50" />
        <span>Calculating market breadth & sector sentiment...</span>
      </div>
    );
  }

  if (!data) return null;

  const totalEvaluated = data.advances + data.declines + data.unchanged || 1;
  const advPct = ((data.advances / totalEvaluated) * 100).toFixed(1);
  const decPct = ((data.declines / totalEvaluated) * 100).toFixed(1);

  return (
    <div className="surface rounded-2xl p-4 sm:p-5 space-y-4 border border-border">
      {/* Advance / Decline Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-500">
            <Layers className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-bold text-sm text-text-primary">
              Market Breadth
            </h3>
            <p className="text-[11px] text-text-tertiary">
              Live Advance / Decline ratio across NSE equity universe
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
          {data.pcr && (
            <div className="flex items-center gap-2 border-r border-border pr-3">
              <span className="text-[11px] text-text-tertiary font-bold uppercase">
                PCR:
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] ${
                  data.pcr.nifty.sentiment === "Bullish"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-red-500/15 text-red-600 dark:text-red-400"
                }`}
              >
                Nifty {data.pcr.nifty.val} ({data.pcr.nifty.sentiment})
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] ${
                  data.pcr.bankNifty.sentiment === "Bullish"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-red-500/15 text-red-600 dark:text-red-400"
                }`}
              >
                Bank {data.pcr.bankNifty.val} ({data.pcr.bankNifty.sentiment})
              </span>
            </div>
          )}

          <span className="text-emerald-500 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            {data.advances} Adv ({advPct}%)
          </span>
          <span className="text-red-500 flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5" />
            {data.declines} Dec ({decPct}%)
          </span>
          <span className="text-text-tertiary px-2 py-0.5 rounded bg-bg-tertiary border border-border">
            A/D Ratio: {data.ratio.toFixed(2)}x
          </span>
        </div>
      </div>

      {/* Visual Proportion Bar */}
      <div className="space-y-1">
        <div className="h-3 w-full rounded-full bg-bg-tertiary overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${advPct}%` }}
            className="bg-emerald-500 transition-all duration-500"
            title={`Advances: ${data.advances}`}
          />
          <div
            style={{ width: `${decPct}%` }}
            className="bg-red-500 transition-all duration-500"
            title={`Declines: ${data.declines}`}
          />
          <div
            style={{
              width: `${(100 - parseFloat(advPct) - parseFloat(decPct)).toFixed(1)}%`,
            }}
            className="bg-slate-400/40 transition-all duration-500"
            title={`Unchanged: ${data.unchanged}`}
          />
        </div>
      </div>

      {/* Sector Quick Performance Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary whitespace-nowrap shrink-0">
          Sectors:
        </span>
        {data.sectors.map((sec) => {
          const isUp = sec.avgChp >= 0;
          return (
            <div
              key={sec.id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border transition-transform hover:scale-105 ${
                isUp
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
              }`}
            >
              <span>{sec.name}</span>
              <span>
                {isUp ? "+" : ""}
                {sec.avgChp.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
