import Link from "next/link";
import type { ReactNode } from "react";
import { delta, formatPct, formatTokens, formatUsd } from "@/lib/format";
import { RANGES, type Breakdown, type Range, type Totals } from "@/lib/queries";

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-surface p-4 ${className}`}>
      {title && <h2 className="mb-3 text-sm font-medium text-muted">{title}</h2>}
      {children}
    </section>
  );
}

export function RangeTabs({ current, basePath }: { current: Range; basePath: string }) {
  return (
    <nav aria-label="Date range" className="flex w-fit gap-1 rounded-lg border border-border bg-surface p-1 text-sm">
      {RANGES.map((r) => (
        <Link
          key={r}
          href={`${basePath}?days=${r}`}
          aria-current={r === current ? "page" : undefined}
          className={`rounded-md px-3 py-1 ${r === current ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}
        >
          {r}d
        </Link>
      ))}
    </nav>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

export function KpiRow({ totals, days }: { totals: Totals; days: number }) {
  const d = delta(totals.cost, totals.prevCost);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        label={`Spend (${days}d)`}
        value={formatUsd(totals.cost)}
        sub={d ? <span className={d.up ? "text-up" : "text-down"}>{d.label} vs previous {days}d</span> : "No previous data"}
      />
      <Stat label="Tokens" value={formatTokens(totals.tokens)} sub={`${totals.events.toLocaleString()} sessions logged`} />
      <Stat label="PRs with AI spend" value={totals.prs.toLocaleString()} sub={`${totals.authors} authors`} />
      <Stat label="Avg cost per PR" value={totals.prs ? formatUsd(totals.cost / totals.prs) : "—"} />
    </div>
  );
}

export function BreakdownList({ rows, hrefFor }: { rows: Breakdown[]; hrefFor?: (key: string) => string }) {
  if (rows.length === 0) return <p className="text-sm text-muted">No data in this range.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            {hrefFor ? (
              <Link href={hrefFor(r.key)} className="truncate font-medium hover:underline">{r.key}</Link>
            ) : (
              <span className="truncate font-medium">{r.key}</span>
            )}
            <span className="shrink-0 tabular-nums">
              {formatUsd(r.cost)} <span className="text-muted">· {formatPct(r.share)}</span>
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-accent-soft">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(r.share * 100, 1)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl border border-border bg-surface ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-64" />
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)}
      </div>
    </div>
  );
}
