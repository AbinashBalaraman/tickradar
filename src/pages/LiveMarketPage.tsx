import { useEffect, useState, useRef } from "react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  ShieldAlert,
  Search,
  Download,
  Star,
  Calendar,
  RotateCcw,
  LayoutGrid,
  List,
  X,
  Volume2,
  Zap,
  ChevronDown,
  Layers,
} from "lucide-react";
import { DataBadge } from "../components/common/DataBadge";
import { Skeleton, SkeletonCard } from "../components/common/Skeleton";
import { MarketBreadthBar } from "../components/MarketBreadthBar";
import { PresetFilters, type PresetConfig } from "../components/PresetFilters";
import { StockDetailModal } from "../components/StockDetailModal";
import { MultiChartModal } from "../components/MultiChartModal";
import { RowSparkline } from "../components/RowSparkline";
import { StockRowCard } from "../components/StockRowCard";

interface LiveGainerLoser {
  symbol: string;
  chp: number;
  ltp: number;
  close: number;
  changeValue?: number;
  circuit?: {
    limit: number;
    direction: "upper" | "lower";
    locked: boolean;
  } | null;
  sparkline?: number[];
}

interface LiveDataResponse {
  gainers: LiveGainerLoser[];
  losers: LiveGainerLoser[];
  totalTracked: number;
  isMock?: boolean;
  activeSource?: "ANGEL" | "FYERS" | "SAMPLE";
  sortBy?: "percent" | "value";
  historicalDate?: string;
}

const UNIVERSES = [
  { id: "all", label: "All NSE Equities" },
  { id: "watchlist", label: "⭐ My Watchlist" },
  { id: "nifty50", label: "Nifty 50" },
  { id: "banknifty", label: "Bank Nifty" },
  { id: "niftyit", label: "Nifty IT" },
  { id: "niftyauto", label: "Nifty Auto" },
  { id: "niftypharma", label: "Nifty Pharma" },
  { id: "niftymetal", label: "Nifty Metal" },
  { id: "fno", label: "F&O Only" },
] as const;

const INTRADAY_TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h"] as const;
const EOD_TIMEFRAMES = ["daily", "weekly", "monthly", "ytd"] as const;

const PRICE_TIERS = [
  { id: "all", label: "All", min: 0, max: 1_000_000 },
  { id: "penny", label: "< ₹50", min: 0, max: 50 },
  { id: "mid", label: "₹50–500", min: 50, max: 500 },
  { id: "high", label: "₹500–5K", min: 500, max: 5000 },
  { id: "heavy", label: "> ₹5K", min: 5000, max: 1_000_000 },
] as const;

const LIMIT_OPTIONS = [
  { id: 10, label: "Top 10" },
  { id: 25, label: "Top 25" },
  { id: 50, label: "Top 50" },
  { id: 0, label: "Full Table" },
] as const;

