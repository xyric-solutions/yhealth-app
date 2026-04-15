"use client";

export type FilterPeriod =
  | { mode: "all_time" }
  | { mode: "year"; year: number }
  | { mode: "month"; year: number; month: number };

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Props {
  filter: FilterPeriod;
  onFilterChange: (filter: FilterPeriod) => void;
}

function getLabel(filter: FilterPeriod): string {
  if (filter.mode === "all_time") return "All Time";
  if (filter.mode === "year") return String(filter.year);
  return `${MONTH_NAMES[filter.month]} ${filter.year}`;
}

function navigatePrev(filter: FilterPeriod): FilterPeriod {
  if (filter.mode === "month") {
    const m = filter.month - 1;
    if (m < 0) return { mode: "month", year: filter.year - 1, month: 11 };
    return { mode: "month", year: filter.year, month: m };
  }
  if (filter.mode === "year") return { mode: "year", year: filter.year - 1 };
  return filter;
}

function navigateNext(filter: FilterPeriod): FilterPeriod {
  if (filter.mode === "month") {
    const m = filter.month + 1;
    if (m > 11) return { mode: "month", year: filter.year + 1, month: 0 };
    return { mode: "month", year: filter.year, month: m };
  }
  if (filter.mode === "year") return { mode: "year", year: filter.year + 1 };
  return filter;
}

export function ObservatoryFilterBar({ filter, onFilterChange }: Props) {
  const modes = ["month", "year", "all_time"] as const;
  const modeLabels = { month: "MONTH", year: "YEAR", all_time: "ALL TIME" };

  const switchMode = (mode: "month" | "year" | "all_time") => {
    if (mode === "all_time") {
      onFilterChange({ mode: "all_time" });
    } else if (mode === "year") {
      const y = filter.mode !== "all_time" && "year" in filter ? filter.year : new Date().getFullYear();
      onFilterChange({ mode: "year", year: y });
    } else {
      const now = new Date();
      const y = filter.mode !== "all_time" && "year" in filter ? filter.year : now.getFullYear();
      const m = filter.mode === "month" ? filter.month : now.getMonth();
      onFilterChange({ mode: "month", year: y, month: m });
    }
  };

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3"
      style={{ top: 72, zIndex: 30 }}
    >
      {/* Mode pills */}
      <div
        className="flex rounded-full overflow-hidden"
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
        }}
      >
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`observatory-font-display px-4 py-2 transition-all duration-200 ${
              filter.mode === m
                ? "text-purple-100"
                : "text-white/30 hover:text-white/50 hover:bg-white/5"
            }`}
            style={{
              fontSize: 10,
              letterSpacing: "0.15em",
              ...(filter.mode === m
                ? {
                    background: "linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(99, 102, 241, 0.2) 100%)",
                  }
                : {}),
            }}
          >
            {modeLabels[m]}
          </button>
        ))}
      </div>

      {/* Period navigator */}
      {filter.mode !== "all_time" && (
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <button
            onClick={() => onFilterChange(navigatePrev(filter))}
            className="text-white/40 hover:text-white/70 transition-colors px-1.5 py-0.5 rounded hover:bg-white/5"
            style={{ fontSize: 16 }}
          >
            &lsaquo;
          </button>
          <span
            className="observatory-font-display text-white/70 min-w-[120px] text-center"
            style={{ fontSize: 12, letterSpacing: "0.12em" }}
          >
            {getLabel(filter)}
          </span>
          <button
            onClick={() => onFilterChange(navigateNext(filter))}
            className="text-white/40 hover:text-white/70 transition-colors px-1.5 py-0.5 rounded hover:bg-white/5"
            style={{ fontSize: 16 }}
          >
            &rsaquo;
          </button>
        </div>
      )}
    </div>
  );
}
