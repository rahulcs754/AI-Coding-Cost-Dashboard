import { formatDate, formatUsd } from "@/lib/format";
import type { DailyPoint } from "@/lib/queries";

// Daily spend as plain div bars: responsive, themeable, and no client JS.
export function SpendChart({ data }: { data: DailyPoint[] }) {
  const max = Math.max(...data.map((d) => d.cost), 0.01);
  const ticks = [0, Math.floor((data.length - 1) / 2), data.length - 1];
  return (
    <figure>
      <div className="flex items-start gap-2">
        <div className="flex h-48 flex-col justify-between text-right text-xs text-muted tabular-nums">
          <span>{formatUsd(max)}</span>
          <span>{formatUsd(max / 2)}</span>
          <span>$0</span>
        </div>
        <div
          className="flex h-48 flex-1 items-end gap-px border-b border-l border-border"
          role="img"
          aria-label={`Daily spend over ${data.length} days, peak ${formatUsd(max)}`}
        >
          {data.map((d) => (
            <div
              key={d.day}
              title={`${formatDate(d.day)}: ${formatUsd(d.cost)}`}
              className="flex-1 rounded-t-sm bg-accent/80 hover:bg-accent"
              style={{ height: `${(d.cost / max) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <figcaption className="mt-1 flex justify-between pl-14 text-xs text-muted">
        {ticks.map((i) => <span key={i}>{data[i] && formatDate(data[i].day)}</span>)}
      </figcaption>
    </figure>
  );
}
