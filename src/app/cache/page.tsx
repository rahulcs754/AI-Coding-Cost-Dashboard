import Link from "next/link";
import { Suspense } from "react";
import { Card, DashboardSkeleton, RangeTabs } from "@/components/ui";
import { ALL_CAUSES, CACHE_TTL_MINUTES, diagnose, hitRate } from "@/lib/cache";
import { formatDate, formatPct, formatUsd, prHref, userHref } from "@/lib/format";
import { getCacheReport, parseRange, type CacheBreakdown } from "@/lib/queries";

export default function CachePage({ searchParams }: PageProps<"/cache">) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Prompt cache</h1>
        <p className="text-sm text-muted">How much of each prompt came from cache, what that saved, and what broke it.</p>
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <CacheReport searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : ""}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

function HitBar({ rate }: { rate: number }) {
  const color = rate >= 0.8 ? "bg-accent" : rate >= 0.5 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="mt-1 h-1.5 rounded-full bg-accent-soft" role="img" aria-label={`${formatPct(rate)} hit rate`}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(rate * 100, 1)}%` }} />
    </div>
  );
}

function HitList({ rows, hrefFor }: { rows: CacheBreakdown[]; hrefFor?: (key: string) => string }) {
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
              {formatPct(r.hitRate)} hit
              {r.lost >= 0.01 && <span className="text-muted"> · {formatUsd(r.lost)} lost</span>}
            </span>
          </div>
          <HitBar rate={r.hitRate} />
        </li>
      ))}
    </ul>
  );
}

async function CacheReport({ searchParams }: Pick<PageProps<"/cache">, "searchParams">) {
  const days = parseRange((await searchParams).days);
  const { totals, byModel, byTool, byAuthor, causes, worst } = await getCacheReport(days);

  return (
    <>
      <RangeTabs current={days} basePath="/cache" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cache hit rate" value={formatPct(totals.hitRate)} sub="Prompt tokens read from cache" tone={totals.hitRate >= 0.8 ? "down" : "up"} />
        <Stat label="Saved by cache" value={formatUsd(totals.saved)} sub="vs. paying full input price" tone="down" />
        <Stat label="Lost to cache breaks" value={formatUsd(totals.lost)} sub="Estimate: cache rebuilt instead of read" tone={totals.lost > 0 ? "up" : undefined} />
        <Stat
          label="Sessions with a broken cache"
          value={`${totals.brokenSessions} / ${totals.sessions}`}
          sub={`${totals.rebuilds} rebuilds, ${totals.idleRebuilds} after idle`}
        />
      </div>

      <Card title="What broke your cache">
        {causes.length === 0 ? (
          <p className="text-sm text-muted">Nothing. Every session in this range read most of its prompt from cache.</p>
        ) : (
          <ul className="divide-y divide-border">
            {causes.map(({ cause, sessions, lost }) => (
              <li key={cause.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-4">
                <div className="sm:w-48 sm:shrink-0">
                  <p className="font-medium">{cause.label}</p>
                  <p className="text-xs text-muted tabular-nums">
                    {sessions} session{sessions === 1 ? "" : "s"} · {formatUsd(lost)} lost
                  </p>
                </div>
                <p className="text-sm text-muted">{cause.fix}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="By model">
          <HitList rows={byModel} />
        </Card>
        <Card title="By tool">
          <HitList rows={byTool} />
        </Card>
        <Card title="By user">
          <HitList rows={byAuthor} hrefFor={userHref} />
        </Card>
      </div>

      <Card title="Sessions that lost the most">
        {worst.length === 0 ? (
          <p className="text-sm text-muted">No broken sessions in this range.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">Session</th>
                  <th className="py-2 pr-3 font-medium">PR</th>
                  <th className="py-2 pr-3 font-medium">Model</th>
                  <th className="py-2 pr-3 text-right font-medium">Hit rate</th>
                  <th className="py-2 pr-3 text-right font-medium">Rebuilds</th>
                  <th className="py-2 pr-3 font-medium">Why</th>
                  <th className="py-2 text-right font-medium">Lost</th>
                </tr>
              </thead>
              <tbody>
                {worst.map((s, i) => (
                  <tr key={s.sessionId ?? i} className="border-b border-border align-top last:border-0">
                    <td className="py-2 pr-3">
                      <Link href={userHref(s.author)} className="font-medium hover:underline">{s.author}</Link>
                      <p className="text-xs text-muted">{formatDate(s.ts)} · {s.tool}</p>
                    </td>
                    <td className="py-2 pr-3">
                      {s.pr != null ? (
                        <Link href={prHref(s.repo, s.pr)} className="hover:underline">{s.repo}#{s.pr}</Link>
                      ) : (
                        <span className="text-muted">{s.repo}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs">{s.models.split(",").join(" → ")}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatPct(hitRate(s))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{s.cacheRebuilds}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {diagnose(s).map((c) => (
                          <span key={c.id} title={c.fix} className="rounded-md bg-accent-soft px-1.5 py-0.5 text-xs">{c.label}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums">{formatUsd(s.lost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="How this is measured">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Hit rate = cache read tokens ÷ all prompt tokens (input + cache write + cache read). Cached tokens cost about a tenth of normal input.</li>
          <li>Lost = cache written beyond about 10% of the prompt, priced as write minus read. A healthy session writes its prefix once, then reads it.</li>
          <li>Rebuilds come from <code>scripts/report-usage.mjs</code>: a later call that wrote its prompt to cache instead of reading it. After {CACHE_TTL_MINUTES}+ minutes idle it counts as an idle rebuild.</li>
          <li>Causes: {ALL_CAUSES.map((c) => c.label.toLowerCase()).join(", ")}.</li>
        </ul>
      </Card>
    </>
  );
}
