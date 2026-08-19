import { useState, useEffect } from "react";
import { Anchor, ShieldAlert, Activity, Search, Filter } from "lucide-react";
import { SkeletonTableRows } from "../components/common/Skeleton";

interface WhaleDeal {
  id: string;
  date: string;
  symbol: string;
  clientName: string;
  clientType: "FII" | "DII" | "PROMOTER" | "HNI";
  dealType: "BUY" | "SELL";
  quantity: number;
  price: number;
  valueCr: number;
}

// Seeded PRNG for deterministic mock data
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Mock Data Generation — deterministic per session so data doesn't shuffle on navigation
const generateMockDeals = (): WhaleDeal[] => {
  const cached = sessionStorage.getItem("whale_deals");
  if (cached) return JSON.parse(cached);

  const symbols = [
    "HDFCBANK-EQ",
    "RELIANCE-EQ",
    "INFY-EQ",
    "TCS-EQ",
    "ICICIBANK-EQ",
    "ITC-EQ",
    "SBIN-EQ",
    "BHARTIARTL-EQ",
    "BAJFINANCE-EQ",
    "ASIANPAINT-EQ",
  ];
  const clients = [
    "Vanguard Group",
    "Life Insurance Corp",
    "BlackRock Inc",
    "SBI Mutual Fund",
    "Promoter Group A",
    "Morgan Stanley",
    "HDFC AMC",
  ];
  const types: ("FII" | "DII" | "PROMOTER" | "HNI")[] = [
    "FII",
    "DII",
    "PROMOTER",
    "HNI",
  ];

  const rand = seededRandom(42);
  const deals: WhaleDeal[] = [];
  for (let i = 0; i < 50; i++) {
    const isBuy = rand() > 0.4;
    const qty = Math.floor(rand() * 5000000) + 100000;
    const price = Math.floor(rand() * 3000) + 100;
    deals.push({
      id: `deal-${i}`,
      date: new Date(Date.now() - Math.floor(rand() * 10) * 86400000)
        .toISOString()
        .split("T")[0],
      symbol: symbols[Math.floor(rand() * symbols.length)],
      clientName: clients[Math.floor(rand() * clients.length)],
      clientType: types[Math.floor(rand() * types.length)],
      dealType: isBuy ? "BUY" : "SELL",
      quantity: qty,
      price: price,
      valueCr: (qty * price) / 10000000,
    });
  }
  const sorted = deals.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  sessionStorage.setItem("whale_deals", JSON.stringify(sorted));
  return sorted;
};

