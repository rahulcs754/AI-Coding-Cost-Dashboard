import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BreakdownList, Card, DashboardSkeleton } from "@/components/ui";
import { formatDate, formatTokens, formatUsd, repoHref } from "@/lib/format";
import { getPrSessions, getPrTitle, type Breakdown, type SessionRow } from "@/lib/queries";

type Props = PageProps<"/repos/[owner]/[name]/pulls/[number]">;

export default function PrPage({ params }: Props) {
  return (
    <div className="space-y-4">
      <Suspense fallback={<DashboardSkeleton />}>
        <PrDashboard params={params} />
      </Suspense>
    </div>
  );
}

function groupBy(rows: SessionRow[], key: "author" | "model" | "tool"): Breakdown[] {
  const map = new Map<string, { cost: number; tokens: number }>();
  for (const r of rows) {
    const cur = map.get(r[key]) ?? { cost: 0, tokens: 0 };
    map.set(r[key], { cost: cur.cost + r.cost, tokens: cur.tokens + r.tokens });
  }
  const total = rows.reduce((s, r) => s + r.cost, 0) || 1;
  return [...map].map(([k, v]) => ({ key: k, ...v, share: v.cost / total })).sort((a, b) => b.cost - a.cost);
}

async function PrDashboard({ params }: Pick<Props, "params">) {
  const { owner, name, number } = await params;
  const repo = `${owner}/${name}`;
  const pr = Number(number);
  if (!Number.isInteger(pr) || pr <= 0) notFound();
  const [sessions, title] = await Promise.all([getPrSessions(repo, pr), getPrTitle(repo, pr)]);
  if (sessions.length === 0) notFound();

  const cost = sessions.reduce((s, r) => s + r.cost, 0);
  const tokens = sessions.reduce((s, r) => s + r.tokens, 0);

  return (
    <>
      <Link href={repoHref(repo)} className="text-sm text-muted hover:underline">← {repo}</Link>
      <div>
        <h1 className="text-xl font-semibold">
          <span className="text-muted">#{pr}</span> {title ?? "Untitled PR"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {formatUsd(cost)} across {sessions.length} sessions · {formatTokens(tokens)} tokens
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="By author"><BreakdownList rows={groupBy(sessions, "author")} /></Card>
        <Card title="By model"><BreakdownList rows={groupBy(sessions, "model")} /></Card>
        <Card title="By tool"><BreakdownList rows={groupBy(sessions, "tool")} /></Card>
      </div>
      <Card title="Sessions">
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Author</th>
                <th className="py-2 pr-3 font-medium">Tool</th>
                <th className="py-2 pr-3 font-medium">Model</th>
                <th className="py-2 pr-3 text-right font-medium">Tokens</th>
                <th className="py-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={`${s.sessionId ?? i}-${s.model}`} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3 text-muted">{formatDate(s.ts)}</td>
                  <td className="py-2 pr-3">{s.author}</td>
                  <td className="py-2 pr-3">{s.tool}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{s.model}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatTokens(s.tokens)}</td>
                  <td className="py-2 text-right font-medium tabular-nums">{formatUsd(s.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
