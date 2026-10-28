import Link from "next/link";
import { Suspense } from "react";
import { PrTable } from "@/components/pr-table";
import { SpendChart } from "@/components/spend-chart";
import { BreakdownList, Card, DashboardSkeleton, KpiRow, RangeTabs } from "@/components/ui";
import { repoHref } from "@/lib/format";
import { getBreakdown, getDaily, getPrs, getTotals, parseRange } from "@/lib/queries";

type Props = PageProps<"/repos/[owner]/[name]">;

export default function RepoPage({ params, searchParams }: Props) {
  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-muted hover:underline">← Overview</Link>
      <Suspense fallback={<DashboardSkeleton />}>
        <RepoDashboard params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function RepoDashboard({ params, searchParams }: Props) {
  const { owner, name } = await params;
  const repo = `${owner}/${name}`;
  const days = parseRange((await searchParams).days);
  const scope = { repo };
  const [totals, daily, authors, models, prs] = await Promise.all([
    getTotals(days, scope),
    getDaily(days, scope),
    getBreakdown("author", days, scope),
    getBreakdown("model", days, scope),
    getPrs(days, scope),
  ]);

  return (
    <>
      <h1 className="text-xl font-semibold">{repo}</h1>
      <RangeTabs current={days} basePath={repoHref(repo)} />
      <KpiRow totals={totals} days={days} />
      <Card title="Daily spend">
        <SpendChart data={daily} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="By author">
          <BreakdownList rows={authors} />
        </Card>
        <Card title="By model">
          <BreakdownList rows={models} />
        </Card>
      </div>
      <Card title="Pull requests">
        <PrTable rows={prs} showRepo={false} />
      </Card>
    </>
  );
}