export function WhaleTrackerPage() {
  const [deals, setDeals] = useState<WhaleDeal[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterType, setFilterType] = useState<
    "ALL" | "FII" | "DII" | "PROMOTER"
  >("ALL");
  const [filterDeal, setFilterDeal] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    // Simulate API fetch
    const timer = setTimeout(() => {
      setDeals(generateMockDeals());
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const filteredDeals = deals.filter((deal) => {
    if (filterType !== "ALL" && deal.clientType !== filterType) return false;
    if (filterDeal !== "ALL" && deal.dealType !== filterDeal) return false;
    if (
      search &&
      !deal.symbol.toLowerCase().includes(search.toLowerCase()) &&
      !deal.clientName.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const filterBtn = (active: boolean) =>
    `px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
      active
        ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md"
        : "bg-bg-tertiary border border-border text-text-secondary hover:text-text-primary"
    }`;

  const formatCr = (val: number) => `₹${val.toFixed(2)} Cr`;
  const formatQty = (val: number) => new Intl.NumberFormat("en-IN").format(val);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/20">
              <Anchor className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
              Institutional & Whale Tracker
            </h1>
          </div>
          <p className="text-text-secondary mt-1.5 text-sm">
            Monitor bulk, block deals, and insider buying/selling activities in
            real-time.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="surface p-5 rounded-2xl border border-border space-y-4">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex gap-4 flex-wrap">
            {/* Client Type Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-text-tertiary flex items-center gap-1">
                <Filter className="w-3 h-3" /> Entity
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className={filterBtn(filterType === "ALL")}
                  onClick={() => setFilterType("ALL")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={filterBtn(filterType === "FII")}
                  onClick={() => setFilterType("FII")}
                >
                  FII
                </button>
                <button
                  type="button"
                  className={filterBtn(filterType === "DII")}
                  onClick={() => setFilterType("DII")}
                >
                  DII
                </button>
                <button
                  type="button"
                  className={filterBtn(filterType === "PROMOTER")}
                  onClick={() => setFilterType("PROMOTER")}
                >
                  Promoter
                </button>
              </div>
            </div>

            {/* Deal Type Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                Action
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className={filterBtn(filterDeal === "ALL")}
                  onClick={() => setFilterDeal("ALL")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={filterBtn(filterDeal === "BUY")}
                  onClick={() => setFilterDeal("BUY")}
                >
                  Buys
                </button>
                <button
                  type="button"
                  className={filterBtn(filterDeal === "SELL")}
                  onClick={() => setFilterDeal("SELL")}
                >
                  Sells
                </button>
              </div>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search symbol or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-bg-tertiary border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-text-primary"
            />
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="surface overflow-hidden border border-border rounded-2xl">
        <div className="p-4 border-b border-border bg-bg-secondary flex justify-between items-center text-xs font-bold">
          <span>Found Deals: {filteredDeals.length}</span>
          <span className="flex items-center gap-1 text-amber-500">
            <ShieldAlert className="w-3.5 h-3.5" /> Showing simulated data
          </span>
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
                  <th className="p-3">Date</th>
                  <th className="p-3">Symbol</th>
                  <th className="p-3">Client Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Action</th>
                  <th className="p-3 text-right">Quantity</th>
                  <th className="p-3 text-right">Price</th>
                  <th className="p-3 text-right">Value (Cr)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-medium">
                {filteredDeals.map((deal) => {
                  const isBuy = deal.dealType === "BUY";
                  const ticker = deal.symbol.replace("-EQ", "");
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

                  return (
                    <tr
                      key={deal.id}
                      className="hover:bg-bg-tertiary/70 transition-colors group"
                    >
                      <td className="p-3 text-text-secondary">{deal.date}</td>
                      <td className="p-3 font-extrabold text-text-primary flex items-center gap-2.5">
                        <div
                          className={`w-6 h-6 rounded-md bg-gradient-to-br ${avatarGradient} text-white font-bold text-[9px] flex items-center justify-center shadow-sm shrink-0 uppercase tracking-tight`}
                        >
                          {ticker.slice(0, 2)}
                        </div>
                        <span className="group-hover:text-blue-400 transition-colors">
                          {ticker}
                        </span>
                      </td>
                      <td
                        className="p-3 font-semibold truncate max-w-[150px]"
                        title={deal.clientName}
                      >
                        {deal.clientName}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            deal.clientType === "FII"
                              ? "bg-purple-500/15 text-purple-400"
                              : deal.clientType === "DII"
                                ? "bg-blue-500/15 text-blue-400"
                                : deal.clientType === "PROMOTER"
                                  ? "bg-amber-500/15 text-amber-400"
                                  : "bg-slate-500/15 text-slate-400"
                          }`}
                        >
                          {deal.clientType}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            isBuy
                              ? "bg-emerald-500/15 text-emerald-500"
                              : "bg-red-500/15 text-red-500"
                          }`}
                        >
                          {deal.dealType}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        {formatQty(deal.quantity)}
                      </td>
                      <td className="p-3 text-right font-mono">
                        ₹{deal.price.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-text-primary">
                        {formatCr(deal.valueCr)}
                      </td>
                    </tr>
                  );
                })}
                {filteredDeals.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-8 text-center text-text-tertiary"
                    >
                      No deals found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
