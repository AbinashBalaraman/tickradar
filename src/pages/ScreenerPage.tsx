import { useEffect, useState } from "react";
import { Filter, Activity, CheckCircle2, XCircle } from "lucide-react";
import { SkeletonTableRows } from "../components/common/Skeleton";
import { RowSparkline } from "../components/RowSparkline";

interface ScreenerStock {
  symbol: string;
  ltp: number;
  close: number;
  chp: number;
  changeValue: number;
  rsi: number;
  ema20: number;
  ema50: number;
  ema200: number;
  isAboveEma20: boolean;
  isAboveEma50: boolean;
  isAboveEma200: boolean;
}

interface CustomRule {
  id: string;
  field: "rsi" | "ltp" | "chp" | "ema20" | "ema50" | "ema200";
  operator: ">" | "<" | "=";
  value: number;
}

export function ScreenerPage() {
  const [stocks, setStocks] = useState<ScreenerStock[]>([]);
  const [loading, setLoading] = useState(true);

  // Screener Filters
  const [rsiRange, setRsiRange] = useState<
    "all" | "oversold" | "overbought" | "bullish"
  >("all");
  const [emaCross, setEmaCross] = useState<
    "all" | "above_20" | "above_50" | "above_200"
  >("all");
  const [universe, setUniverse] = useState<string>("all");
  const [priceTier, setPriceTier] = useState<string>("all");
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);

  const fetchScreenerData = async () => {
    try {
      const params = new URLSearchParams();
      if (universe !== "all") params.set("universe", universe);
      const res = await fetch(`/api/smartapi/screener?${params}`);
      if (res.ok) {
        const json = await res.json();
        setStocks(json);
      }
    } catch {
      // silently handle temporary network error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScreenerData();
    const interval = setInterval(fetchScreenerData, 6000);
    return () => clearInterval(interval);
  }, [universe]);

  // Apply Client Filters
  const filtered = stocks.filter((s) => {
    // RSI Filter
    if (rsiRange === "oversold" && s.rsi >= 35) return false;
    if (rsiRange === "overbought" && s.rsi <= 65) return false;
    if (rsiRange === "bullish" && (s.rsi < 50 || s.rsi > 70)) return false;

    // EMA Crossover Filter
    if (emaCross === "above_20" && !s.isAboveEma20) return false;
    if (emaCross === "above_50" && !s.isAboveEma50) return false;
    if (emaCross === "above_200" && !s.isAboveEma200) return false;

    // Price Tier
    if (priceTier === "penny" && s.ltp > 50) return false;
    if (priceTier === "heavy" && s.ltp < 1000) return false;

    // Custom Rules
    for (const rule of customRules) {
      const fieldVal = s[rule.field as keyof ScreenerStock];
      if (typeof fieldVal === "number") {
        if (rule.operator === ">" && fieldVal <= rule.value) return false;
        if (rule.operator === "<" && fieldVal >= rule.value) return false;
        if (rule.operator === "=" && fieldVal !== rule.value) return false;
      }
    }

    return true;
  });

  const filterBtn = (active: boolean) =>
    `px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
      active
        ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md"
        : "bg-bg-tertiary border border-border text-text-secondary hover:text-text-primary"
    }`;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/20">
              <Filter className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
              Quantitative Multi-Factor Screener Hub
            </h1>
          </div>
          <p className="text-text-secondary mt-1.5 text-sm">
            Filter stocks using technical indicators (RSI 14, EMA 20/50/200
            Crossovers) and multi-dimensional rules.
          </p>
        </div>
      </div>

      {/* Screener Controls */}
      <div className="surface p-5 rounded-2xl border border-border space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* RSI Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
              RSI (14)
            </label>
            <div className="flex gap-1.5">
              <button
                type="button"
                className={filterBtn(rsiRange === "all")}
                onClick={() => setRsiRange("all")}
              >
                All
              </button>
              <button
                type="button"
                className={filterBtn(rsiRange === "oversold")}
                onClick={() => setRsiRange("oversold")}
              >
                Oversold (&lt;35)
              </button>
              <button
                type="button"
                className={filterBtn(rsiRange === "bullish")}
                onClick={() => setRsiRange("bullish")}
              >
                Bullish (50-70)
              </button>
              <button
                type="button"
                className={filterBtn(rsiRange === "overbought")}
                onClick={() => setRsiRange("overbought")}
              >
                Overbought (&gt;65)
              </button>
            </div>
          </div>

          {/* EMA Crossover Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
              EMA Trend
            </label>
            <div className="flex gap-1.5">
              <button
                type="button"
                className={filterBtn(emaCross === "all")}
                onClick={() => setEmaCross("all")}
              >
                All
              </button>
              <button
                type="button"
                className={filterBtn(emaCross === "above_20")}
                onClick={() => setEmaCross("above_20")}
              >
                &gt; 20 EMA
              </button>
              <button
                type="button"
                className={filterBtn(emaCross === "above_50")}
                onClick={() => setEmaCross("above_50")}
              >
                &gt; 50 EMA
              </button>
              <button
                type="button"
                className={filterBtn(emaCross === "above_200")}
                onClick={() => setEmaCross("above_200")}
              >
                &gt; 200 EMA
              </button>
            </div>
          </div>
        </div>

        {/* Custom Rule Builder */}
        <div className="w-full border-t border-border pt-4 mt-2 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-text-tertiary flex items-center gap-1">
              <Filter className="w-3 h-3" /> Magic Scanner (Custom Rules)
            </label>
            <button
              type="button"
              onClick={() =>
                setCustomRules([
                  ...customRules,
                  {
                    id: Date.now().toString(),
                    field: "rsi",
                    operator: ">",
                    value: 50,
                  },
                ])
              }
              className="text-xs text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
            >
              + Add Condition
            </button>
          </div>

          {customRules.length > 0 && (
            <div className="flex flex-col gap-2">
              {customRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex flex-wrap items-center gap-2 bg-bg-primary p-2 rounded-xl border border-border"
                >
                  <select
                    value={rule.field}
                    onChange={(e) =>
                      setCustomRules(
                        customRules.map((r) =>
                          r.id === rule.id
                            ? {
                                ...r,
                                field: e.target.value as CustomRule["field"],
                              }
                            : r,
                        ),
                      )
                    }
                    className="bg-bg-tertiary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none"
                  >
                    <option value="rsi">RSI (14)</option>
                    <option value="ltp">Price (LTP)</option>
                    <option value="chp">Day Change %</option>
                    <option value="ema20">EMA 20</option>
                    <option value="ema50">EMA 50</option>
                    <option value="ema200">EMA 200</option>
                  </select>
                  <select
                    value={rule.operator}
                    onChange={(e) =>
                      setCustomRules(
                        customRules.map((r) =>
                          r.id === rule.id
                            ? {
                                ...r,
                                operator: e.target
                                  .value as CustomRule["operator"],
                              }
                            : r,
                        ),
                      )
                    }
                    className="bg-bg-tertiary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none"
                  >
                    <option value=">">Greater than (&gt;)</option>
                    <option value="<">Less than (&lt;)</option>
                    <option value="=">Equals (=)</option>
                  </select>
                  <input
                    type="number"
                    value={rule.value}
                    onChange={(e) =>
                      setCustomRules(
                        customRules.map((r) =>
                          r.id === rule.id
                            ? { ...r, value: Number(e.target.value) }
                            : r,
                        ),
                      )
                    }
                    className="bg-bg-tertiary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none w-24"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setCustomRules(
                        customRules.filter((r) => r.id !== rule.id),
                      )
                    }
                    className="ml-auto text-red-400 hover:text-red-300 p-1"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* High-Density Results Table */}
      <div className="surface overflow-hidden border border-border rounded-2xl">
        <div className="p-4 border-b border-border bg-bg-secondary flex justify-between items-center text-xs font-bold">
          <span>Screened Matches: {filtered.length} Stocks</span>
        </div>

        {loading ? (
          <div className="divide-y divide-border/60">
            <SkeletonTableRows count={10} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg-tertiary text-text-tertiary font-bold uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="p-3">Symbol</th>
                  <th className="p-3">Price (₹)</th>
                  <th className="p-3">Day %</th>
                  <th className="p-3">RSI (14)</th>
                  <th className="p-3">20 EMA</th>
                  <th className="p-3">50 EMA</th>
                  <th className="p-3">200 EMA</th>
                  <th className="p-3">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-medium">
                {filtered.slice(0, 50).map((stock, i) => {
                  const isUp = stock.chp >= 0;
                  const ticker = stock.symbol.replace("-EQ", "");
                  const charSum = ticker
                    .split("")
                    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
                  const gradients = [
                    "from-indigo-600 to-violet-600",
                    "from-blue-600 to-cyan-600",
                    "from-emerald-600 to-teal-600",
                    "from-fuchsia-600 to-pink-600",
                    "from-amber-600 to-orange-600",
                  ];
                  const avatarGradient = gradients[charSum % gradients.length];
                  const low = stock.ltp * (isUp ? 0.98 : 0.96);
                  const high = stock.ltp * (isUp ? 1.04 : 1.01);
                  const posPct = Math.max(
                    10,
                    Math.min(90, ((stock.ltp - low) / (high - low)) * 100),
                  );

                  return (
                    <tr
                      key={stock.symbol}
                      className="hover:bg-bg-tertiary/70 transition-colors group"
                    >
                      <td className="p-3 font-extrabold text-text-primary flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarGradient} text-white font-extrabold text-[10px] flex items-center justify-center shadow-sm shrink-0 uppercase tracking-tight`}
                        >
                          {ticker.slice(0, 3)}
                        </div>
                        <div className="flex flex-col">
                          <span className="group-hover:text-indigo-400 transition-colors">
                            {ticker}
                          </span>
                          <span className="text-[10px] font-normal text-text-tertiary">
                            {stock.ltp > 1000
                              ? "Large Cap"
                              : stock.ltp > 200
                                ? "Mid Cap"
                                : "Small Cap"}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 font-bold text-text-primary">
                        ₹{stock.ltp.toFixed(2)}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`font-bold ${isUp ? "text-emerald-500" : "text-red-500"}`}
                          >
                            {isUp ? "+" : ""}
                            {stock.chp.toFixed(2)}%
                          </span>
                          <div className="w-24 h-1.5 rounded-full bg-bg-tertiary relative overflow-hidden">
                            <div
                              style={{ left: `${posPct}%` }}
                              className={`absolute top-0 bottom-0 w-2 -ml-1 rounded-full ${
                                isUp ? "bg-emerald-500" : "bg-red-500"
                              }`}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            stock.rsi > 65
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : stock.rsi < 35
                                ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                                : "bg-bg-tertiary text-text-secondary border border-border"
                          }`}
                        >
                          RSI {stock.rsi}
                        </span>
                      </td>
                      <td className="p-3 text-text-tertiary font-semibold">
                        ₹{stock.ema20.toFixed(1)}
                      </td>
                      <td className="p-3 text-text-tertiary font-semibold">
                        ₹{stock.ema50.toFixed(1)}
                      </td>
                      <td className="p-3 text-text-tertiary font-semibold">
                        ₹{stock.ema200.toFixed(1)}
                      </td>
                      <td className="p-3">
                        {stock.isAboveEma20 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-500 font-extrabold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Bullish
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-400 font-extrabold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                            <XCircle className="w-3.5 h-3.5" /> Bearish
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
