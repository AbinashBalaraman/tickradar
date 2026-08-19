export interface FnoBuildupItem {
  symbol: string;
  ltp: number;
  chp: number;
  oi: number;
  oiChangePct: number;
  buildupType:
    "LONG_BUILDUP" | "SHORT_BUILDUP" | "SHORT_COVERING" | "LONG_UNWINDING";
  pcr?: number;
}

export function classifyBuildup(
  chp: number,
  oiChangePct: number,
): FnoBuildupItem["buildupType"] {
  if (chp >= 0 && oiChangePct >= 0) return "LONG_BUILDUP";
  if (chp < 0 && oiChangePct >= 0) return "SHORT_BUILDUP";
  if (chp >= 0 && oiChangePct < 0) return "SHORT_COVERING";
  return "LONG_UNWINDING";
}

export function computeFnoIntelligence(
  stocks: Array<{ symbol: string; ltp: number; chp: number; close: number }>,
) {
  const fnoList: FnoBuildupItem[] = stocks.map((s, idx) => {
    // Generate deterministic simulated OI based on symbol & market volatility for demo accuracy
    const charSum = s.symbol
      .split("")
      .reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const oiChangePct = parseFloat(
      ((charSum % 15) - 6 + s.chp * 0.4).toFixed(2),
    );
    const oi = Math.abs(charSum * 1250 + Math.round(s.ltp * 100));
    const buildupType = classifyBuildup(s.chp, oiChangePct);

    return {
      symbol: s.symbol,
      ltp: s.ltp,
      chp: s.chp,
      oi,
      oiChangePct,
      buildupType,
      pcr: parseFloat((0.8 + (charSum % 7) / 10).toFixed(2)),
    };
  });

  const longBuildup = fnoList
    .filter((x) => x.buildupType === "LONG_BUILDUP")
    .sort((a, b) => b.chp - a.chp);
  const shortBuildup = fnoList
    .filter((x) => x.buildupType === "SHORT_BUILDUP")
    .sort((a, b) => a.chp - b.chp);
  const shortCovering = fnoList
    .filter((x) => x.buildupType === "SHORT_COVERING")
    .sort((a, b) => b.chp - a.chp);
  const longUnwinding = fnoList
    .filter((x) => x.buildupType === "LONG_UNWINDING")
    .sort((a, b) => a.chp - b.chp);

  return {
    summary: {
      longBuildupCount: longBuildup.length,
      shortBuildupCount: shortBuildup.length,
      shortCoveringCount: shortCovering.length,
      longUnwindingCount: longUnwinding.length,
      overallSentiment:
        longBuildup.length + shortCovering.length >
        shortBuildup.length + longUnwinding.length
          ? "Bullish"
          : "Bearish",
    },
    longBuildup: longBuildup.slice(0, 15),
    shortBuildup: shortBuildup.slice(0, 15),
    shortCovering: shortCovering.slice(0, 15),
    longUnwinding: longUnwinding.slice(0, 15),
  };
}
