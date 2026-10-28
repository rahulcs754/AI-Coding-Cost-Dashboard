import { Suspense } from "react";
import { PrTable } from "@/components/pr-table";
import { SpendChart } from "@/components/spend-chart";
import { BreakdownList, Card, DashboardSkeleton, KpiRow, RangeTabs } from "@/components/ui";
import { repoHref } from "@/lib/format";
import { getBreakdown, getDaily, getPrs, getTotals, parseRange } from "@/lib/queries";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Team overview</h1>
      <Suspense fallback={<DashboardSkeleton />}>
        <Overview searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Overview({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const days = parseRange((await searchParams).days);
  const [totals, daily, repos, models, tools, prs] = await Promise.all([
    getTotals(days),
    getDaily(days),
    getBreakdown("repo", days),
    getBreakdown("model", days),
    getBreakdown("tool", days),
    getPrs(days, {}, 10),
  ]);

  return (
    <>
      <RangeTabs current={days} basePath="/" />
      <KpiRow totals={totals} days={days} />
      <Card title="Daily spend">
        <SpendChart data={daily} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="By repo">
          <BreakdownList rows={repos} hrefFor={repoHref} />
        </Card>
        <Card title="By model">
          <BreakdownList rows={models} />
        </Card>
        <Card title="By tool">
          <BreakdownList rows={tools} />
        </Card>
      </div>
      <Card title="Most expensive PRs">
        <PrTable rows={prs} />
      </Card>
    </>
  );
}