function CircuitPill({
  circuit,
}: {
  circuit: NonNullable<LiveGainerLoser["circuit"]>;
}) {
  const upper = circuit.direction === "upper";
  const locked = circuit.locked;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${
        locked
          ? upper
            ? "bg-red-500/15 text-red-600 dark:text-red-400"
            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      }`}
      title={`${upper ? "Upper" : "Lower"} circuit ${locked ? "locked" : "near"} (${circuit.limit}%)`}
    >
      {locked ? "LOCKED" : "NEAR"} {circuit.limit}% {upper ? "▲" : "▼"}
    </span>
  );
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

const getPastTradingDate = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  if (d.getDay() === 0)
    d.setDate(d.getDate() - 2); // Sunday -> Friday
  else if (d.getDay() === 6) d.setDate(d.getDate() - 1); // Saturday -> Friday
  return d.toISOString().slice(0, 10);
};

export function LiveMarketPage() {
  const [data, setData] = useState<LiveDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [universe, setUniverse] = useState<string>("all");
  const [timeframe, setTimeframe] = useState<string>("daily");
  const [sortBy, setSortBy] = useState<"percent" | "value">("percent");
  const [tier, setTier] = useState<(typeof PRICE_TIERS)[number]>(
    PRICE_TIERS[0],
  );
  const [circuit, setCircuit] = useState<"none" | "upper" | "lower">("none");
  const [rvol, setRvol] = useState<"none" | "2x" | "5x" | "10x">("none");
  const [gap, setGap] = useState<"none" | "gap_up" | "gap_down">("none");
  const [limit, setLimit] = useState<number>(10);

  const [searchQuery, setSearchQuery] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(""); // empty string = Live Feed

  // Density & View Preferences
  const [density, setDensity] = useState<"comfortable" | "compact">(
    "comfortable",
  );

  // Comparison Multi-Select Mode
  const [compareSymbols, setCompareSymbols] = useState<string[]>([]);
  const [isMultiChartOpen, setIsMultiChartOpen] = useState(false);

  // Advanced filters collapsed by default
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);

  // Track tick price directions for flash animation
  const prevPricesRef = useRef<Map<string, number>>(new Map());
  const [tickFlashes, setTickFlashes] = useState<Map<string, "up" | "down">>(
    new Map(),
  );

  // Track last updated time
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const todayDateStr = new Date().toISOString().slice(0, 10);

  // Watchlist state stored in localStorage
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("livescanner_watchlist");
      return saved
        ? JSON.parse(saved)
        : ["RELIANCE-EQ", "TCS-EQ", "INFY-EQ", "HDFCBANK-EQ", "SBIN-EQ"];
    } catch {
      return ["RELIANCE-EQ", "TCS-EQ", "INFY-EQ", "HDFCBANK-EQ", "SBIN-EQ"];
    }
  });

  // Modal detail drawer state
  const [selectedStock, setSelectedStock] = useState<LiveGainerLoser | null>(
    null,
  );

  useEffect(() => {
    localStorage.setItem("livescanner_watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape") {
        if (searchQuery) setSearchQuery("");
        if (selectedStock) setSelectedStock(null);
        if (isMultiChartOpen) setIsMultiChartOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchQuery, selectedStock, isMultiChartOpen]);

  const toggleFavorite = (symbol: string) => {
    setWatchlist((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol],
    );
  };

  const toggleCompareSymbol = (symbol: string) => {
    setCompareSymbols((prev) => {
      if (prev.includes(symbol)) {
        if (prev.length === 1) setCompareMode(false);
        return prev.filter((s) => s !== symbol);
      }
      if (prev.length >= 4) return prev;
      return [...prev, symbol];
    });
  };

  const toggleCompareMode = () => {
    if (compareMode) {
      setCompareSymbols([]);
      setCompareMode(false);
    } else {
      setCompareMode(true);
    }
  };

  const fetchLiveMovers = async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const params = new URLSearchParams({
        limit: String(limit),
        timeframe,
        universe: universe === "watchlist" ? "all" : universe,
        sort: sortBy,
        circuit,
        rvol,
        gap,
        price_min: String(tier.min),
        price_max: String(tier.max),
      });

      if (universe === "watchlist") {
        params.set("universe", "watchlist");
        params.set("symbols", watchlist.join(","));
      }

      if (selectedDate) {
        params.set("date", selectedDate);
      }

      const res = await fetch(`/api/smartapi/live-gainers-losers?${params}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch market data (HTTP ${res.status})`);
      }
      const json: LiveDataResponse = await res.json();

      // Compare tick directions for price flash animation
      const newFlashes = new Map<string, "up" | "down">();
      const allStocks = [...json.gainers, ...json.losers];
      for (const stock of allStocks) {
        const prev = prevPricesRef.current.get(stock.symbol);
        if (prev !== undefined && prev !== stock.ltp) {
          newFlashes.set(stock.symbol, stock.ltp > prev ? "up" : "down");
        }
        prevPricesRef.current.set(stock.symbol, stock.ltp);
      }

      if (newFlashes.size > 0) {
        setTickFlashes(newFlashes);
        setTimeout(() => setTickFlashes(new Map()), 900);
      }

      setData(json);
      setError(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || "Unknown error fetching market movers");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const isInitial = !data;
    fetchLiveMovers(isInitial);
    if (!selectedDate) {
      const interval = setInterval(() => fetchLiveMovers(false), 5000);
      return () => clearInterval(interval);
    }
  }, [
    universe,
    timeframe,
    sortBy,
    tier,
    circuit,
    rvol,
    gap,
    limit,
    watchlist,
    selectedDate,
  ]);

  const handleSelectPreset = (preset: PresetConfig) => {
    setActivePresetId(preset.id);
    setUniverse(preset.universe);
    setTimeframe(preset.timeframe);
    const foundTier =
      PRICE_TIERS.find((t) => t.id === preset.tierId) || PRICE_TIERS[0];
    setTier(foundTier);
    setCircuit(preset.circuit);
    setSortBy(preset.sortBy);
  };

  const resetAllFilters = () => {
    setUniverse("all");
    setTimeframe("daily");
    setSortBy("percent");
    setTier(PRICE_TIERS[0]);
    setCircuit("none");
    setRvol("none");
    setGap("none");
    setSearchQuery("");
    setSelectedDate("");
    setActivePresetId(null);
  };

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      [
        "Type",
        "Symbol",
        "LTP (₹)",
        "Change (%)",
        "Change (₹)",
        "Prev Close (₹)",
        "Circuit",
      ],
      ...data.gainers.map((g) => [
        "Gainer",
        g.symbol.replace("-EQ", ""),
        g.ltp.toFixed(2),
        `+${g.chp.toFixed(2)}%`,
        g.changeValue !== undefined ? `+${g.changeValue.toFixed(2)}` : "",
        g.close.toFixed(2),
        g.circuit ? `${g.circuit.limit}% ${g.circuit.direction}` : "None",
      ]),
      ...data.losers.map((l) => [
        "Loser",
        l.symbol.replace("-EQ", ""),
        l.ltp.toFixed(2),
        `${l.chp.toFixed(2)}%`,
        l.changeValue !== undefined ? l.changeValue.toFixed(2) : "",
        l.close.toFixed(2),
        l.circuit ? `${l.circuit.limit}% ${l.circuit.direction}` : "None",
      ]),
    ];

    const fileName = selectedDate
      ? `LiveScanner_${selectedDate}.csv`
      : `LiveScanner_Live.csv`;
    const csvContent =
      "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter gainers/losers by search query
  const filteredGainers = (data?.gainers || []).filter((s) =>
    s.symbol
      .replace("-EQ", "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase().trim()),
  );
  const filteredLosers = (data?.losers || []).filter((s) =>
    s.symbol
      .replace("-EQ", "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase().trim()),
  );

  const compareStockList = [
    ...(data?.gainers || []),
    ...(data?.losers || []),
  ].filter((s) => compareSymbols.includes(s.symbol));

  const activeFiltersCount =
    (universe !== "all" ? 1 : 0) +
    (timeframe !== "daily" ? 1 : 0) +
    (tier.id !== "all" ? 1 : 0) +
    (circuit !== "none" ? 1 : 0) +
    (rvol !== "none" ? 1 : 0) +
    (gap !== "none" ? 1 : 0) +
    (selectedDate ? 1 : 0) +
    (searchQuery ? 1 : 0);

  const feedBadge = (() => {
    if (selectedDate) {
      return (
        <div className="flex items-center gap-1.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-md text-xs font-bold border border-amber-500/20">
          <Calendar className="w-3.5 h-3.5" />
          HISTORICAL ({selectedDate})
        </div>
      );
    }
    if (data?.activeSource === "FYERS" || data?.activeSource === "ANGEL") {
      return (
        <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-md text-xs font-bold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          LIVE FEED
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-md text-xs font-bold">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        SIMULATED FEED
      </div>
    );
  })();

  const controlBtn = (active: boolean) =>
    `px-3 py-1.5 text-xs font-semibold rounded-lg uppercase transition-all duration-200 cursor-pointer ${
      active
        ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md"
        : "text-text-secondary hover:text-text-primary"
    }`;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-4 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-md shadow-indigo-500/20">
              <Activity className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
              Market Intelligence Scanner
            </h1>
          </div>
          <p className="text-text-secondary mt-1.5 text-sm">
            Real-time and historical NSE market movers with RVOL shockers, gap
            trackers, PCR sentiment, and sparklines.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-sm text-text-tertiary">
          <div className="flex items-center gap-2">
            {isRefreshing && (
              <Activity className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            )}
            <DataBadge
              source={data?.activeSource || (data?.isMock ? "SAMPLE" : "ANGEL")}
              size="sm"
            />
            {feedBadge}
          </div>
          {data && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {selectedDate
                ? `Historical data for ${selectedDate}`
                : lastUpdated
                  ? `Updated ${formatRelativeTime(lastUpdated)}`
                  : `Tracking ${data.totalTracked.toLocaleString()} symbols`}
            </span>
          )}
        </div>
      </div>

      {/* Historical Mode Alert Banner */}
      {selectedDate && (
        <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-600 dark:text-amber-400 font-bold text-xs shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-amber-500" />
            <span>
              Viewing Historical Market Movers & Breadth for:{" "}
              <strong className="text-amber-500">{selectedDate}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate("")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-extrabold hover:bg-amber-400 transition-colors shadow-sm cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Return to Live Stream
          </button>
        </div>
      )}

      {/* Market Breadth & Index PCR Sentiment */}
      <MarketBreadthBar selectedDate={selectedDate} />

      {/* Preset Strategy Pills */}
      <PresetFilters
        activePresetId={activePresetId}
        onSelectPreset={handleSelectPreset}
      />

      {/* ─── Main Control Panel ─────────────────────────────────────────────── */}
      <div className="surface rounded-2xl p-4 space-y-4 border border-border">
        {/* Search, Date, Compare & Actions */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 border-b border-border pb-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker (e.g. SBIN)... Press '/' to focus"
              className="w-full bg-bg-tertiary border border-border rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-tertiary hover:text-text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Picker & View Options */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-bg-tertiary border border-border rounded-xl px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <input
                type="date"
                max={todayDateStr}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-text-primary focus:outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1 bg-bg-tertiary p-1 rounded-xl border border-border text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setSelectedDate("")}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  !selectedDate
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                Live
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(getPastTradingDate(1))}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedDate === getPastTradingDate(1)
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                Yesterday
              </button>
            </div>

            {/* Density Toggle */}
            <div className="flex bg-bg-tertiary p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setDensity("comfortable")}
                className={`p-1 rounded-lg transition-all cursor-pointer ${
                  density === "comfortable"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
                title="Comfortable Cards"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDensity("compact")}
                className={`p-1 rounded-lg transition-all cursor-pointer ${
                  density === "compact"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
                title="Compact High-Density Table"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Compare Mode Toggle */}
            <button
              type="button"
              onClick={toggleCompareMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                compareMode
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "bg-bg-tertiary border border-border text-text-secondary hover:text-text-primary hover:border-indigo-500/30"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              {compareMode
                ? `Comparing (${compareSymbols.length}/4)`
                : "Compare"}
            </button>

            {/* Multi-Chart Compare Launcher */}
            {compareSymbols.length > 0 && (
              <button
                type="button"
                onClick={() => setIsMultiChartOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                Open Charts
              </button>
            )}

            <button
              type="button"
              onClick={exportCSV}
              disabled={!data}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-bg-tertiary border border-border text-xs font-bold text-text-secondary hover:text-text-primary hover:border-indigo-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>

        {/* Active Filters Bar */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-border">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary shrink-0">
              Active Filters:
            </span>
            {universe !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-400 text-xs font-bold">
                Universe: {universe}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-white"
                  onClick={() => setUniverse("all")}
                />
              </span>
            )}
            {timeframe !== "daily" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-400 text-xs font-bold">
                Timeframe: {timeframe}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-white"
                  onClick={() => setTimeframe("daily")}
                />
              </span>
            )}
            {tier.id !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-400 text-xs font-bold">
                Price: {tier.label}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-white"
                  onClick={() => setTier(PRICE_TIERS[0])}
                />
              </span>
            )}
            {circuit !== "none" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-400 text-xs font-bold">
                Circuit: {circuit}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-white"
                  onClick={() => setCircuit("none")}
                />
              </span>
            )}
            {rvol !== "none" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-400 text-xs font-bold">
                RVOL: {rvol}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-white"
                  onClick={() => setRvol("none")}
                />
              </span>
            )}
            {gap !== "none" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-400 text-xs font-bold">
                Gap: {gap}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-white"
                  onClick={() => setGap("none")}
                />
              </span>
            )}
            {selectedDate && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-bold">
                Date: {selectedDate}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-white"
                  onClick={() => setSelectedDate("")}
                />
              </span>
            )}
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 ml-auto shrink-0 cursor-pointer"
            >
              Reset All
            </button>
          </div>
        )}

        {/* Filters Controls Row 1: Universe & Sort */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
            Universe
          </label>
          <select
            value={universe}
            onChange={(e) => {
              setUniverse(e.target.value);
              setActivePresetId(null);
            }}
            className="bg-bg-tertiary border border-border rounded-lg px-3 py-1.5 text-xs font-semibold text-text-primary cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
          >
            {UNIVERSES.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label} {u.id === "watchlist" ? `(${watchlist.length})` : ""}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
              Sort
            </label>
            <div className="flex bg-bg-tertiary p-1 rounded-xl border border-border">
              <button
                type="button"
                className={controlBtn(sortBy === "percent")}
                onClick={() => setSortBy("percent")}
              >
                %
              </button>
              <button
                type="button"
                className={controlBtn(sortBy === "value")}
                onClick={() => setSortBy("value")}
              >
                ₹
              </button>
            </div>
          </div>
        </div>

        {/* Filters Controls Row 2: Timeframe */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
            Timeframe
          </label>
          <div className="flex flex-wrap gap-1.5">
            {INTRADAY_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                disabled={Boolean(selectedDate)}
                onClick={() => {
                  setTimeframe(tf);
                  setActivePresetId(null);
                }}
                className={`${controlBtn(timeframe === tf)} ${selectedDate ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {tf}
              </button>
            ))}
            {EOD_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                disabled={Boolean(selectedDate)}
                onClick={() => {
                  setTimeframe(tf);
                  setActivePresetId(null);
                }}
                className={`${controlBtn(timeframe === tf)} ${selectedDate ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Filters Toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
            />
            Advanced Filters
            {(rvol !== "none" ||
              gap !== "none" ||
              circuit !== "none" ||
              tier.id !== "all") && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            )}
          </button>
        </div>

        {/* Advanced Filters Row: RVOL, Gap, Price, Circuit, Rows */}
        {showAdvanced && (
          <div className="flex flex-wrap items-center gap-4 animate-fade-in">
            {/* RVOL Volume Shockers */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-text-tertiary flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                RVOL
              </label>
              <div className="flex bg-bg-tertiary p-1 rounded-xl border border-border">
                {(["none", "2x", "5x", "10x"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={controlBtn(rvol === r)}
                    onClick={() => setRvol(r)}
                  >
                    {r === "none" ? "All" : r}
                  </button>
                ))}
              </div>
            </div>

            {/* Gap Up / Down */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-text-tertiary flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Gap
              </label>
              <div className="flex bg-bg-tertiary p-1 rounded-xl border border-border">
                {(["none", "gap_up", "gap_down"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={controlBtn(gap === g)}
                    onClick={() => setGap(g)}
                  >
                    {g === "none"
                      ? "All"
                      : g === "gap_up"
                        ? "Gap Up"
                        : "Gap Down"}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Tier */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                Price
              </label>
              <div className="flex flex-wrap gap-1">
                {PRICE_TIERS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTier(t);
                      setActivePresetId(null);
                    }}
                    className={controlBtn(tier.id === t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Circuit */}
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                Circuit
              </label>
              <div className="flex bg-bg-tertiary p-1 rounded-xl border border-border">
                {(["none", "upper", "lower"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={controlBtn(circuit === c)}
                    onClick={() => setCircuit(c)}
                  >
                    {c === "none" ? "All" : c === "upper" ? "Upper" : "Lower"}
                  </button>
                ))}
              </div>
            </div>

            {/* Rows Limit */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                Rows
              </label>
              <div className="flex bg-bg-tertiary p-1 rounded-xl border border-border">
                {LIMIT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={controlBtn(limit === opt.id)}
                    onClick={() => setLimit(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {loading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="surface overflow-hidden flex flex-col border border-border rounded-2xl">
            <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-5 py-3.5">
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="divide-y divide-border/60">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
          <div className="surface overflow-hidden flex flex-col border border-border rounded-2xl">
            <div className="bg-red-500/10 border-b border-red-500/20 px-5 py-3.5">
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="divide-y divide-border/60">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        </div>
      )}

      {error && !data && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center text-red-500 max-w-lg mx-auto mt-10">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-80" />
          <h3 className="font-bold mb-1">Connection Failed</h3>
          <p className="text-sm opacity-80">{error}</p>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Top Gainers Column */}
          <div className="surface overflow-hidden flex flex-col border border-border rounded-2xl">
            <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                </span>
                <h2 className="font-bold text-emerald-700 dark:text-emerald-300">
                  Gainers ({filteredGainers.length}){" "}
                  {selectedDate ? `• ${selectedDate}` : ""}
                </h2>
              </div>
              {searchQuery && (
                <span className="text-xs text-text-tertiary">
                  Filtered by "{searchQuery}"
                </span>
              )}
            </div>
            <div className="divide-y divide-border/60">
              {filteredGainers.length === 0 ? (
                <div className="p-8 text-center text-text-tertiary text-sm">
                  {searchQuery
                    ? `No gainers match "${searchQuery}"`
                    : "No gainers tracked for this selection."}
                </div>
              ) : (
                filteredGainers.map((stock, i) => (
                  <StockRowCard
                    key={stock.symbol}
                    stock={stock}
                    index={i}
                    density={density}
                    isGain={true}
                    isFav={watchlist.includes(stock.symbol)}
                    isCompared={compareSymbols.includes(stock.symbol)}
                    compareMode={compareMode}
                    flash={tickFlashes.get(stock.symbol)}
                    onSelect={(s) => setSelectedStock(s as any)}
                    onToggleFavorite={toggleFavorite}
                    onToggleCompare={toggleCompareSymbol}
                  />
                ))
              )}
            </div>
          </div>

          {/* Top Losers Column */}
          <div className="surface overflow-hidden flex flex-col border border-border rounded-2xl">
            <div className="bg-red-500/10 border-b border-red-500/20 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-red-500/15 text-red-600 dark:text-red-400">
                  <TrendingDown className="w-4 h-4" />
                </span>
                <h2 className="font-bold text-red-700 dark:text-red-300">
                  Losers ({filteredLosers.length}){" "}
                  {selectedDate ? `• ${selectedDate}` : ""}
                </h2>
              </div>
              {searchQuery && (
                <span className="text-xs text-text-tertiary">
                  Filtered by "{searchQuery}"
                </span>
              )}
            </div>
            <div className="divide-y divide-border/60">
              {filteredLosers.length === 0 ? (
                <div className="p-8 text-center text-text-tertiary text-sm">
                  {searchQuery
                    ? `No losers match "${searchQuery}"`
                    : "No losers tracked for this selection."}
                </div>
              ) : (
                filteredLosers.map((stock, i) => (
                  <StockRowCard
                    key={stock.symbol}
                    stock={stock}
                    index={i}
                    density={density}
                    isGain={false}
                    isFav={watchlist.includes(stock.symbol)}
                    isCompared={compareSymbols.includes(stock.symbol)}
                    compareMode={compareMode}
                    flash={tickFlashes.get(stock.symbol)}
                    onSelect={(s) => setSelectedStock(s as any)}
                    onToggleFavorite={toggleFavorite}
                    onToggleCompare={toggleCompareSymbol}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Single Stock Detail Modal Drawer */}
      <StockDetailModal
        stock={selectedStock}
        isOpen={Boolean(selectedStock)}
        onClose={() => setSelectedStock(null)}
        isFavorite={
          selectedStock ? watchlist.includes(selectedStock.symbol) : false
        }
        onToggleFavorite={toggleFavorite}
      />

      {/* Multi-Stock Split Comparison Grid Modal */}
      <MultiChartModal
        stocks={compareStockList}
        isOpen={isMultiChartOpen}
        onClose={() => setIsMultiChartOpen(false)}
        onRemoveStock={toggleCompareSymbol}
      />
    </div>
  );
}
