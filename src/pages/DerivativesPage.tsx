import { useEffect, useState } from "react";
import {
  Target,
  Activity,
  TrendingUp,
  TrendingDown,
  Layers,
  ShieldAlert,
} from "lucide-react";
import { Skeleton } from "../components/common/Skeleton";
import { type FnoBuildupItem } from "../server/smartapi/fno";

interface FnoData {
  summary: {
    longBuildupCount: number;
    shortBuildupCount: number;
    shortCoveringCount: number;
    longUnwindingCount: number;
    overallSentiment: "Bullish" | "Bearish";
  };
  longBuildup: FnoBuildupItem[];
  shortBuildup: FnoBuildupItem[];
  shortCovering: FnoBuildupItem[];
  longUnwinding: FnoBuildupItem[];
}

export function DerivativesPage() {
  const [data, setData] = useState<FnoData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFno = async () => {
    try {
      const res = await fetch("/api/smartapi/fno-buildup");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silently handle temporary network error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFno();
    const interval = setInterval(fetchFno, 8000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="surface p-4 rounded-2xl border border-border space-y-3"
            >
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="surface border border-border rounded-2xl overflow-hidden"
            >
              <div className="p-4">
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="divide-y divide-border">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="p-3 flex justify-between">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-amber-500 text-white shadow-md shadow-indigo-500/20">
              <Target className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
              F&O & Derivatives Intelligence Center
            </h1>
          </div>
          <p className="text-text-secondary mt-1.5 text-sm">
            Real-time classification of Open Interest (OI) buildup: Long
            Buildup, Short Buildup, Short Covering & Long Unwinding.
          </p>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider">
              Long Buildup (Price ↑ OI ↑)
            </span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold">
            {data.summary.longBuildupCount} Stocks
          </div>
          <p className="text-[11px] opacity-80 font-medium">
            Aggressive Bullish Buying
          </p>
        </div>

        <div className="surface p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider">
              Short Buildup (Price ↓ OI ↑)
            </span>
            <TrendingDown className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold">
            {data.summary.shortBuildupCount} Stocks
          </div>
          <p className="text-[11px] opacity-80 font-medium">
            Aggressive Bearish Shorting
          </p>
        </div>

        <div className="surface p-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider">
              Short Covering (Price ↑ OI ↓)
            </span>
            <Layers className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold">
            {data.summary.shortCoveringCount} Stocks
          </div>
          <p className="text-[11px] opacity-80 font-medium">
            Bears Closing Short Positions
          </p>
        </div>

        <div className="surface p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider">
              Long Unwinding (Price ↓ OI ↓)
            </span>
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold">
            {data.summary.longUnwindingCount} Stocks
          </div>
          <p className="text-[11px] opacity-80 font-medium">
            Bulls Exiting Positions
          </p>
        </div>
      </div>

      {/* Buildup Tables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Long Buildup Table */}
        <div className="surface border border-border rounded-2xl overflow-hidden">
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 p-4 text-emerald-400 font-extrabold text-sm flex justify-between items-center">
            <span>🔥 Top Long Buildup</span>
            <span className="text-xs">Price ↑ & OI ↑</span>
          </div>
          <div className="divide-y divide-border text-xs">
            {data.longBuildup.slice(0, 8).map((item) => (
              <div
                key={item.symbol}
                className="p-3 flex items-center justify-between hover:bg-bg-tertiary/50"
              >
                <span className="font-extrabold text-text-primary">
                  {item.symbol.replace("-EQ", "")}
                </span>
                <div className="text-right">
                  <div className="font-bold text-emerald-400">
                    +{item.chp.toFixed(2)}%
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    OI Chg: +{item.oiChangePct}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Short Buildup Table */}
        <div className="surface border border-border rounded-2xl overflow-hidden">
          <div className="bg-red-500/15 border-b border-red-500/30 p-4 text-red-400 font-extrabold text-sm flex justify-between items-center">
            <span>🔻 Top Short Buildup</span>
            <span className="text-xs">Price ↓ & OI ↑</span>
          </div>
          <div className="divide-y divide-border text-xs">
            {data.shortBuildup.slice(0, 8).map((item) => (
              <div
                key={item.symbol}
                className="p-3 flex items-center justify-between hover:bg-bg-tertiary/50"
              >
                <span className="font-extrabold text-text-primary">
                  {item.symbol.replace("-EQ", "")}
                </span>
                <div className="text-right">
                  <div className="font-bold text-red-400">
                    {item.chp.toFixed(2)}%
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    OI Chg: +{item.oiChangePct}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
