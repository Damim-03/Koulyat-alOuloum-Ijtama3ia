import { useId } from "react";

/** A progress arc; `light` for the cream cards, dark ground otherwise. */
export function Ring({
  percent,
  size,
  light,
  alarm,
}: {
  percent: number;
  size: number;
  light?: boolean;
  alarm?: boolean;
}) {
  const gid = useId();
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={alarm ? "#e07a5f" : "#e6c496"} />
            <stop offset="100%" stopColor={alarm ? "#a8442d" : "#c1965a"} />
          </linearGradient>
        </defs>
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="7"
          className={light ? "stroke-forest/10" : "stroke-white/10"}
        />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percent / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      {light && (
        <span className="absolute font-serif text-sm font-bold text-forest tabular-nums">
          {percent}%
        </span>
      )}
    </span>
  );
}
