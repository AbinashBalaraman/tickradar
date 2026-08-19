import { Sparkles } from "lucide-react";

export interface PresetConfig {
  id: string;
  label: string;
  universe: string;
  timeframe: string;
  tierId: string;
  circuit: "none" | "upper" | "lower";
  sortBy: "percent" | "value";
}

export const PRESETS: PresetConfig[] = [
  {
    id: "penny_surge",
    label: "⚡ Penny Surge (<₹50)",
    universe: "all",
    timeframe: "daily",
    tierId: "penny",
    circuit: "none",
    sortBy: "percent",
  },
  {
    id: "fno_circuits",
    label: "🚨 F&O Circuits",
    universe: "fno",
    timeframe: "daily",
    tierId: "all",
    circuit: "upper",
    sortBy: "percent",
  },
  {
    id: "heavyweight_movers",
    label: "👑 Heavyweights (>₹5K)",
    universe: "all",
    timeframe: "daily",
    tierId: "heavy",
    circuit: "none",
    sortBy: "percent",
  },
  {
    id: "intraday_5m",
    label: "⏱ Intraday 5m Surge",
    universe: "all",
    timeframe: "5m",
    tierId: "all",
    circuit: "none",
    sortBy: "percent",
  },
  {
    id: "bank_nifty_movers",
    label: "🏦 Bank Nifty Focus",
    universe: "banknifty",
    timeframe: "daily",
    tierId: "all",
    circuit: "none",
    sortBy: "percent",
  },
];

interface PresetFiltersProps {
  activePresetId: string | null;
  onSelectPreset: (preset: PresetConfig) => void;
}

export function PresetFilters({
  activePresetId,
  onSelectPreset,
}: PresetFiltersProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      <div className="flex items-center gap-1.5 text-xs font-bold text-text-tertiary shrink-0 mr-1">
        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
        <span>Quick Presets:</span>
      </div>
      {PRESETS.map((preset) => {
        const isActive = activePresetId === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelectPreset(preset)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer border ${
              isActive
                ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/25 scale-105"
                : "bg-bg-tertiary text-text-secondary hover:text-text-primary border-border hover:border-indigo-500/30"
            }`}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
