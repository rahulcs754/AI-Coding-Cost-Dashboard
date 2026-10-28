import Link from "next/link";
import { Suspense } from "react";
import { PrTable } from "@/components/pr-table";
import { SpendChart } from "@/components/spend-chart";
import { BreakdownList, Card, DashboardSkeleton, KpiRow, RangeTabs } from "@/components/ui";
import { repoHref, userHref } from "@/lib/format";
import { getBreakdown, getDaily, getPrs, getTotals, parseRange } from "@/lib/queries";

type Props = PageProps<"/users/[author]">;

export default function UserPage({ params, searchParams }: Props) {
  return (
    <div className="space-y-4">
      <Link href="/users" className="text-sm text-muted hover:underline">← Users</Link>
      <Suspense fallback={<DashboardSkeleton />}>
        <UserDashboard params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function UserDashboard({ params, searchParams }: Props) {
  const author = decodeURIComponent((await params).author);
  const days = parseRange((await searchParams).days);
  const scope = { author };
  const [totals, daily, tools, models, repos, prs] = await Promise.all([
    getTotals(days, scope),
    getDaily(days, scope),
    getBreakdown("tool", days, scope),
    getBreakdown("model", days, scope),
    getBreakdown("repo", days, scope),
    getPrs(days, scope),
  ]);

  return (
    <>
      <h1 className="text-xl font-semibold">{author}</h1>
      <RangeTabs current={days} basePath={userHref(author)} />
      <KpiRow totals={totals} days={days} />
      <Card title="Daily spend">
        <SpendChart data={daily} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Agents used"><BreakdownList rows={tools} /></Card>
        <Card title="Models"><BreakdownList rows={models} /></Card>
        <Card title="Repos"><BreakdownList rows={repos} hrefFor={repoHref} /></Card>
      </div>
      <Card title="Pull requests (this user's spend)">
        <PrTable rows={prs} />
      </Card>
    </>
  );
}
