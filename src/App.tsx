import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, Navigate } from "react-router-dom";
import {
  Activity,
  Gauge,
  Filter,
  Target,
  LineChart,
  Moon,
  Sun,
} from "lucide-react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DataBadge } from "./components/common/DataBadge";

import { MarketPulsePage } from "./pages/MarketPulsePage";
import { LiveMarketPage } from "./pages/LiveMarketPage";
import { ScreenerPage } from "./pages/ScreenerPage";
import { DerivativesPage } from "./pages/DerivativesPage";
import { ChartWorkspacePage } from "./pages/ChartWorkspacePage";
import { WhaleTrackerPage } from "./pages/WhaleTrackerPage";

function Logo() {
  return (
    <Link to="/pulse" className="flex items-center gap-2.5 group">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/25 transition-transform group-hover:scale-105">
        <Activity className="h-5 w-5" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-xl font-extrabold tracking-tight text-text-primary">
          TickRadar
        </span>
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-tertiary">
          v2.0 Quantitative Platform
        </span>
      </span>
    </Link>
  );
}

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });
  const [dataSource, setDataSource] = useState<"SAMPLE" | "FYERS" | "ANGEL">(
    "SAMPLE",
  );

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    fetch("/api/status/data-source")
      .then((res) => res.json())
      .then((data) => {
        if (data.source) setDataSource(data.source);
      })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 cursor-pointer ${
      isActive
        ? "bg-gradient-to-r from-indigo-500/15 to-fuchsia-500/10 text-text-primary shadow-sm ring-1 ring-inset ring-indigo-500/25"
        : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
    }`;

  return (
    <div className="min-h-screen bg-bg-secondary text-text-primary flex font-sans transition-colors duration-200">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col bg-bg-primary/80 backdrop-blur-xl border-r border-border pt-6 px-4">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-8 space-y-1.5">
          <NavLink to="/pulse" className={navLinkClass}>
            <Gauge className="w-4 h-4 shrink-0 text-emerald-400" />
            Market Pulse
          </NavLink>
          <NavLink to="/live" className={navLinkClass}>
            <Activity className="w-4 h-4 shrink-0 text-indigo-400" />
            Live Movers
          </NavLink>
          <NavLink to="/screener" className={navLinkClass}>
            <Filter className="w-4 h-4 shrink-0 text-purple-400" />
            Quant Screener
          </NavLink>
          <NavLink to="/derivatives" className={navLinkClass}>
            <Target className="w-4 h-4 shrink-0 text-amber-400" />
            F&O Intelligence
          </NavLink>
          <NavLink to="/whales" className={navLinkClass}>
            <Activity className="w-4 h-4 shrink-0 text-blue-400" />
            Whale Tracker
          </NavLink>
          <NavLink to="/charts" className={navLinkClass}>
            <LineChart className="w-4 h-4 shrink-0 text-cyan-400" />
            Chart Workspace
          </NavLink>
        </nav>
        <div className="mt-auto pb-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <DataBadge source={dataSource} size="sm" />
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* Mobile / tablet top bar */}
        <header className="lg:hidden sticky top-0 z-30 backdrop-blur-xl bg-bg-primary/80 border-b border-border px-4 py-3 flex items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-2">
            <DataBadge source={dataSource} size="sm" />
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Strip */}
        <div className="lg:hidden flex overflow-x-auto border-b border-border bg-bg-primary px-3 py-2 gap-2 text-xs font-bold scrollbar-none">
          <NavLink
            to="/pulse"
            className="whitespace-nowrap px-3 py-1.5 rounded-lg bg-bg-tertiary"
          >
            📊 Pulse
          </NavLink>
          <NavLink
            to="/live"
            className="whitespace-nowrap px-3 py-1.5 rounded-lg bg-bg-tertiary"
          >
            ⚡ Live
          </NavLink>
          <NavLink
            to="/screener"
            className="whitespace-nowrap px-3 py-1.5 rounded-lg bg-bg-tertiary"
          >
            🔍 Screener
          </NavLink>
          <NavLink
            to="/whales"
            className="whitespace-nowrap px-3 py-1.5 rounded-lg bg-bg-tertiary"
          >
            🐋 Whales
          </NavLink>
          <NavLink
            to="/derivatives"
            className="whitespace-nowrap px-3 py-1.5 rounded-lg bg-bg-tertiary"
          >
            🎯 F&O
          </NavLink>
          <NavLink
            to="/charts"
            className="whitespace-nowrap px-3 py-1.5 rounded-lg bg-bg-tertiary"
          >
            📈 Charts
          </NavLink>
        </div>

        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-start min-w-0">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Navigate to="/pulse" replace />} />
              <Route path="/pulse" element={<MarketPulsePage />} />
              <Route path="/live" element={<LiveMarketPage />} />
              <Route path="/screener" element={<ScreenerPage />} />
              <Route path="/whales" element={<WhaleTrackerPage />} />
              <Route path="/derivatives" element={<DerivativesPage />} />
              <Route path="/charts" element={<ChartWorkspacePage />} />
              <Route path="*" element={<Navigate to="/pulse" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>

        <footer className="border-t border-border py-4 px-6 text-center">
          <p className="text-xs text-text-tertiary">
            TickRadar v2.0 — real-time NSE market scanning platform. Educational
            purposes only.
          </p>
        </footer>
      </div>
    </div>
  );
}
