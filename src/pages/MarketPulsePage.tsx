import { useEffect, useState } from "react";
import { Activity, Layers, Gauge } from "lucide-react";
import { MarketBreadthBar } from "../components/MarketBreadthBar";

interface SectorHeatmapItem {
  id: string;
  name: string;
  avgChp: number;
  advances: number;
  declines: number;
  total: number;
}

export function MarketPulsePage() {
  const [sectors, setSectors] = useState<SectorHeatmapItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPulse = async () => {
      try {
        const res = await fetch("/api/smartapi/market-breadth");
        if (res.ok) {
          const json = await res.json();
          setSectors(json.sectors || []);
        }
      } catch {
        // silently handle network glitches
      } finally {
        setLoading(false);
      }
    };
    fetchPulse();
    const interval = setInterval(fetchPulse, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20">
              <Gauge className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
              Market Pulse & Macro Sentiment
            </h1>
          </div>
          <p className="text-text-secondary mt-1.5 text-sm">
            High-level overview of market breadth, sector heatmaps, and macro
            regime indicators.
          </p>
        </div>
      </div>

      {/* Market Breadth & PCR Card */}
      <MarketBreadthBar />

      {/* Sector Treemap Visual Heatmap Grid */}
      <div className="surface p-6 rounded-2xl border border-border space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-text-primary">
            Sector Treemap Performance Matrix
          </h2>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center gap-2 text-xs text-text-tertiary">
            <Activity className="w-4 h-4 animate-spin text-indigo-500" />
            <span>Building sector heatmaps...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectors.map((sec) => {
              const isUp = sec.avgChp >= 0;
              return (
                <div
                  key={sec.id}
                  className={`p-5 rounded-2xl border transition-all hover:scale-[1.02] flex flex-col justify-between ${
                    isUp
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-red-500/10 border-red-500/30 text-red-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-base text-text-primary">
                      {sec.name}
                    </h3>
                    <span
                      className={`text-sm font-extrabold px-2 py-0.5 rounded-lg ${isUp ? "bg-emerald-500/20" : "bg-red-500/20"}`}
                    >
                      {isUp ? "+" : ""}
                      {sec.avgChp.toFixed(2)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold pt-4 text-text-secondary">
                    <span>Adv: {sec.advances}</span>
                    <span>Dec: {sec.declines}</span>
                    <span>Total: {sec.total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
