interface RowSparklineProps {
  points?: number[];
  isGain: boolean;
}

export function RowSparkline({ points = [], isGain }: RowSparklineProps) {
  if (!points || points.length < 2) return null;

  const width = 64;
  const height = 20;
  const minP = Math.min(...points);
  const maxP = Math.max(...points);
  const range = maxP - minP || 1;

  const polyPoints = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - minP) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const strokeColor = isGain ? "#10b981" : "#ef4444";

  return (
    <div className="w-16 h-5 flex items-center justify-center shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polyPoints}
        />
      </svg>
    </div>
  );
}
