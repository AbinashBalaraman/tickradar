interface DataBadgeProps {
  source: "SAMPLE" | "LIVE" | "FYERS" | "ANGEL";
  size?: "sm" | "md";
}

export function DataBadge({ source, size = "sm" }: DataBadgeProps) {
  let label = "";
  let colorClasses = "";
  let icon: React.ReactNode = null;

  const sizeClasses =
    size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1 text-xs";
  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";

  switch (source) {
    case "SAMPLE":
      label = "Sample Data";
      colorClasses = "bg-bg-tertiary text-text-secondary border-border";
      icon = (
        <svg
          className={iconSize}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
          />
        </svg>
      );
      break;
    case "LIVE":
      label = "Live Data";
      colorClasses =
        "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25";
      icon = (
        <svg
          className={iconSize}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
        </svg>
      );
      break;
    case "FYERS":
      label = "FYERS Live";
      colorClasses =
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25";
      icon = (
        <svg
          className={iconSize}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          />
        </svg>
      );
      break;
    case "ANGEL":
      label = "Angel One";
      colorClasses =
        "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/25";
      icon = (
        <svg
          className={iconSize}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      );
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-full border shadow-sm select-none ${colorClasses} ${sizeClasses}`}
    >
      {icon}
      {label}
    </span>
  );
}
